import { useEffect, useMemo, useState } from "react";
import type { NewsItem, PerformancePreset } from "../../shared/types";
import { api } from "../api";
import { errorText, useStore } from "../store";
import { SkinViewer } from "../components/SkinViewer";

const PRESETS: { id: PerformancePreset; label: string; hint: string }[] = [
  { id: "max-fps", label: "Max FPS", hint: "Lower distances, fast graphics, minimal effects" },
  { id: "balanced", label: "Balanced", hint: "Good visuals with the optimization stack" },
  { id: "quality", label: "Quality", hint: "Fancy graphics, longer render distance" },
  { id: "custom", label: "Custom", hint: "Leave my in-game video settings alone" }
];

export function HomePage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { settings, profiles, accounts, launch, progress, logs, updateSettings, toast, info } = useStore();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [showLog, setShowLog] = useState(false);
  const account = accounts.find((a) => a.id === settings?.selectedAccountId) ?? null;
  const profile = profiles.find((p) => p.id === settings?.selectedProfileId) ?? profiles[0];
  const busy = launch.state === "preparing" || launch.state === "running";

  useEffect(() => {
    void api.news().then(setNews).catch(() => setNews([]));
  }, []);

  const pct = useMemo(() => (progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : null), [progress]);

  const play = async () => {
    if (!profile) return;
    if (!account) {
      toast("error", "Add a Minecraft account first.");
      onNavigate("accounts");
      return;
    }
    try {
      await api.launch.start(profile.id);
    } catch (err) {
      toast("error", errorText(err));
    }
  };

  return (
    <div className="page home">
      <section className="hero glass">
        <div className="hero-model">
          <SkinViewer skinUrl={account?.skinUrl ?? null} slim={account?.skinVariant === "slim"} />
          <div className="hero-name">{account ? account.username : "No account"}</div>
          {account?.type === "offline-dev" && <span className="badge warn">Offline dev account</span>}
        </div>
        <div className="hero-main">
          <h1 className="brand-title">ZENITH CLIENT</h1>
          <p className="tagline">Reach Your Peak.</p>

          <label className="field-label" htmlFor="profile">Profile</label>
          <select id="profile" className="select" value={profile?.id ?? ""} disabled={busy} onChange={(e) => void updateSettings({ selectedProfileId: e.target.value })}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {p.loader === "fabric" ? "Fabric" : "Vanilla"} {p.minecraftVersion}{p.zenithEnhanced ? " · Zenith" : ""}</option>
            ))}
          </select>

          <button className={`play-button ${busy ? "busy" : ""}`} onClick={play} disabled={busy || !profile}>
            {launch.state === "preparing" ? "Preparing…" : launch.state === "running" ? "Running" : "PLAY"}
          </button>

          {(progress || launch.message) && (
            <div className="launch-status">
              <div className="launch-message">{progress?.message ?? progress?.stage ?? launch.message}</div>
              {pct !== null && launch.state === "preparing" && (
                <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
              )}
              {launch.state === "running" && <button className="link" onClick={() => api.launch.kill()}>Force close game</button>}
              {(launch.state === "crashed" || logs.length > 0) && <button className="link" onClick={() => setShowLog((s) => !s)}>{showLog ? "Hide" : "Show"} game log</button>}
            </div>
          )}
          {showLog && <pre className="log-view">{logs.slice(-200).join("\n")}</pre>}
        </div>
      </section>

      <div className="grid-2">
        <section className="card glass">
          <h2>Performance preset</h2>
          <p className="muted">Applied to the profile's video settings at launch. Sodium, Lithium and FerriteCore are installed in Zenith profiles.</p>
          <div className="preset-grid">
            {PRESETS.map((p) => (
              <button key={p.id} className={`preset ${settings?.performancePreset === p.id ? "active" : ""}`} onClick={() => void updateSettings({ performancePreset: p.id })}>
                <strong>{p.label}</strong>
                <span>{p.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card glass">
          <h2>News</h2>
          {news.length === 0 && <p className="muted">No news available.</p>}
          <ul className="news">
            {news.map((n) => (
              <li key={n.id}>
                <div className="news-head"><span className="badge">{n.tag}</span><time>{n.date}</time></div>
                <strong>{n.title}</strong>
                <p>{n.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="footer-meta muted">Launcher v{info?.version} · Data: {info?.dataDir}</div>
    </div>
  );
}
