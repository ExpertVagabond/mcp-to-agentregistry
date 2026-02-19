// ServerJSON — mirrors modelcontextprotocol/registry schema 2025-12-11

export interface ServerJSON {
  $schema: string;
  name: string;
  description: string;
  title?: string;
  version: string;
  websiteUrl?: string;
  repository?: Repository;
  icons?: Icon[];
  packages?: Package[];
  remotes?: Remote[];
  _meta?: ServerMeta;
}

export interface Repository {
  url: string;
  source: string;
  id?: string;
  subfolder?: string;
}

export interface Icon {
  src: string;
  mimeType?: string;
  sizes?: string[];
  theme?: string;
}

export interface Remote {
  type: string;
  url?: string;
  headers?: KeyValue[];
}

export interface Package {
  registryType: string;
  identifier: string;
  version: string;
  registryBaseUrl?: string;
  transport: PackageTransport;
  runtimeHint?: string;
  runtimeArguments?: Argument[];
  packageArguments?: Argument[];
  environmentVariables?: EnvVar[];
}

export interface PackageTransport {
  type: string;
  url?: string;
}

export interface Argument {
  value: string;
  type: "positional" | "named";
}

export interface KeyValue {
  name: string;
  value: string;
}

export interface EnvVar {
  name: string;
  description?: string;
  value?: string;
  isRequired?: boolean;
  isSecret?: boolean;
}

export interface ServerMeta {
  "io.modelcontextprotocol.registry/publisher-provided"?: Record<string, unknown>;
}

// npm registry API response
export interface NpmPackageMetadata {
  name: string;
  version: string;
  description: string;
  mcpName?: string;
  repository?: { type: string; url: string };
  homepage?: string;
  keywords?: string[];
  author?: string | { name: string; email?: string };
  license?: string;
  bin?: Record<string, string>;
}

// Batch config for collection publishing
export interface BatchConfig {
  collection: string;
  namespace: string;
  servers: ServerConfig[];
}

export interface ServerConfig {
  npmPackage: string;
  version?: string;
  nameOverride?: string;
  envVars?: EnvVar[];
}

// Build options passed to artifact builder
export interface BuildOptions {
  namespace?: string;
  nameOverride?: string;
  collection?: string;
  toolCount?: number;
  toolNames?: string[];
  envVars?: EnvVar[];
}

// Tool info from MCP introspection
export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}
