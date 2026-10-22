import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  ChevronRight,
  Menu,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import AskStatementIQ from "./components/AskStatementIQ";
import Dashboard from "./components/Dashboard";
import DocumentTable from "./components/DocumentTable";
import DocumentUpload from "./components/DocumentUpload";
import History from "./components/History";
import Sidebar, { type PageKey } from "./components/Sidebar";
import {
  ApiError,
  deleteDocument,
  deleteHistoryItem,
  getDocuments,
  getHealth,
  getHistory,
  getHistoryItem,
} from "./services/api";
import type {
  Analysis,
  DashboardStats,
  DocumentRecord,
} from "./services/api";

const pageTitles: Record<PageKey, string> = {
  dashboard: "Dashboard",
  documents: "Documents",
  ask: "Ask StatementIQ",
  history: "Search history",
  settings: "Settings",
};

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analyses, setAnalyses] = useState<
    Awaited<ReturnType<typeof getHistory>>["analyses"]
  >([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisSession, setAnalysisSession] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lightMode, setLightMode] = useState(
    () => localStorage.getItem("statementiq-theme") === "light",
  );
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const loadWorkspace = useCallback(async () => {
    setPageError("");
    try {
      const [documentResponse, historyResponse] = await Promise.all([
        getDocuments(),
        getHistory(),
      ]);
      setDocuments(documentResponse.documents);
      setStats(documentResponse.stats);
      setAnalyses(historyResponse.analyses);
      setBackendHealthy(true);
    } catch (error) {
      setBackendHealthy(false);
      setPageError(
        error instanceof ApiError
          ? error.message
          : "The workspace could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
    void getHealth()
      .then(() => setBackendHealthy(true))
      .catch(() => setBackendHealthy(false));
  }, [loadWorkspace]);

  useEffect(() => {
    document.documentElement.classList.toggle("light-mode", lightMode);
    localStorage.setItem("statementiq-theme", lightMode ? "light" : "dark");
  }, [lightMode]);

  const navigate = (page: PageKey) => {
    setActivePage(page);
    setMobileOpen(false);
  };

  const newAnalysis = () => {
    setAnalysis(null);
    setAnalysisSession((session) => session + 1);
    navigate("ask");
  };

  const openAnalysis = async (analysisId: string) => {
    try {
      const detail = await getHistoryItem(analysisId);
      setAnalysis(detail);
      navigate("ask");
    } catch (error) {
      setPageError(
        error instanceof ApiError ? error.message : "This analysis could not be opened.",
      );
    }
  };

  const removeDocument = async (record: DocumentRecord) => {
    if (!window.confirm(`Delete "${record.filename}" and its indexed passages?`)) return;
    try {
      await deleteDocument(record.id);
      await loadWorkspace();
    } catch (error) {
      setPageError(
        error instanceof ApiError ? error.message : "The document could not be deleted.",
      );
    }
  };

  const removeAnalysis = async (analysisId: string) => {
    try {
      await deleteHistoryItem(analysisId);
      if (analysis?.id === analysisId) setAnalysis(null);
      await loadWorkspace();
    } catch (error) {
      setPageError(
        error instanceof ApiError ? error.message : "The analysis could not be deleted.",
      );
    }
  };

  const handleAnalysis = (nextAnalysis: Analysis) => {
    setAnalysis(nextAnalysis);
    void loadWorkspace();
  };

  const retryUpload = () => {
    void loadWorkspace();
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Sidebar
        activePage={activePage}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        lightMode={lightMode}
        onNavigate={navigate}
        onNewAnalysis={newAnalysis}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleTheme={() => setLightMode((value) => !value)}
      />
      <div
        className={`min-h-screen transition-[margin] duration-200 ${
          collapsed ? "md:ml-[76px]" : "md:ml-[250px]"
        }`}
      >
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur-md sm:px-7">
          <div className="flex items-center gap-3">
            <button
              className="icon-button -ml-1 md:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span className="hidden text-muted sm:inline">Workspace</span>
              <ChevronRight size={13} className="hidden text-muted sm:inline" />
              <span className="font-medium text-ink">{pageTitles[activePage]}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] sm:inline-flex ${
                backendHealthy === true
                  ? "border-accent/20 bg-accent/5 text-accent"
                  : backendHealthy === false
                    ? "border-rose-400/20 bg-rose-400/5 text-rose-400"
                    : "border-line bg-panel text-muted"
              }`}
              title={
                backendHealthy
                  ? "StatementIQ API is available"
                  : "StatementIQ API is unavailable"
              }
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {backendHealthy === true
                ? "API connected"
                : backendHealthy === false
                  ? "API unavailable"
                  : "Connecting"}
            </span>
            <button
              className="icon-button"
              aria-label="Refresh workspace"
              title="Refresh workspace"
              onClick={() => void loadWorkspace()}
            >
              <RefreshCw size={15} />
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-panel text-[10px] font-semibold text-muted">
              IQ
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8 xl:px-9">
          {pageError && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-xs text-rose-300"
            >
              <span className="flex items-start gap-2">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                {pageError}
              </span>
              <button
                className="text-[11px] font-medium underline underline-offset-2"
                onClick={() => void loadWorkspace()}
              >
                Try again
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="flex items-center gap-2.5 text-xs text-muted">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
                Loading your research workspace
              </div>
            </div>
          ) : (
            <>
              {activePage === "dashboard" && stats && (
                <Dashboard
                  stats={stats}
                  documents={documents}
                  onNavigate={(page) => (page === "ask" ? newAnalysis() : navigate(page))}
                />
              )}
              {activePage === "documents" && (
                <div className="space-y-6">
                  <div>
                    <p className="eyebrow">Source library</p>
                    <h1 className="page-title mt-2">Documents</h1>
                    <p className="mt-2 text-sm text-muted">
                      Upload annual reports and statements to create searchable, page-cited evidence.
                    </p>
                  </div>
                  <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
                    <div className="rounded-xl border border-line bg-panel p-4 sm:p-5">
                      <div className="mb-4">
                        <h2 className="text-sm font-semibold text-ink">Add a statement</h2>
                        <p className="mt-1 text-[11px] text-muted">
                          PDF text is extracted, embedded locally, and stored for search.
                        </p>
                      </div>
                      <DocumentUpload onUploaded={retryUpload} />
                    </div>
                    <div className="rounded-xl border border-line bg-panel p-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={15} className="text-accent" />
                        <h2 className="text-xs font-semibold text-ink">Processing location</h2>
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-muted">
                        PDFs and extracted passages are stored with this application. Embeddings and
                        answers are generated by the Ollama server configured on the backend. Restrict
                        network access before uploading confidential filings.
                      </p>
                    </div>
                  </section>
                  <section className="overflow-hidden rounded-xl border border-line bg-panel">
                    <div className="flex items-center justify-between border-b border-line px-5 py-4">
                      <div>
                        <h2 className="text-sm font-semibold text-ink">Statement library</h2>
                        <p className="mt-1 text-[11px] text-muted">
                          {documents.length.toLocaleString()}{" "}
                          {documents.length === 1 ? "document" : "documents"}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted">Searchable pages and passages</span>
                    </div>
                    <DocumentTable documents={documents} onDelete={removeDocument} />
                  </section>
                </div>
              )}
              {activePage === "ask" && (
                <AskStatementIQ
                  key={`${analysis?.id ?? "new-analysis"}-${analysisSession}`}
                  documents={documents}
                  initialAnalysis={analysis}
                  onAnalysis={handleAnalysis}
                />
              )}
              {activePage === "history" && (
                <History
                  analyses={analyses}
                  onOpen={(id) => void openAnalysis(id)}
                  onDelete={removeAnalysis}
                />
              )}
              {activePage === "settings" && (
                <section className="space-y-6">
                  <div>
                    <p className="eyebrow">Workspace preferences</p>
                    <h1 className="page-title mt-2">Settings</h1>
                    <p className="mt-2 text-sm text-muted">
                      Application status and local model setup.
                    </p>
                  </div>
                  <div className="max-w-3xl space-y-3">
                    <article className="rounded-xl border border-line bg-panel p-5">
                      <div className="flex items-center gap-2">
                        <Settings2 size={16} className="text-accent" />
                        <h2 className="text-sm font-semibold text-ink">Service health</h2>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                        <div>
                          <p className="text-xs font-medium text-ink">StatementIQ API</p>
                          <p className="mt-1 text-[11px] text-muted">
                            Application and SQLite connection
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              backendHealthy ? "bg-accent" : "bg-rose-400"
                            }`}
                          />
                          {backendHealthy ? "Connected" : "Unavailable"}
                        </span>
                      </div>
                    </article>
                    <article className="rounded-xl border border-line bg-panel p-5">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-accent" />
                        <h2 className="text-sm font-semibold text-ink">Local model</h2>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted">
                        The Ollama URL and model names are read only by the backend. They are not
                        exposed to browser code. Set <code>OLLAMA_BASE_URL</code>,{" "}
                        <code>LLM_MODEL</code>, and <code>EMBED_MODEL</code> in the server environment.
                      </p>
                      <div className="mt-4 rounded-lg border border-line bg-canvas p-3 text-[11px] leading-5 text-muted">
                        <code>OLLAMA_BASE_URL=http://localhost:11434</code>
                        <br />
                        <code>LLM_MODEL=gemma4:e4b</code>
                        <br />
                        <code>EMBED_MODEL=nomic-embed-text</code>
                      </div>
                      <p className="mt-3 text-[11px] leading-5 text-muted">
                        A Render instance cannot reach Ollama on your Mac by default. For hosted
                        use, configure a securely reachable Ollama host; a Mac-hosted model also
                        requires the Mac to remain awake and connected.
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-amber-300">
                        This starter app does not include user sign-in. Do not expose confidential
                        documents on a public service until access is restricted.
                      </p>
                    </article>
                    <article className="rounded-xl border border-line bg-panel p-5">
                      <div className="flex items-center gap-2">
                        <Bell size={16} className="text-accent" />
                        <h2 className="text-sm font-semibold text-ink">Data persistence</h2>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted">
                        Uploaded files and SQLite history use configured storage paths. Render
                        mounts a persistent disk at <code>/var/data</code>; keep the disk attached
                        to retain application data across deployments.
                      </p>
                    </article>
                    <button
                      className="button-secondary h-9 px-3 text-xs"
                      onClick={() => navigate("documents")}
                    >
                      Manage documents <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
