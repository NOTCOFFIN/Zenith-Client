import { promises as fs } from "node:fs";
import { fetchJson } from "../../util/http";
import { atomicWriteJson, exists, readJsonSafe } from "../../util/fsx";
import type { LauncherPaths } from "../paths";
import { mergeVersionJson } from "./merge";
import type { VersionJson, VersionManifest } from "./types";

export const VERSION_MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
export const FABRIC_META = "https://meta.fabricmc.net/v2";

export class VersionService {
  private manifest: VersionManifest | null = null;

  constructor(private readonly paths: LauncherPaths) {}

  async getManifest(force = false): Promise<VersionManifest> {
    if (this.manifest && !force) return this.manifest;
    const cache = `${this.paths.cacheDir}/version_manifest_v2.json`;
    try {
      this.manifest = await fetchJson<VersionManifest>(VERSION_MANIFEST_URL);
      await atomicWriteJson(cache, this.manifest);
    } catch (err) {
      const cached = await readJsonSafe<VersionManifest | null>(cache, null);
      if (!cached) throw err;
      this.manifest = cached;
    }
    return this.manifest;
  }

  async getFabricGameVersions(): Promise<Set<string>> {
    try {
      const list = await fetchJson<{ version: string }[]>(`${FABRIC_META}/versions/game`);
      return new Set(list.map((v) => v.version));
    } catch {
      return new Set();
    }
  }

  async getLatestFabricLoader(): Promise<string> {
    const list = await fetchJson<{ version: string; stable: boolean }[]>(`${FABRIC_META}/versions/loader`);
    const stable = list.find((l) => l.stable) ?? list[0];
    return stable.version;
  }

  /** Downloads (if needed) and returns the vanilla version JSON. */
  async getVanillaJson(id: string): Promise<VersionJson> {
    const path = this.paths.versionJson(id);
    if (await exists(path)) return JSON.parse(await fs.readFile(path, "utf8")) as VersionJson;
    const manifest = await this.getManifest();
    const entry = manifest.versions.find((v) => v.id === id);
    if (!entry) throw new Error(`Unknown Minecraft version ${id}`);
    const json = await fetchJson<VersionJson>(entry.url);
    await atomicWriteJson(path, json);
    return json;
  }

  fabricVersionId(gameVersion: string, loaderVersion: string): string {
    return `fabric-loader-${loaderVersion}-${gameVersion}`;
  }

  async getFabricJson(gameVersion: string, loaderVersion: string): Promise<VersionJson> {
    const id = this.fabricVersionId(gameVersion, loaderVersion);
    const path = this.paths.versionJson(id);
    if (await exists(path)) return JSON.parse(await fs.readFile(path, "utf8")) as VersionJson;
    const json = await fetchJson<VersionJson>(
      `${FABRIC_META}/versions/loader/${encodeURIComponent(gameVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`
    );
    await atomicWriteJson(path, json);
    return json;
  }

  /** Resolves a version id to a fully merged version JSON (walking inheritsFrom). */
  async resolve(id: string): Promise<VersionJson> {
    const json = JSON.parse(await fs.readFile(this.paths.versionJson(id), "utf8")) as VersionJson;
    if (!json.inheritsFrom) return json;
    const parent = await this.resolve(json.inheritsFrom);
    return mergeVersionJson(json, parent);
  }

  async isInstalled(id: string): Promise<boolean> {
    return (await exists(this.paths.versionJson(id))) && (await exists(`${this.paths.versionDir(id)}/.installed`));
  }
}
