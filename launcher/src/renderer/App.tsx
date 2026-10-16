import { useState } from "react";
import { api } from "./api";
import { StoreProvider, useStore } from "./store";
import { HomePage } from "./pages/Home";
import { VersionsPage } from "./pages/Versions";
import { ModsPage } from "./pages/Mods";
import { AccountsPage } from "./pages/Accounts";
import { SettingsPage } from "./pages/Settings";
import { Logo } from "./components/Logo";

const PAGES = [
  { id: "home", label: "Home", icon: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" },
  { id: "versions", label: "Versions", icon: "M4 6h16M4 12h16M4 18h10" },
  { id: "mods", label: "Mods", icon: "M12 2l9 5v10l-9 5-9-5V7z" },
  { id: "accounts", label: "Accounts", icon: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-9 10a9 9 0 0 1 18 0" },
  { id: "settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8-3l2-1-2-4-2 .5-1.5-1L16 4h-4l-.5 2.5L10 7.5 8 7 6 11l2 1v0l-2 1 2 4 2-.5 1.5 1L12 20h4l.5-2.5 1.5-1 2 .5 2-4z" }
] as const;

type PageId = (typeof PAGES)[number]["id"];

function Shell() {
  const [page, setPage] = useState<PageId>("home");
  const { toasts, info } = useStore();
  return (
    <div className="app">
      <div className="titlebar">
        <div className="titlebar-drag" />
        <div className="window-controls">
          <button aria-label="Minimize" onClick={() => api.window.minimize()}>&#8211;</button>
          <button aria-label="Maximize" onClick={() => api.window.maximize()}>&#9633;</button>
          <button aria-label="Close" className="close" onClick={() => api.window.close()}>&#10005;</button>
        </div>
      </div>
      <nav className="sidebar">
        <Logo />
        <div className="nav-items">
          {PAGES.map((p) => (
            <button key={p.id} className={`nav-item ${page === p.id ? "active" : ""}`} onClick={() => setPage(p.id)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d={p.icon} /></svg>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">v{info?.version ?? "…"}{info?.devOffline ? " · dev" : ""}</div>
      </nav>
      <main className="content" key={page}>
        {page === "home" && <HomePage onNavigate={(p) => setPage(p as PageId)} />}
        {page === "versions" && <VersionsPage />}
        {page === "mods" && <ModsPage />}
        {page === "accounts" && <AccountsPage />}
        {page === "settings" && <SettingsPage />}
      </main>
      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
