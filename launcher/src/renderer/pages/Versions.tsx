import { useEffect, useMemo, useState } from "react";
import type { CompatibilityEntry, GameProfile, MinecraftVersionInfo } from "../../shared/types";
import { api } from "../api";
import { errorText, useStore } from "../store";

export function VersionsPage() {
  const { profiles, reloadProfiles, toast, progress, updateSettings, settings } = useStore();
  const [versions, setVersions] = useState<MinecraftVersionInfo[]>([]);
  const [compat, setCompat] = useState<CompatibilityEntry[]>([]);
  const [filter, setFilter] = useState<"release" | "snapshot" | "all">("release");
  const [query, setQuery] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [v, c] = await Promise.all([api.versions.list(), api.compat()]);
      setVersions(v);
      setCompat(c);
      setError(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => void load(), []);

  const shown = useMemo(
    () => versions.filter((v) => (filter === "all" || v.type === filter) && v.id.includes(query.trim())).slice(0, 200),
    [versions, filter, query]
  );

  const install = async (v: MinecraftVersionInfo, loader: "vanilla" | "fabric") => {
    setInstalling(`${v.id}:${loader}`);
    try {
      await api.versions.install(v.id, loader);
      toast("success", `Minecraft ${v.id} (${loader}) installed`);
      await load();
    } catch (err) {
      toast("error", errorText(err));
    } finally {
      setInstalling(null);
    }
  };

  const createProfile = async (v: MinecraftVersionInfo, loader: "vanilla" | "fabric") => {
    const id = `${loader}-${v.id}`.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
    const profile: GameProfile = {
      id,
      name: `${loader === "fabric" ? "Fabric" : "Vanilla"} ${v.id}`,
      minecraftVersion: v.id,
      loader,
      loaderVersion: null,
      zenithEnhanced: loader === "fabric" && v.zenithSupported,
      createdAt: new Date().toISOString(),
      lastPlayed: null
    };
    try {
      await api.profiles.upsert(profile);
      await reloadProfiles();
      await updateSettings({ selectedProfileId: id });
      toast("success", `Profile "${profile.name}" created and selected`);
    } catch (err) {
      toast("error", errorText(err));
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Versions</h1>
          <p className="muted">Install official Minecraft Java Edition releases. The Zenith in-game client is only enabled on versions in the compatibility matrix.</p>
        </div>
      </header>

      <section className="card glass">
        <h2>Profiles</h2>
        <table className="table">
          <thead><tr><th>Name</th><th>Version</th><th>Loader</th><th>Zenith client</th><th>Last played</th><th /></tr></thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className={settings?.selectedProfileId === p.id ? "selected" : ""}>
                <td>{p.name}</td>
                <td>{p.minecraftVersion}</td>
                <td>{p.loader}</td>
                <td>{p.zenithEnhanced ? <span className="badge ok">Enabled</span> : <span className="badge">Off</span>}</td>
                <td>{p.lastPlayed ? new Date(p.lastPlayed).toLocaleString() : "Never"}</td>
                <td className="row-actions">
                  <button className="btn small" onClick={() => void updateSettings({ selectedProfileId: p.id })}>Select</button>
                  <button className="btn small ghost" onClick={() => api.openPath("instance", p.id)}>Folder</button>
                  {profiles.length > 1 && (
                    <button className="btn small danger" onClick={async () => { await api.profiles.remove(p.id); await reloadProfiles(); }}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card glass">
        <h2>Compatibility matrix</h2>
        <table className="table">
          <thead><tr><th>Minecraft</th><th>Launcher</th><th>Fabric</th><th>Zenith client</th><th>Notes</th></tr></thead>
          <tbody>
            {compat.map((c) => (
              <tr key={c.minecraftVersion}>
                <td>{c.minecraftVersion}</td>
                <td><Level l={c.launcher} /></td>
                <td><Level l={c.fabric} /></td>
                <td><Level l={c.zenithClient} /></td>
                <td className="muted">{c.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card glass">
        <div className="toolbar">
          <input className="input" placeholder="Search versions…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="segmented">
            {(["release", "snapshot", "all"] as const).map((f) => (
              <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        {loading && <p className="muted">Loading version manifest…</p>}
        {error && <p className="error">{error} <button className="link" onClick={load}>Retry</button></p>}
        {progress && installing && <div className="progress"><div className="progress-bar" style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }} /></div>}
        <table className="table">
          <thead><tr><th>Version</th><th>Type</th><th>Released</th><th>Status</th><th /></tr></thead>
          <tbody>
            {shown.map((v) => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td>{v.type}</td>
                <td>{new Date(v.releaseTime).toLocaleDateString()}</td>
                <td>
                  {v.installed ? <span className="badge ok">Installed</span> : <span className="badge">Not installed</span>}{" "}
                  {v.zenithSupported && <span className="badge accent">Zenith</span>}
                </td>
                <td className="row-actions">
                  <button className="btn small" disabled={!!installing} onClick={() => install(v, "vanilla")}>{installing === `${v.id}:vanilla` ? "Installing…" : "Install"}</button>
                  <button className="btn small ghost" onClick={() => createProfile(v, "vanilla")}>+ Vanilla profile</button>
                  {v.fabricSupported && <button className="btn small ghost" onClick={() => createProfile(v, "fabric")}>+ Fabric profile</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Level({ l }: { l: CompatibilityEntry["launcher"] }) {
  const cls = l === "tested" ? "ok" : l === "implemented" ? "accent" : l === "unsupported" ? "danger" : "";
  return <span className={`badge ${cls}`}>{l}</span>;
}
