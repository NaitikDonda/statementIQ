import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronDown,
  FileText,
  LoaderCircle,
  MessageSquareText,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import EvidencePanel from "./EvidencePanel";
import { ApiError, queryStatementIQ } from "../services/api";
import type { Analysis, DocumentRecord } from "../services/api";

interface AskStatementIQProps {
  documents: DocumentRecord[];
  initialAnalysis: Analysis | null;
  onAnalysis: (analysis: Analysis) => void;
}

const suggestions = [
  "How did revenue change year over year?",
  "What are the primary sources of revenue?",
  "Summarize operating cash flow and capital expenditure.",
  "What risks does management highlight?",
];

function AnswerText({
  answer,
  onCitationClick,
}: {
  answer: string;
  onCitationClick: (sourceId: string) => void;
}) {
  return (
    <div className="space-y-3 text-[13px] leading-7 text-ink/90">
      {answer.split(/\n{2,}/).map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 12)}`}>
          {paragraph.split(/(\[E\d+\])/g).map((part, partIndex) =>
            /^\[E\d+\]$/.test(part) ? (
              <button
                key={`${part}-${partIndex}`}
                className="mx-0.5 inline-flex items-center rounded bg-accent/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold leading-4 text-accent hover:bg-accent/20"
                onClick={() => onCitationClick(part.slice(1, -1))}
                aria-label={`Open evidence ${part.slice(1, -1)}`}
              >
                {part}
              </button>
            ) : (
              <span key={partIndex}>{part}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

export default function AskStatementIQ({
  documents,
  initialAnalysis,
  onAnalysis,
}: AskStatementIQProps) {
  const [question, setQuestion] = useState(initialAnalysis?.question ?? "");
  const [result, setResult] = useState<Analysis | null>(initialAnalysis);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [focusedSource, setFocusedSource] = useState<string | null>(null);
  const didInitialize = useRef(false);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const indexedDocuments = documents.filter((document) => document.status === "indexed");

  useEffect(() => {
    if (initialAnalysis) {
      setQuestion(initialAnalysis.question);
      setResult(initialAnalysis);
      setSelectedIds(initialAnalysis.selected_documents.map((document) => document.id));
      didInitialize.current = true;
      return;
    }
    if (!didInitialize.current && indexedDocuments.length > 0) {
      setSelectedIds(indexedDocuments.map((document) => document.id));
      didInitialize.current = true;
    }
  }, [initialAnalysis?.id, indexedDocuments.length]);

  const selectedDocuments = indexedDocuments.filter((document) =>
    selectedIds.includes(document.id),
  );

  const ask = async (nextQuestion = question) => {
    if (!nextQuestion.trim() || loading) return;
    if (selectedIds.length === 0) {
      setError("Select at least one indexed statement to search.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const analysis = await queryStatementIQ(nextQuestion.trim(), selectedIds);
      setQuestion(nextQuestion.trim());
      setResult(analysis);
      setShowVerification(false);
      onAnalysis(analysis);
    } catch (queryError) {
      setError(
        queryError instanceof ApiError
          ? queryError.message
          : "The analysis could not be completed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const revealEvidence = (sourceId: string) => {
    setFocusedSource(sourceId);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Evidence-backed research</p>
        <h1 className="page-title mt-2">Ask StatementIQ</h1>
        <p className="mt-2 text-sm text-muted">
          Ask a question across your filings. Every answer is grounded in retrieved passages.
        </p>
      </div>

      {indexedDocuments.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel px-6 py-12 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <FileText size={21} />
          </span>
          <h2 className="text-sm font-semibold text-ink">Add a statement to get started</h2>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted">
            StatementIQ needs indexed financial documents to retrieve evidence and answer questions.
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-4">
            <section className="rounded-xl border border-line bg-panel p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Search size={14} />
                  </span>
                  <span className="text-xs font-semibold text-ink">Research question</span>
                </div>
                <div className="relative">
                  <button
                    className="button-secondary h-8 max-w-[260px] gap-2 px-2.5 text-[11px]"
                    onClick={() => setSelectionOpen((open) => !open)}
                    aria-expanded={selectionOpen}
                  >
                    <FileText size={13} className="shrink-0" />
                    <span className="truncate">
                      {selectedDocuments.length === indexedDocuments.length
                        ? `All documents (${selectedDocuments.length})`
                        : `${selectedDocuments.length} selected`}
                    </span>
                    <ChevronDown size={13} className="shrink-0" />
                  </button>
                  {selectionOpen && (
                    <div className="absolute right-0 top-10 z-20 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-line bg-panel p-2 shadow-xl shadow-black/30">
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                          Search sources
                        </span>
                        <button
                          className="text-[10px] text-accent"
                          onClick={() =>
                            setSelectedIds(
                              selectedIds.length === indexedDocuments.length
                                ? []
                                : indexedDocuments.map((document) => document.id),
                            )
                          }
                        >
                          {selectedIds.length === indexedDocuments.length ? "Clear all" : "Select all"}
                        </button>
                      </div>
                      <div className="mt-1 max-h-52 space-y-0.5 overflow-y-auto">
                        {indexedDocuments.map((document) => {
                          const checked = selectedIds.includes(document.id);
                          return (
                            <button
                              key={document.id}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-elevated"
                              onClick={() =>
                                setSelectedIds((current) =>
                                  checked
                                    ? current.filter((id) => id !== document.id)
                                    : [...current, document.id],
                                )
                              }
                            >
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                  checked
                                    ? "border-accent bg-accent text-[#061b19]"
                                    : "border-line bg-canvas"
                                }`}
                              >
                                {checked && <Check size={11} />}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[11px] text-ink">
                                  {document.filename}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-muted">
                                  {document.pages} indexed pages
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <textarea
                ref={questionRef}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void ask();
                  }
                }}
                placeholder="Ask about performance, risks, cash flow, or a specific line item…"
                rows={3}
                maxLength={2000}
                className="w-full resize-y rounded-lg border border-line bg-canvas px-3.5 py-3 text-sm leading-6 text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent/60"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[10px] text-muted">Enter to ask · Shift + Enter for a new line</span>
                <button
                  className="button-primary h-9 px-3.5 text-xs"
                  disabled={loading || !question.trim()}
                  onClick={() => void ask()}
                >
                  {loading ? (
                    <>
                      <LoaderCircle size={14} className="animate-spin" />
                      Analyzing evidence
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Ask StatementIQ
                    </>
                  )}
                </button>
              </div>
              {error && (
                <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-rose-400/5 px-3 py-2.5 text-xs leading-5 text-rose-400">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  {error}
                </p>
              )}
            </section>

            {!result && (
              <section className="rounded-xl border border-line bg-panel p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <MessageSquareText size={15} className="text-muted" />
                  <h2 className="text-xs font-semibold text-ink">Suggested questions</h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="group flex min-h-[54px] items-start gap-2 rounded-lg border border-line bg-canvas px-3 py-2.5 text-left text-[11px] leading-5 text-muted transition-colors hover:border-accent/40 hover:text-ink"
                      onClick={() => {
                        setQuestion(suggestion);
                        questionRef.current?.focus();
                      }}
                    >
                      <Plus size={13} className="mt-1 shrink-0 text-accent" />
                      <span className="flex-1">{suggestion}</span>
                      <ArrowUpRight size={12} className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {result && (
              <section className="overflow-hidden rounded-xl border border-line bg-panel">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-accent" />
                      <h2 className="text-xs font-semibold text-ink">StatementIQ analysis</h2>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted">{result.question}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium ${
                      result.citation_verification.citation_check_passed &&
                      result.citation_verification.has_citations
                        ? "bg-accent/10 text-accent"
                        : "bg-amber-400/10 text-amber-300"
                    }`}
                  >
                    <ShieldCheck size={12} />
                    {result.citation_verification.has_citations
                      ? result.citation_verification.citation_check_passed
                        ? "Citations checked"
                        : "Review citations"
                      : "No citations detected"}
                  </span>
                </div>
                <div className="px-4 py-4 sm:px-5 sm:py-5">
                  <AnswerText answer={result.answer} onCitationClick={revealEvidence} />
                  <div className="mt-5 border-t border-line pt-3">
                    <button
                      className="text-[11px] font-medium text-muted transition-colors hover:text-ink"
                      onClick={() => setShowVerification((visible) => !visible)}
                      aria-expanded={showVerification}
                    >
                      {showVerification ? "Hide" : "View"} claim verification
                      <ChevronDown
                        size={13}
                        className={`ml-1 inline transition-transform ${showVerification ? "rotate-180" : ""}`}
                      />
                    </button>
                    {showVerification && (
                      <div className="mt-3 rounded-lg border border-line bg-canvas px-3.5 py-3 text-xs leading-6 text-muted">
                        {result.claim_verification ||
                          "Claim verification was not included in this saved analysis."}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-3 xl:sticky xl:top-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Source material</p>
                <h2 className="mt-1 text-sm font-semibold text-ink">
                  Supporting evidence
                  {result && (
                    <span className="ml-2 rounded-md bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      {result.evidence.length}
                    </span>
                  )}
                </h2>
              </div>
              <span className="text-[10px] text-muted">Sorted by relevance</span>
            </div>
            <EvidencePanel
              evidence={result?.evidence ?? []}
              focusSource={focusedSource}
            />
            {result && (
              <p className="px-1 text-[10px] leading-4 text-muted">
                Similarity indicates retrieval relevance, not the certainty of a financial claim.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
