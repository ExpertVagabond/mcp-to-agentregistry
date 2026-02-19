import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ToolInfo } from "./types.js";

export async function introspectServer(
  npmPackage: string,
  timeout = 15000,
): Promise<ToolInfo[]> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", npmPackage],
  });

  const client = new Client(
    { name: "mcp2ar-introspector", version: "1.0.0" },
    { capabilities: {} },
  );

  const timer = setTimeout(() => {
    client.close().catch(() => {});
  }, timeout);

  try {
    await client.connect(transport);
    const result = await client.listTools();
    clearTimeout(timer);

    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown> | undefined,
    }));
  } catch (err) {
    clearTimeout(timer);
    throw new Error(
      `Failed to introspect ${npmPackage}: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    await client.close().catch(() => {});
  }
}
