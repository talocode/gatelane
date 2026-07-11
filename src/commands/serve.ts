import { Command } from "commander";
import { createServer } from "../server.js";

export const serveCommand = new Command("serve")
  .description("Start the GateLane HTTP API server")
  .option("-p, --port <port>", "Port to listen on", "3050")
  .action(async (options) => {
    const port = parseInt(options.port) || 3050;
    console.log(` GateLane API server starting on port ${port}...`);
    console.log(`   Local API: http://localhost:${port}/v1/gatelane/health`);
    console.log(`   Press Ctrl+C to stop`);
    console.log("");
    const server = createServer({ port });
    server.listen(port, () => {
      console.log(` GateLane API server running on http://localhost:${port}`);
    });
  });
