import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { promises as fs } from "node:fs";
import os from "node:os";
import { join, resolve } from "node:path";
import type { GameProfile, LauncherSettings, MinecraftVersionInfo } from "../shared/types";
import { exists } from "./util/fsx";
import { AccountService } from "./services/accounts";
import { loadCompatibility, loadNews } from "./services/content";
import { Installer } from "./services/installer";
import { JavaService } from "./services/java";
import { LaunchService } from "./services/launch";
import { ModrinthService } from "./services/modrinth";
import { VersionService } from "./services/mojang/versions";
import { LauncherPaths } from "./services/paths";
import { ProfileService, SettingsService } from "./services/settings";
import { electronCipher } from "./secure";

/** Built-in Azure application id. Override with ZENITH_MS_CLIENT_ID; see docs/AUTHENTICATION.md. */
const DEFAULT_MS_CLIENT_ID = "";

export function registerIpc(win: BrowserWindow) {
  const root = process.env.ZENITH_HOME ? resolve(process.env.ZENITH_HOME) : join(app.getPath("appData"), ".zenith-client");
  const paths = new LauncherPaths(root);
  const settings = new SettingsService(paths.settingsFile);
  const profiles = new ProfileService(paths.profilesFile);
  const versions = new VersionService(paths);
  const installer = new Installer(paths, versions);
  const java = new JavaService(paths.runtimesDir);
  const modrinth = new ModrinthService();
  const accounts = new AccountService(paths.accountsFile, electronCipher, () => process.env.ZENITH_MS_CLIENT_ID ?? DEFAULT_MS_CLIENT_ID);
  const resourcesDir = app.isPackaged ? process.resourcesPath : join(__dirname, "../../resources");
  const devOffline = process.env.ZENITH_DEV_OFFLINE === "1";

  const zenithModJar = async (): Promise<string | null> => {
    const candidates = [join(resourcesDir, "mods"), join(__dirname, "../../../minecraft-client/build/libs")];
    for (const dir of candidates) {
      if (!(await exists(dir))) continue;
      const jar = (await fs.readdir(dir)).find((f) => /^zenith-client-.*\.jar$/.test(f) && !f.includes("-sources"));
      if (jar) return join(dir, jar);
    }
    return null;
  };
  const launcher = new LaunchService({ paths, installer, java, modrinth, zenithModJar });

  const send = (channel: string, payload: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  };
  const handle = (channel: string, fn: (...args: any[]) => unknown) =>
    ipcMain.handle(channel, async (_e, ...args) => {
      try {
        return { ok: true, value: await fn(...args) };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    });

  handle("app:info", () => ({ version: app.getVersion(), dataDir: root, platform: process.platform, devOffline, totalMemoryMb: Math.floor(os.totalmem() / 1048576), msClientConfigured: !!(process.env.ZENITH_MS_CLIENT_ID ?? DEFAULT_MS_CLIENT_ID) }));
  handle("window:minimize", () => win.minimize());
  handle("window:maximize", () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
  handle("window:close", () => win.close());
  handle("shell:openPath", async (target: "data" | "logs" | "instance", profileId?: string) => {
    const p = target === "logs" ? paths.logsDir : target === "instance" && profileId ? paths.instanceDir(profileId) : root;
    await fs.mkdir(p, { recursive: true });
    return shell.openPath(p);
  });
  handle("shell:openExternal", (url: string) => {
    if (!/^https:\/\//.test(url)) throw new Error("Only https links can be opened");
    return shell.openExternal(url);
  });

  handle("settings:get", () => settings.get());
  handle("settings:update", (patch: Partial<LauncherSettings>) => settings.update(patch));
  handle("settings:pickDirectory", async () => {
    const r = await dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"] });
    return r.canceled ? null : r.filePaths[0];
  });
  handle("settings:pickJava", async () => {
    const r = await dialog.showOpenDialog(win, { properties: ["openFile"], filters: process.platform === "win32" ? [{ name: "Java", extensions: ["exe"] }] : [] });
    return r.canceled ? null : r.filePaths[0];
  });

  handle("profiles:list", () => profiles.list());
  handle("profiles:upsert", (p: GameProfile) => profiles.upsert(p));
  handle("profiles:remove", (id: string) => profiles.remove(id));

  handle("versions:list", async (): Promise<MinecraftVersionInfo[]> => {
    const [manifest, fabric] = await Promise.all([versions.getManifest(), versions.getFabricGameVersions()]);
    const compat = loadCompatibility(resourcesDir);
    return Promise.all(
      manifest.versions.map(async (v) => ({
        id: v.id,
        type: v.type as MinecraftVersionInfo["type"],
        releaseTime: v.releaseTime,
        installed: await versions.isInstalled(v.id),
        fabricSupported: fabric.has(v.id),
        zenithSupported: compat.some((c) => c.minecraftVersion === v.id && c.zenithClient !== "unsupported")
      }))
    );
  });
  handle("versions:install", (minecraftVersion: string, loader: "vanilla" | "fabric") =>
    installer.install({ minecraftVersion, loader }, (e) => send("progress", e)).then((r) => r.versionId)
  );
  handle("compat:list", () => loadCompatibility(resourcesDir));
  handle("news:list", () => loadNews(resourcesDir));

  handle("java:detect", async () => java.detect((await settings.get()).javaPath));
  handle("java:download", (major: number) => java.downloadRuntime(major, (c, t) => send("progress", { taskId: "java", stage: "java", current: c, total: t, message: `Downloading Java ${major}` })));

  handle("accounts:list", () => accounts.list());
  handle("accounts:loginMicrosoft", async () => {
    const acc = await accounts.beginMicrosoftLogin((code) => send("auth:deviceCode", code));
    await settings.update({ selectedAccountId: acc.id });
    return acc;
  });
  handle("accounts:cancelLogin", () => accounts.cancelLogin());
  handle("accounts:refresh", (id: string) => accounts.refresh(id));
  handle("accounts:remove", async (id: string) => {
    await accounts.remove(id);
    const s = await settings.get();
    if (s.selectedAccountId === id) await settings.update({ selectedAccountId: null });
  });
  handle("accounts:addOfflineDev", async (username: string) => {
    if (!devOffline) throw new Error("Offline accounts are only available in development mode.");
    const acc = await accounts.addOfflineDevAccount(username);
    await settings.update({ selectedAccountId: acc.id });
    return acc;
  });

  handle("mods:installed", (profileId: string) => modrinth.installed(paths.modsDir(profileId)));
  handle("mods:search", async (query: string, profileId: string) => {
    const p = await profiles.get(profileId);
    return modrinth.search(query, p.minecraftVersion, p.loader === "vanilla" ? "fabric" : p.loader);
  });
  handle("mods:install", async (projectId: string, profileId: string) => {
    const p = await profiles.get(profileId);
    if (p.loader === "vanilla") throw new Error("Mods require a Fabric profile.");
    return modrinth.install(projectId, p.minecraftVersion, p.loader, paths.modsDir(profileId));
  });
  handle("mods:setEnabled", (profileId: string, fileName: string, enabled: boolean) => modrinth.setEnabled(paths.modsDir(profileId), fileName, enabled));
  handle("mods:uninstall", (profileId: string, fileName: string) => modrinth.uninstall(paths.modsDir(profileId), fileName));

  handle("launch:status", () => launcher.getStatus());
  handle("launch:start", async (profileId: string) => {
    const s = await settings.get();
    if (!s.selectedAccountId) throw new Error("Add a Minecraft account before playing.");
    const session = await accounts.getSession(s.selectedAccountId);
    const profile = await profiles.get(profileId);
    const status = await launcher.launch(profile, s, session, {
      onProgress: (e) => send("progress", e),
      onStatus: (st) => send("launch:status", st),
      onLog: (line) => send("launch:log", line)
    });
    await profiles.touch(profileId);
    if (s.closeOnLaunch) win.minimize();
    return status;
  });
  handle("launch:kill", () => launcher.kill());
}
