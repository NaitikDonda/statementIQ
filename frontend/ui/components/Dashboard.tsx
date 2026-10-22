import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Files,
  FileText,
  Layers3,
  Sparkles,
} from "lucide-react";
import DocumentTable from "./DocumentTable";
import type { DashboardStats, DocumentRecord } from "../services/api";

interface DashboardProps {
  stats: DashboardStats;
  documents: DocumentRecord[];
  onNavigate: (page: "documents" | "ask") => void;
}

const statCards = [
  { key: "total_documents", label: "Indexed documents", icon: Files, suffix: "statements" },
  { key: "total_pages", label: "Pages indexed", icon: FileText, suffix: "pages" },
  { key: "total_chunks", label: "Searchable passages", icon: Layers3, suffix: "chunks" },
  { key: "recent_analyses", label: "Recent analyses", icon: BarChart3, suffix: "this month" },
] as const;

export default function Dashboard({ stats, documents, onNavigate }: DashboardProps) {
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Research workspace</p>
          <h1 className="page-title mt-2">Financial intelligence, grounded in evidence.</h1>
          <p className="mt-2 text-sm text-muted">
            A clear view of your statements, indexed research, and recent activity.
          </p>
        </div>
        <button className="button-primary h-9 px-3.5 text-xs" onClick={() => onNavigate("ask")}>
          <Sparkles size={14} />
          Start an analysis
          <ArrowRight size={14} />
        </button>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ key, label, icon: Icon, suffix }) => (
          <article key={key} className="rounded-xl border border-line bg-panel p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">{label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-elevated text-muted">
                <Icon size={16} />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-[26px] font-semibold tracking-tight text-ink tabular-nums">
                {stats[key].toLocaleString()}
              </span>
              <span className="text-[10px] text-muted">{suffix}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Recent documents</h2>
            <p className="mt-1 text-[11px] text-muted">
              Indexed source material available to your analysis workspace.
            </p>
          </div>
          {documents.length > 0 && (
            <button
              className="text-xs font-medium text-accent transition-colors hover:text-[#39d5c4]"
              onClick={() => onNavigate("documents")}
            >
              View all <ArrowUpRight size={13} className="ml-1 inline" />
            </button>
          )}
        </div>
        <DocumentTable
          documents={documents}
          compact
          onUpload={() => onNavigate("documents")}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <button
          className="group flex items-center gap-4 rounded-xl border border-line bg-panel p-4 text-left transition-colors hover:border-accent/35"
          onClick={() => onNavigate("documents")}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <FileText size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-ink">Add a financial statement</span>
            <span className="mt-1 block text-[11px] text-muted">
              Securely index a PDF for evidence-backed research.
            </span>
          </span>
          <ArrowRight size={15} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
        </button>
        <button
          className="group flex items-center gap-4 rounded-xl border border-line bg-panel p-4 text-left transition-colors hover:border-accent/35"
          onClick={() => onNavigate("ask")}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Sparkles size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-ink">Explore your filings</span>
            <span className="mt-1 block text-[11px] text-muted">
              Ask a question and inspect every source passage.
            </span>
          </span>
          <ArrowRight size={15} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
        </button>
      </section>
    </div>
  );
}
