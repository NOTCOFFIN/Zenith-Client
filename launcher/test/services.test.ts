import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrateSettings, defaultSettings } from "../src/main/services/settings";
import { mergeOptions } from "../src/main/services/presets";
import { parseJavaVersion } from "../src/main/services/java";
import { atomicWriteJson, readJsonSafe } from "../src/main/util/fsx";
import { AccountService, type SecretCipher } from "../src/main/services/accounts";

const plainCipher: SecretCipher = { available: () => true, encrypt: (s) => Buffer.from(s).toString("base64"), decrypt: (s) => Buffer.from(s, "base64").toString() };

describe("settings migration", () => {
  it("fills defaults and drops wrong types", () => {
    const s = migrateSettings({ memoryMaxMb: "lots" as unknown as number, fullscreen: true, schemaVersion: 0 });
    expect(s.memoryMaxMb).toBe(defaultSettings().memoryMaxMb);
    expect(s.fullscreen).toBe(true);
    expect(s.schemaVersion).toBe(1);
  });
  it("clamps memory", () => {
    const s = migrateSettings({ memoryMaxMb: 2048, memoryMinMb: 8000 });
    expect(s.memoryMinMb).toBe(2048);
  });
});

describe("presets", () => {
  it("replaces existing keys and appends missing", () => {
    expect(mergeOptions("version:3955\nrenderDistance:32\n", { renderDistance: "8", maxFps: "260" })).toBe("version:3955\nrenderDistance:8\nmaxFps:260\n");
  });
});

describe("java", () => {
  it("parses modern and legacy versions", () => {
    expect(parseJavaVersion('openjdk version "21.0.4" 2024-07-16')).toEqual({ version: "21.0.4", major: 21 });
    expect(parseJavaVersion('java version "1.8.0_402"')).toEqual({ version: "1.8.0_402", major: 8 });
    expect(parseJavaVersion("garbage")).toBeNull();
  });
});

describe("atomic json", () => {
  it("recovers from a corrupt file using the backup", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zenith-"));
    const f = join(dir, "a.json");
    await atomicWriteJson(f, { v: 1 });
    await atomicWriteJson(f, { v: 2 });
    writeFileSync(f, "{corrupt");
    expect(await readJsonSafe(f, { v: 0 })).toEqual({ v: 1 });
  });
});

describe("accounts", () => {
  it("creates offline dev accounts with stable v3 UUIDs and never stores secrets in summaries", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zenith-"));
    const svc = new AccountService(join(dir, "accounts.json"), plainCipher, () => "");
    const acc = await svc.addOfflineDevAccount("ZenithDev");
    expect(acc.uuid).toHaveLength(32);
    expect(acc.uuid[12]).toBe("3");
    expect(JSON.stringify(await svc.list())).not.toContain("secret");
    const session = await svc.getSession(acc.id);
    expect(session.userType).toBe("legacy");
    expect(readFileSync(join(dir, "accounts.json"), "utf8")).toContain("ZenithDev");
  });
  it("rejects invalid usernames", async () => {
    const svc = new AccountService(join(mkdtempSync(join(tmpdir(), "zenith-")), "a.json"), plainCipher, () => "");
    await expect(svc.addOfflineDevAccount("x")).rejects.toThrow();
  });
});
