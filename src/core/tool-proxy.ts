import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { loadServers } from "./config-store.js";
import type { GateLaneServer, GateLaneTool } from "./schema.js";
import { GateLaneError } from "./errors.js";

interface McpJsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface McpJsonRpcResponse {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface ToolCallInput {
  tool: string;
  input: Record<string, unknown>;
  actor?: string;
}

export interface ToolCallOutput {
  result: unknown;
  durationMs: number;
}

interface ToolDef {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

const TIMEOUT_MS = 30000;

const STDIO_COMMANDS = ["mcp-stdio", "mcp-http", "http-api"];

function isRealServer(server: GateLaneServer): boolean {
  return STDIO_COMMANDS.includes(server.type);
}

export class ToolProxy {
  async call(tool: GateLaneTool, input: Record<string, unknown>): Promise<ToolCallOutput> {
    const servers = loadServers();
    const server = servers.find((s) => s.id === tool.serverId);
    if (!server) {
      throw new GateLaneError(`Server '${tool.serverName}' not found in registry`, "SERVER_NOT_FOUND", 404);
    }
    return this.executeToolCall(server, tool, input);
  }

  async getToolList(server: GateLaneServer): Promise<ToolDef[]> {
    switch (server.type) {
      case "mcp-stdio":
        return this.listStdioTools(server);
      case "mcp-http":
      case "http-api":
        return this.listHttpTools(server);
      case "mock":
        return this.getMockTools(server.name);
      default:
        return this.getMockTools(server.name);
    }
  }

  private async executeToolCall(
    server: GateLaneServer,
    tool: GateLaneTool,
    input: Record<string, unknown>,
  ): Promise<ToolCallOutput> {
    const startTime = Date.now();

    switch (server.type) {
      case "mcp-stdio":
        return this.callStdioTool(server, tool, input, startTime);
      case "mcp-http":
      case "http-api":
        return this.callHttpTool(server, tool, input, startTime);
      case "mock":
        return this.callMockTool(server, tool, input, startTime);
      default:
        return this.callMockTool(server, tool, input, startTime);
    }
  }

  private extractToolName(tool: GateLaneTool): string {
    return tool.name.includes(".") ? tool.name.split(".").pop()! : tool.name;
  }

  private async callStdioTool(
    server: GateLaneServer,
    tool: GateLaneTool,
    input: Record<string, unknown>,
    startTime: number,
  ): Promise<ToolCallOutput> {
    const toolName = this.extractToolName(tool);

    return new Promise((resolve, reject) => {
      const proc = spawn(server.command!, server.args || [], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...server.env },
      });

      let stderr = "";
      let done = false;
      let resolved = false;

      const cleanup = () => {
        if (!proc.killed) proc.kill();
      };

      const timeout = setTimeout(() => {
        if (!done) {
          done = true;
          cleanup();
          reject(new GateLaneError("MCP stdio call timed out", "MCP_TIMEOUT", 504));
        }
      }, TIMEOUT_MS);

      proc.on("error", (err) => {
        if (!done) {
          done = true;
          clearTimeout(timeout);
          reject(new GateLaneError(`Failed to start MCP server: ${err.message}`, "MCP_START_FAILED", 502));
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const rl = createInterface({ input: proc.stdout, terminal: false });

      const tryResolve = (line: string) => {
        if (resolved) return;
        try {
          const parsed = JSON.parse(line) as McpJsonRpcResponse;
          if (parsed.jsonrpc !== "2.0") return;
          if (!parsed.id) return;
          if (parsed.error) {
            resolved = true;
            throw new GateLaneError(parsed.error.message, "MCP_ERROR", 502);
          }
          if (parsed.result !== undefined) {
            resolved = true;
            const durationMs = Date.now() - startTime;
            resolve({ result: parsed.result, durationMs });
          }
        } catch (err) {
          if (err instanceof GateLaneError) {
            resolved = true;
            done = true;
            clearTimeout(timeout);
            cleanup();
            reject(err);
          }
        }
      };

      rl.on("line", (line: string) => {
        if (resolved || done) return;
        tryResolve(line);
      });

      rl.on("close", () => {
        clearTimeout(timeout);
        if (!resolved && !done) {
          done = true;
          const durationMs = Date.now() - startTime;
          if (proc.exitCode !== null && proc.exitCode !== 0) {
            reject(new GateLaneError(`MCP server exited with code ${proc.exitCode}: ${stderr}`, "MCP_EXIT_ERROR", 502));
          } else {
            reject(new GateLaneError("MCP server closed without response", "MCP_NO_RESPONSE", 502));
          }
        }
      });

      proc.on("close", () => {
        clearTimeout(timeout);
        rl.close();
        if (!resolved && !done) {
          done = true;
          const durationMs = Date.now() - startTime;
          reject(new GateLaneError(`MCP server exited with code ${proc.exitCode}: ${stderr}`, "MCP_EXIT_ERROR", 502));
        }
      });

      const body = JSON.stringify({
        jsonrpc: "2.0",
        id: "gl-call-1",
        method: "tools/call",
        params: { name: toolName, arguments: input },
      }) + "\n";

      proc.stdin.write(body);
      proc.stdin.end();
    });
  }

  private async callHttpTool(
    server: GateLaneServer,
    tool: GateLaneTool,
    input: Record<string, unknown>,
    startTime: number,
  ): Promise<ToolCallOutput> {
    const toolName = this.extractToolName(tool);

    const request: McpJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "gl-http-1",
      method: "tools/call",
      params: { name: toolName, arguments: input },
    };

    const { default: fetch } = await import("cross-fetch");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(server.url!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        let detail = "";
        try { const errBody = await response.json(); detail = errBody.error?.message || JSON.stringify(errBody); } catch {}
        throw new GateLaneError(`HTTP MCP server returned ${response.status}: ${detail}`, "MCP_HTTP_ERROR", 502);
      }

      const data = await response.json() as McpJsonRpcResponse;
      if (data.error) {
        throw new GateLaneError(data.error.message, "MCP_HTTP_ERROR", 502);
      }
      return { result: data.result, durationMs };
    } catch (err) {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;
      if (err instanceof GateLaneError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new GateLaneError("HTTP MCP call timed out", "MCP_TIMEOUT", 504);
      }
      throw new GateLaneError(`HTTP MCP call failed: ${(err as Error).message}`, "MCP_HTTP_FAILED", 502);
    }
  }

  private async callMockTool(
    _server: GateLaneServer,
    tool: GateLaneTool,
    input: Record<string, unknown>,
    startTime: number,
  ): Promise<ToolCallOutput> {
    const durationMs = Date.now() - startTime;
    return {
      result: { mock: true, input, server: tool.serverName, tool: tool.name },
      durationMs,
    };
  }

  private async listStdioTools(server: GateLaneServer): Promise<ToolDef[]> {
    return new Promise((resolve, reject) => {
      const proc = spawn(server.command!, server.args || [], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...server.env },
      });

      let stderr = "";
      let done = false;
      let resolved = false;
      const tools: ToolDef[] = [];

      const cleanup = () => {
        if (!proc.killed) proc.kill();
      };

      const timeout = setTimeout(() => {
        if (!done) {
          done = true;
          cleanup();
          reject(new GateLaneError("MCP list tools timed out", "MCP_TIMEOUT", 504));
        }
      }, TIMEOUT_MS);

      proc.on("error", (err) => {
        if (!done) {
          done = true;
          clearTimeout(timeout);
          reject(new GateLaneError(`Failed to start MCP server: ${err.message}`, "MCP_START_FAILED", 502));
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const rl = createInterface({ input: proc.stdout, terminal: false });

      rl.on("line", (line: string) => {
        if (resolved || done) return;
        try {
          const parsed = JSON.parse(line) as McpJsonRpcResponse;
          if (parsed.jsonrpc !== "2.0" || !parsed.id) return;
          if (parsed.error) {
            if (parsed.error.code === -32601) {
              resolved = true;
              done = true;
              clearTimeout(timeout);
              cleanup();
              reject(new GateLaneError(`MCP method not found: ${parsed.error.message}`, "MCP_NO_TOOLS", 501));
              return;
            }
            resolved = true;
            done = true;
            clearTimeout(timeout);
            cleanup();
            reject(new GateLaneError(parsed.error.message, "MCP_ERROR", 502));
            return;
          }
          if (parsed.result && typeof parsed.result === "object" && "tools" in (parsed.result as Record<string, unknown>)) {
            resolved = true;
            done = true;
            clearTimeout(timeout);
            cleanup();
            resolve((parsed.result as { tools: ToolDef[] }).tools || []);
          }
        } catch {
          // Skip non-JSON lines (e.g., logging messages)
        }
      });

      rl.on("close", () => {
        clearTimeout(timeout);
        if (!resolved && !done) {
          done = true;
          reject(new GateLaneError(`MCP server exited without tool list: ${stderr}`, "MCP_NO_TOOLS", 502));
        }
      });

      proc.on("close", () => {
        clearTimeout(timeout);
        rl.close();
        if (!resolved && !done) {
          done = true;
          reject(new GateLaneError(`MCP server exited with code ${proc.exitCode} without tool list: ${stderr}`, "MCP_EXIT_ERROR", 502));
        }
      });

      const initializeMsg = JSON.stringify({
        jsonrpc: "2.0", id: "gl-init",
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "gatelane", version: "0.2.0" } },
      }) + "\n";

      const listMsg = JSON.stringify({
        jsonrpc: "2.0", id: "gl-list",
        method: "tools/list",
      }) + "\n";

      proc.stdin.write(initializeMsg);
      proc.stdin.write(listMsg);
      proc.stdin.end();
    });
  }

  private async listHttpTools(server: GateLaneServer): Promise<ToolDef[]> {
    const { default: fetch } = await import("cross-fetch");

    const listRequest = {
      jsonrpc: "2.0", id: "gl-list",
      method: "tools/list",
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(server.url!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(listRequest),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new GateLaneError(`HTTP MCP list tools returned ${response.status}`, "MCP_HTTP_ERROR", 502);
      }

      const data = await response.json() as McpJsonRpcResponse;
      if (data.error) {
        throw new GateLaneError(data.error.message, "MCP_HTTP_ERROR", 502);
      }
      const result = data.result as { tools?: ToolDef[] };
      return result?.tools || [];
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof GateLaneError) throw err;
      throw new GateLaneError(`HTTP MCP list tools failed: ${(err as Error).message}`, "MCP_HTTP_FAILED", 502);
    }
  }

  getMockTools(serverName: string): ToolDef[] {
    return [
      { name: `${serverName}_ping`, description: `Ping the ${serverName} server` },
      { name: `${serverName}_echo`, description: `Echo input back from ${serverName}` },
      { name: `${serverName}_query`, description: `Query ${serverName} with input` },
    ];
  }
}
