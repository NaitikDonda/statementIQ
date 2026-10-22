import csv
import json
import os
from pathlib import Path
from typing import Any, Optional

import numpy as np
import requests

from database import database_connection


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
LEGACY_INDEX_PATH = Path(
    os.getenv("LEGACY_INDEX_PATH", "outputs/pdf_chunks_embeddings.csv")
).expanduser()

_legacy_cache: Optional[tuple[int, list[dict[str, Any]], np.ndarray]] = None


def safe_normalize(vector: Any) -> np.ndarray:
    normalized = np.asarray(vector, dtype=np.float64)
    if normalized.ndim != 1 or not np.isfinite(normalized).all():
        raise ValueError("Embedding contains invalid values.")
    norm = float(np.linalg.norm(normalized))
    if not np.isfinite(norm) or norm == 0:
        raise ValueError("Embedding has an invalid norm.")
    return normalized / norm


def get_query_embedding(question: str) -> np.ndarray:
    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/embed",
            json={"model": EMBED_MODEL, "input": question},
            timeout=120,
        )
        response.raise_for_status()
        embeddings = response.json().get("embeddings")
    except requests.RequestException as exc:
        raise RuntimeError(
            "Could not reach the configured Ollama server for embeddings. "
            "Check OLLAMA_BASE_URL and that the embedding model is available."
        ) from exc
    except ValueError as exc:
        raise RuntimeError("Ollama returned an invalid embedding response.") from exc

    if not isinstance(embeddings, list) or len(embeddings) != 1:
        raise RuntimeError("Ollama returned an unexpected query embedding.")
    return safe_normalize(embeddings[0])


def load_legacy_index() -> tuple[list[dict[str, Any]], np.ndarray]:
    global _legacy_cache
    if not LEGACY_INDEX_PATH.is_file():
        return [], np.empty((0, 0), dtype=np.float64)

    modified_at = LEGACY_INDEX_PATH.stat().st_mtime_ns
    if _legacy_cache is not None and _legacy_cache[0] == modified_at:
        return _legacy_cache[1], _legacy_cache[2]

    rows: list[dict[str, Any]] = []
    vectors: list[np.ndarray] = []
    with LEGACY_INDEX_PATH.open("r", encoding="utf-8", newline="") as csv_file:
        for row in csv.DictReader(csv_file):
            vector = safe_normalize(json.loads(row["embedding"]))
            if vectors and vector.shape != vectors[0].shape:
                raise ValueError("Legacy index contains embeddings with different dimensions.")
            rows.append(
                {
                    "document_name": row["document_name"],
                    "page_number": int(row["page_number"]),
                    "chunk_index": int(row["chunk_index"]),
                    "chunk_text": row["chunk_text"],
                    "embedding": vector,
                }
            )
            vectors.append(vector)

    matrix = np.vstack(vectors) if vectors else np.empty((0, 0), dtype=np.float64)
    _legacy_cache = (modified_at, rows, matrix)
    return rows, matrix


def legacy_document_summaries() -> list[dict[str, Any]]:
    rows, _ = load_legacy_index()
    summaries: dict[str, dict[str, Any]] = {}
    for row in rows:
        summary = summaries.setdefault(
            row["document_name"],
            {"filename": row["document_name"], "pages": set(), "chunks": 0},
        )
        summary["pages"].add(row["page_number"])
        summary["chunks"] += 1
    return [
        {
            "filename": name,
            "pages": len(summary["pages"]),
            "chunks": summary["chunks"],
        }
        for name, summary in summaries.items()
    ]


def search_documents(
    question: str, document_ids: list[str], top_k: int = 8
) -> list[dict[str, Any]]:
    query_vector = get_query_embedding(question)
    allowed_ids = set(document_ids)
    candidates: list[dict[str, Any]] = []

    legacy_rows, legacy_matrix = load_legacy_index()
    if legacy_rows:
        with database_connection() as connection:
            excluded = {
                row["filename"]
                for row in connection.execute("SELECT filename FROM excluded_documents")
            }
            legacy_ids = {
                row["filename"]: row["id"]
                for row in connection.execute(
                    "SELECT id, filename FROM documents WHERE source_type = 'legacy' AND status = 'indexed'"
                )
                if row["filename"] not in excluded
            }
        if legacy_matrix.shape[1] != query_vector.size:
            raise RuntimeError(
                "The configured embedding model does not match the existing document index."
            )
        for index, row in enumerate(legacy_rows):
            document_id = legacy_ids.get(row["document_name"])
            if document_id and document_id in allowed_ids:
                candidates.append(
                    {
                        "document_id": document_id,
                        "document": row["document_name"],
                        "page": row["page_number"],
                        "chunk_index": row["chunk_index"],
                        "text": row["chunk_text"],
                        "similarity_score": float(legacy_matrix[index] @ query_vector),
                    }
                )

    with database_connection() as connection:
        uploaded_rows = connection.execute(
            """
            SELECT c.document_id, d.filename, c.page_number, c.chunk_index,
                   c.chunk_text, c.embedding
            FROM chunks AS c
            JOIN documents AS d ON d.id = c.document_id
            WHERE d.status = 'indexed' AND d.source_type = 'upload'
            """
        ).fetchall()
    for row in uploaded_rows:
        if row["document_id"] not in allowed_ids:
            continue
        vector = safe_normalize(json.loads(row["embedding"]))
        if vector.size != query_vector.size:
            raise RuntimeError(
                "The configured embedding model does not match an indexed document."
            )
        candidates.append(
            {
                "document_id": row["document_id"],
                "document": row["filename"],
                "page": row["page_number"],
                "chunk_index": row["chunk_index"],
                "text": row["chunk_text"],
                "similarity_score": float(vector @ query_vector),
            }
        )

    candidates.sort(key=lambda item: item["similarity_score"], reverse=True)
    return candidates[:top_k]
