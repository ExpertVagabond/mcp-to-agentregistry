import { Command } from "commander";
import { introspectServer } from "../lib/introspector.js";
import { sanitizeError } from "../cli.js";

export const inspectCommand = new Command("inspect")
  .description("Introspect an MCP server to discover its tools")
  .argument("<npm-package>", "npm package name")
  .option("--timeout <ms>", "connection timeout in ms", "15000")
  .option("--json", "output as JSON instead of table")
  .action(async (npmPackage: string, opts) => {
    try {
      console.log(`Introspecting ${npmPackage}...`);
      console.log(`  This will run the server via npx. Timeout: ${opts.timeout}ms\n`);

      const tools = await introspectServer(npmPackage, parseInt(opts.timeout));

      if (opts.json) {
        console.log(JSON.stringify(tools, null, 2));
        return;
      }

      console.log(`Found ${tools.length} tools:\n`);

      const nameWidth = Math.max(
        4,
        ...tools.map((t) => t.name.length),
      );

      console.log(
        `${"NAME".padEnd(nameWidth)}  DESCRIPTION`,
      );
      console.log(`${"─".repeat(nameWidth)}  ${"─".repeat(60)}`);

      for (const tool of tools) {
        const desc = tool.description
          ? tool.description.length > 60
            ? tool.description.slice(0, 57) + "..."
            : tool.description
          : "(no description)";
        console.log(`${tool.name.padEnd(nameWidth)}  ${desc}`);
      }
    } catch (err) {
      console.error(
        `Error: ${sanitizeError(err)}`,
      );
      process.exit(1);
    }
  });
