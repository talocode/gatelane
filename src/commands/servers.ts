import { Command } from "commander";
import { ServerRegistry } from "../core/server-registry.js";

export const serversCommand = new Command("servers")
  .description("Manage registered MCP servers");

serversCommand
  .command("add <name>")
  .description("Register a new server")
  .option("--type <type>", "Server type (mcp-stdio, mcp-http, http-api, mock)", "mock")
  .option("--command <cmd>", "Command for stdio MCP servers")
  .option("--args <args>", "Command arguments (comma-separated)")
  .option("--url <url>", "URL for HTTP/MCP servers")
  .option("--disabled", "Register but disable the server")
  .action((name, options) => {
    const registry = new ServerRegistry();
    const server = registry.add({
      name,
      type: options.type,
      command: options.command,
      args: options.args?.split(",").map((a: string) => a.trim()),
      url: options.url,
      enabled: !options.disabled,
    });
    console.log(` Server '${server.name}' registered (${server.type})`);
    console.log(`   ID: ${server.id}`);
  });

serversCommand
  .command("list")
  .description("List all registered servers")
  .action(() => {
    const registry = new ServerRegistry();
    const servers = registry.list();
    if (servers.length === 0) {
      console.log(" No servers registered.");
      console.log(" Run: gatelane servers add <name> --type mock");
      return;
    }
    for (const s of servers) {
      const status = s.enabled ? "enabled" : "disabled";
      const type = s.type;
      const target = s.command || s.url || "(mock)";
      console.log(` ${s.name} [${type}] (${status})`);
      console.log(`   ID: ${s.id} | ${target}`);
    }
  });

serversCommand
  .command("show <name>")
  .description("Show server details")
  .action((name) => {
    const registry = new ServerRegistry();
    try {
      const server = registry.get(name);
      console.log(` Server: ${server.name}`);
      console.log(`   ID: ${server.id}`);
      console.log(`   Type: ${server.type}`);
      console.log(`   Command: ${server.command || "(none)"}`);
      console.log(`   Args: ${server.args?.join(" ") || "(none)"}`);
      console.log(`   URL: ${server.url || "(none)"}`);
      console.log(`   Status: ${server.enabled ? "enabled" : "disabled"}`);
      console.log(`   Created: ${server.createdAt}`);
    } catch (err: unknown) {
      const e = err as Error;
      console.error(` Error: ${e.message}`);
    }
  });

serversCommand
  .command("remove <name>")
  .description("Remove a registered server")
  .action((name) => {
    const registry = new ServerRegistry();
    try {
      registry.remove(name);
      console.log(` Server '${name}' removed.`);
    } catch (err: unknown) {
      const e = err as Error;
      console.error(` Error: ${e.message}`);
    }
  });
