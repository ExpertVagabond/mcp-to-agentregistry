import { Command } from "commander";
import { fetchNpmMetadata } from "../lib/npm-fetcher.js";
import { buildArtifact } from "../lib/artifact-builder.js";
import { introspectServer } from "../lib/introspector.js";
import { RegistryClient } from "../lib/registry-client.js";
import type { BuildOptions } from "../lib/types.js";

export const publishCommand = new Command("publish")
  .description("Publish an npm MCP server to agentregistry")
  .argument("<npm-package>", "npm package name")
  .option("-v, --pkg-version <version>", "specific npm version (default: latest)")
  .option("-n, --namespace <namespace>", "registry namespace", "io.github.ExpertVagabond")
  .option("--name <name>", "override registry name")
  .option("--introspect", "run server to discover tools")
  .option("--timeout <ms>", "introspection timeout", "15000")
  .option("--dry-run", "show artifact JSON without publishing")
  .option("--registry-url <url>", "agentregistry API URL")
  .option("--collection <name>", "tag with collection name")
  .action(async (npmPackage: string, opts) => {
    try {
      console.log(`Fetching metadata for ${npmPackage}...`);
      const npm = await fetchNpmMetadata(npmPackage, opts.pkgVersion);
      console.log(`  Found ${npm.name}@${npm.version}`);

      const buildOpts: BuildOptions = {
        namespace: opts.namespace,
        nameOverride: opts.name,
        collection: opts.collection,
      };

      if (opts.introspect) {
        console.log(`  Introspecting tools (timeout: ${opts.timeout}ms)...`);
        try {
          const tools = await introspectServer(npmPackage, parseInt(opts.timeout));
          buildOpts.toolCount = tools.length;
          buildOpts.toolNames = tools.map((t) => t.name);
          console.log(`  Discovered ${tools.length} tools`);
        } catch (err) {
          console.log(
            `  Warning: introspection failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      const artifact = buildArtifact(npm, buildOpts);

      if (opts.dryRun) {
        console.log("\n--- Dry Run ---");
        console.log(JSON.stringify(artifact, null, 2));
        return;
      }

      const client = new RegistryClient(opts.registryUrl);

      console.log("  Checking registry connection...");
      const alive = await client.ping();
      if (!alive) {
        console.error(
          "Error: Cannot reach agentregistry. Is arctl running?\n" +
            "  Install: curl -fsSL https://raw.githubusercontent.com/agentregistry-dev/agentregistry/main/scripts/get-arctl | bash\n" +
            "  Start:   arctl &",
        );
        process.exit(1);
      }

      console.log(`  Publishing ${artifact.name}@${artifact.version}...`);
      const result = await client.publish(artifact);
      console.log(`  Published: ${result.spec?.name ?? artifact.name}@${result.spec?.version ?? artifact.version}`);
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });
