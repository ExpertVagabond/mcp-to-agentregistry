import { Command } from "commander";
import { fetchNpmMetadata } from "../lib/npm-fetcher.js";
import { buildArtifact } from "../lib/artifact-builder.js";
import { introspectServer } from "../lib/introspector.js";
import { sanitizeError } from "../cli.js";
import type { BuildOptions } from "../lib/types.js";
import { writeFileSync } from "node:fs";

export const generateCommand = new Command("generate")
  .description("Generate agentregistry artifact JSON from an npm MCP server")
  .argument("<npm-package>", "npm package name")
  .option("-v, --pkg-version <version>", "specific npm version (default: latest)")
  .option("-n, --namespace <namespace>", "registry namespace", "io.github.ExpertVagabond")
  .option("--name <name>", "override registry name")
  .option("--introspect", "run server to discover tools")
  .option("--timeout <ms>", "introspection timeout", "15000")
  .option("-o, --output <file>", "write to file instead of stdout")
  .option("--collection <name>", "tag with collection name")
  .action(async (npmPackage: string, opts) => {
    try {
      console.error(`Fetching metadata for ${npmPackage}...`);
      const npm = await fetchNpmMetadata(npmPackage, opts.pkgVersion);
      console.error(`  Found ${npm.name}@${npm.version}`);

      const buildOpts: BuildOptions = {
        namespace: opts.namespace,
        nameOverride: opts.name,
        collection: opts.collection,
      };

      if (opts.introspect) {
        console.error(`  Introspecting tools (timeout: ${opts.timeout}ms)...`);
        try {
          const tools = await introspectServer(npmPackage, parseInt(opts.timeout));
          buildOpts.toolCount = tools.length;
          buildOpts.toolNames = tools.map((t) => t.name);
          console.error(`  Discovered ${tools.length} tools`);
        } catch (err) {
          console.error(
            `  Warning: introspection failed: ${sanitizeError(err)}`,
          );
        }
      }

      const artifact = buildArtifact(npm, buildOpts);
      const json = JSON.stringify(artifact, null, 2);

      if (opts.output) {
        writeFileSync(opts.output, json + "\n");
        console.error(`  Written to ${opts.output}`);
      } else {
        console.log(json);
      }
    } catch (err) {
      console.error(
        `Error: ${sanitizeError(err)}`,
      );
      process.exit(1);
    }
  });
