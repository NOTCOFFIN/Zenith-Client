import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { InstalledMod, ModSearchHit } from "../../shared/types";
import { atomicWriteJson, ensureDir, exists, readJsonSafe } from "../util/fsx";
import { downloadFile, fetchJson } from "../util/http";

const API = "https://api.modrinth.com/v2";

interface MrVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  date_published: string;
  version_type: "release" | "beta" | "alpha";
  dependencies: { project_id: string | null; version_id: string | null; dependency_type: "required" | "optional" | "incompatible" | "embedded" }[];
  files: { url: string; filename: string; primary: boolean; size: number; hashes: { sha1: string; sha512: string } }[];
}

interface ModIndexEntry {
  fileName: string;
  projectId: string;
  versionId: string;
  title: string;
  managed: "zenith" | "user";
}

/** Mod management backed by the Modrinth API. Only .jar files from Modrinth's CDN are installed, hash-verified. */
export class ModrinthService {
  async search(query: string, gameVersion: string, loader: string, limit = 20): Promise<ModSearchHit[]> {
    const facets = JSON.stringify([[`versions:${gameVersion}`], [`categories:${loader}`], ["project_type:mod"]]);
    const res = await fetchJson<{ hits: { project_id: string; slug: string; title: string; description: string; author: string; downloads: number; icon_url: string | null; categories: string[] }[] }>(
      `${API}/search?query=${encodeURIComponent(query)}&facets=${encodeURIComponent(facets)}&limit=${limit}`
    );
    return res.hits.map((h) => ({ projectId: h.project_id, slug: h.slug, title: h.title, description: h.description, author: h.author, downloads: h.downloads, iconUrl: h.icon_url, categories: h.categories }));
  }

  async bestVersion(projectIdOrSlug: string, gameVersion: string, loader: string): Promise<MrVersion | null> {
    const versions = await fetchJson<MrVersion[]>(
      `${API}/project/${encodeURIComponent(projectIdOrSlug)}/version?game_versions=${encodeURIComponent(JSON.stringify([gameVersion]))}&loaders=${encodeURIComponent(JSON.stringify([loader]))}`
    );
    return versions.find((v) => v.version_type === "release") ?? versions[0] ?? null;
  }

  async projectTitle(projectId: string): Promise<string> {
    const p = await fetchJson<{ title: string }>(`${API}/project/${encodeURIComponent(projectId)}`);
    return p.title;
  }

  private indexFile(modsDir: string) {
    return join(modsDir, ".zenith-mods.json");
  }

  async installed(modsDir: string): Promise<InstalledMod[]> {
    await ensureDir(modsDir);
    const index = await readJsonSafe<ModIndexEntry[]>(this.indexFile(modsDir), []);
    const files = await fs.readdir(modsDir);
    const out: InstalledMod[] = [];
    for (const f of files) {
      if (!f.endsWith(".jar") && !f.endsWith(".jar.disabled")) continue;
      const base = f.replace(/\.disabled$/, "");
      const entry = index.find((e) => e.fileName === base);
      const stat = await fs.stat(join(modsDir, f));
      out.push({ fileName: base, enabled: !f.endsWith(".disabled"), projectId: entry?.projectId ?? null, versionId: entry?.versionId ?? null, title: entry?.title ?? base, managed: entry?.managed ?? "user", sizeBytes: stat.size });
    }
    return out.sort((a, b) => a.title.localeCompare(b.title));
  }

  /** Installs a project plus its required dependencies. Returns the titles that were installed. */
  async install(projectId: string, gameVersion: string, loader: string, modsDir: string, managed: "zenith" | "user" = "user", seen = new Set<string>()): Promise<string[]> {
    if (seen.has(projectId)) return [];
    seen.add(projectId);
    const version = await this.bestVersion(projectId, gameVersion, loader);
    if (!version) throw new Error(`No ${loader} build of this mod exists for Minecraft ${gameVersion}.`);
    const file = version.files.find((f) => f.primary) ?? version.files[0];
    if (!file || !file.filename.endsWith(".jar")) throw new Error("Refusing to install a non-jar file.");
    if (!file.url.startsWith("https://cdn.modrinth.com/")) throw new Error("Refusing to download from an untrusted host.");

    const installed = await this.installed(modsDir);
    const index = await readJsonSafe<ModIndexEntry[]>(this.indexFile(modsDir), []);
    // Remove an older version of the same project.
    for (const old of installed.filter((m) => m.projectId === version.project_id && m.fileName !== file.filename)) {
      await fs.rm(join(modsDir, old.fileName), { force: true });
      await fs.rm(join(modsDir, `${old.fileName}.disabled`), { force: true });
    }
    await downloadFile({ url: file.url, dest: join(modsDir, file.filename), hash: { algo: "sha512", value: file.hashes.sha512 } });
    const title = await this.projectTitle(version.project_id).catch(() => file.filename);
    const nextIndex = index.filter((e) => e.projectId !== version.project_id);
    nextIndex.push({ fileName: file.filename, projectId: version.project_id, versionId: version.id, title, managed });
    await atomicWriteJson(this.indexFile(modsDir), nextIndex);

    const titles = [title];
    for (const dep of version.dependencies.filter((d) => d.dependency_type === "required" && d.project_id)) {
      if (installed.some((m) => m.projectId === dep.project_id)) continue;
      titles.push(...(await this.install(dep.project_id!, gameVersion, loader, modsDir, managed, seen)));
    }
    return titles;
  }

  async setEnabled(modsDir: string, fileName: string, enabled: boolean): Promise<void> {
    const on = join(modsDir, fileName);
    const off = `${on}.disabled`;
    if (enabled && (await exists(off))) await fs.rename(off, on);
    if (!enabled && (await exists(on))) await fs.rename(on, off);
  }

  async uninstall(modsDir: string, fileName: string): Promise<void> {
    if (fileName.includes("/") || fileName.includes("\\")) throw new Error("Invalid file name");
    await fs.rm(join(modsDir, fileName), { force: true });
    await fs.rm(join(modsDir, `${fileName}.disabled`), { force: true });
    const index = await readJsonSafe<ModIndexEntry[]>(this.indexFile(modsDir), []);
    await atomicWriteJson(this.indexFile(modsDir), index.filter((e) => e.fileName !== fileName));
  }
}
