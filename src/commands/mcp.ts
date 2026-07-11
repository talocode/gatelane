import { Command } from "commander";

export const mcpCommand = new Command("mcp")
  .description("Start the GateLane MCP server (exposes GateLane management as MCP tools)")
  .option("-p, --port <port>", "Port to listen on", "3052")
  .action(async (options) => {
    const port = parseInt(options.port) || 3052;
    console.log(` GateLane MCP server is available through the proxy:`);
    console.log(`   gatelane proxy --port ${port}`);
    console.log(`   This exposes GateLane management as MCP tools on port ${port}`);
    console.log("");
    const { createMcp } = await import("../mcp-server.js");
    createMcp(port);
  });
