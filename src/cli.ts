#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initCommand } from "./commands/init.js";
import { doctorCommand } from "./commands/doctor.js";
import { demoCommand } from "./commands/demo.js";
import { serversCommand } from "./commands/servers.js";
import { toolsCommand } from "./commands/tools.js";
import { callCommand } from "./commands/call.js";
import { policyCommand } from "./commands/policy.js";
import { logsCommand } from "./commands/logs.js";
import { serveCommand } from "./commands/serve.js";
import { proxyCommand } from "./commands/proxy.js";
import { mcpCommand } from "./commands/mcp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8"),
    );
    return pkg.version || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

const program = new Command();

program
  .name("gatelane")
  .description("Open-source MCP gateway and agent tool control plane")
  .version(getVersion());

program.addCommand(initCommand);
program.addCommand(doctorCommand);
program.addCommand(demoCommand);
program.addCommand(serversCommand);
program.addCommand(toolsCommand);
program.addCommand(callCommand);
program.addCommand(policyCommand);
program.addCommand(logsCommand);
program.addCommand(serveCommand);
program.addCommand(proxyCommand);
program.addCommand(mcpCommand);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
