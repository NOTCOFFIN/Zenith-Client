import os from "node:os";
import type { Rule, RuleEnv } from "./types";

export function currentRuleEnv(features: Record<string, boolean> = {}): RuleEnv {
  const platform = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "osx" : "linux";
  const arch = process.arch === "x64" ? "x86_64" : process.arch === "ia32" ? "x86" : process.arch;
  return { os: platform, arch, osVersion: os.release(), features };
}

/** Mojang rule semantics: no rules = allowed; otherwise the last matching rule wins, default disallow. */
export function rulesAllow(rules: Rule[] | undefined, env: RuleEnv): boolean {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) {
    if (ruleMatches(rule, env)) allowed = rule.action === "allow";
  }
  return allowed;
}

function ruleMatches(rule: Rule, env: RuleEnv): boolean {
  if (rule.os) {
    if (rule.os.name && rule.os.name !== env.os) return false;
    if (rule.os.arch && rule.os.arch !== env.arch && !(rule.os.arch === "x86" && env.arch === "x86")) return false;
    if (rule.os.version) {
      try {
        if (!new RegExp(rule.os.version).test(env.osVersion)) return false;
      } catch {
        return false;
      }
    }
  }
  if (rule.features) {
    for (const [key, value] of Object.entries(rule.features)) {
      if ((env.features[key] ?? false) !== value) return false;
    }
  }
  return true;
}
