import type { NpmPackageMetadata } from "./types.js";

const NPM_REGISTRY = "https://registry.npmjs.org";

export async function fetchNpmMetadata(
  packageName: string,
  version?: string,
): Promise<NpmPackageMetadata> {
  const url = version
    ? `${NPM_REGISTRY}/${encodeURIComponent(packageName)}/${version}`
    : `${NPM_REGISTRY}/${encodeURIComponent(packageName)}/latest`;

  const response = await fetch(url);
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
