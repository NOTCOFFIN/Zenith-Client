import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { PerformancePreset } from "../../shared/types";
import { atomicWriteFile, exists } from "../util/fsx";

/** Vanilla options.txt values applied per preset. "custom" leaves the user's options untouched. */
export const PRESET_OPTIONS: Record<Exclude<PerformancePreset, "custom">, Record<string, string>> = {
  "max-fps": { renderDistance: "8", simulationDistance: "6", graphicsMode: "0", particles: "2", entityDistanceScaling: "0.5", biomeBlendRadius: "0", renderClouds: '"false"', ao: "false", entityShadows: "false", maxFps: "260", enableVsync: "false", mipmapLevels: "0" },
  balanced: { renderDistance: "12", simulationDistance: "8", graphicsMode: "1", particles: "1", entityDistanceScaling: "0.75", biomeBlendRadius: "2", renderClouds: '"fast"', ao: "true", entityShadows: "true", maxFps: "260", enableVsync: "false", mipmapLevels: "4" },
  quality: { renderDistance: "16", simulationDistance: "12", graphicsMode: "1", particles: "0", entityDistanceScaling: "1.0", biomeBlendRadius: "5", renderClouds: '"true"', ao: "true", entityShadows: "true", maxFps: "260", enableVsync: "true", mipmapLevels: "4" }
};

export function mergeOptions(existing: string, values: Record<string, string>): string {
  const lines = existing.split(/\r?\n/).filter((l) => l.length > 0);
  const seen = new Set<string>();
  const out = lines.map((line) => {
    const idx = line.indexOf(":");
    const key = idx === -1 ? line : line.slice(0, idx);
    if (key in values) {
      seen.add(key);
      return `${key}:${values[key]}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(values)) if (!seen.has(k)) out.push(`${k}:${v}`);
  return `${out.join("\n")}\n`;
}

export async function applyPerformancePreset(gameDir: string, preset: PerformancePreset): Promise<void> {
  if (preset === "custom") return;
  const file = join(gameDir, "options.txt");
  const existing = (await exists(file)) ? await fs.readFile(file, "utf8") : "";
  await atomicWriteFile(file, mergeOptions(existing, PRESET_OPTIONS[preset]));
}
