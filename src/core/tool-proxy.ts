import { spawn } from "node:child_process";
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

export class ToolProxy {
  async call(tool: GateLaneTool, input: Record<string, unknown>): Promise<ToolCallOutput> {
    const servers = loadServers();
    const server = servers.find((s) => s.id === tool.serverId);
    if (!server) {
      throw new GateLaneError(`Server '${tool.serverName}' not found in registry`, "SERVER_NOT_FOUND", 404);
    }
    return this.executeToolCall(server, tool, input);
  }

  async getToolList(server: GateLaneServer): Promise<{ name: string; description?: string; inputSchema?: Record<string, unknown> }[]> {
    switch (server.type) {
      case "mcp-stdio":
        return this.listStdioTools(server);
      case "mcp-http":
        return this.listHttpTools(server);
      case "mock":
        return this.getMockTools(server.name);
      default:
        return this.getMockTools(server.name);
    }
  }

  private async executeToolCall(server: GateLaneServer, tool: GateLaneTool, input: Record<string, unknown>): Promise<ToolCallOutput> {
    const startTime = Date.now();

    switch (server.type) {
      case "mcp-stdio":
        return this.callStdioTool(server, tool, input, startTime);
      case "mcp-http":
        return this.callHttpTool(server, tool, input, startTime);
      case "mock":
        return this.callMockTool(server, tool, input, startTime);
      default:
        return this.callMockTool(server, tool, input, startTime);
    }
  }

  private async callStdioTool(
    server: GateLaneServer,
    tool: GateLaneTool,
    input: Record<string, unknown>,
    startTime: number,
  ): Promise<ToolCallOutput> {
    const toolName = tool.name.includes(".") ? tool.name.split(".").pop()! : tool.name;

    const request: McpJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "gl-1",
      method: "tools/call",
      params: { name: toolName, arguments: input },
    };

    return new Promise((resolve, reject) => {
      const proc = spawn(server.command!, server.args || [], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...server.env },
      });

      let stdout = "";
      let stderr = "";
      let done = false;

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on("error", (err) => {
        if (!done) {
          done = true;
          reject(new GateLaneError(`Failed to start MCP server: ${err.message}`, "MCP_START_FAILED", 502));
        }
      });

      proc.on("close", (code) => {
        if (done) return;
        done = true;
        const durationMs = Date.now() - startTime;

        if (code !== 0) {
          reject(new GateLaneError(`MCP server exited with code ${code}: ${stderr}`, "MCP_EXIT_ERROR", 502));
          return;
        }

        try {
          const result = this.parseJsonRpcResponse(stdout);
          resolve({ result, durationMs });
        } catch (err) {
          reject(new GateLaneError(`Failed to parse MCP response: ${(err as Error).message}`, "MCP_PARSE_ERROR", 502));
        }
      });

      const timeout = setTimeout(() => {
        if (!done) {
          done = true;
          proc.kill();
          reject(new GateLaneError("MCP call timed out", "MCP_TIMEOUT", 504));
        }
      }, 30000);

      proc.on("close", () => clearTimeout(timeout));

      const body = JSON.stringify(request) + "\n";
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
    const toolName = tool.name.includes(".") ? tool.name.split(".").pop()! : tool.name;

    const request: McpJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "gl-1",
      method: "tools/call",
      params: { name: toolName, arguments: input },
    };

    const { default: fetch } = await import("cross-fetch");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

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
        throw new GateLaneError(`HTTP MCP server returned ${response.status}`, "MCP_HTTP_ERROR", 502);
      }

      const data = await response.json();
      return { result: data, durationMs };
    } catch (err) {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;
      if (err instanceof GateLaneError) throw err;
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

  private parseJsonRpcResponse(raw: string): unknown {
    const lines = raw.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as McpJsonRpcResponse;
        if (parsed.jsonrpc === "2.0") {
          if (parsed.error) {
            throw new GateLaneError(parsed.error.message, "MCP_ERROR", 502);
          }
          return parsed.result;
        }
      } catch {
        continue;
      }
    }
    throw new GateLaneError("No valid JSON-RPC response from MCP server", "MCP_NO_RESPONSE", 502);
  }

  private async listStdioTools(server: GateLaneServer): Promise<{ name: string; description?: string; inputSchema?: Record<string, unknown> }[]> {
    const request: McpJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "gl-list",
      method: "tools/list",
    };

    return new Promise((resolve, reject) => {
      const proc = spawn(server.command!, server.args || [], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...server.env },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on("error", (err) => {
        reject(new GateLaneError(`Failed to start MCP server: ${err.message}`, "MCP_START_FAILED", 502));
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new GateLaneError(`MCP server exited with code ${code}: ${stderr}`, "MCP_EXIT_ERROR", 502));
          return;
        }

        try {
          const result = this.parseJsonRpcResponse(stdout) as { tools: { name: string; description?: string; inputSchema?: Record<string, unknown> }[] };
          resolve(result.tools || []);
        } catch (err) {
          resolve(this.getMockTools(server.name));
        }
      });

      const body = JSON.stringify(request) + "\n";
      proc.stdin.write(body);
      proc.stdin.end();
    });
  }

  private async listHttpTools(server: GateLaneServer): Promise<{ name: string; description?: string; inputSchema?: Record<string, unknown> }[]> {
    const request: McpJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "gl-list",
      method: "tools/list",
    };

    try {
      const { default: fetch } = await import("cross-fetch");
      const response = await fetch(server.url!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!response.ok) return this.getMockTools(server.name);
      const data = await response.json() as McpJsonRpcResponse;
      if (data.error || !data.result) return this.getMockTools(server.name);
      const result = data.result as { tools: { name: string; description?: string }[] };
      return result.tools || [];
    } catch {
      return this.getMockTools(server.name);
    }
  }

  private getMockTools(serverName: string): { name: string; description?: string; inputSchema?: Record<string, unknown> }[] {
    return [
      { name: `${serverName}_ping`, description: `Ping the ${serverName} server` },
      { name: `${serverName}_echo`, description: `Echo input back from ${serverName}` },
      { name: `${serverName}_query`, description: `Query ${serverName} with input` },
    ];
  }
}
