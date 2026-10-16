import type {
  AccountSummary, CompatibilityEntry, DeviceCodeInfo, GameProfile, InstalledMod, JavaInstallation,
  LaunchStatus, LauncherSettings, MinecraftVersionInfo, ModSearchHit, NewsItem, ProgressEvent
} from "../shared/types";

interface Bridge {
  call<T>(channel: string, ...args: unknown[]): Promise<T>;
  on(channel: string, listener: (payload: unknown) => void): () => void;
}

declare global {
  interface Window {
    zenith: Bridge;
  }
}

export interface AppInfo {
  version: string;
  dataDir: string;
  platform: string;
  devOffline: boolean;
  totalMemoryMb: number;
  msClientConfigured: boolean;
}

const b = () => window.zenith;

export const api = {
  appInfo: () => b().call<AppInfo>("app:info"),
  window: {
    minimize: () => b().call<void>("window:minimize"),
    maximize: () => b().call<void>("window:maximize"),
    close: () => b().call<void>("window:close")
  },
  openPath: (target: "data" | "logs" | "instance", profileId?: string) => b().call<string>("shell:openPath", target, profileId),
  openExternal: (url: string) => b().call<void>("shell:openExternal", url),
  settings: {
    get: () => b().call<LauncherSettings>("settings:get"),
    update: (patch: Partial<LauncherSettings>) => b().call<LauncherSettings>("settings:update", patch),
    pickDirectory: () => b().call<string | null>("settings:pickDirectory"),
    pickJava: () => b().call<string | null>("settings:pickJava")
  },
  profiles: {
    list: () => b().call<GameProfile[]>("profiles:list"),
    upsert: (p: GameProfile) => b().call<GameProfile[]>("profiles:upsert", p),
    remove: (id: string) => b().call<GameProfile[]>("profiles:remove", id)
  },
  versions: {
    list: () => b().call<MinecraftVersionInfo[]>("versions:list"),
    install: (id: string, loader: "vanilla" | "fabric") => b().call<string>("versions:install", id, loader)
  },
  compat: () => b().call<CompatibilityEntry[]>("compat:list"),
  news: () => b().call<NewsItem[]>("news:list"),
  java: {
    detect: () => b().call<JavaInstallation[]>("java:detect"),
    download: (major: number) => b().call<JavaInstallation>("java:download", major)
  },
  accounts: {
    list: () => b().call<AccountSummary[]>("accounts:list"),
    loginMicrosoft: () => b().call<AccountSummary>("accounts:loginMicrosoft"),
    cancelLogin: () => b().call<void>("accounts:cancelLogin"),
    refresh: (id: string) => b().call<AccountSummary>("accounts:refresh", id),
    remove: (id: string) => b().call<void>("accounts:remove", id),
    addOfflineDev: (name: string) => b().call<AccountSummary>("accounts:addOfflineDev", name)
  },
  mods: {
    installed: (profileId: string) => b().call<InstalledMod[]>("mods:installed", profileId),
    search: (q: string, profileId: string) => b().call<ModSearchHit[]>("mods:search", q, profileId),
    install: (projectId: string, profileId: string) => b().call<string[]>("mods:install", projectId, profileId),
    setEnabled: (profileId: string, file: string, enabled: boolean) => b().call<void>("mods:setEnabled", profileId, file, enabled),
    uninstall: (profileId: string, file: string) => b().call<void>("mods:uninstall", profileId, file)
  },
  launch: {
    status: () => b().call<LaunchStatus>("launch:status"),
    start: (profileId: string) => b().call<LaunchStatus>("launch:start", profileId),
    kill: () => b().call<void>("launch:kill")
  },
  onProgress: (fn: (e: ProgressEvent) => void) => b().on("progress", fn as (p: unknown) => void),
  onLaunchStatus: (fn: (s: LaunchStatus) => void) => b().on("launch:status", fn as (p: unknown) => void),
  onLaunchLog: (fn: (line: string) => void) => b().on("launch:log", fn as (p: unknown) => void),
  onDeviceCode: (fn: (c: DeviceCodeInfo) => void) => b().on("auth:deviceCode", fn as (p: unknown) => void)
};
