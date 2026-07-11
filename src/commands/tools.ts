import { Command } from "commander";
import { ToolDiscovery } from "../core/tool-discovery.js";

export const toolsCommand = new Command("tools")
  .description("Discover and list available tools");

toolsCommand
  .command("discover")
  .description("Discover tools from all registered servers")
  .action(async () => {
    const discovery = new ToolDiscovery();
    const tools = await discovery.discover();
    console.log(` Discovered ${tools.length} tools:`);
    for (const t of tools) {
      console.log(`   ${t.name}`);
      if (t.description) console.log(`     ${t.description}`);
    }
  });

toolsCommand
  .command("list")
  .description("List discovered tools")
  .action(async () => {
    const discovery = new ToolDiscovery();
    let tools = discovery.list();
    if (tools.length === 0) {
      console.log(" No tools in cache. Auto-discovering...");
      tools = await discovery.discover();
    }
    const groups: Record<string, typeof tools> = {};
    for (const t of tools) {
      (groups[t.serverName] ||= []).push(t);
    }
    for (const [server, ts] of Object.entries(groups)) {
      console.log(` ${server}:`);
      for (const t of ts) {
        console.log(`   ${t.name}${t.description ? ` — ${t.description}` : ""}`);
      }
    }
  });

toolsCommand
  .command("show <toolName>")
  .description("Show tool details")
  .action(async (toolName) => {
    const discovery = new ToolDiscovery();
    let tools = discovery.list();
    if (tools.length === 0) {
      tools = await discovery.discover();
    }
    const tool = discovery.get(toolName);
    if (!tool) {
      console.error(` Tool '${toolName}' not found.`);
      return;
    }
    console.log(` Tool: ${tool.name}`);
    console.log(`   Server: ${tool.serverName}`);
    console.log(`   Description: ${tool.description || "(none)"}`);
    console.log(`   Enabled: ${tool.enabled}`);
  });
