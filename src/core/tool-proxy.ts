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

type ProtocolMapping = {
  listTools: string;
  callTool: string;
  label: string;
};

const PROTOCOLS: ProtocolMapping[] = [
  { listTools: "tools/list", callTool: "tools/call", label: "standard" },
  { listTools: "mcp.listTools", callTool: "mcp.callTool", label: "legacy" },
];

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

  private async executeToolCall(server: GateLaneServer, tool: GateLaneTool, input: Record<string, unknown>): Promise<ToolCallOutput> {
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

  private spawnProc(server: GateLaneServer) {
    return spawn(server.command!, server.args || [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...server.env },
    });
  }

  private async callStdioTool(server: GateLaneServer, tool: GateLaneTool, input: Record<string, unknown>, startTime: number): Promise<ToolCallOutput> {
    const toolName = this.extractToolName(tool);

    for (const proto of PROTOCOLS) {
      try {
        return await this.callStdioToolWithProtocol(server, toolName, input, startTime, proto);
      } catch (err) {
        if (err instanceof GateLaneError && err.code === "MCP_METHOD_NOT_FOUND" && proto !== PROTOCOLS[PROTOCOLS.length - 1]) {
          continue;
        }
        throw err;
      }
    }
    throw new GateLaneError("All MCP protocol variants failed", "MCP_PROTOCOL_FAILED", 502);
  }

  private callStdioToolWithProtocol(server: GateLaneServer, toolName: string, input: Record<string, unknown>, startTime: number, proto: ProtocolMapping): Promise<ToolCallOutput> {
    return new Promise((resolve, reject) => {
      const proc = this.spawnProc(server);
      let stderr = "";
      let done = false;
      let resolved = false;

      const cleanup = () => { if (!proc.killed) proc.kill(); };
      const timeout = setTimeout(() => {
        if (!done) { done = true; cleanup(); reject(new GateLaneError("MCP stdio call timed out", "MCP_TIMEOUT", 504)); }
      }, TIMEOUT_MS);

      proc.on("error", (err) => {
        if (!done) { done = true; clearTimeout(timeout); reject(new GateLaneError(`Failed to start MCP server: ${err.message}`, "MCP_START_FAILED", 502)); }
      });

      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      const rl = createInterface({ input: proc.stdout, terminal: false });

      rl.on("line", (line: string) => {
        if (resolved || done) return;
        try {
          const parsed = JSON.parse(line) as McpJsonRpcResponse;
          if (parsed.jsonrpc !== "2.0" || !parsed.id) return;
          if (parsed.error) {
            if (parsed.error.code === -32601) {
              resolved = true; done = true; clearTimeout(timeout); cleanup();
              reject(new GateLaneError(parsed.error.message, "MCP_METHOD_NOT_FOUND", 501));
              return;
            }
            resolved = true; done = true; clearTimeout(timeout); cleanup();
            reject(new GateLaneError(parsed.error.message, "MCP_ERROR", 502));
            return;
          }
          if (parsed.result !== undefined) {
            resolved = true; done = true; clearTimeout(timeout); cleanup();
            resolve({ result: parsed.result, durationMs: Date.now() - startTime });
          }
        } catch {}
      });

      rl.on("close", () => {
        clearTimeout(timeout);
        if (!resolved && !done) {
          done = true;
          reject(new GateLaneError(
            proc.exitCode !== null && proc.exitCode !== 0
              ? `MCP server exited with code ${proc.exitCode}: ${stderr}`
              : "MCP server closed without response",
            proc.exitCode !== null && proc.exitCode !== 0 ? "MCP_EXIT_ERROR" : "MCP_NO_RESPONSE", 502
          ));
        }
      });

      proc.on("close", () => { clearTimeout(timeout); rl.close(); if (!resolved && !done) { done = true; reject(new GateLaneError(`MCP server exited with code ${proc.exitCode}: ${stderr}`, "MCP_EXIT_ERROR", 502)); } });

      const body = JSON.stringify({ jsonrpc: "2.0", id: "gl-call-1", method: proto.callTool, params: { name: toolName, arguments: input } }) + "\n";
      proc.stdin.write(body);
      proc.stdin.end();
    });
  }

  private async callHttpTool(server: GateLaneServer, tool: GateLaneTool, input: Record<string, unknown>, startTime: number): Promise<ToolCallOutput> {
    const toolName = this.extractToolName(tool);

    for (const proto of PROTOCOLS) {
      try {
        return await this.callHttpToolWithProtocol(server, toolName, input, startTime, proto);
      } catch (err) {
        if (err instanceof GateLaneError && err.code === "MCP_METHOD_NOT_FOUND" && proto !== PROTOCOLS[PROTOCOLS.length - 1]) {
          continue;
        }
        throw err;
      }
    }
    throw new GateLaneError("All MCP protocol variants failed", "MCP_PROTOCOL_FAILED", 502);
  }

  private async callHttpToolWithProtocol(server: GateLaneServer, toolName: string, input: Record<string, unknown>, startTime: number, proto: ProtocolMapping): Promise<ToolCallOutput> {
    const request: McpJsonRpcRequest = { jsonrpc: "2.0", id: "gl-http-1", method: proto.callTool, params: { name: toolName, arguments: input } };
    const { default: fetch } = await import("cross-fetch");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(server.url!, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: controller.signal });
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;
      if (!response.ok) {
        let detail = "";
        try { const errBody = await response.json(); detail = errBody.error?.message || JSON.stringify(errBody); } catch {}
        throw new GateLaneError(`HTTP MCP server returned ${response.status}: ${detail}`, "MCP_HTTP_ERROR", 502);
      }
      const data = await response.json() as McpJsonRpcResponse;
      if (data.error) {
        if (data.error.code === -32601) throw new GateLaneError(data.error.message, "MCP_METHOD_NOT_FOUND", 501);
        throw new GateLaneError(data.error.message, "MCP_HTTP_ERROR", 502);
      }
      return { result: data.result, durationMs };
    } catch (err) {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;
      if (err instanceof GateLaneError) throw err;
      if ((err as Error).name === "AbortError") throw new GateLaneError("HTTP MCP call timed out", "MCP_TIMEOUT", 504);
      throw new GateLaneError(`HTTP MCP call failed: ${(err as Error).message}`, "MCP_HTTP_FAILED", 502);
    }
  }

  private async callMockTool(_server: GateLaneServer, tool: GateLaneTool, input: Record<string, unknown>, startTime: number): Promise<ToolCallOutput> {
    return { result: { mock: true, input, server: tool.serverName, tool: tool.name }, durationMs: Date.now() - startTime };
  }

  private async listStdioTools(server: GateLaneServer): Promise<ToolDef[]> {
    for (const proto of PROTOCOLS) {
      try {
        return await this.listStdioToolsWithProtocol(server, proto);
      } catch (err) {
        if (err instanceof GateLaneError && err.code === "MCP_METHOD_NOT_FOUND" && proto !== PROTOCOLS[PROTOCOLS.length - 1]) {
          continue;
        }
        throw err;
      }
    }
    throw new GateLaneError("All MCP protocol variants failed for discovery", "MCP_PROTOCOL_FAILED", 502);
  }

  private listStdioToolsWithProtocol(server: GateLaneServer, proto: ProtocolMapping): Promise<ToolDef[]> {
    return new Promise((resolve, reject) => {
      const proc = this.spawnProc(server);
      let stderr = "";
      let done = false;
      let resolved = false;

      const cleanup = () => { if (!proc.killed) proc.kill(); };
      const timeout = setTimeout(() => {
        if (!done) { done = true; cleanup(); reject(new GateLaneError("MCP list tools timed out", "MCP_TIMEOUT", 504)); }
      }, TIMEOUT_MS);

      proc.on("error", (err) => {
        if (!done) { done = true; clearTimeout(timeout); reject(new GateLaneError(`Failed to start MCP server: ${err.message}`, "MCP_START_FAILED", 502)); }
      });

      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      const rl = createInterface({ input: proc.stdout, terminal: false });

      rl.on("line", (line: string) => {
        if (resolved || done) return;
        try {
          const parsed = JSON.parse(line) as McpJsonRpcResponse;
          if (parsed.jsonrpc !== "2.0" || !parsed.id) return;
          if (parsed.error) {
            if (parsed.error.code === -32601) {
              resolved = true; done = true; clearTimeout(timeout); cleanup();
              reject(new GateLaneError(parsed.error.message, "MCP_METHOD_NOT_FOUND", 501));
              return;
            }
            resolved = true; done = true; clearTimeout(timeout); cleanup();
            reject(new GateLaneError(parsed.error.message, "MCP_ERROR", 502));
            return;
          }
          if (parsed.result && typeof parsed.result === "object" && "tools" in (parsed.result as Record<string, unknown>)) {
            resolved = true; done = true; clearTimeout(timeout); cleanup();
            resolve((parsed.result as { tools: ToolDef[] }).tools || []);
          }
        } catch {}
      });

      rl.on("close", () => {
        clearTimeout(timeout);
        if (!resolved && !done) { done = true; reject(new GateLaneError(`MCP server exited without tool list: ${stderr}`, "MCP_NO_TOOLS", 502)); }
      });

      proc.on("close", () => { clearTimeout(timeout); rl.close(); if (!resolved && !done) { done = true; reject(new GateLaneError(`MCP server exited with code ${proc.exitCode} without tool list: ${stderr}`, "MCP_EXIT_ERROR", 502)); } });

      const initMsg = JSON.stringify({ jsonrpc: "2.0", id: "gl-init", method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "gatelane", version: "0.3.0" } } }) + "\n";
      const listMsg = JSON.stringify({ jsonrpc: "2.0", id: "gl-list", method: proto.listTools }) + "\n";

      proc.stdin.write(initMsg);
      proc.stdin.write(listMsg);
      proc.stdin.end();
    });
  }

  private async listHttpTools(server: GateLaneServer): Promise<ToolDef[]> {
    for (const proto of PROTOCOLS) {
      try {
        return await this.listHttpToolsWithProtocol(server, proto);
      } catch (err) {
        if (err instanceof GateLaneError && err.code === "MCP_METHOD_NOT_FOUND" && proto !== PROTOCOLS[PROTOCOLS.length - 1]) {
          continue;
        }
        throw err;
      }
    }
    throw new GateLaneError("All MCP protocol variants failed for discovery", "MCP_PROTOCOL_FAILED", 502);
  }

  private async listHttpToolsWithProtocol(server: GateLaneServer, proto: ProtocolMapping): Promise<ToolDef[]> {
    const { default: fetch } = await import("cross-fetch");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(server.url!, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "gl-list", method: proto.listTools }), signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new GateLaneError(`HTTP MCP list tools returned ${response.status}`, "MCP_HTTP_ERROR", 502);
      const data = await response.json() as McpJsonRpcResponse;
      if (data.error) {
        if (data.error.code === -32601) throw new GateLaneError(data.error.message, "MCP_METHOD_NOT_FOUND", 501);
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
