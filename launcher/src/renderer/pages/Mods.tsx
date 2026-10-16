import { useEffect, useState } from "react";
import type { InstalledMod, ModSearchHit } from "../../shared/types";
import { api } from "../api";
import { errorText, useStore } from "../store";

export function ModsPage() {
  const { settings, profiles, toast } = useStore();
  const profile = profiles.find((p) => p.id === settings?.selectedProfileId) ?? profiles[0];
  const [installed, setInstalled] = useState<InstalledMod[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ModSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    if (profile) setInstalled(await api.mods.installed(profile.id));
  };
  useEffect(() => void reload(), [profile?.id]);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!profile) return;
    setSearching(true);
    try {
      setResults(await api.mods.search(query, profile.id));
    } catch (err) {
      toast("error", errorText(err));
    } finally {
      setSearching(false);
    }
  };

  const install = async (hit: ModSearchHit) => {
    if (!profile) return;
    setBusy(hit.projectId);
    try {
      const titles = await api.mods.install(hit.projectId, profile.id);
      toast("success", `Installed ${titles.join(", ")}. Restart Minecraft to load new mods.`);
      await reload();
    } catch (err) {
      toast("error", errorText(err));
    } finally {
      setBusy(null);
    }
  };

  if (!profile) return <div className="page"><p className="muted">No profile selected.</p></div>;
  const isFabric = profile.loader === "fabric";

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Mods</h1>
          <p className="muted">Managing <strong>{profile.name}</strong> (Minecraft {profile.minecraftVersion}). Mods are installed per profile and downloaded from Modrinth with SHA-512 verification.</p>
        </div>
        <button className="btn ghost" onClick={() => api.openPath("instance", profile.id)}>Open folder</button>
      </header>

      {!isFabric && <p className="error">This is a vanilla profile. Create a Fabric profile on the Versions page to use mods.</p>}

      <section className="card glass">
        <h2>Installed ({installed.length})</h2>
        {installed.length === 0 && <p className="muted">No mods yet. Zenith profiles get Fabric API, Sodium, Lithium and FerriteCore on first launch.</p>}
        <table className="table">
          <tbody>
            {installed.map((m) => (
              <tr key={m.fileName}>
                <td>
                  <strong>{m.title}</strong>
                  <div className="muted small">{m.fileName}</div>
                </td>
                <td>{m.managed === "zenith" ? <span className="badge accent">Zenith stack</span> : <span className="badge">User</span>}</td>
                <td>{(m.sizeBytes / 1024 / 1024).toFixed(1)} MB</td>
                <td className="row-actions">
                  <label className="switch">
                    <input type="checkbox" checked={m.enabled} onChange={async (e) => { await api.mods.setEnabled(profile.id, m.fileName, e.target.checked); await reload(); }} />
                    <span />
                  </label>
                  <button className="btn small danger" onClick={async () => { await api.mods.uninstall(profile.id, m.fileName); await reload(); }}>Uninstall</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {isFabric && (
        <section className="card glass">
          <h2>Browse Modrinth</h2>
          <form className="toolbar" onSubmit={search}>
            <input className="input" placeholder={`Search Fabric mods for ${profile.minecraftVersion}…`} value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="btn" type="submit" disabled={searching}>{searching ? "Searching…" : "Search"}</button>
          </form>
          <div className="mod-grid">
            {results.map((r) => {
              const has = installed.some((m) => m.projectId === r.projectId);
              return (
                <div key={r.projectId} className="mod-card">
                  {r.iconUrl ? <img src={r.iconUrl} alt="" width={48} height={48} /> : <div className="mod-icon" />}
                  <div className="mod-body">
                    <strong>{r.title}</strong>
                    <span className="muted small">by {r.author} · {r.downloads.toLocaleString()} downloads</span>
                    <p>{r.description}</p>
                  </div>
                  <button className="btn small" disabled={has || busy === r.projectId} onClick={() => install(r)}>
                    {has ? "Installed" : busy === r.projectId ? "Installing…" : "Install"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
