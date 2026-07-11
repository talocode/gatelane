import { loadServers } from "./config-store.js";
import { ToolProxy } from "./tool-proxy.js";
import type { GateLaneTool } from "./schema.js";
import { newToolId } from "./ids.js";

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
      } catch {
        const fallback = this.getMockTools(server.name);
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

    this.discovered = true;
    return this.tools;
  }

  list(): GateLaneTool[] {
    return this.tools;
  }

  get(toolName: string): GateLaneTool | undefined {
    return this.tools.find((t) => t.name === toolName);
  }

  private getMockTools(serverName: string): { name: string; description?: string; inputSchema?: Record<string, unknown> }[] {
    switch (serverName) {
      case "memorylane":
        return [
          { name: "memorylane_recall", description: "Recall memories by query" },
          { name: "memorylane_store", description: "Store a new memory" },
          { name: "memorylane_forget", description: "Delete a memory" },
          { name: "memorylane_list", description: "List all memories" },
        ];
      case "searchlane":
        return [
          { name: "searchlane_search", description: "Search the web" },
          { name: "searchlane_fetch", description: "Fetch a URL" },
          { name: "searchlane_extract", description: "Extract content from a page" },
        ];
      case "geolane":
        return [
          { name: "geolane_check", description: "Check AI visibility for a domain" },
          { name: "geolane_audit", description: "Run full AI citation audit" },
        ];
      default:
        return [
          { name: `${serverName}_ping`, description: `Ping the ${serverName} server` },
          { name: `${serverName}_echo`, description: `Echo input back from ${serverName}` },
          { name: `${serverName}_query`, description: `Query ${serverName} with input` },
        ];
    }
  }
}
