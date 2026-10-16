import { rulesAllow } from "./rules";
import type { ArgumentValue, RuleEnv, VersionJson } from "./types";

export interface LaunchContext {
  username: string;
  uuid: string;
  accessToken: string;
  userType: "msa" | "legacy";
  xuid?: string;
  clientId?: string;
  versionName: string;
  versionType: string;
  gameDirectory: string;
  assetsRoot: string;
  assetsIndexName: string;
  nativesDirectory: string;
  librariesDirectory: string;
  classpath: string[];
  classpathSeparator: string;
  launcherName: string;
  launcherVersion: string;
  resolution?: { width: number; height: number };
  fullscreen?: boolean;
  memoryMinMb: number;
  memoryMaxMb: number;
  extraJvmArgs: string[];
  loggingArgument?: string;
}

export interface LaunchCommand {
  jvmArgs: string[];
  mainClass: string;
  gameArgs: string[];
}

export function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\$\{([^}]+)\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

function flatten(values: ArgumentValue[] | undefined, env: RuleEnv): string[] {
  const out: string[] = [];
  for (const v of values ?? []) {
    if (typeof v === "string") out.push(v);
    else if (rulesAllow(v.rules, env)) out.push(...(Array.isArray(v.value) ? v.value : [v.value]));
  }
  return out;
}

/** Splits a user-supplied JVM argument string, honouring double quotes. */
export function splitArgs(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) out.push(m[1] ?? m[2]);
  return out;
}

export function buildLaunchCommand(version: VersionJson, ctx: LaunchContext, env: RuleEnv): LaunchCommand {
  const vars: Record<string, string> = {
    auth_player_name: ctx.username,
    auth_uuid: ctx.uuid,
    auth_access_token: ctx.accessToken,
    auth_session: ctx.accessToken,
    auth_xuid: ctx.xuid ?? "0",
    clientid: ctx.clientId ?? "0",
    user_type: ctx.userType,
    user_properties: "{}",
    version_name: ctx.versionName,
    version_type: ctx.versionType,
    game_directory: ctx.gameDirectory,
    assets_root: ctx.assetsRoot,
    game_assets: ctx.assetsRoot,
    assets_index_name: ctx.assetsIndexName,
    natives_directory: ctx.nativesDirectory,
    library_directory: ctx.librariesDirectory,
    classpath_separator: ctx.classpathSeparator,
    classpath: ctx.classpath.join(ctx.classpathSeparator),
    launcher_name: ctx.launcherName,
    launcher_version: ctx.launcherVersion,
    resolution_width: String(ctx.resolution?.width ?? 854),
    resolution_height: String(ctx.resolution?.height ?? 480),
    quickPlayPath: "",
    quickPlaySingleplayer: "",
    quickPlayMultiplayer: "",
    quickPlayRealms: ""
  };

  const jvm: string[] = [`-Xms${ctx.memoryMinMb}M`, `-Xmx${ctx.memoryMaxMb}M`];
  if (version.arguments?.jvm) {
    jvm.push(...flatten(version.arguments.jvm, env).map((a) => substitute(a, vars)));
  } else {
    if (env.os === "osx") jvm.push("-XstartOnFirstThread");
    jvm.push(`-Djava.library.path=${ctx.nativesDirectory}`, "-cp", vars.classpath);
  }
  if (ctx.loggingArgument) jvm.push(ctx.loggingArgument);
  jvm.push(...ctx.extraJvmArgs);

  const featureEnv: RuleEnv = {
    ...env,
    features: { ...env.features, has_custom_resolution: !!ctx.resolution && !ctx.fullscreen }
  };
  let game: string[];
  if (version.arguments?.game) {
    game = flatten(version.arguments.game, featureEnv);
  } else {
    game = splitArgs(version.minecraftArguments ?? "");
    if (featureEnv.features.has_custom_resolution) game.push("--width", "${resolution_width}", "--height", "${resolution_height}");
  }
  game = game.map((a) => substitute(a, vars)).filter((a) => !/\$\{quickPlay/.test(a));
  // Drop quick-play flags whose values are empty.
  const cleaned: string[] = [];
  for (let i = 0; i < game.length; i++) {
    if (game[i].startsWith("--quickPlay") && (game[i + 1] === "" || game[i + 1] === undefined)) {
      i++;
      continue;
    }
    cleaned.push(game[i]);
  }
  if (ctx.fullscreen) cleaned.push("--fullscreen");

  return { jvmArgs: jvm, mainClass: version.mainClass, gameArgs: cleaned };
}
