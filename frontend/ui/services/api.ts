export interface DocumentRecord {
  id: string;
  filename: string;
  company: string;
  financial_year: string | null;
  pages: number;
  chunks: number;
  status: "indexed" | "processing" | "failed" | string;
  source_type: "legacy" | "upload" | string;
  error: string | null;
  uploaded_at: string;
}

export interface DashboardStats {
  total_documents: number;
  total_pages: number;
  total_chunks: number;
  recent_analyses: number;
}

export interface Evidence {
  source_id: string;
  document_id: string;
  document: string;
  page: number;
  chunk_index: number;
  text: string;
  similarity_score: number;
}

export interface CitationVerification {
  citations_found: string[];
  valid_citations: number;
  invalid_citations: string[];
  citation_check_passed: boolean;
  has_citations: boolean;
}

export interface Analysis {
  id: string;
  question: string;
  answer: string;
  selected_documents: Array<{ id: string; filename: string }>;
  evidence: Evidence[];
  citation_verification: CitationVerification;
  claim_verification?: string;
  created_at: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError("Cannot connect to the StatementIQ server.", 0);
  }
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      const detail = body.detail;
      message =
        typeof detail === "string"
          ? detail
          : typeof detail?.message === "string"
            ? detail.message
            : message;
    } catch {
      // Keep the HTTP status message when the server response is not JSON.
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export const getDocuments = () =>
  request<{ documents: DocumentRecord[]; stats: DashboardStats }>("/api/documents");

export const getHealth = () =>
  request<{ status: string; service: string }>("/api/health");

export const queryStatementIQ = (question: string, documentIds: string[]) =>
  request<Analysis>("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, document_ids: documentIds }),
  });

export const getHistory = () =>
  request<{ analyses: Omit<Analysis, "evidence" | "claim_verification">[] }>(
    "/api/history",
  );

export const getHistoryItem = (id: string) =>
  request<Analysis>(`/api/history/${encodeURIComponent(id)}`);

export const deleteHistoryItem = (id: string) =>
  request<{ status: string }>(`/api/history/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export const deleteDocument = (id: string) =>
  request<{ status: string }>(`/api/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export function uploadDocument(
  file: File,
  onProgress: (progress: number) => void,
): Promise<DocumentRecord> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/documents/upload");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve(JSON.parse(request.responseText) as DocumentRecord);
        return;
      }
      let message = `Upload failed (${request.status}).`;
      try {
        const detail = JSON.parse(request.responseText).detail;
        message =
          typeof detail === "string"
            ? detail
            : typeof detail?.message === "string"
              ? detail.message
              : message;
      } catch {
        // Keep the HTTP status message when the server response is not JSON.
      }
      reject(new ApiError(message, request.status));
    };
    request.onerror = () =>
      reject(new ApiError("Cannot connect to the StatementIQ server.", 0));
    const formData = new FormData();
    formData.append("file", file);
    request.send(formData);
  });
}
