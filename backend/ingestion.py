import os
import re
from pathlib import Path
from typing import Any, Optional

import requests
from pypdf import PdfReader


CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")


def create_chunks(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    normalized_text = text.strip()
    if not normalized_text:
        return []
    if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
        raise ValueError("Chunk size must be positive and overlap smaller than chunk size.")

    chunks: list[str] = []
    start = 0
    while start < len(normalized_text):
        end = start + chunk_size
        chunk = normalized_text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(normalized_text):
            break
        start = end - overlap
    return chunks


def extract_pdf_pages(path: Path) -> list[dict[str, Any]]:
    reader = PdfReader(str(path))
    if reader.is_encrypted and not reader.decrypt(""):
        raise ValueError("This PDF is password-protected and cannot be indexed.")

    pages: list[dict[str, Any]] = []
    for page_number, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            pages.append({"page_number": page_number, "text": text})

    if not pages:
        raise ValueError("No searchable text was found in this PDF.")
    return pages


def create_page_chunks(pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    page_chunks: list[dict[str, Any]] = []
    for page in pages:
        for chunk_index, text in enumerate(create_chunks(page["text"])):
            page_chunks.append(
                {
                    "page_number": page["page_number"],
                    "chunk_index": chunk_index,
                    "chunk_text": text,
                }
            )
    return page_chunks


def embed_texts(texts: list[str]) -> list[list[float]]:
    embeddings: list[list[float]] = []
    for start in range(0, len(texts), 32):
        batch = texts[start : start + 32]
        try:
            response = requests.post(
                f"{OLLAMA_BASE_URL}/api/embed",
                json={"model": EMBED_MODEL, "input": batch},
                timeout=120,
            )
            response.raise_for_status()
            batch_embeddings = response.json().get("embeddings")
        except requests.RequestException as exc:
            raise RuntimeError(
                "Could not reach the configured Ollama server for embeddings. "
                "Check OLLAMA_BASE_URL and that the embedding model is available."
            ) from exc
        except ValueError as exc:
            raise RuntimeError("Ollama returned an invalid embedding response.") from exc

        if not isinstance(batch_embeddings, list) or len(batch_embeddings) != len(batch):
            raise RuntimeError("Ollama returned an unexpected number of embeddings.")
        embeddings.extend(batch_embeddings)
    return embeddings


def infer_company_and_year(filename: str) -> tuple[str, Optional[str]]:
    stem = Path(filename).stem
    year_match = re.search(r"(?<!\d)(20\d{2})(?!\d)", stem)
    without_year = re.sub(r"[_\-\s]*(?<!\d)20\d{2}(?!\d)", "", stem)
    without_year = re.sub(
        r"(?:[_\-\s]*(?:annual[_\-\s]*report|financial[_\-\s]*statements?|report))+$",
        "",
        without_year,
        flags=re.IGNORECASE,
    )
    company = re.sub(r"[_\-]+", " ", without_year).strip().title()
    return company or "Unknown company", year_match.group(1) if year_match else None
