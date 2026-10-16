import { useEffect, useState } from "react";
import type { JavaInstallation } from "../../shared/types";
import { api } from "../api";
import { errorText, useStore } from "../store";

export function SettingsPage() {
  const { settings, updateSettings, info, toast } = useStore();
  const [javas, setJavas] = useState<JavaInstallation[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [jvmArgs, setJvmArgs] = useState(settings?.jvmArgs ?? "");

  const detect = async () => {
    setDetecting(true);
    try {
      setJavas(await api.java.detect());
    } finally {
      setDetecting(false);
    }
  };
  useEffect(() => void detect(), []);
  useEffect(() => setJvmArgs(settings?.jvmArgs ?? ""), [settings?.jvmArgs]);

  if (!settings) return null;
  const maxRam = Math.max(2048, Math.floor((info?.totalMemoryMb ?? 8192) * 0.75 / 256) * 256);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Launch settings</h1>
          <p className="muted">Changes save automatically.</p>
        </div>
      </header>

      <section className="card glass form">
        <h2>Memory</h2>
        <label className="field">
          <span>Maximum RAM: <strong>{(settings.memoryMaxMb / 1024).toFixed(1)} GB</strong></span>
          <input type="range" min={1024} max={maxRam} step={256} value={settings.memoryMaxMb} onChange={(e) => void updateSettings({ memoryMaxMb: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>Minimum RAM: <strong>{(settings.memoryMinMb / 1024).toFixed(1)} GB</strong></span>
          <input type="range" min={512} max={settings.memoryMaxMb} step={256} value={settings.memoryMinMb} onChange={(e) => void updateSettings({ memoryMinMb: Number(e.target.value) })} />
        </label>
      </section>

      <section className="card glass form">
        <h2>Java</h2>
        <div className="field">
          <span>Java installation</span>
          <select className="select" value={settings.javaPath ?? ""} onChange={(e) => void updateSettings({ javaPath: e.target.value || null })}>
            <option value="">Automatic (pick the right version per Minecraft release)</option>
            {settings.javaPath && !javas.some((j) => j.path === settings.javaPath) && <option value={settings.javaPath}>{settings.javaPath}</option>}
            {javas.map((j) => (
              <option key={j.path} value={j.path}>Java {j.majorVersion} ({j.version}) · {j.path}</option>
            ))}
          </select>
        </div>
        <div className="row-actions">
          <button className="btn small" onClick={detect} disabled={detecting}>{detecting ? "Scanning…" : "Rescan"}</button>
          <button className="btn small ghost" onClick={async () => { const p = await api.settings.pickJava(); if (p) await updateSettings({ javaPath: p }); }}>Browse…</button>
          <button className="btn small ghost" onClick={async () => { try { const j = await api.java.download(21); toast("success", `Installed Java ${j.version}`); await detect(); } catch (err) { toast("error", errorText(err)); } }}>Download Java 21</button>
        </div>
        <label className="check">
          <input type="checkbox" checked={settings.autoDownloadJava} onChange={(e) => void updateSettings({ autoDownloadJava: e.target.checked })} />
          Automatically download a compatible Java runtime (Eclipse Temurin) when none is found
        </label>
        <label className="field">
          <span>JVM arguments</span>
          <input className="input mono" value={jvmArgs} onChange={(e) => setJvmArgs(e.target.value)} onBlur={() => void updateSettings({ jvmArgs })} />
        </label>
      </section>

      <section className="card glass form">
        <h2>Game window</h2>
        <div className="inline-fields">
          <label className="field"><span>Width</span><input className="input" type="number" min={640} value={settings.resolution.width} onChange={(e) => void updateSettings({ resolution: { ...settings.resolution, width: Number(e.target.value) } })} /></label>
          <label className="field"><span>Height</span><input className="input" type="number" min={480} value={settings.resolution.height} onChange={(e) => void updateSettings({ resolution: { ...settings.resolution, height: Number(e.target.value) } })} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={settings.fullscreen} onChange={(e) => void updateSettings({ fullscreen: e.target.checked })} /> Start in fullscreen</label>
        <label className="check"><input type="checkbox" checked={settings.closeOnLaunch} onChange={(e) => void updateSettings({ closeOnLaunch: e.target.checked })} /> Minimize the launcher when the game starts</label>
      </section>

      <section className="card glass form">
        <h2>Game directory</h2>
        <p className="muted">By default every profile gets its own isolated folder. Override applies to the selected profile only.</p>
        <div className="toolbar">
          <input className="input mono" readOnly value={settings.gameDirectory ?? "Per-profile (recommended)"} />
          <button className="btn small" onClick={async () => { const d = await api.settings.pickDirectory(); if (d) await updateSettings({ gameDirectory: d }); }}>Choose…</button>
          {settings.gameDirectory && <button className="btn small ghost" onClick={() => void updateSettings({ gameDirectory: null })}>Reset</button>}
        </div>
      </section>

      <section className="card glass form">
        <h2>Launcher</h2>
        <div className="row-actions">
          <button className="btn small ghost" onClick={() => api.openPath("data")}>Open data folder</button>
          <button className="btn small ghost" onClick={() => api.openPath("logs")}>Open logs</button>
        </div>
      </section>
    </div>
  );
}
