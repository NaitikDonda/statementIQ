import os

import requests


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "gemma4:e4b")


def generate_answer(question: str, evidence: list[dict[str, object]]) -> str:
    formatted_evidence = "\n\n".join(
        (
            f"Source ID: [{item['source_id']}]\n"
            f"Document: {item['document']}\n"
            f"Page: {item['page']}\n"
            f"Passage:\n{item['text']}"
        )
        for item in evidence
    )
    prompt = f"""You are StatementIQ, a financial document analysis assistant.
Answer the user's question using only the supplied evidence.
Do not invent facts, figures, or citations. If evidence is insufficient, say so.
Cite each factual claim using its source ID in square brackets, such as [E1].
Distinguish facts from calculations or interpretations.

Evidence:
{formatted_evidence}

Question:
{question}

Answer:
"""
    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={"model": LLM_MODEL, "prompt": prompt, "stream": False},
            timeout=300,
        )
        response.raise_for_status()
        answer = response.json().get("response")
    except requests.RequestException as exc:
        raise RuntimeError(
            "Could not reach the configured Ollama server for answer generation. "
            "Check OLLAMA_BASE_URL and that the configured LLM_MODEL is available."
        ) from exc
    except ValueError as exc:
        raise RuntimeError("Ollama returned an invalid answer response.") from exc

    if not isinstance(answer, str) or not answer.strip():
        raise RuntimeError("Ollama returned an empty answer.")
    return answer.strip()
