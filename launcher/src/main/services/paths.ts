import { join } from "node:path";

/** All on-disk locations used by the launcher, rooted at a single data directory. */
export class LauncherPaths {
  constructor(public readonly root: string) {}

  get settingsFile() { return join(this.root, "settings.json"); }
  get accountsFile() { return join(this.root, "accounts.json"); }
  get profilesFile() { return join(this.root, "profiles.json"); }
  get sharedDir() { return join(this.root, "minecraft"); }
  get versionsDir() { return join(this.sharedDir, "versions"); }
  get librariesDir() { return join(this.sharedDir, "libraries"); }
  get assetsDir() { return join(this.sharedDir, "assets"); }
  get runtimesDir() { return join(this.root, "runtimes"); }
  get instancesDir() { return join(this.root, "instances"); }
  get logsDir() { return join(this.root, "logs"); }
  get backupsDir() { return join(this.root, "backups"); }
  get cacheDir() { return join(this.root, "cache"); }

  versionDir(id: string) { return join(this.versionsDir, id); }
  versionJson(id: string) { return join(this.versionDir(id), `${id}.json`); }
  versionJar(id: string) { return join(this.versionDir(id), `${id}.jar`); }
  nativesDir(id: string) { return join(this.versionDir(id), "natives"); }
  instanceDir(profileId: string) { return join(this.instancesDir, profileId); }
  modsDir(profileId: string) { return join(this.instanceDir(profileId), "mods"); }
}
