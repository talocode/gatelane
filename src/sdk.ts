import type {
  GateLaneServer,
  GateLaneTool,
  GateLanePolicy,
  GateLaneRateLimit,
  GateLaneAuditEvent,
  GateLaneUsageEvent,
  ToolCallResponse,
  CreateServerRequest,
  CreatePolicyRequest,
} from "./core/schema.js";

export interface GateLaneClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export class GateLaneClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(options: GateLaneClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(err.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async health(): Promise<{ status: string; service: string; version: string; cloudMode: boolean }> {
    return this.request("GET", "/v1/gatelane/health");
  }

  async capabilities(): Promise<{ capabilities: string[]; version: string }> {
    return this.request("GET", "/v1/gatelane/capabilities");
  }

  async listServers(): Promise<{ servers: GateLaneServer[] }> {
    return this.request("GET", "/v1/gatelane/servers");
  }

  async addServer(req: CreateServerRequest): Promise<{ server: GateLaneServer }> {
    return this.request("POST", "/v1/gatelane/servers", req);
  }

  async getServer(id: string): Promise<{ server: GateLaneServer }> {
    return this.request("GET", `/v1/gatelane/servers/${encodeURIComponent(id)}`);
  }

  async removeServer(id: string): Promise<{ status: string }> {
    return this.request("DELETE", `/v1/gatelane/servers/${encodeURIComponent(id)}`);
  }

  async discoverTools(): Promise<{ tools: GateLaneTool[]; count: number }> {
    return this.request("POST", "/v1/gatelane/tools/discover");
  }

  async listTools(): Promise<{ tools: GateLaneTool[] }> {
    return this.request("GET", "/v1/gatelane/tools");
  }

  async getTool(id: string): Promise<{ tool: GateLaneTool }> {
    return this.request("GET", `/v1/gatelane/tools/${encodeURIComponent(id)}`);
  }

  async callTool(req: { tool: string; input?: Record<string, unknown>; actor?: string }): Promise<ToolCallResponse> {
    return this.request("POST", "/v1/gatelane/call", req);
  }

  async createPolicy(req: CreatePolicyRequest): Promise<{ policy: GateLanePolicy }> {
    return this.request("POST", "/v1/gatelane/policies", req);
  }

  async allowTool(tool: string, reason?: string): Promise<{ policy: GateLanePolicy }> {
    return this.createPolicy({ effect: "allow", tool, reason });
  }

  async denyTool(tool: string, reason?: string): Promise<{ policy: GateLanePolicy }> {
    return this.createPolicy({ effect: "deny", tool, reason });
  }

  async listPolicies(): Promise<{ policies: GateLanePolicy[] }> {
    return this.request("GET", "/v1/gatelane/policies");
  }

  async removePolicy(id: string): Promise<{ status: string }> {
    return this.request("DELETE", `/v1/gatelane/policies/${encodeURIComponent(id)}`);
  }

  async createRateLimit(req: { scope: string; target: string; limit: number; windowSeconds: number }): Promise<{ rateLimit: GateLaneRateLimit }> {
    return this.request("POST", "/v1/gatelane/rate-limits", req);
  }

  async listRateLimits(): Promise<{ rateLimits: GateLaneRateLimit[] }> {
    return this.request("GET", "/v1/gatelane/rate-limits");
  }

  async listAuditLogs(): Promise<{ entries: GateLaneAuditEvent[]; count: number }> {
    return this.request("GET", "/v1/gatelane/audit");
  }

  async getUsage(): Promise<{ events: GateLaneUsageEvent[]; totalCredits: number }> {
    return this.request("GET", "/v1/gatelane/usage");
  }
}
