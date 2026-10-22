import { useState } from "react";
import { ArrowUpRight, Clock3, FileText, History as HistoryIcon, Trash2 } from "lucide-react";
import type { Analysis } from "../services/api";

interface HistoryProps {
  analyses: Omit<Analysis, "evidence" | "claim_verification">[];
  onOpen: (analysisId: string) => void;
  onDelete: (analysisId: string) => Promise<void>;
}

function formatDate(value: string) {
  const date = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

export default function History({ analyses, onOpen, onDelete }: HistoryProps) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const remove = async (id: string) => {
    setPendingDelete(id);
    try {
      await onDelete(id);
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Saved research</p>
        <h1 className="page-title mt-2">Search history</h1>
        <p className="mt-2 text-sm text-muted">
          Reopen previous analyses with their original citations and evidence.
        </p>
      </div>

      {analyses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-panel px-6 py-14 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-elevated text-muted">
            <HistoryIcon size={20} />
          </span>
          <h2 className="text-sm font-semibold text-ink">Your analysis history is empty</h2>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted">
            Completed questions and their evidence will be saved here for later review.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {analyses.map((analysis) => (
            <article
              key={analysis.id}
              className="group rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line/80 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <FileText size={15} />
                </span>
                <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(analysis.id)}>
                  <span className="block text-sm font-medium leading-6 text-ink">
                    {analysis.question}
                  </span>
                  <span className="mt-2 line-clamp-2 block text-xs leading-5 text-muted">
                    {analysis.answer}
                  </span>
                  <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 size={12} />
                      {formatDate(analysis.created_at)}
                    </span>
                    <span>
                      {analysis.selected_documents.length}{" "}
                      {analysis.selected_documents.length === 1 ? "document" : "documents"}
                    </span>
                    <span
                      className={
                        analysis.citation_verification?.has_citations &&
                        analysis.citation_verification?.citation_check_passed
                          ? "text-accent"
                          : "text-amber-300"
                      }
                    >
                      {analysis.citation_verification?.has_citations
                        ? analysis.citation_verification?.citation_check_passed
                          ? "Citations checked"
                          : "Review citations"
                        : "No citations"}
                    </span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    aria-label="Open analysis"
                    title="Open analysis"
                    className="icon-button h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    onClick={() => onOpen(analysis.id)}
                  >
                    <ArrowUpRight size={15} />
                  </button>
                  <button
                    aria-label="Delete analysis"
                    title="Delete analysis"
                    className="icon-button h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                    disabled={pendingDelete === analysis.id}
                    onClick={() => void remove(analysis.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
