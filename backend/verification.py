import os
import re

import requests


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "gemma4:e4b")


def validate_citations(answer: str, evidence: list[dict[str, object]]) -> dict[str, object]:
    cited_ids = re.findall(r"\[(E\d+)\]", answer)
    valid_ids = {str(item["source_id"]) for item in evidence}
    invalid_ids = [source_id for source_id in cited_ids if source_id not in valid_ids]
    return {
        "citations_found": cited_ids,
        "valid_citations": len(cited_ids) - len(invalid_ids),
        "invalid_citations": invalid_ids,
        "citation_check_passed": not invalid_ids,
        "has_citations": bool(cited_ids),
    }


def verify_answer_claims(answer: str, evidence: list[dict[str, object]]) -> str:
    formatted_evidence = "\n\n".join(
        (
            f"Source ID: [{item['source_id']}]\n"
            f"Document: {item['document']}\n"
            f"Page: {item['page']}\n"
            f"Passage:\n{item['text']}"
        )
        for item in evidence
    )
    prompt = f"""You are a financial evidence verifier. Use only the supplied evidence.
For each factual claim in the answer, mark it SUPPORTED, UNSUPPORTED, or CONTRADICTED.
Include the supporting source IDs and a short reason. A citation alone is not proof.

Answer:
{answer}

Evidence:
{formatted_evidence}
"""
    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={"model": LLM_MODEL, "prompt": prompt, "stream": False},
            timeout=300,
        )
        response.raise_for_status()
        result = response.json().get("response")
    except requests.RequestException as exc:
        raise RuntimeError(
            "Could not reach the configured Ollama server for claim verification."
        ) from exc
    except ValueError as exc:
        raise RuntimeError("Ollama returned an invalid verification response.") from exc

    if not isinstance(result, str) or not result.strip():
        raise RuntimeError("Ollama returned an empty claim verification.")
    return result.strip()
