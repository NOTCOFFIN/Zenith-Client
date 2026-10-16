import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CompatibilityEntry, NewsItem } from "../../shared/types";
import { fetchJson } from "../util/http";

const NEWS_URL = "https://raw.githubusercontent.com/NOTCOFFIN/Zenith-Client/main/backend/news/news.json";

/** News is fetched online when possible and falls back to the copy bundled with the launcher. */
export async function loadNews(bundledDir: string): Promise<NewsItem[]> {
  try {
    const remote = await fetchJson<{ items: NewsItem[] }>(NEWS_URL);
    if (Array.isArray(remote.items)) return remote.items;
  } catch {
    // offline or not yet published
  }
  return loadBundled<{ items: NewsItem[] }>(bundledDir, "news.json").items;
}

export function loadCompatibility(bundledDir: string): CompatibilityEntry[] {
  return loadBundled<{ entries: CompatibilityEntry[] }>(bundledDir, "compatibility.json").entries;
}

function loadBundled<T>(dir: string, file: string): T {
  return JSON.parse(readFileSync(join(dir, file), "utf8")) as T;
}
