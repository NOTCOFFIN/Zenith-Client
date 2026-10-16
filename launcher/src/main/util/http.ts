import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ensureDir, exists } from "./fsx";

const USER_AGENT = "ZenithClient-Launcher/0.1.0 (+https://github.com/NOTCOFFIN/Zenith-Client)";

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly url: string, public readonly body: string) {
    super(`HTTP ${status} for ${url}`);
  }
}

export async function fetchWithRetry(url: string, init: RequestInit = {}, retries = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const headers = new Headers(init.headers);
      if (!headers.has("User-Agent")) headers.set("User-Agent", USER_AGENT);
      const res = await fetch(url, { ...init, headers });
      if (res.status >= 500 || res.status === 429) {
        throw new HttpError(res.status, url, await res.text().catch(() => ""));
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchWithRetry(url, init);
  if (!res.ok) throw new HttpError(res.status, url, await res.text().catch(() => ""));
  return (await res.json()) as T;
}

export type HashAlgo = "sha1" | "sha512" | "sha256";

export async function hashFile(path: string, algo: HashAlgo): Promise<string> {
  const hash = createHash(algo);
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

export interface DownloadSpec {
  url: string;
  dest: string;
  hash?: { algo: HashAlgo; value: string };
  size?: number;
}

/** Downloads to a .part file, verifies the hash, then renames. Skips if an existing file already matches. */
export async function downloadFile(spec: DownloadSpec, onBytes?: (n: number) => void): Promise<boolean> {
  if (await exists(spec.dest)) {
    if (!spec.hash) return false;
    if ((await hashFile(spec.dest, spec.hash.algo)) === spec.hash.value.toLowerCase()) return false;
  }
  await ensureDir(dirname(spec.dest));
  const part = `${spec.dest}.part`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchWithRetry(spec.url);
    if (!res.ok || !res.body) throw new HttpError(res.status, spec.url, "");
    const body = Readable.fromWeb(res.body as never);
    if (onBytes) body.on("data", (chunk: Buffer) => onBytes(chunk.length));
    await pipeline(body, createWriteStream(part));
    if (spec.hash) {
      const actual = await hashFile(part, spec.hash.algo);
      if (actual !== spec.hash.value.toLowerCase()) {
        await fs.rm(part, { force: true });
        if (attempt === 2) throw new Error(`Integrity check failed for ${spec.url}`);
        continue;
      }
    }
    await fs.rename(part, spec.dest);
    return true;
  }
  return true;
}

/** Runs tasks with a fixed concurrency limit. */
export async function runPool<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}
