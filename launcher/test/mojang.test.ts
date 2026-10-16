import { describe, expect, it } from "vitest";
import { rulesAllow } from "../src/main/services/mojang/rules";
import { mavenPath, resolveLibraries } from "../src/main/services/mojang/libraries";
import { mergeVersionJson } from "../src/main/services/mojang/merge";
import { buildLaunchCommand, splitArgs, type LaunchContext } from "../src/main/services/mojang/arguments";
import type { RuleEnv, VersionJson } from "../src/main/services/mojang/types";

const linux: RuleEnv = { os: "linux", arch: "x86_64", osVersion: "6.0", features: {} };
const windows: RuleEnv = { os: "windows", arch: "x86_64", osVersion: "10.0", features: {} };

describe("rules", () => {
  it("allows when there are no rules", () => expect(rulesAllow(undefined, linux)).toBe(true));
  it("applies os allow rules", () => {
    const rules = [{ action: "allow" as const, os: { name: "windows" } }];
    expect(rulesAllow(rules, windows)).toBe(true);
    expect(rulesAllow(rules, linux)).toBe(false);
  });
  it("last matching rule wins", () => {
    const rules = [{ action: "allow" as const }, { action: "disallow" as const, os: { name: "osx" } }];
    expect(rulesAllow(rules, linux)).toBe(true);
    expect(rulesAllow(rules, { ...linux, os: "osx" })).toBe(false);
  });
  it("evaluates features", () => {
    const rules = [{ action: "allow" as const, features: { is_demo_user: true } }];
    expect(rulesAllow(rules, linux)).toBe(false);
    expect(rulesAllow(rules, { ...linux, features: { is_demo_user: true } })).toBe(true);
  });
});

describe("libraries", () => {
  it("builds maven paths", () => {
    expect(mavenPath("net.fabricmc:fabric-loader:0.19.5")).toBe("net/fabricmc/fabric-loader/0.19.5/fabric-loader-0.19.5.jar");
    expect(mavenPath("org.lwjgl:lwjgl:3.3.3:natives-linux")).toBe("org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-linux.jar");
    expect(mavenPath("a.b:c:1@zip")).toBe("a/b/c/1/c-1.zip");
  });
  it("filters by rules and resolves fabric-style libraries", () => {
    const libs = resolveLibraries(
      [
        { name: "org.lwjgl:lwjgl:3.3.3:natives-windows", rules: [{ action: "allow", os: { name: "windows" } }], downloads: { artifact: { path: "x.jar", url: "https://x/x.jar", sha1: "a" } } },
        { name: "net.fabricmc:fabric-loader:0.19.5", url: "https://maven.fabricmc.net/" }
      ],
      linux,
      "/libs"
    );
    expect(libs).toHaveLength(1);
    expect(libs[0].url).toBe("https://maven.fabricmc.net/net/fabricmc/fabric-loader/0.19.5/fabric-loader-0.19.5.jar");
  });
  it("resolves legacy natives classifiers", () => {
    const libs = resolveLibraries(
      [{ name: "org.lwjgl.lwjgl:lwjgl-platform:2.9.4", natives: { linux: "natives-linux" }, extract: { exclude: ["META-INF/"] }, downloads: { classifiers: { "natives-linux": { url: "https://n/n.jar", path: "n.jar", sha1: "b" } } } }],
      linux,
      "/libs"
    );
    expect(libs).toEqual([expect.objectContaining({ native: true, extractExclude: ["META-INF/"] })]);
  });
});

describe("merge", () => {
  it("child libraries override parent by group:artifact", () => {
    const parent: VersionJson = { id: "1.21.1", mainClass: "net.minecraft.client.main.Main", libraries: [{ name: "org.ow2.asm:asm:9.3" }, { name: "com.google:gson:2.10" }], arguments: { game: ["--username"], jvm: ["-cp"] } };
    const child: VersionJson = { id: "fabric", inheritsFrom: "1.21.1", mainClass: "net.fabricmc.loader.impl.launch.knot.KnotClient", libraries: [{ name: "org.ow2.asm:asm:9.8" }], arguments: { game: [], jvm: ["-DFabricMcEmu=x"] } };
    const merged = mergeVersionJson(child, parent);
    expect(merged.mainClass).toBe("net.fabricmc.loader.impl.launch.knot.KnotClient");
    expect(merged.libraries.map((l) => l.name)).toEqual(["org.ow2.asm:asm:9.8", "com.google:gson:2.10"]);
    expect(merged.arguments?.jvm).toEqual(["-cp", "-DFabricMcEmu=x"]);
  });
});

describe("arguments", () => {
  const ctx: LaunchContext = {
    username: "Steve", uuid: "u", accessToken: "tok", userType: "msa", versionName: "1.21.1", versionType: "Zenith",
    gameDirectory: "/g", assetsRoot: "/a", assetsIndexName: "17", nativesDirectory: "/n", librariesDirectory: "/l",
    classpath: ["/l/a.jar", "/v/c.jar"], classpathSeparator: ":", launcherName: "zenith", launcherVersion: "0.1",
    resolution: { width: 1280, height: 720 }, memoryMinMb: 512, memoryMaxMb: 2048, extraJvmArgs: ["-XX:+UseG1GC"]
  };
  it("builds modern arguments with substitutions and feature rules", () => {
    const v: VersionJson = {
      id: "1.21.1", mainClass: "M", libraries: [],
      arguments: {
        game: ["--username", "${auth_player_name}", "--accessToken", "${auth_access_token}", { rules: [{ action: "allow", features: { has_custom_resolution: true } }], value: ["--width", "${resolution_width}"] }, { rules: [{ action: "allow", features: { is_demo_user: true } }], value: "--demo" }],
        jvm: ["-Djava.library.path=${natives_directory}", "-cp", "${classpath}"]
      }
    };
    const cmd = buildLaunchCommand(v, ctx, linux);
    expect(cmd.jvmArgs).toEqual(["-Xms512M", "-Xmx2048M", "-Djava.library.path=/n", "-cp", "/l/a.jar:/v/c.jar", "-XX:+UseG1GC"]);
    expect(cmd.gameArgs).toEqual(["--username", "Steve", "--accessToken", "tok", "--width", "1280"]);
  });
  it("supports legacy minecraftArguments", () => {
    const v: VersionJson = { id: "1.8.9", mainClass: "M", libraries: [], minecraftArguments: "--username ${auth_player_name} --version ${version_name}" };
    const cmd = buildLaunchCommand(v, { ...ctx, resolution: undefined }, linux);
    expect(cmd.jvmArgs).toContain("-cp");
    expect(cmd.gameArgs).toEqual(["--username", "Steve", "--version", "1.21.1"]);
  });
  it("splits quoted args", () => expect(splitArgs('-Xss1M "-Dfoo=a b"  -X')).toEqual(["-Xss1M", "-Dfoo=a b", "-X"]));
});
