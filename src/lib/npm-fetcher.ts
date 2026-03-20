import type { NpmPackageMetadata } from "./types.js";

const NPM_REGISTRY = "https://registry.npmjs.org";

/** Validate npm package name — must match npm naming rules */
function validatePackageName(name: string): void {
  if (!name || typeof name !== "string") throw new Error("Package name is required");
  if (name.length > 214) throw new Error("Package name exceeds maximum length (214)");
  // npm package names: lowercase, can have @scope/, hyphens, dots, underscores
  if (!/^(@[a-z0-9\-~][a-z0-9\-._~]*\/)?[a-z0-9\-~][a-z0-9\-._~]*$/.test(name)) {
    throw new Error(`Invalid npm package name: ${name}`);
  }
}

export async function fetchNpmMetadata(
  packageName: string,
  version?: string,
): Promise<NpmPackageMetadata> {
  validatePackageName(packageName);
  if (version && !/^[a-zA-Z0-9.\-+]+$/.test(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  const url = version
    ? `${NPM_REGISTRY}/${encodeURIComponent(packageName)}/${version}`
    : `${NPM_REGISTRY}/${encodeURIComponent(packageName)}/latest`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  const response = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
  if (!response.ok) {
    throw new Error(
      `npm registry returned ${response.status} for ${packageName}${version ? `@${version}` : ""}`,
    );
  }

  const data = await response.json();
  return {
    name: data.name,
    version: data.version,
    description: data.description ?? "",
    mcpName: data.mcpName,
    repository: data.repository,
    homepage: data.homepage,
    keywords: data.keywords,
    author: data.author,
    license: data.license,
    bin: data.bin,
  };
}
