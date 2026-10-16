export type LoaderType = "vanilla" | "fabric";

export interface LauncherSettings {
  schemaVersion: number;
  memoryMinMb: number;
  memoryMaxMb: number;
  javaPath: string | null;
  autoDownloadJava: boolean;
  gameDirectory: string | null;
  resolution: { width: number; height: number };
  fullscreen: boolean;
  jvmArgs: string;
  selectedProfileId: string;
  selectedAccountId: string | null;
  closeOnLaunch: boolean;
  performancePreset: PerformancePreset;
}

export type PerformancePreset = "max-fps" | "balanced" | "quality" | "custom";

export interface GameProfile {
  id: string;
  name: string;
  minecraftVersion: string;
  loader: LoaderType;
  loaderVersion: string | null;
  /** Install the Zenith in-game client and its performance stack into this profile. */
  zenithEnhanced: boolean;
  createdAt: string;
  lastPlayed: string | null;
}

export interface AccountSummary {
  id: string;
  username: string;
  uuid: string;
  type: "microsoft" | "offline-dev";
  skinUrl: string | null;
  skinVariant: "classic" | "slim";
  expiresAt: number;
}

export interface MinecraftVersionInfo {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha";
  releaseTime: string;
  installed: boolean;
  fabricSupported: boolean;
  zenithSupported: boolean;
}

export interface ProgressEvent {
  taskId: string;
  stage: string;
  current: number;
  total: number;
  message?: string;
}

export interface JavaInstallation {
  path: string;
  version: string;
  majorVersion: number;
  arch: string;
  source: "settings" | "java-home" | "path" | "system" | "zenith-runtime";
}

export type LaunchState = "idle" | "preparing" | "running" | "exited" | "crashed";

export interface LaunchStatus {
  state: LaunchState;
  profileId: string | null;
  pid: number | null;
  exitCode: number | null;
  message: string | null;
  logFile: string | null;
}

export interface DeviceCodeInfo {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  message: string;
}

export interface ModSearchHit {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  iconUrl: string | null;
  categories: string[];
}

export interface InstalledMod {
  fileName: string;
  enabled: boolean;
  projectId: string | null;
  versionId: string | null;
  title: string;
  managed: "zenith" | "user";
  sizeBytes: number;
}

export interface NewsItem {
  id: string;
  title: string;
  date: string;
  body: string;
  tag: string;
}

export interface CompatibilityEntry {
  minecraftVersion: string;
  launcher: SupportLevel;
  fabric: SupportLevel;
  zenithClient: SupportLevel;
  notes: string;
}

export type SupportLevel = "tested" | "implemented" | "untested" | "unsupported";
