#!/usr/bin/env node
// ─── Security: error sanitization ────────────────────────────────────
/** Redact file paths and internal details from error messages. */
export function sanitizeError(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err);
  msg = msg.replace(/\/[^\s"']+/g, "[path]");
  if (msg.length > 500) msg = msg.slice(0, 500) + "... (truncated)";
  return msg;
}

import { program } from "commander";
import { publishCommand } from "./commands/publish.js";
import { batchCommand } from "./commands/batch.js";
import { inspectCommand } from "./commands/inspect.js";
import { generateCommand } from "./commands/generate.js";

program
  .name("mcp2ar")
  .description(
    "Auto-package npm-published MCP servers for agentregistry.\n" +
      "Bridge the gap between npm and Solo.io's agent registry.",
  )
  .version("1.0.0");

program.addCommand(generateCommand);
program.addCommand(publishCommand);
program.addCommand(batchCommand);
program.addCommand(inspectCommand);

program.parse();
