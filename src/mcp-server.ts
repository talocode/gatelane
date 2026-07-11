import express from "express";
import { ServerRegistry } from "./core/server-registry.js";
import { ToolDiscovery } from "./core/tool-discovery.js";
import { PolicyEngine } from "./core/policy-engine.js";
import { AuditLog } from "./core/audit-log.js";
import { UsageTracker } from "./core/usage.js";
import { checkAuth, isCloudMode } from "./core/auth.js";

// MCP Server exposing GateLane management tools
// In v0.1.0, we expose the tool definitions via a lightweight HTTP endpoint
// compatible with the MCP protocol

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const mcpTools: MCPToolDefinition[] = [
  {
    name: "gatelane_health",
    description: "Check GateLane server health and cloud mode status",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "gatelane_list_servers",
    description: "List all registered MCP servers in GateLane",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "gatelane_add_server",
    description: "Register a new MCP server in GateLane",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Server name" },
        type: { type: "string", enum: ["mcp-stdio", "mcp-http", "http-api", "mock"], description: "Server type" },
        command: { type: "string", description: "Command for stdio MCP servers" },
        url: { type: "string", description: "URL for HTTP/MCP servers" },
      },
      required: ["name", "type"],
    },
  },
  {
    name: "gatelane_discover_tools",
    description: "Discover tools from all registered servers",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "gatelane_list_tools",
    description: "List all discovered tools across all servers",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "gatelane_call_tool",
    description: "Call a tool through GateLane (checks auth, policies, rate limits, records audit log)",
    inputSchema: {
      type: "object",
      properties: {
        tool: { type: "string", description: "Tool name in format <server.tool>" },
        input: { type: "object", description: "JSON input for the tool" },
        actor: { type: "string", description: "Actor identifier for audit" },
      },
      required: ["tool"],
    },
  },
  {
    name: "gatelane_allow_tool",
    description: "Create an allow policy for a tool",
    inputSchema: {
      type: "object",
      properties: {
        tool: { type: "string", description: "Tool name in format <server.tool>" },
        reason: { type: "string", description: "Reason for allowing" },
      },
      required: ["tool"],
    },
  },
  {
    name: "gatelane_deny_tool",
    description: "Create a deny policy for a tool",
    inputSchema: {
      type: "object",
      properties: {
        tool: { type: "string", description: "Tool name in format <server.tool>" },
        reason: { type: "string", description: "Reason for denying" },
      },
      required: ["tool"],
    },
  },
  {
    name: "gatelane_list_policies",
    description: "List all access policies",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "gatelane_list_audit_logs",
    description: "View audit log entries",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of entries to return (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "gatelane_get_usage",
    description: "View usage statistics and total credits consumed",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  try {
    switch (name) {
      case "gatelane_health": {
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "ok", service: "gatelane", version: "0.2.0", cloudMode: isCloudMode() }) }],
        };
      }
      case "gatelane_list_servers": {
        const registry = new ServerRegistry();
        return {
          content: [{ type: "text", text: JSON.stringify({ servers: registry.list() }, null, 2) }],
        };
      }
      case "gatelane_add_server": {
        const registry = new ServerRegistry();
        const server = registry.add({
          name: args.name as string,
          type: args.type as "mcp-stdio" | "mcp-http" | "http-api" | "mock",
          command: args.command as string | undefined,
          url: args.url as string | undefined,
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ server }, null, 2) }],
        };
      }
      case "gatelane_discover_tools": {
        const discovery = new ToolDiscovery();
        const tools = await discovery.discover();
        return {
          content: [{ type: "text", text: JSON.stringify({ tools, count: tools.length }, null, 2) }],
        };
      }
      case "gatelane_list_tools": {
        const discovery = new ToolDiscovery();
        return {
          content: [{ type: "text", text: JSON.stringify({ tools: discovery.list() }, null, 2) }],
        };
      }
      case "gatelane_call_tool": {
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "completed", tool: args.tool, result: { mock: true, input: args.input } }, null, 2) }],
        };
      }
      case "gatelane_allow_tool": {
        const engine = new PolicyEngine();
        const policy = engine.add({
          effect: "allow",
          tool: args.tool as string | undefined,
          reason: args.reason as string | undefined,
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ policy, message: `Tool '${args.tool}' is now allowed` }, null, 2) }],
        };
      }
      case "gatelane_deny_tool": {
        const engine = new PolicyEngine();
        const policy = engine.add({
          effect: "deny",
          tool: args.tool as string | undefined,
          reason: args.reason as string | undefined,
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ policy, message: `Tool '${args.tool}' is now denied` }, null, 2) }],
        };
      }
      case "gatelane_list_policies": {
        const engine = new PolicyEngine();
        return {
          content: [{ type: "text", text: JSON.stringify({ policies: engine.list() }, null, 2) }],
        };
      }
      case "gatelane_list_audit_logs": {
        const audit = new AuditLog();
        const limit = (args.limit as number) || 20;
        return {
          content: [{ type: "text", text: JSON.stringify({ entries: audit.tail(limit) }, null, 2) }],
        };
      }
      case "gatelane_get_usage": {
        const usage = new UsageTracker();
        return {
          content: [{ type: "text", text: JSON.stringify({ events: usage.getUsage(), totalCredits: usage.getTotalCredits() }, null, 2) }],
        };
      }
      default:
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
          isError: true,
        };
    }
  } catch (err: unknown) {
    const e = err as Error;
    return {
      content: [{ type: "text", text: JSON.stringify({ error: e.message }) }],
      isError: true,
    };
  }
}

export function createMcp(port: number = 3052): void {
  const app = express();
  app.use(express.json());

  // MCP tools/list endpoint
  app.post("/mcp", async (req, res) => {
    const { method, params } = req.body;

    if (method === "tools/list") {
      res.json({
        jsonrpc: "2.0",
        id: params?.id || 1,
        result: {
          tools: mcpTools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      });
    } else if (method === "tools/call") {
      const result = await executeTool(params?.name, params?.arguments || {});
      res.json({
        jsonrpc: "2.0",
        id: params?.id || 1,
        result: {
          content: result.content,
          isError: (result as any).isError || false,
        },
      });
    } else if (method === "health") {
      res.json({ status: "ok", service: "gatelane-mcp", version: "0.2.0" });
    } else {
      res.json({
        jsonrpc: "2.0",
        id: params?.id || 1,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    }
  });

  // Health endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "gatelane-mcp", version: "0.2.0" });
  });

  app.listen(port, () => {
    console.log(` GateLane MCP server running on http://localhost:${port}/mcp`);
    console.log(`   Tools available: ${mcpTools.length}`);
    for (const t of mcpTools) {
      console.log(`   - ${t.name}: ${t.description}`);
    }
  });
}
