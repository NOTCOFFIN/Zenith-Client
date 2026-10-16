/**
 * Headless end-to-end check of the launcher pipeline without Electron:
 * install Minecraft + Fabric, install the Zenith stack, and launch with an offline dev account.
 * Usage: ZENITH_HOME=.zenith-test node dist-electron/scripts/headless-launch.js [mcVersion] [--install-only]
 */
import { resolve, join } from "node:path";
import { promises as fs } from "node:fs";
import { AccountService } from "../src/main/services/accounts";
import { Installer } from "../src/main/services/installer";
import { JavaService } from "../src/main/services/java";
import { LaunchService } from "../src/main/services/launch";
import { ModrinthService } from "../src/main/services/modrinth";
import { VersionService } from "../src/main/services/mojang/versions";
import { LauncherPaths } from "../src/main/services/paths";
import { ProfileService, SettingsService } from "../src/main/services/settings";

async function main() {
  const root = resolve(process.env.ZENITH_HOME ?? ".zenith-test");
  const mc = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "1.21.1";
  const installOnly = process.argv.includes("--install-only");
  const paths = new LauncherPaths(root);
  const versions = new VersionService(paths);
  const installer = new Installer(paths, versions);
  const java = new JavaService(paths.runtimesDir);
  const modrinth = new ModrinthService();
  const cipher = { available: () => true, encrypt: (s: string) => s, decrypt: (s: string) => s };
  const accounts = new AccountService(paths.accountsFile, cipher, () => "");
  const settings = await new SettingsService(paths.settingsFile).update({ performancePreset: "max-fps", resolution: { width: 1280, height: 720 } });
  const profiles = new ProfileService(paths.profilesFile);
  const profile = (await profiles.list()).find((p) => p.minecraftVersion === mc) ?? (await profiles.list())[0];

  const modJarDir = resolve(__dirname, "../../../../minecraft-client/build/libs");
  const zenithModJar = async () => {
    try {
      const f = (await fs.readdir(modJarDir)).find((n) => /^zenith-client-.*\.jar$/.test(n) && !n.includes("sources"));
      return f ? join(modJarDir, f) : null;
    } catch {
      return null;
    }
  };

  let lastStage = "";
  const onProgress = (e: { stage: string; current: number; total: number; message?: string }) => {
    const key = `${e.stage}:${Math.floor((e.current / Math.max(1, e.total)) * 10)}`;
    if (key !== lastStage) console.log(`[progress] ${e.stage} ${e.current}/${e.total} ${e.message ?? ""}`);
    lastStage = key;
  };

  if (installOnly) {
    const r = await installer.install({ minecraftVersion: mc, loader: profile.loader }, onProgress);
    console.log(`[ok] installed ${r.versionId}`);
    return;
  }
  const existing = (await accounts.list()).find((a) => a.username === "ZenithDev");
  const acc = existing ?? (await accounts.addOfflineDevAccount("ZenithDev"));
  const session = await accounts.getSession(acc.id);
  const launcher = new LaunchService({ paths, installer, java, modrinth, zenithModJar });
  await launcher.launch(profile, settings, session, {
    onProgress,
    onStatus: (s) => console.log(`[status] ${s.state} ${s.message ?? ""}`),
    onLog: (l) => console.log(`[game] ${l}`)
  });
}

main().catch((err) => {
  console.error("[fail]", err);
  process.exit(1);
});
