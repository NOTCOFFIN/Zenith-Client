import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, promises as fs } from "node:fs";
import { join, delimiter } from "node:path";
import type { GameProfile, LaunchStatus, LauncherSettings, ProgressEvent } from "../../shared/types";
import { Log4jXmlParser } from "../util/log4j";
import { ensureDir } from "../util/fsx";
import type { ResolvedSession } from "./accounts";
import type { Installer } from "./installer";
import type { JavaService } from "./java";
import type { ModrinthService } from "./modrinth";
import type { LauncherPaths } from "./paths";
import { buildLaunchCommand, splitArgs } from "./mojang/arguments";
import { resolveLibraries } from "./mojang/libraries";
import { currentRuleEnv } from "./mojang/rules";
import { applyPerformancePreset } from "./presets";

export const LAUNCHER_NAME = "zenith-client";
export const LAUNCHER_VERSION = "0.1.0";

/** Modrinth projects installed into every Zenith-enhanced Fabric profile. */
export const ZENITH_STACK = [
  { id: "P7dR8mSH", name: "Fabric API" },
  { id: "AANobbMI", name: "Sodium" },
  { id: "gvQqBUqZ", name: "Lithium" },
  { id: "uXXizFIs", name: "FerriteCore" }
];

export interface LaunchDeps {
  paths: LauncherPaths;
  installer: Installer;
  java: JavaService;
  modrinth: ModrinthService;
  /** Absolute path to the built Zenith in-game client jar, or null if unavailable. */
  zenithModJar: () => Promise<string | null>;
}

export interface LaunchCallbacks {
  onProgress: (e: ProgressEvent) => void;
  onStatus: (s: LaunchStatus) => void;
  onLog: (line: string) => void;
}

export class LaunchService {
  private child: ChildProcess | null = null;
  private status: LaunchStatus = { state: "idle", profileId: null, pid: null, exitCode: null, message: null, logFile: null };

  constructor(private readonly deps: LaunchDeps) {}

  getStatus(): LaunchStatus {
    return this.status;
  }

  private setStatus(patch: Partial<LaunchStatus>, cb: LaunchCallbacks) {
    this.status = { ...this.status, ...patch };
    cb.onStatus(this.status);
  }

  async launch(profile: GameProfile, settings: LauncherSettings, session: ResolvedSession, cb: LaunchCallbacks): Promise<LaunchStatus> {
    if (this.child && this.status.state === "running") throw new Error("Minecraft is already running from this launcher.");
    const { paths, installer, java } = this.deps;
    this.setStatus({ state: "preparing", profileId: profile.id, pid: null, exitCode: null, message: "Installing game files" }, cb);

    try {
      const { versionId, version } = await installer.install(
        { minecraftVersion: profile.minecraftVersion, loader: profile.loader, loaderVersion: profile.loaderVersion },
        cb.onProgress
      );

      const gameDir = settings.gameDirectory && profile.id === settings.selectedProfileId ? settings.gameDirectory : paths.instanceDir(profile.id);
      await ensureDir(gameDir);

      if (profile.loader === "fabric" && profile.zenithEnhanced) {
        await this.prepareZenithMods(profile, join(gameDir, "mods"), cb);
        await applyPerformancePreset(gameDir, settings.performancePreset);
      }

      this.setStatus({ message: "Locating Java" }, cb);
      const required = version.javaVersion?.majorVersion ?? 8;
      let runtime = java.pick(await java.detect(settings.javaPath), required, settings.javaPath);
      if (!runtime) {
        if (!settings.autoDownloadJava) throw new Error(`Java ${required} or newer is required. Install it or enable automatic Java downloads.`);
        cb.onProgress({ taskId: "java", stage: "java", current: 0, total: 1, message: `Downloading Java ${required}` });
        runtime = await java.downloadRuntime(required, (c, t) => cb.onProgress({ taskId: "java", stage: "java", current: c, total: t, message: `Downloading Java ${required}` }));
      }

      const env = currentRuleEnv();
      const libs = resolveLibraries(version.libraries, env, paths.librariesDir).filter((l) => !l.native);
      const classpath = [...new Set(libs.map((l) => l.path)), paths.versionJar(profile.minecraftVersion)];
      const loggingArg = version.logging?.client
        ? version.logging.client.argument.replace("${path}", join(paths.assetsDir, "log_configs", version.logging.client.file.id))
        : undefined;

      const cmd = buildLaunchCommand(
        version,
        {
          username: session.username,
          uuid: session.uuid,
          accessToken: session.accessToken,
          userType: session.userType,
          xuid: session.xuid,
          versionName: versionId,
          versionType: "Zenith",
          gameDirectory: gameDir,
          assetsRoot: paths.assetsDir,
          assetsIndexName: version.assetIndex?.id ?? version.assets ?? "legacy",
          nativesDirectory: paths.nativesDir(profile.minecraftVersion),
          librariesDirectory: paths.librariesDir,
          classpath,
          classpathSeparator: delimiter,
          launcherName: LAUNCHER_NAME,
          launcherVersion: LAUNCHER_VERSION,
          resolution: settings.resolution,
          fullscreen: settings.fullscreen,
          memoryMinMb: settings.memoryMinMb,
          memoryMaxMb: settings.memoryMaxMb,
          extraJvmArgs: splitArgs(settings.jvmArgs),
          loggingArgument: loggingArg
        },
        env
      );

      await ensureDir(paths.logsDir);
      const logFile = join(paths.logsDir, `game-${profile.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
      const log = createWriteStream(logFile);
      const redacted = [...cmd.jvmArgs, cmd.mainClass, ...cmd.gameArgs].map((a) => (a === session.accessToken && a !== "0" ? "<access token>" : a));
      log.write(`# java: ${runtime.path} (${runtime.version})\n# args: ${redacted.join(" ")}\n`);

      const child = spawn(java.launcherExecutable(runtime.path), [...cmd.jvmArgs, cmd.mainClass, ...cmd.gameArgs], { cwd: gameDir, windowsHide: false });
      this.child = child;
      const stdout = new Log4jXmlParser();
      const stderr = new Log4jXmlParser();
      const emit = (lines: string[]) => {
        for (const line of lines) {
          log.write(line + "\n");
          cb.onLog(line);
        }
      };
      child.stdout?.on("data", (buf: Buffer) => emit(stdout.feed(buf.toString())));
      child.stderr?.on("data", (buf: Buffer) => emit(stderr.feed(buf.toString())));
      child.on("exit", (code) => {
        emit([...stdout.flush(), ...stderr.flush()]);
        log.end();
        this.child = null;
        const crashed = code !== 0 && code !== null;
        this.setStatus({ state: crashed ? "crashed" : "exited", pid: null, exitCode: code, message: crashed ? `Minecraft exited with code ${code}. See the log for details.` : "Minecraft closed" }, cb);
      });
      child.on("error", (err) => {
        this.setStatus({ state: "crashed", message: `Failed to start Java: ${err.message}` }, cb);
      });

      this.setStatus({ state: "running", pid: child.pid ?? null, message: `Running ${profile.name}`, logFile }, cb);
      return this.status;
    } catch (err) {
      this.setStatus({ state: "crashed", message: err instanceof Error ? err.message : String(err) }, cb);
      throw err;
    }
  }

  private async prepareZenithMods(profile: GameProfile, modsDir: string, cb: LaunchCallbacks) {
    await ensureDir(modsDir);
    const { modrinth } = this.deps;
    const installed = await modrinth.installed(modsDir);
    const missing = ZENITH_STACK.filter((m) => !installed.some((i) => i.projectId === m.id));
    let i = 0;
    for (const mod of missing) {
      cb.onProgress({ taskId: "zenith-mods", stage: "mods", current: i++, total: missing.length, message: `Installing ${mod.name}` });
      try {
        await modrinth.install(mod.id, profile.minecraftVersion, "fabric", modsDir, "zenith");
      } catch (err) {
        if (mod.id === "P7dR8mSH") throw err;
        cb.onLog(`[Zenith] Skipped ${mod.name}: ${err instanceof Error ? err.message : err}`);
      }
    }
    const jar = await this.deps.zenithModJar();
    if (jar) {
      for (const f of await fs.readdir(modsDir)) if (/^zenith-client-.*\.jar(\.disabled)?$/.test(f)) await fs.rm(join(modsDir, f), { force: true });
      await fs.copyFile(jar, join(modsDir, jar.split(/[\\/]/).pop()!));
    } else {
      cb.onLog("[Zenith] In-game client jar not found; launching without the Zenith in-game client.");
    }
  }

  kill(): void {
    this.child?.kill();
  }
}
