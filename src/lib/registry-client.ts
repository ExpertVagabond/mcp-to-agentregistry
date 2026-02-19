import type { ServerJSON } from "./types.js";

export interface ServerResponse {
  spec: ServerJSON;
  _meta?: Record<string, unknown>;
}

export interface ListResponse {
  servers: ServerResponse[];
  meta?: { count: number; next_cursor?: string };
}

export class RegistryClient {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl?: string, token?: string) {
    this.baseUrl =
      baseUrl ??
      process.env.ARCTL_API_BASE_URL ??
      "http://localhost:12121";
    this.token = token ?? process.env.ARCTL_API_TOKEN;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.token) {
      h["Authorization"] = `Bearer ${this.token}`;
    }
    return h;
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v0/servers?limit=1`, {
        headers: this.headers(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async publish(server: ServerJSON): Promise<ServerResponse> {
    const res = await fetch(`${this.baseUrl}/v0/servers`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(server),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Registry returned ${res.status}: ${body}`);
    }

    return res.json();
  }

  async listServers(limit = 100): Promise<ListResponse> {
    const res = await fetch(
      `${this.baseUrl}/v0/servers?limit=${limit}`,
      { headers: this.headers() },
    );

    if (!res.ok) {
      throw new Error(`Registry returned ${res.status}`);
    }

    return res.json();
  }

  async getServer(
    name: string,
    version: string,
  ): Promise<ServerResponse | null> {
    const res = await fetch(
      `${this.baseUrl}/v0/servers/${encodeURIComponent(name)}/versions/${version}`,
      { headers: this.headers() },
    );

    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Registry returned ${res.status}`);
    }

    return res.json();
  }
}
