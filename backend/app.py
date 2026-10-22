import json
import os
import uuid
from pathlib import Path
from typing import Any, Optional

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

PROJECT_DIR = Path(__file__).resolve().parent
load_dotenv(PROJECT_DIR / ".env")

from answering import generate_answer
from database import database_connection, initialize_database
from ingestion import (
    create_page_chunks,
    embed_texts,
    extract_pdf_pages,
    infer_company_and_year,
)
from retrieval import legacy_document_summaries, search_documents
from verification import validate_citations, verify_answer_claims


UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "data/uploads")).expanduser().resolve()
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "100")) * 1024 * 1024
app = FastAPI(title="StatementIQ API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def serialize_document(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "filename": row["filename"],
        "company": row["company"],
        "financial_year": row["financial_year"],
        "pages": row["pages"],
        "chunks": row["chunks"],
        "status": row["status"],
        "source_type": row["source_type"],
        "error": row["error"],
        "uploaded_at": row["uploaded_at"],
    }


def sync_legacy_documents() -> None:
    legacy_root = PROJECT_DIR / "data" / "financial_pdfs"
    summaries = legacy_document_summaries()
    with database_connection() as connection:
        excluded = {
            row["filename"]
            for row in connection.execute("SELECT filename FROM excluded_documents")
        }
        for summary in summaries:
            filename = summary["filename"]
            if filename in excluded:
                continue
            company, year = infer_company_and_year(filename)
            source_path = legacy_root / filename
            existing = connection.execute(
                "SELECT id FROM documents WHERE filename = ? AND source_type = 'legacy'",
                (filename,),
            ).fetchone()
            if existing:
                connection.execute(
                    """
                    UPDATE documents SET company = ?, financial_year = ?,
                        pages = ?, chunks = ?, status = 'indexed', error = NULL,
                        source_path = ?
                    WHERE id = ?
                    """,
                    (
                        company,
                        year,
                        summary["pages"],
                        summary["chunks"],
                        str(source_path),
                        existing["id"],
                    ),
                )
            else:
                connection.execute(
                    """
                    INSERT INTO documents
                        (id, filename, company, financial_year, pages, chunks,
                         status, source_type, source_path)
                    VALUES (?, ?, ?, ?, ?, ?, 'indexed', 'legacy', ?)
                    """,
                    (
                        str(uuid.uuid4()),
                        filename,
                        company,
                        year,
                        summary["pages"],
                        summary["chunks"],
                        str(source_path),
                    ),
                )


@app.on_event("startup")
def startup() -> None:
    initialize_database()
    sync_legacy_documents()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "StatementIQ"}


@app.get("/api/documents")
def list_documents() -> dict[str, Any]:
    with database_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM documents ORDER BY uploaded_at DESC, filename COLLATE NOCASE"
        ).fetchall()
        stats = connection.execute(
            """
            SELECT COUNT(*) AS total_documents,
                   COALESCE(SUM(pages), 0) AS total_pages,
                   COALESCE(SUM(chunks), 0) AS total_chunks
            FROM documents WHERE status = 'indexed'
            """
        ).fetchone()
        recent_analyses = connection.execute(
            """
            SELECT COUNT(*) AS count FROM analyses
            WHERE created_at >= datetime('now', '-30 days')
            """
        ).fetchone()["count"]

    return {
        "documents": [serialize_document(row) for row in rows],
        "stats": {
            "total_documents": stats["total_documents"],
            "total_pages": stats["total_pages"],
            "total_chunks": stats["total_chunks"],
            "recent_analyses": recent_analyses,
        },
    }


@app.post("/api/documents/upload", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    company: Optional[str] = Form(default=None),
    financial_year: Optional[str] = Form(default=None),
) -> dict[str, Any]:
    original_name = Path((file.filename or "").replace("\\", "/")).name
    if not original_name or Path(original_name).suffix.lower() != ".pdf":
        raise HTTPException(status_code=415, detail="Please upload a PDF file.")

    document_id = str(uuid.uuid4())
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_path = UPLOAD_DIR / f"{document_id}.pdf"
    temporary_path = UPLOAD_DIR / f"{document_id}.part"

    try:
        first_bytes = await file.read(8)
        if not first_bytes.startswith(b"%PDF-"):
            raise HTTPException(status_code=415, detail="The uploaded file is not a valid PDF.")
        size = len(first_bytes)
        with temporary_path.open("wb") as target:
            target.write(first_bytes)
            while content := await file.read(1024 * 1024):
                size += len(content)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"PDF exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
                    )
                target.write(content)
        os.replace(temporary_path, stored_path)
    except HTTPException:
        temporary_path.unlink(missing_ok=True)
        raise
    except OSError as exc:
        temporary_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Could not save the uploaded PDF.") from exc
    finally:
        await file.close()

    inferred_company, inferred_year = infer_company_and_year(original_name)
    document_company = (company or inferred_company).strip() or inferred_company
    document_year = (financial_year or inferred_year or "").strip() or None
    with database_connection() as connection:
        connection.execute(
            """
            INSERT INTO documents
                (id, filename, company, financial_year, status, source_type, source_path)
            VALUES (?, ?, ?, ?, 'processing', 'upload', ?)
            """,
            (document_id, original_name, document_company, document_year, str(stored_path)),
        )

    try:
        pages = extract_pdf_pages(stored_path)
        page_chunks = create_page_chunks(pages)
        vectors = embed_texts([chunk["chunk_text"] for chunk in page_chunks])
        if not page_chunks or len(vectors) != len(page_chunks):
            raise ValueError("The PDF did not produce any searchable text.")
        dimensions = {len(vector) for vector in vectors}
        if len(dimensions) != 1 or any(
            not np.isfinite(np.asarray(vector, dtype=np.float64)).all()
            or not np.asarray(vector, dtype=np.float64).any()
            for vector in vectors
        ):
            raise RuntimeError("The embedding model returned invalid vectors.")

        with database_connection() as connection:
            connection.executemany(
                """
                INSERT INTO chunks
                    (document_id, page_number, chunk_index, chunk_text, embedding)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (
                        document_id,
                        chunk["page_number"],
                        chunk["chunk_index"],
                        chunk["chunk_text"],
                        json.dumps(vector),
                    )
                    for chunk, vector in zip(page_chunks, vectors)
                ],
            )
            connection.execute(
                """
                UPDATE documents SET pages = ?, chunks = ?, status = 'indexed', error = NULL
                WHERE id = ?
                """,
                (len(pages), len(page_chunks), document_id),
            )
            row = connection.execute(
                "SELECT * FROM documents WHERE id = ?", (document_id,)
            ).fetchone()
        return serialize_document(row)
    except Exception as exc:
        with database_connection() as connection:
            connection.execute(
                "UPDATE documents SET status = 'failed', error = ? WHERE id = ?",
                (str(exc), document_id),
            )
        status_code = 503 if isinstance(exc, RuntimeError) else 422
        raise HTTPException(
            status_code=status_code,
            detail={"message": str(exc), "document_id": document_id},
        ) from exc


@app.get("/api/documents/{document_id}")
def get_document(document_id: str) -> dict[str, Any]:
    with database_connection() as connection:
        row = connection.execute(
            "SELECT * FROM documents WHERE id = ?", (document_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Document not found.")
        chunks = connection.execute(
            """
            SELECT page_number, chunk_index, chunk_text FROM chunks
            WHERE document_id = ? ORDER BY page_number, chunk_index
            """,
            (document_id,),
        ).fetchall()
    return {
        "document": serialize_document(row),
        "chunks": [dict(chunk) for chunk in chunks],
    }


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str) -> dict[str, str]:
    with database_connection() as connection:
        row = connection.execute(
            "SELECT * FROM documents WHERE id = ?", (document_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Document not found.")

        if row["source_type"] == "upload" and row["source_path"]:
            stored_path = Path(row["source_path"]).resolve()
            if stored_path.parent != UPLOAD_DIR.resolve():
                raise HTTPException(status_code=500, detail="Upload storage path is invalid.")
            try:
                stored_path.unlink(missing_ok=True)
            except OSError as exc:
                raise HTTPException(status_code=500, detail="Could not remove the uploaded PDF.") from exc
        elif row["source_type"] == "legacy":
            connection.execute(
                "INSERT OR IGNORE INTO excluded_documents (filename) VALUES (?)",
                (row["filename"],),
            )

        connection.execute("DELETE FROM documents WHERE id = ?", (document_id,))
    return {"status": "deleted", "document_id": document_id}


@app.post("/api/query")
def query_statementiq(payload: dict[str, Any]) -> dict[str, Any]:
    question = payload.get("question")
    if not isinstance(question, str) or not question.strip():
        raise HTTPException(status_code=422, detail="Enter a question to continue.")
    question = question.strip()
    if len(question) > 2000:
        raise HTTPException(status_code=422, detail="Questions must be 2,000 characters or fewer.")

    selected_ids = payload.get("document_ids", [])
    if not isinstance(selected_ids, list) or any(not isinstance(item, str) for item in selected_ids):
        raise HTTPException(status_code=422, detail="document_ids must be a list of document IDs.")

    with database_connection() as connection:
        available = connection.execute(
            "SELECT id, filename FROM documents WHERE status = 'indexed'"
        ).fetchall()
    if selected_ids:
        unknown_ids = set(selected_ids) - {row["id"] for row in available}
        if unknown_ids:
            raise HTTPException(status_code=404, detail="One or more selected documents were not found.")
        selected = [row for row in available if row["id"] in set(selected_ids)]
    else:
        selected = available
    if not selected:
        raise HTTPException(status_code=422, detail="Index a financial statement before asking a question.")

    try:
        passages = search_documents(question, [row["id"] for row in selected], top_k=8)
        if not passages:
            raise HTTPException(
                status_code=422,
                detail="No searchable passages were found in the selected documents.",
            )
        evidence = [
            {"source_id": f"E{index}", **passage}
            for index, passage in enumerate(passages, start=1)
        ]
        answer = generate_answer(question, evidence)
        citation_verification = validate_citations(answer, evidence)
        claim_verification = verify_answer_claims(answer, evidence)
    except HTTPException:
        raise
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    analysis_id = str(uuid.uuid4())
    selected_documents = [
        {"id": row["id"], "filename": row["filename"]} for row in selected
    ]
    with database_connection() as connection:
        connection.execute(
            """
            INSERT INTO analyses
                (id, question, answer, selected_documents, evidence,
                 citation_verification, claim_verification)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                analysis_id,
                question,
                answer,
                json.dumps(selected_documents),
                json.dumps(evidence),
                json.dumps(citation_verification),
                claim_verification,
            ),
        )
        created_at = connection.execute(
            "SELECT created_at FROM analyses WHERE id = ?", (analysis_id,)
        ).fetchone()["created_at"]

    return {
        "id": analysis_id,
        "question": question,
        "answer": answer,
        "selected_documents": selected_documents,
        "evidence": evidence,
        "citation_verification": citation_verification,
        "claim_verification": claim_verification,
        "created_at": created_at,
    }


@app.get("/api/history")
def list_history() -> dict[str, list[dict[str, Any]]]:
    with database_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, question, answer, selected_documents, created_at,
                   citation_verification
            FROM analyses ORDER BY created_at DESC
            """
        ).fetchall()
    return {
        "analyses": [
            {
                "id": row["id"],
                "question": row["question"],
                "answer": row["answer"],
                "selected_documents": json.loads(row["selected_documents"]),
                "created_at": row["created_at"],
                "citation_verification": json.loads(row["citation_verification"]),
            }
            for row in rows
        ]
    }


@app.get("/api/history/{analysis_id}")
def get_history_item(analysis_id: str) -> dict[str, Any]:
    with database_connection() as connection:
        row = connection.execute(
            "SELECT * FROM analyses WHERE id = ?", (analysis_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return {
        "id": row["id"],
        "question": row["question"],
        "answer": row["answer"],
        "selected_documents": json.loads(row["selected_documents"]),
        "evidence": json.loads(row["evidence"]),
        "citation_verification": json.loads(row["citation_verification"]),
        "claim_verification": row["claim_verification"],
        "created_at": row["created_at"],
    }


@app.delete("/api/history/{analysis_id}")
def delete_history_item(analysis_id: str) -> dict[str, str]:
    with database_connection() as connection:
        result = connection.execute("DELETE FROM analyses WHERE id = ?", (analysis_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Analysis not found.")
    return {"status": "deleted", "analysis_id": analysis_id}


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"service": "StatementIQ API", "version": "1.0.0"}
