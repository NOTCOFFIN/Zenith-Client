import os from "node:os";
import type { GameProfile, LauncherSettings } from "../../shared/types";
import { atomicWriteJson, readJsonSafe } from "../util/fsx";

export const SETTINGS_SCHEMA_VERSION = 1;
export const DEFAULT_PROFILE_ID = "zenith-1.21.1";

export function defaultSettings(): LauncherSettings {
  const totalMb = Math.floor(os.totalmem() / 1024 / 1024);
  const maxMb = Math.max(2048, Math.min(4096, Math.floor(totalMb / 4 / 512) * 512));
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    memoryMinMb: 1024,
    memoryMaxMb: maxMb,
    javaPath: null,
    autoDownloadJava: true,
    gameDirectory: null,
    resolution: { width: 1280, height: 720 },
    fullscreen: false,
    jvmArgs: "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200",
    selectedProfileId: DEFAULT_PROFILE_ID,
    selectedAccountId: null,
    closeOnLaunch: false,
    performancePreset: "balanced"
  };
}

/** Migrates older settings files forward. Unknown keys are dropped, missing keys get defaults. */
export function migrateSettings(raw: Partial<LauncherSettings> & { schemaVersion?: number }): LauncherSettings {
  const defaults = defaultSettings();
  const merged: LauncherSettings = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof LauncherSettings)[]) {
    if (raw[key] !== undefined && typeof raw[key] === typeof defaults[key]) (merged as unknown as Record<string, unknown>)[key] = raw[key];
    if (key === "javaPath" || key === "gameDirectory" || key === "selectedAccountId") {
      const v = raw[key];
      if (v === null || typeof v === "string") (merged as unknown as Record<string, unknown>)[key] = v;
    }
  }
  merged.memoryMaxMb = Math.max(1024, merged.memoryMaxMb);
  merged.memoryMinMb = Math.min(Math.max(256, merged.memoryMinMb), merged.memoryMaxMb);
  merged.schemaVersion = SETTINGS_SCHEMA_VERSION;
  return merged;
}

export class SettingsService {
  constructor(private readonly file: string) {}

  async get(): Promise<LauncherSettings> {
    return migrateSettings(await readJsonSafe(this.file, {}));
  }

  async update(patch: Partial<LauncherSettings>): Promise<LauncherSettings> {
    const next = migrateSettings({ ...(await this.get()), ...patch });
    await atomicWriteJson(this.file, next);
    return next;
  }
}

export function defaultProfiles(): GameProfile[] {
  const now = new Date().toISOString();
  return [
    { id: DEFAULT_PROFILE_ID, name: "Zenith 1.21.1", minecraftVersion: "1.21.1", loader: "fabric", loaderVersion: null, zenithEnhanced: true, createdAt: now, lastPlayed: null }
  ];
}

export class ProfileService {
  constructor(private readonly file: string) {}

  async list(): Promise<GameProfile[]> {
    const data = await readJsonSafe<{ profiles: GameProfile[] } | null>(this.file, null);
    if (!data || data.profiles.length === 0) {
      const profiles = defaultProfiles();
      await atomicWriteJson(this.file, { schemaVersion: 1, profiles });
      return profiles;
    }
    return data.profiles;
  }

  async get(id: string): Promise<GameProfile> {
    const p = (await this.list()).find((x) => x.id === id);
    if (!p) throw new Error(`Profile ${id} not found`);
    return p;
  }

  async upsert(profile: GameProfile): Promise<GameProfile[]> {
    if (!/^[a-z0-9._-]{1,48}$/.test(profile.id)) throw new Error("Profile id may only contain a-z, 0-9, '.', '_' and '-'.");
    const profiles = (await this.list()).filter((p) => p.id !== profile.id);
    profiles.push(profile);
    await atomicWriteJson(this.file, { schemaVersion: 1, profiles });
    return profiles;
  }

  async remove(id: string): Promise<GameProfile[]> {
    const profiles = (await this.list()).filter((p) => p.id !== id);
    await atomicWriteJson(this.file, { schemaVersion: 1, profiles });
    return profiles;
  }

  async touch(id: string): Promise<void> {
    const p = await this.get(id);
    await this.upsert({ ...p, lastPlayed: new Date().toISOString() });
  }
}
