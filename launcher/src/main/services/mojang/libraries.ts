import { join } from "node:path";
import { rulesAllow } from "./rules";
import type { Library, RuleEnv } from "./types";

export interface ResolvedLibrary {
  name: string;
  path: string;
  url: string;
  sha1?: string;
  size?: number;
  native: boolean;
  extractExclude: string[];
}

/** Converts a Maven coordinate (group:artifact:version[:classifier][@ext]) to a repository-relative path. */
export function mavenPath(coordinate: string): string {
  let ext = "jar";
  let coord = coordinate;
  const at = coord.indexOf("@");
  if (at !== -1) {
    ext = coord.slice(at + 1);
    coord = coord.slice(0, at);
  }
  const parts = coord.split(":");
  if (parts.length < 3) throw new Error(`Invalid maven coordinate: ${coordinate}`);
  const [group, artifact, version, classifier] = parts;
  const file = `${artifact}-${version}${classifier ? `-${classifier}` : ""}.${ext}`;
  return [...group.split("."), artifact, version, file].join("/");
}

/** Group+artifact(+classifier) identity used to de-duplicate libraries when merging inherited profiles. */
export function libraryKey(name: string): string {
  const parts = name.split("@")[0].split(":");
  return [parts[0], parts[1], parts[3] ?? ""].join(":");
}

export function resolveLibraries(libraries: Library[], env: RuleEnv, librariesDir: string): ResolvedLibrary[] {
  const out: ResolvedLibrary[] = [];
  for (const lib of libraries) {
    if (!rulesAllow(lib.rules, env)) continue;

    const artifact = lib.downloads?.artifact;
    if (artifact) {
      const rel = artifact.path ?? mavenPath(lib.name);
      out.push({ name: lib.name, path: join(librariesDir, rel), url: artifact.url, sha1: artifact.sha1, size: artifact.size, native: false, extractExclude: [] });
    } else if (!lib.natives && !lib.downloads) {
      // Fabric-style library: name + repository base url.
      const rel = mavenPath(lib.name);
      const base = (lib.url ?? "https://libraries.minecraft.net/").replace(/\/?$/, "/");
      out.push({ name: lib.name, path: join(librariesDir, rel), url: base + rel, sha1: lib.sha1, size: lib.size, native: false, extractExclude: [] });
    }

    // Legacy (pre-1.19) natives are separate classifier jars that must be extracted.
    if (lib.natives) {
      const key = lib.natives[env.os];
      if (key) {
        const classifier = key.replace("${arch}", env.arch.includes("64") ? "64" : "32");
        const nat = lib.downloads?.classifiers?.[classifier];
        if (nat) {
          const rel = nat.path ?? mavenPath(`${lib.name}:${classifier}`);
          out.push({ name: `${lib.name}:${classifier}`, path: join(librariesDir, rel), url: nat.url, sha1: nat.sha1, size: nat.size, native: true, extractExclude: lib.extract?.exclude ?? [] });
        }
      }
    }
  }
  return out;
}
