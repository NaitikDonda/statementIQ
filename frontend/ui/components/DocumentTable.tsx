import { useState } from "react";
import { ArrowUpRight, FileText, MoreHorizontal, Trash2 } from "lucide-react";
import type { DocumentRecord } from "../services/api";

interface DocumentTableProps {
  documents: DocumentRecord[];
  compact?: boolean;
  onUpload?: () => void;
  onDelete?: (document: DocumentRecord) => Promise<void>;
}

function formatDate(value: string): string {
  const date = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function DocumentTable({
  documents,
  compact = false,
  onUpload,
  onDelete,
}: DocumentTableProps) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const remove = async (document: DocumentRecord) => {
    if (!onDelete) return;
    setPendingDelete(document.id);
    try {
      await onDelete(document);
    } finally {
      setPendingDelete(null);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-11 text-center">
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-elevated text-muted">
          <FileText size={20} />
        </span>
        <p className="text-sm font-medium text-ink">No statements indexed yet</p>
        <p className="mt-1 max-w-xs text-xs leading-5 text-muted">
          Upload a financial statement to make its figures searchable and ready for analysis.
        </p>
        {onUpload && (
          <button className="button-secondary mt-4 h-8 px-3 text-xs" onClick={onUpload}>
            Upload a statement <ArrowUpRight size={13} />
          </button>
        )}
      </div>
    );
  }

  const visibleDocuments = compact ? documents.slice(0, 5) : documents;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[690px] text-left">
        <thead>
          <tr className="border-b border-line text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            <th className="px-5 py-3 font-medium">Document</th>
            <th className="px-4 py-3 font-medium">Company</th>
            <th className="px-4 py-3 font-medium">Year</th>
            <th className="px-4 py-3 text-right font-medium">Pages</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {!compact && <th className="px-4 py-3 font-medium">Added</th>}
            {!compact && <th className="w-12 px-3 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {visibleDocuments.map((document) => (
            <tr key={document.id} className="group transition-colors hover:bg-elevated/40">
              <td className="max-w-[260px] px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
                    <FileText size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-ink">
                      {document.filename}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted">
                      {document.chunks.toLocaleString()} searchable chunks
                    </span>
                  </span>
                </div>
              </td>
              <td className="px-4 py-3.5 text-xs text-muted">{document.company}</td>
              <td className="px-4 py-3.5 text-xs text-muted">
                {document.financial_year ?? "—"}
              </td>
              <td className="px-4 py-3.5 text-right text-xs tabular-nums text-muted">
                {document.pages.toLocaleString()}
              </td>
              <td className="px-4 py-3.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium ${
                    document.status === "indexed"
                      ? "bg-accent/10 text-accent"
                      : document.status === "failed"
                        ? "bg-rose-400/10 text-rose-400"
                        : "bg-amber-400/10 text-amber-300"
                  }`}
                >
                  <span className="h-1 w-1 rounded-full bg-current" />
                  {document.status === "indexed"
                    ? "Indexed"
                    : document.status === "failed"
                      ? "Failed"
                      : "Processing"}
                </span>
              </td>
              {!compact && (
                <td className="px-4 py-3.5 text-xs text-muted">{formatDate(document.uploaded_at)}</td>
              )}
              {!compact && onDelete && (
                <td className="px-3 py-3.5">
                  <button
                    title="Delete document"
                    aria-label={`Delete ${document.filename}`}
                    disabled={pendingDelete === document.id}
                    onClick={() => void remove(document)}
                    className="icon-button h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                  >
                    {pendingDelete === document.id ? (
                      <MoreHorizontal size={15} className="animate-pulse" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
