import AdmZip from "adm-zip";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { downloadFile, fetchJson, runPool, type DownloadSpec } from "../util/http";
import { atomicWriteFile, ensureDir, exists } from "../util/fsx";
import type { ProgressEvent } from "../../shared/types";
import type { LauncherPaths } from "./paths";
import { resolveLibraries } from "./mojang/libraries";
import { currentRuleEnv } from "./mojang/rules";
import type { VersionJson } from "./mojang/types";
import type { VersionService } from "./mojang/versions";

const RESOURCES_URL = "https://resources.download.minecraft.net";

export type ProgressFn = (e: ProgressEvent) => void;

export interface InstallRequest {
  minecraftVersion: string;
  loader: "vanilla" | "fabric";
  loaderVersion?: string | null;
}

export interface InstallResult {
  versionId: string;
  version: VersionJson;
}

export class Installer {
  constructor(private readonly paths: LauncherPaths, private readonly versions: VersionService) {}

  async install(req: InstallRequest, onProgress: ProgressFn = () => undefined): Promise<InstallResult> {
    const taskId = `install:${req.minecraftVersion}:${req.loader}`;
    const report = (stage: string, current: number, total: number, message?: string) =>
      onProgress({ taskId, stage, current, total, message });

    report("metadata", 0, 1, `Fetching Minecraft ${req.minecraftVersion} metadata`);
    await this.versions.getVanillaJson(req.minecraftVersion);
    let versionId = req.minecraftVersion;
    if (req.loader === "fabric") {
      const loaderVersion = req.loaderVersion ?? (await this.versions.getLatestFabricLoader());
      await this.versions.getFabricJson(req.minecraftVersion, loaderVersion);
      versionId = this.versions.fabricVersionId(req.minecraftVersion, loaderVersion);
    }
    const version = await this.versions.resolve(versionId);
    report("metadata", 1, 1);

    const env = currentRuleEnv();
    const libs = resolveLibraries(version.libraries, env, this.paths.librariesDir);
    const specs: DownloadSpec[] = libs.map((l) => ({ url: l.url, dest: l.path, hash: l.sha1 ? { algo: "sha1", value: l.sha1 } : undefined, size: l.size }));

    const client = version.downloads?.client;
    if (!client) throw new Error(`Version ${req.minecraftVersion} has no client download`);
    specs.push({ url: client.url, dest: this.paths.versionJar(req.minecraftVersion), hash: client.sha1 ? { algo: "sha1", value: client.sha1 } : undefined });

    if (version.logging?.client) {
      const f = version.logging.client.file;
      specs.push({ url: f.url, dest: join(this.paths.assetsDir, "log_configs", f.id), hash: { algo: "sha1", value: f.sha1 } });
    }

    let done = 0;
    await runPool(specs, 8, async (spec) => {
      await downloadFile(spec);
      report("libraries", ++done, specs.length, spec.dest.split(/[\\/]/).pop());
    });

    await this.extractNatives(req.minecraftVersion, libs.filter((l) => l.native));
    await this.installAssets(version, report);

    await atomicWriteFile(join(this.paths.versionDir(versionId), ".installed"), new Date().toISOString());
    if (versionId !== req.minecraftVersion) {
      await atomicWriteFile(join(this.paths.versionDir(req.minecraftVersion), ".installed"), new Date().toISOString());
    }
    report("done", 1, 1, `Minecraft ${req.minecraftVersion} ready`);
    return { versionId, version };
  }

  private async extractNatives(minecraftVersion: string, natives: { path: string; extractExclude: string[] }[]): Promise<void> {
    if (natives.length === 0) return;
    const dir = this.paths.nativesDir(minecraftVersion);
    await ensureDir(dir);
    for (const n of natives) {
      const zip = new AdmZip(n.path);
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        if (n.extractExclude.some((ex) => entry.entryName.startsWith(ex))) continue;
        if (entry.entryName.includes("..")) continue;
        await fs.writeFile(join(dir, entry.entryName.split("/").pop()!), entry.getData());
      }
    }
  }

  private async installAssets(version: VersionJson, report: (s: string, c: number, t: number, m?: string) => void) {
    const idx = version.assetIndex;
    if (!idx) return;
    const indexPath = join(this.paths.assetsDir, "indexes", `${idx.id}.json`);
    await downloadFile({ url: idx.url, dest: indexPath, hash: { algo: "sha1", value: idx.sha1 } });
    const index = JSON.parse(await fs.readFile(indexPath, "utf8")) as { objects: Record<string, { hash: string; size: number }> };
    const objects = [...new Map(Object.values(index.objects).map((o) => [o.hash, o])).values()];
    const missing: { hash: string }[] = [];
    for (const o of objects) {
      if (!(await exists(join(this.paths.assetsDir, "objects", o.hash.slice(0, 2), o.hash)))) missing.push(o);
    }
    let done = objects.length - missing.length;
    report("assets", done, objects.length);
    await runPool(missing, 16, async (o) => {
      const prefix = o.hash.slice(0, 2);
      await downloadFile({ url: `${RESOURCES_URL}/${prefix}/${o.hash}`, dest: join(this.paths.assetsDir, "objects", prefix, o.hash), hash: { algo: "sha1", value: o.hash } });
      done++;
      if (done % 25 === 0 || done === objects.length) report("assets", done, objects.length);
    });
  }
}

export async function fetchFabricLoaders(): Promise<string[]> {
  const list = await fetchJson<{ version: string; stable: boolean }[]>("https://meta.fabricmc.net/v2/versions/loader");
  return list.filter((l) => l.stable).map((l) => l.version);
}
