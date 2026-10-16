import { promises as fs } from "node:fs";
import { dirname } from "node:path";

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/** Writes via a temp file + rename so a crash never leaves a half-written file. Keeps one .bak copy. */
export async function atomicWriteFile(path: string, data: string | Buffer): Promise<void> {
  await ensureDir(dirname(path));
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data);
  if (await exists(path)) {
    await fs.copyFile(path, `${path}.bak`).catch(() => undefined);
  }
  await fs.rename(tmp, path);
}

export async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await atomicWriteFile(path, JSON.stringify(value, null, 2));
}

/** Reads JSON, falling back to the .bak copy and then to the provided default if the file is missing or corrupt. */
export async function readJsonSafe<T>(path: string, fallback: T): Promise<T> {
  for (const candidate of [path, `${path}.bak`]) {
    try {
      return JSON.parse(await fs.readFile(candidate, "utf8")) as T;
    } catch {
      // try next candidate
    }
  }
  return fallback;
}
