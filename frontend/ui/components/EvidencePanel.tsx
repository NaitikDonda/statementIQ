import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, FileText, Quote } from "lucide-react";
import type { Evidence } from "../services/api";

interface EvidencePanelProps {
  evidence: Evidence[];
  focusSource?: string | null;
}

export default function EvidencePanel({
  evidence,
  focusSource,
}: EvidencePanelProps) {
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    if (!focusSource) return;
    setExpanded((current) =>
      current.includes(focusSource) ? current : [...current, focusSource],
    );
    const timer = window.setTimeout(() => {
      const element = document.getElementById(`evidence-${focusSource}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.classList.add("evidence-flash");
      window.setTimeout(() => element?.classList.remove("evidence-flash"), 1000);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [focusSource]);

  const toggle = (sourceId: string) =>
    setExpanded((current) =>
      current.includes(sourceId)
        ? current.filter((item) => item !== sourceId)
        : [...current, sourceId],
    );

  if (evidence.length === 0) {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-panel px-5 text-center">
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-elevated text-muted">
          <Quote size={18} />
        </span>
        <p className="text-sm font-medium text-ink">Evidence will appear here</p>
        <p className="mt-1 max-w-[230px] text-xs leading-5 text-muted">
          Ask a question to see the passages and page references behind the answer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {evidence.map((item) => {
        const isExpanded = expanded.includes(item.source_id);
        return (
          <article
            id={`evidence-${item.source_id}`}
            key={item.source_id}
            className="scroll-mt-5 overflow-hidden rounded-xl border border-line bg-panel"
          >
            <button
              className="flex w-full items-start gap-3 p-3.5 text-left"
              onClick={() => toggle(item.source_id)}
              aria-expanded={isExpanded}
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-[10px] font-semibold text-accent">
                {item.source_id}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-xs font-medium text-ink">
                  <FileText size={13} className="shrink-0 text-muted" />
                  {item.document}
                </span>
                <span className="mt-1.5 flex items-center gap-2 text-[10px] text-muted">
                  <span>Page {item.page}</span>
                  <span className="h-1 w-1 rounded-full bg-line" />
                  <span>{Math.round(item.similarity_score * 100)}% match</span>
                </span>
              </span>
              {isExpanded ? (
                <ChevronUp size={15} className="mt-1 shrink-0 text-muted" />
              ) : (
                <ChevronDown size={15} className="mt-1 shrink-0 text-muted" />
              )}
            </button>
            {isExpanded && (
              <div className="border-t border-line px-4 py-3.5">
                <p className="whitespace-pre-wrap text-xs leading-6 text-muted">
                  {item.text}
                </p>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
