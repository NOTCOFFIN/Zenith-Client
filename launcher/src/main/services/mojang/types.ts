export interface Rule {
  action: "allow" | "disallow";
  os?: { name?: string; arch?: string; version?: string };
  features?: Record<string, boolean>;
}

export interface Artifact {
  path?: string;
  url: string;
  sha1?: string;
  size?: number;
}

export interface Library {
  name: string;
  url?: string;
  sha1?: string;
  size?: number;
  rules?: Rule[];
  natives?: Record<string, string>;
  extract?: { exclude?: string[] };
  downloads?: {
    artifact?: Artifact;
    classifiers?: Record<string, Artifact>;
  };
}

export type ArgumentValue = string | { rules?: Rule[]; value: string | string[] };

export interface VersionJson {
  id: string;
  inheritsFrom?: string;
  type?: string;
  mainClass: string;
  minecraftArguments?: string;
  arguments?: { game?: ArgumentValue[]; jvm?: ArgumentValue[] };
  libraries: Library[];
  assetIndex?: { id: string; url: string; sha1: string; size: number; totalSize?: number };
  assets?: string;
  downloads?: { client?: Artifact; client_mappings?: Artifact };
  javaVersion?: { component: string; majorVersion: number };
  logging?: { client?: { argument: string; file: { id: string; url: string; sha1: string; size: number } } };
  releaseTime?: string;
}

export interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: { id: string; type: string; url: string; sha1: string; releaseTime: string }[];
}

export interface RuleEnv {
  os: "windows" | "osx" | "linux";
  arch: string;
  osVersion: string;
  features: Record<string, boolean>;
}
