import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { JavaInstallation } from "../../shared/types";
import { downloadFile, fetchJson } from "../util/http";
import { ensureDir, exists } from "../util/fsx";

const execFileAsync = promisify(execFile);
const exe = process.platform === "win32" ? "java.exe" : "java";
const javawExe = process.platform === "win32" ? "javaw.exe" : "java";

/** Parses `java -version` stderr output into a version string and major version. */
export function parseJavaVersion(output: string): { version: string; major: number } | null {
  const m = output.match(/version "([^"]+)"/);
  if (!m) return null;
  const version = m[1];
  const parts = version.split(/[._+-]/);
  const major = parts[0] === "1" ? Number(parts[1]) : Number(parts[0]);
  return Number.isFinite(major) ? { version, major } : null;
}

export async function probeJava(javaPath: string, source: JavaInstallation["source"]): Promise<JavaInstallation | null> {
  try {
    const { stderr, stdout } = await execFileAsync(javaPath, ["-version"], { timeout: 10_000, windowsHide: true });
    const parsed = parseJavaVersion(stderr || stdout);
    if (!parsed) return null;
    const archMatch = (stderr || stdout).match(/64-Bit/i) ? "x64" : "x86";
    return { path: javaPath, version: parsed.version, majorVersion: parsed.major, arch: archMatch, source };
  } catch {
    return null;
  }
}

async function listJavaHomes(base: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(base);
    const out: string[] = [];
    for (const e of entries) {
      for (const candidate of [join(base, e, "bin", exe), join(base, e, "Contents", "Home", "bin", exe)]) {
        if (await exists(candidate)) out.push(candidate);
      }
    }
    return out;
  } catch {
    return [];
  }
}

export class JavaService {
  constructor(private readonly runtimesDir: string) {}

  async detect(configuredPath: string | null): Promise<JavaInstallation[]> {
    const candidates = new Map<string, JavaInstallation["source"]>();
    if (configuredPath) candidates.set(configuredPath, "settings");
    if (process.env.JAVA_HOME) candidates.set(join(process.env.JAVA_HOME, "bin", exe), "java-home");
    for (const p of await listJavaHomes(this.runtimesDir)) candidates.set(p, "zenith-runtime");

    const systemDirs =
      process.platform === "win32"
        ? ["C:\\Program Files\\Java", "C:\\Program Files\\Eclipse Adoptium", "C:\\Program Files\\Microsoft", "C:\\Program Files\\Zulu", "C:\\Program Files (x86)\\Minecraft Launcher\\runtime"]
        : process.platform === "darwin"
          ? ["/Library/Java/JavaVirtualMachines", join(os.homedir(), "Library/Java/JavaVirtualMachines")]
          : ["/usr/lib/jvm", "/usr/java", "/opt/java", join(os.homedir(), ".jdks"), join(os.homedir(), "jdks")];
    for (const dir of systemDirs) for (const p of await listJavaHomes(dir)) if (!candidates.has(p)) candidates.set(p, "system");

    for (const dir of (process.env.PATH ?? "").split(process.platform === "win32" ? ";" : ":")) {
      const p = join(dir, exe);
      if (dir && !candidates.has(p) && (await exists(p))) candidates.set(p, "path");
    }

    const results = await Promise.all([...candidates].map(([p, s]) => probeJava(p, s)));
    const seen = new Set<string>();
    return results.filter((r): r is JavaInstallation => {
      if (!r) return false;
      const key = `${r.version}|${r.source === "settings" ? r.path : r.version}`;
      if (seen.has(r.path) || (r.source !== "settings" && seen.has(key))) return false;
      seen.add(r.path);
      seen.add(key);
      return true;
    });
  }

  /** Picks the configured Java if compatible, else the lowest installed version >= required, preferring an exact match. */
  pick(installs: JavaInstallation[], requiredMajor: number, configuredPath: string | null): JavaInstallation | null {
    const configured = installs.find((i) => i.source === "settings" && i.path === configuredPath);
    if (configured && configured.majorVersion >= requiredMajor) return configured;
    const compatible = installs.filter((i) => i.majorVersion >= requiredMajor && i.arch === "x64");
    compatible.sort((a, b) => Math.abs(a.majorVersion - requiredMajor) - Math.abs(b.majorVersion - requiredMajor));
    return compatible[0] ?? null;
  }

  /** Downloads an Eclipse Temurin JRE for the given major version from the Adoptium API. */
  async downloadRuntime(major: number, onProgress?: (received: number, total: number) => void): Promise<JavaInstallation> {
    const osName = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "mac" : "linux";
    const arch = process.arch === "arm64" ? "aarch64" : "x64";
    type Asset = { binary: { package: { link: string; checksum: string; name: string; size: number } }; release_name: string };
    const assets = await fetchJson<Asset[]>(
      `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=${arch}&image_type=jre&os=${osName}&vendor=eclipse`
    );
    if (assets.length === 0) throw new Error(`No Java ${major} runtime available for ${osName}/${arch}`);
    const pkg = assets[0].binary.package;
    const target = join(this.runtimesDir, `java-${major}`);
    const archive = join(this.runtimesDir, pkg.name);
    let received = 0;
    await downloadFile({ url: pkg.link, dest: archive, hash: { algo: "sha256", value: pkg.checksum } }, (n) => {
      received += n;
      onProgress?.(received, pkg.size);
    });
    await fs.rm(target, { recursive: true, force: true });
    await ensureDir(target);
    // bsdtar ships with Windows 10+, macOS and Linux and handles both .zip and .tar.gz.
    await execFileAsync("tar", ["-xf", archive, "-C", target], { windowsHide: true });
    await fs.rm(archive, { force: true });
    const found = await listJavaHomes(target);
    if (found.length === 0) throw new Error("Downloaded Java runtime did not contain a java executable");
    const install = await probeJava(found[0], "zenith-runtime");
    if (!install) throw new Error("Downloaded Java runtime failed to start");
    return install;
  }

  /** On Windows prefer javaw.exe so no console window appears. */
  launcherExecutable(javaPath: string): string {
    if (process.platform !== "win32") return javaPath;
    const javaw = javaPath.replace(/java\.exe$/i, javawExe);
    return javaw;
  }
}
