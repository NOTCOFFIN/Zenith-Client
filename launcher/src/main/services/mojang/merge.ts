import { libraryKey } from "./libraries";
import type { VersionJson } from "./types";

/** Merges a child profile (e.g. Fabric) onto its parent (vanilla). Child libraries win on conflicts. */
export function mergeVersionJson(child: VersionJson, parent: VersionJson): VersionJson {
  const childKeys = new Set(child.libraries.map((l) => libraryKey(l.name)));
  const libraries = [...child.libraries, ...parent.libraries.filter((l) => !childKeys.has(libraryKey(l.name)))];
  return {
    ...parent,
    ...child,
    inheritsFrom: undefined,
    mainClass: child.mainClass ?? parent.mainClass,
    libraries,
    arguments:
      parent.arguments || child.arguments
        ? {
            game: [...(parent.arguments?.game ?? []), ...(child.arguments?.game ?? [])],
            jvm: [...(parent.arguments?.jvm ?? []), ...(child.arguments?.jvm ?? [])]
          }
        : undefined,
    minecraftArguments: child.minecraftArguments ?? parent.minecraftArguments,
    assetIndex: child.assetIndex ?? parent.assetIndex,
    assets: child.assets ?? parent.assets,
    downloads: child.downloads ?? parent.downloads,
    javaVersion: child.javaVersion ?? parent.javaVersion,
    logging: child.logging ?? parent.logging
  };
}
