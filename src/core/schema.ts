export type ServerType = "mcp-stdio" | "mcp-http" | "http-api" | "mock";

export interface GateLaneServer {
  id: string;
  name: string;
  type: ServerType;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface GateLaneTool {
  id: string;
  serverId: string;
  serverName: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  enabled: boolean;
}

export interface GateLanePolicy {
  id: string;
  name: string;
  effect: "allow" | "deny";
  server?: string;
  tool?: string;
  actor?: string;
  reason?: string;
  createdAt: string;
}

export interface GateLaneRateLimit {
  id: string;
  scope: "global" | "server" | "tool" | "actor";
  target: string;
  limit: number;
  windowSeconds: number;
  createdAt: string;
}

export interface GateLaneAuditEvent {
  id: string;
  actor?: string;
  serverId?: string;
  serverName?: string;
  toolName?: string;
  requestId: string;
  status: "allowed" | "denied" | "failed" | "completed";
  reason?: string;
  durationMs?: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface GateLaneUsageEvent {
  id: string;
  actor?: string;
  serverId?: string;
  toolName?: string;
  requestId: string;
  credits: number;
  createdAt: string;
}

export interface GateLaneConfig {
  cloudMode: boolean;
  defaultPort: number;
  policyDefault?: "allow" | "deny";
  createdAt: string;
  updatedAt: string;
}

export interface ToolCallRequest {
  tool: string;
  input: Record<string, unknown>;
  actor?: string;
}

export interface ToolCallResponse {
  requestId: string;
  status: "allowed" | "denied" | "failed" | "completed";
  tool: string;
  result?: unknown;
  error?: string;
  auditId: string;
  durationMs: number;
}

export interface CreateServerRequest {
  name: string;
  type: ServerType;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface CreatePolicyRequest {
  effect: "allow" | "deny";
  server?: string;
  tool?: string;
  actor?: string;
  reason?: string;
}
