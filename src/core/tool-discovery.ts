import { loadServers } from "./config-store.js";
import { ToolProxy } from "./tool-proxy.js";
import type { GateLaneTool } from "./schema.js";
import { newToolId } from "./ids.js";

const REAL_TYPES = ["mcp-stdio", "mcp-http", "http-api"];

export class ToolDiscovery {
  private tools: GateLaneTool[] = [];
  private discovered = false;
  private proxy = new ToolProxy();

  async discover(): Promise<GateLaneTool[]> {
    const servers = loadServers();
    this.tools = [];

    for (const server of servers.filter((s) => s.enabled)) {
      try {
        const toolList = await this.proxy.getToolList(server);

        for (const t of toolList) {
          this.tools.push({
            id: newToolId(),
            serverId: server.id,
            serverName: server.name,
            name: `${server.name}.${t.name}`,
            description: t.description,
            inputSchema: t.inputSchema,
            enabled: true,
          });
        }
      } catch (err) {
        if (REAL_TYPES.includes(server.type)) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(` Failed to discover tools for '${server.name}': ${message}`);
        } else {
          const fallback = this.proxy.getMockTools(server.name);
          for (const t of fallback) {
            this.tools.push({
              id: newToolId(),
              serverId: server.id,
              serverName: server.name,
              name: `${server.name}.${t.name}`,
              description: t.description,
              enabled: true,
            });
          }
        }
      }
    }

    this.discovered = true;
    return this.tools;
  }

  list(): GateLaneTool[] {
    return this.tools;
  }

  get(toolName: string): GateLaneTool | undefined {
    return this.tools.find((t) => t.name === toolName);
  }
}
