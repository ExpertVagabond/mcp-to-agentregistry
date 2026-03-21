import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fetchNpmMetadata } from "../lib/npm-fetcher.js";
import { buildArtifact } from "../lib/artifact-builder.js";
import { RegistryClient } from "../lib/registry-client.js";
import { sanitizeError } from "../cli.js";
import type { BatchConfig, BuildOptions } from "../lib/types.js";

export const batchCommand = new Command("batch")
  .description("Batch publish MCP servers from a collection config")
  .argument("<config-file>", "path to collection JSON config")
  .option("--dry-run", "show artifacts without publishing")
  .option("--registry-url <url>", "agentregistry API URL")
  .action(async (configFile: string, opts) => {
    try {
      const raw = readFileSync(configFile, "utf-8");
      const config: BatchConfig = JSON.parse(raw);

      console.log(`Collection: ${config.collection}`);
      console.log(`Namespace: ${config.namespace}`);
      console.log(`Servers: ${config.servers.length}\n`);

      const client = new RegistryClient(opts.registryUrl);

      if (!opts.dryRun) {
        console.log("Checking registry connection...");
        const alive = await client.ping();
        if (!alive) {
          console.error(
            "Error: Cannot reach agentregistry. Is arctl running?\n" +
              "  Install: curl -fsSL https://raw.githubusercontent.com/agentregistry-dev/agentregistry/main/scripts/get-arctl | bash\n" +
              "  Start:   arctl &",
          );
          process.exit(1);
        }
        console.log("  Connected.\n");
      }

      let succeeded = 0;
      let failed = 0;

      for (const server of config.servers) {
        try {
          console.log(`[${succeeded + failed + 1}/${config.servers.length}] ${server.npmPackage}`);
          const npm = await fetchNpmMetadata(server.npmPackage, server.version);
          console.log(`  Fetched ${npm.name}@${npm.version}`);

          const buildOpts: BuildOptions = {
            namespace: config.namespace,
            nameOverride: server.nameOverride,
            collection: config.collection,
            envVars: server.envVars,
          };

          const artifact = buildArtifact(npm, buildOpts);

          if (opts.dryRun) {
            console.log(JSON.stringify(artifact, null, 2));
            console.log();
            succeeded++;
            continue;
          }

          console.log(`  Publishing ${artifact.name}@${artifact.version}...`);
          await client.publish(artifact);
          console.log(`  Done.\n`);
          succeeded++;
        } catch (err) {
          console.error(
            `  Failed: ${sanitizeError(err)}\n`,
          );
          failed++;
        }
      }

      console.log(`\nResults: ${succeeded} published, ${failed} failed`);
      if (failed > 0) process.exit(1);
    } catch (err) {
      console.error(
        `Error: ${sanitizeError(err)}`,
      );
      process.exit(1);
    }
  });
