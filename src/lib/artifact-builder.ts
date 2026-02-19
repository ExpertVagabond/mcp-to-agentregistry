import type { ServerJSON, NpmPackageMetadata, BuildOptions } from "./types.js";

const SCHEMA_URL =
  "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";

export function buildArtifact(
  npm: NpmPackageMetadata,
  options?: BuildOptions,
): ServerJSON {
  const name = options?.nameOverride ?? npm.mcpName ?? inferRegistryName(npm.name, options?.namespace);
  const repoUrl = normalizeGitUrl(npm.repository?.url);
  const authorName = typeof npm.author === "string" ? npm.author : npm.author?.name;

  const artifact: ServerJSON = {
    $schema: SCHEMA_URL,
    name,
    description: truncate(npm.description, 100),
    title: humanize(npm.name),
    version: npm.version,
    packages: [
      {
        registryType: "npm",
        identifier: npm.name,
        version: npm.version,
        transport: { type: "stdio" },
        runtimeHint: "npx",
        ...(options?.envVars?.length
          ? { environmentVariables: options.envVars }
          : {}),
      },
    ],
  };

  if (npm.homepage) {
    artifact.websiteUrl = npm.homepage;
  }

  if (repoUrl) {
    artifact.repository = {
      url: repoUrl,
      source: detectSource(repoUrl),
    };
  }

  const publisherMeta: Record<string, unknown> = {};
  if (npm.keywords?.length) publisherMeta.keywords = npm.keywords;
  if (authorName) publisherMeta.author = authorName;
  if (npm.license) publisherMeta.license = npm.license;
  if (options?.collection) publisherMeta.collection = options.collection;
  if (options?.toolCount) publisherMeta.toolCount = options.toolCount;
  if (options?.toolNames?.length) publisherMeta.toolNames = options.toolNames;

  if (Object.keys(publisherMeta).length > 0) {
    artifact._meta = {
      "io.modelcontextprotocol.registry/publisher-provided": publisherMeta,
    };
  }

  return artifact;
}

function inferRegistryName(npmName: string, namespace?: string): string {
  const ns = namespace ?? "io.github.ExpertVagabond";
  return `${ns}/${npmName}`;
}

function normalizeGitUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url
    .replace(/^git\+/, "")
    .replace(/\.git$/, "");
}

function detectSource(url: string): string {
  if (url.includes("github.com")) return "github";
  if (url.includes("gitlab.com")) return "gitlab";
  if (url.includes("bitbucket.org")) return "bitbucket";
  return "custom";
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  const truncated = str.slice(0, max - 3);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > max * 0.6) {
    return truncated.slice(0, lastSpace) + "...";
  }
  return truncated + "...";
}

function humanize(npmName: string): string {
  return npmName
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
