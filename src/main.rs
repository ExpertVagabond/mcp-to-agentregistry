use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const NPM_REGISTRY: &str = "https://registry.npmjs.org";
const SCHEMA_URL: &str = "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";

#[derive(Parser)]
#[command(name = "mcp2ar", about = "Auto-package npm-published MCP servers for agentregistry")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate agentregistry artifact JSON from an npm MCP server
    Generate {
        /// npm package name
        npm_package: String,
        /// specific npm version (default: latest)
        #[arg(short = 'v', long = "pkg-version")]
        pkg_version: Option<String>,
        /// registry namespace
        #[arg(short, long, default_value = "io.github.ExpertVagabond")]
        namespace: String,
        /// override registry name
        #[arg(long)]
        name: Option<String>,
        /// tag with collection name
        #[arg(long)]
        collection: Option<String>,
        /// write to file instead of stdout
        #[arg(short, long)]
        output: Option<String>,
    },
    /// Publish an npm MCP server to agentregistry
    Publish {
        /// npm package name
        npm_package: String,
        #[arg(short = 'v', long = "pkg-version")]
        pkg_version: Option<String>,
        #[arg(short, long, default_value = "io.github.ExpertVagabond")]
        namespace: String,
        #[arg(long)]
        name: Option<String>,
        #[arg(long)]
        collection: Option<String>,
        /// show artifact JSON without publishing
        #[arg(long)]
        dry_run: bool,
        /// agentregistry API URL
        #[arg(long, env = "ARCTL_API_BASE_URL", default_value = "http://localhost:12121")]
        registry_url: String,
    },
    /// Batch publish MCP servers from a collection config
    Batch {
        /// path to collection JSON config
        config_file: String,
        #[arg(long)]
        dry_run: bool,
        #[arg(long, env = "ARCTL_API_BASE_URL", default_value = "http://localhost:12121")]
        registry_url: String,
    },
    /// Introspect an MCP server to discover its tools (via npx stdio)
    Inspect {
        /// npm package name
        npm_package: String,
        /// connection timeout in ms
        #[arg(long, default_value = "15000")]
        timeout: u64,
        /// output as JSON instead of table
        #[arg(long)]
        json: bool,
    },
}

#[derive(Deserialize)]
struct NpmMetadata {
    name: String,
    version: String,
    #[serde(default)]
    description: String,
    repository: Option<NpmRepo>,
    homepage: Option<String>,
    #[serde(default)]
    keywords: Vec<String>,
    author: Option<Value>,
    license: Option<String>,
}

#[derive(Deserialize)]
struct NpmRepo {
    url: Option<String>,
}

#[derive(Deserialize)]
struct BatchConfig {
    collection: String,
    namespace: String,
    servers: Vec<ServerConfig>,
}

#[derive(Deserialize)]
struct ServerConfig {
    #[serde(rename = "npmPackage")]
    npm_package: String,
    version: Option<String>,
    #[serde(rename = "nameOverride")]
    name_override: Option<String>,
}

async fn fetch_npm(client: &reqwest::Client, package: &str, version: Option<&str>) -> Result<NpmMetadata, String> {
    let url = match version {
        Some(v) => format!("{NPM_REGISTRY}/{}/{v}", urlencoding::encode(package)),
        None => format!("{NPM_REGISTRY}/{}/latest", urlencoding::encode(package)),
    };
    let resp = client.get(&url).send().await.map_err(|e| format!("npm fetch error: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("npm returned {} for {package}", resp.status()));
    }
    resp.json::<NpmMetadata>().await.map_err(|e| format!("npm parse error: {e}"))
}

fn build_artifact(npm: &NpmMetadata, namespace: &str, name_override: Option<&str>, collection: Option<&str>) -> Value {
    let reg_name = name_override
        .map(|n| n.to_string())
        .unwrap_or_else(|| format!("{namespace}/{}", npm.name));

    let repo_url = npm.repository.as_ref()
        .and_then(|r| r.url.as_ref())
        .map(|u| u.trim_start_matches("git+").trim_end_matches(".git").to_string());

    let source = repo_url.as_ref().map(|u| {
        if u.contains("github.com") { "github" }
        else if u.contains("gitlab.com") { "gitlab" }
        else { "custom" }
    });

    let title = npm.name.replace('-', " ")
        .split_whitespace()
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().to_string() + c.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ");

    let author_name = match &npm.author {
        Some(Value::String(s)) => Some(s.clone()),
        Some(obj) => obj.get("name").and_then(|n| n.as_str()).map(String::from),
        None => None,
    };

    let mut artifact = json!({
        "$schema": SCHEMA_URL,
        "name": reg_name,
        "description": truncate(&npm.description, 100),
        "title": title,
        "version": npm.version,
        "packages": [{
            "registryType": "npm",
            "identifier": npm.name,
            "version": npm.version,
            "transport": {"type": "stdio"},
            "runtimeHint": "npx"
        }]
    });

    if let Some(hp) = &npm.homepage {
        artifact["websiteUrl"] = json!(hp);
    }
    if let (Some(url), Some(src)) = (&repo_url, source) {
        artifact["repository"] = json!({"url": url, "source": src});
    }

    let mut meta = serde_json::Map::new();
    if !npm.keywords.is_empty() { meta.insert("keywords".into(), json!(npm.keywords)); }
    if let Some(a) = &author_name { meta.insert("author".into(), json!(a)); }
    if let Some(l) = &npm.license { meta.insert("license".into(), json!(l)); }
    if let Some(c) = collection { meta.insert("collection".into(), json!(c)); }

    if !meta.is_empty() {
        artifact["_meta"] = json!({"io.modelcontextprotocol.registry/publisher-provided": meta});
    }

    artifact
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max { return s.to_string(); }
    let t = &s[..max.saturating_sub(3)];
    if let Some(pos) = t.rfind(' ') {
        if pos > max * 6 / 10 {
            return format!("{}...", &t[..pos]);
        }
    }
    format!("{t}...")
}

async fn registry_ping(client: &reqwest::Client, url: &str) -> bool {
    client.get(format!("{url}/v0/servers?limit=1"))
        .send().await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

async fn registry_publish(client: &reqwest::Client, url: &str, artifact: &Value) -> Result<Value, String> {
    let token = std::env::var("ARCTL_API_TOKEN").ok();
    let mut req = client.post(format!("{url}/v0/servers"))
        .json(artifact);
    if let Some(t) = &token {
        req = req.header("Authorization", format!("Bearer {t}"));
    }
    let resp = req.send().await.map_err(|e| format!("publish error: {e}"))?;
    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Registry returned error: {body}"));
    }
    resp.json::<Value>().await.map_err(|e| format!("parse error: {e}"))
}

async fn introspect(npm_package: &str, timeout_ms: u64) -> Result<Vec<Value>, String> {
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

    let mut child = tokio::process::Command::new("npx")
        .args(["-y", npm_package])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn npx: {e}"))?;

    let mut stdin = child.stdin.take().ok_or("No stdin")?;
    let stdout = child.stdout.take().ok_or("No stdout")?;
    let mut reader = BufReader::new(stdout).lines();

    // Send initialize
    let init = json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mcp2ar","version":"1.0.0"}}});
    stdin.write_all(serde_json::to_string(&init).unwrap().as_bytes()).await.map_err(|e| format!("write error: {e}"))?;
    stdin.write_all(b"\n").await.map_err(|e| format!("write error: {e}"))?;

    // Read initialize response
    let deadline = tokio::time::Instant::now() + tokio::time::Duration::from_millis(timeout_ms);
    let _init_resp = tokio::time::timeout_at(deadline, reader.next_line()).await
        .map_err(|_| "Timeout waiting for initialize response".to_string())?
        .map_err(|e| format!("read error: {e}"))?;

    // Send tools/list
    let list = json!({"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}});
    stdin.write_all(serde_json::to_string(&list).unwrap().as_bytes()).await.map_err(|e| format!("write error: {e}"))?;
    stdin.write_all(b"\n").await.map_err(|e| format!("write error: {e}"))?;

    // Read tools/list response
    let tools_line = tokio::time::timeout_at(deadline, reader.next_line()).await
        .map_err(|_| "Timeout waiting for tools/list response".to_string())?
        .map_err(|e| format!("read error: {e}"))?
        .ok_or("Server closed connection")?;

    let resp: Value = serde_json::from_str(&tools_line).map_err(|e| format!("parse error: {e}"))?;
    let tools = resp.pointer("/result/tools")
        .and_then(|t| t.as_array())
        .cloned()
        .unwrap_or_default();

    let _ = child.kill().await;
    Ok(tools)
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let client = reqwest::Client::new();

    match cli.command {
        Commands::Generate { npm_package, pkg_version, namespace, name, collection, output } => {
            eprintln!("Fetching metadata for {npm_package}...");
            match fetch_npm(&client, &npm_package, pkg_version.as_deref()).await {
                Ok(npm) => {
                    eprintln!("  Found {}@{}", npm.name, npm.version);
                    let artifact = build_artifact(&npm, &namespace, name.as_deref(), collection.as_deref());
                    let json = serde_json::to_string_pretty(&artifact).unwrap();
                    if let Some(path) = output {
                        std::fs::write(&path, format!("{json}\n")).expect("Failed to write file");
                        eprintln!("  Written to {path}");
                    } else {
                        println!("{json}");
                    }
                }
                Err(e) => { eprintln!("Error: {e}"); std::process::exit(1); }
            }
        }

        Commands::Publish { npm_package, pkg_version, namespace, name, collection, dry_run, registry_url } => {
            eprintln!("Fetching metadata for {npm_package}...");
            match fetch_npm(&client, &npm_package, pkg_version.as_deref()).await {
                Ok(npm) => {
                    eprintln!("  Found {}@{}", npm.name, npm.version);
                    let artifact = build_artifact(&npm, &namespace, name.as_deref(), collection.as_deref());

                    if dry_run {
                        println!("--- Dry Run ---");
                        println!("{}", serde_json::to_string_pretty(&artifact).unwrap());
                        return;
                    }

                    eprintln!("  Checking registry connection...");
                    if !registry_ping(&client, &registry_url).await {
                        eprintln!("Error: Cannot reach agentregistry at {registry_url}. Is arctl running?");
                        std::process::exit(1);
                    }

                    let reg_name = artifact.get("name").and_then(|n| n.as_str()).unwrap_or("unknown");
                    let ver = artifact.get("version").and_then(|v| v.as_str()).unwrap_or("unknown");
                    eprintln!("  Publishing {reg_name}@{ver}...");

                    match registry_publish(&client, &registry_url, &artifact).await {
                        Ok(_) => eprintln!("  Published successfully."),
                        Err(e) => { eprintln!("Error: {e}"); std::process::exit(1); }
                    }
                }
                Err(e) => { eprintln!("Error: {e}"); std::process::exit(1); }
            }
        }

        Commands::Batch { config_file, dry_run, registry_url } => {
            let raw = std::fs::read_to_string(&config_file).expect("Failed to read config file");
            let config: BatchConfig = serde_json::from_str(&raw).expect("Invalid batch config JSON");

            println!("Collection: {}", config.collection);
            println!("Namespace: {}", config.namespace);
            println!("Servers: {}\n", config.servers.len());

            if !dry_run {
                eprintln!("Checking registry connection...");
                if !registry_ping(&client, &registry_url).await {
                    eprintln!("Error: Cannot reach agentregistry at {registry_url}");
                    std::process::exit(1);
                }
                eprintln!("  Connected.\n");
            }

            let mut succeeded = 0u32;
            let mut failed = 0u32;

            for (i, server) in config.servers.iter().enumerate() {
                println!("[{}/{}] {}", i + 1, config.servers.len(), server.npm_package);
                match fetch_npm(&client, &server.npm_package, server.version.as_deref()).await {
                    Ok(npm) => {
                        println!("  Fetched {}@{}", npm.name, npm.version);
                        let artifact = build_artifact(&npm, &config.namespace, server.name_override.as_deref(), Some(&config.collection));

                        if dry_run {
                            println!("{}", serde_json::to_string_pretty(&artifact).unwrap());
                            succeeded += 1;
                            continue;
                        }

                        match registry_publish(&client, &registry_url, &artifact).await {
                            Ok(_) => { println!("  Done.\n"); succeeded += 1; }
                            Err(e) => { eprintln!("  Failed: {e}\n"); failed += 1; }
                        }
                    }
                    Err(e) => { eprintln!("  Failed: {e}\n"); failed += 1; }
                }
            }

            println!("\nResults: {succeeded} published, {failed} failed");
            if failed > 0 { std::process::exit(1); }
        }

        Commands::Inspect { npm_package, timeout, json: json_output } => {
            eprintln!("Introspecting {npm_package}...");
            eprintln!("  This will run the server via npx. Timeout: {timeout}ms\n");

            match introspect(&npm_package, timeout).await {
                Ok(tools) => {
                    if json_output {
                        println!("{}", serde_json::to_string_pretty(&tools).unwrap());
                    } else {
                        println!("Found {} tools:\n", tools.len());
                        let name_width = tools.iter()
                            .filter_map(|t| t.get("name").and_then(|n| n.as_str()))
                            .map(|n| n.len())
                            .max()
                            .unwrap_or(4)
                            .max(4);

                        println!("{:width$}  DESCRIPTION", "NAME", width = name_width);
                        println!("{}  {}", "─".repeat(name_width), "─".repeat(60));

                        for tool in &tools {
                            let name = tool.get("name").and_then(|n| n.as_str()).unwrap_or("?");
                            let desc = tool.get("description").and_then(|d| d.as_str()).unwrap_or("(no description)");
                            let desc_trunc = if desc.len() > 60 { format!("{}...", &desc[..57]) } else { desc.to_string() };
                            println!("{:width$}  {desc_trunc}", name, width = name_width);
                        }
                    }
                }
                Err(e) => { eprintln!("Error: {e}"); std::process::exit(1); }
            }
        }
    }
}
