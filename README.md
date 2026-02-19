# mcp-to-agentregistry (mcp2ar)

Auto-package npm-published MCP servers for [agentregistry](https://aregistry.ai/) by Solo.io.

**The problem:** Thousands of MCP servers live on npm. agentregistry is a curated registry for AI artifacts with security scoring, governance, and discoverability. Getting servers from one to the other requires manual artifact creation.

**The solution:** `mcp2ar` reads MCP server metadata directly from the npm registry, generates schema-compliant `ServerJSON` artifacts, and publishes them to agentregistry — individually or as curated collections.

## Quick Start

```bash
# Install
npm install -g mcp-to-agentregistry

# Generate an artifact (no registry needed)
mcp2ar generate ordinals-mcp

# Preview what would be published
mcp2ar publish ordinals-mcp --dry-run

# Publish to a running agentregistry
mcp2ar publish ordinals-mcp

# Publish an entire collection
mcp2ar batch examples/blockchain-collection.json
```

## How It Works

```
┌─────────────┐     ┌──────────┐     ┌─────────────────┐
│  npm Registry│────▶│  mcp2ar  │────▶│  agentregistry  │
│  (metadata)  │     │ (bridge) │     │  (curated AI    │
└─────────────┘     └──────────┘     │   artifact hub) │
                         │            └─────────────────┘
                    Reads package.json
                    Generates ServerJSON
                    Publishes via API
```

1. Fetches `package.json` from npm registry API (no install needed)
2. Maps fields to agentregistry's `ServerJSON` schema (`2025-12-11`)
3. Enriches with repository info, keywords, author, license
4. Publishes via agentregistry REST API (`POST /v0/servers`)

## Commands

### `mcp2ar generate <npm-package>`

Generate artifact JSON from an npm MCP server without publishing.

```bash
mcp2ar generate ordinals-mcp                    # stdout
mcp2ar generate ordinals-mcp -o artifact.json   # write to file
mcp2ar generate ordinals-mcp --introspect       # discover tools at runtime
```

| Flag | Description |
|------|-------------|
| `-v, --pkg-version <ver>` | Specific npm version (default: latest) |
| `-n, --namespace <ns>` | Registry namespace (default: `io.github.ExpertVagabond`) |
| `--name <name>` | Override registry name |
| `--introspect` | Run server via npx to discover tools |
| `--timeout <ms>` | Introspection timeout (default: 15000) |
| `-o, --output <file>` | Write to file instead of stdout |
| `--collection <name>` | Tag with collection name |

### `mcp2ar publish <npm-package>`

Generate and publish to agentregistry.

```bash
mcp2ar publish ordinals-mcp
mcp2ar publish ordinals-mcp --dry-run
mcp2ar publish ordinals-mcp --introspect --collection blockchain
```

All `generate` flags plus:

| Flag | Description |
|------|-------------|
| `--dry-run` | Show artifact without publishing |
| `--registry-url <url>` | agentregistry API URL (default: `http://localhost:12121`) |

### `mcp2ar batch <config-file>`

Batch publish from a collection config file.

```bash
mcp2ar batch examples/blockchain-collection.json
mcp2ar batch examples/blockchain-collection.json --dry-run
```

| Flag | Description |
|------|-------------|
| `--dry-run` | Show all artifacts without publishing |
| `--registry-url <url>` | agentregistry API URL |

### `mcp2ar inspect <npm-package>`

Introspect an MCP server to discover its tools.

```bash
mcp2ar inspect ordinals-mcp
mcp2ar inspect ordinals-mcp --json
```

| Flag | Description |
|------|-------------|
| `--timeout <ms>` | Connection timeout (default: 15000) |
| `--json` | Output as JSON instead of table |

## Collection Config

Collections let you publish related MCP servers as a group with shared metadata. Create a JSON config:

```json
{
  "collection": "blockchain-mcp-collection",
  "namespace": "io.github.ExpertVagabond",
  "servers": [
    {
      "npmPackage": "ordinals-mcp",
      "envVars": [
        { "name": "HIRO_API_KEY", "description": "Hiro API key", "isRequired": false, "isSecret": true }
      ]
    },
    {
      "npmPackage": "solana-mcp-server"
    }
  ]
}
```

Each server entry supports:

| Field | Description |
|-------|-------------|
| `npmPackage` | npm package name (required) |
| `version` | Specific version (default: latest) |
| `nameOverride` | Override the registry name |
| `envVars` | Environment variables for the server |

## Demo: Blockchain MCP Collection

This repo ships with a pre-built collection of 4 blockchain MCP servers (102 tools total):

| Server | Tools | Description |
|--------|-------|-------------|
| [ordinals-mcp](https://github.com/ExpertVagabond/ordinals-mcp) | 24 | Bitcoin Ordinals — inscriptions, runes, BRC-20, marketplace |
| [solana-mcp-server](https://github.com/ExpertVagabond/solana-mcp-server) | 28 | Solana — wallets, transactions, SPL tokens, Anchor |
| [solmail-mcp](https://github.com/ExpertVagabond/solmail-mcp) | 4 | Physical mail via Solana — AI agents send real letters |
| [universal-blockchain-mcp](https://github.com/ExpertVagabond/universal-blockchain-mcp) | 46 | Cross-chain — ZetaChain, Foundry, DeFi, NFTs |

```bash
# Preview the full collection
mcp2ar batch examples/blockchain-collection.json --dry-run

# Publish to local agentregistry
arctl &  # start registry
mcp2ar batch examples/blockchain-collection.json
arctl mcp list  # verify
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ARCTL_API_BASE_URL` | agentregistry API URL (default: `http://localhost:12121`) |
| `ARCTL_API_TOKEN` | Bearer token for authenticated registries |

## Requirements

- Node.js >= 18
- [arctl](https://github.com/agentregistry-dev/agentregistry) (for publishing — not needed for `generate`)

Install arctl:
```bash
curl -fsSL https://raw.githubusercontent.com/agentregistry-dev/agentregistry/main/scripts/get-arctl | bash
```

## Schema Compliance

Generated artifacts conform to the [MCP Registry ServerJSON schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json):

- `$schema`: `2025-12-11`
- `name`: Reverse-DNS format (`io.github.{org}/{name}`)
- `packages`: npm registry type with stdio transport
- `repository`: Auto-extracted from npm metadata
- `_meta`: Publisher-provided enrichment (keywords, author, license, collection, tool count)

## License

MIT
