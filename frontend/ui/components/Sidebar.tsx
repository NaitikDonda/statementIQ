import {
  Activity,
  Files,
  History,
  LayoutDashboard,
  MessageSquareText,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Sun,
  X,
} from "lucide-react";

export type PageKey = "dashboard" | "documents" | "ask" | "history" | "settings";

interface SidebarProps {
  activePage: PageKey;
  collapsed: boolean;
  mobileOpen: boolean;
  lightMode: boolean;
  onNavigate: (page: PageKey) => void;
  onNewAnalysis: () => void;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onToggleTheme: () => void;
}

const navigation: Array<{ id: PageKey; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "documents", label: "Documents", icon: Files },
  { id: "ask", label: "Ask StatementIQ", icon: MessageSquareText },
  { id: "history", label: "Search history", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  activePage,
  collapsed,
  mobileOpen,
  lightMode,
  onNavigate,
  onNewAnalysis,
  onToggleCollapsed,
  onCloseMobile,
  onToggleTheme,
}: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`sidebar-shell fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r border-line bg-panel transition-[width,transform] duration-200 md:translate-x-0 ${
          collapsed ? "md:w-[76px]" : ""
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-line px-5">
          <button
            className="flex min-w-0 items-center gap-3 text-left"
            onClick={() => onNavigate("dashboard")}
            aria-label="StatementIQ dashboard"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Activity size={19} strokeWidth={2.5} />
            </span>
            {!collapsed && (
              <span>
                <span className="block text-sm font-semibold tracking-tight text-ink">
                  Statement<span className="text-accent">IQ</span>
                </span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-[0.16em] text-muted">
                  Financial intelligence
                </span>
              </span>
            )}
          </button>
          <button
            aria-label="Close navigation"
            className="icon-button md:hidden"
              onClick={onCloseMobile}
          >
            <X size={17} />
          </button>
        </div>

        <div className="px-3 pt-6">
          <button
            className={`flex h-10 w-full items-center gap-2.5 rounded-lg bg-accent px-3 text-sm font-semibold text-[#061b19] transition-colors hover:bg-[#20c9b6] ${
              collapsed ? "justify-center px-0" : ""
            }`}
            onClick={onNewAnalysis}
            title="New analysis"
          >
            <Plus size={17} />
            {!collapsed && "New analysis"}
          </button>
        </div>

        <nav className="mt-7 flex-1 px-3" aria-label="Main navigation">
          <p className={`mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted ${collapsed ? "sr-only" : ""}`}>
            Workspace
          </p>
          <div className="space-y-1">
            {navigation.map(({ id, label, icon: Icon }) => {
              const isActive = activePage === id;
              return (
                <button
                  key={id}
                  title={collapsed ? label : undefined}
                  onClick={() => {
                    onNavigate(id);
                    onCloseMobile();
                  }}
                  className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] transition-colors ${
                    isActive
                      ? "bg-accent/10 font-medium text-accent"
                      : "text-muted hover:bg-elevated hover:text-ink"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  {!collapsed && label}
                  {id === "history" && !collapsed && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-line p-3">
          <button
            className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-[13px] text-muted transition-colors hover:bg-elevated hover:text-ink ${
              collapsed ? "justify-center px-0" : ""
            }`}
            onClick={onToggleTheme}
            title={lightMode ? "Switch to dark mode" : "Switch to light mode"}
          >
            {lightMode ? <Moon size={17} /> : <Sun size={17} />}
            {!collapsed && (lightMode ? "Dark appearance" : "Light appearance")}
          </button>
          <button
            className={`mt-1 hidden h-9 w-full items-center gap-3 rounded-lg px-3 text-[12px] text-muted transition-colors hover:bg-elevated hover:text-ink md:flex ${
              collapsed ? "justify-center px-0" : ""
            }`}
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && "Collapse sidebar"}
          </button>
        </div>
      </aside>
    </>
  );
}
