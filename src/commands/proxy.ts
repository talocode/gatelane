import { Command } from "commander";
import { createServer } from "../server.js";

export const proxyCommand = new Command("proxy")
  .description("Start the GateLane MCP proxy")
  .option("-p, --port <port>", "Port to listen on", "3051")
  .action(async (options) => {
    const port = parseInt(options.port) || 3051;
    console.log(` GateLane MCP proxy starting on port ${port}...`);
    console.log(`   MCP Proxy: http://localhost:${port}/mcp`);
    console.log(`   Press Ctrl+C to stop`);
    const server = createServer({ port, isProxy: true });
    server.listen(port, () => {
      console.log(` GateLane MCP proxy running on http://localhost:${port}`);
    });
  });
