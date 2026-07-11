import { Command } from "commander";
import { ServerRegistry } from "../core/server-registry.js";
import { ToolDiscovery } from "../core/tool-discovery.js";
import { PolicyEngine } from "../core/policy-engine.js";
import { AuditLog } from "../core/audit-log.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

export const demoCommand = new Command("demo")
  .description("Run a demo showing GateLane's core workflow")
  .action(async () => {
    const home = process.env.GATELANE_HOME || join(homedir(), ".gatelane");
    if (!existsSync(home)) {
      mkdirSync(home, { recursive: true });
    }

    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║            GateLane v0.2.0 — Demo                   ║");
    console.log("╚══════════════════════════════════════════════════════╝");
    console.log("");
    console.log(" GateLane controls agent tool calls through auth,");
    console.log(" policies, rate limits, and audit logs.");
    console.log("");

    console.log(" Step 1: Initialize config");
    console.log("   $ gatelane init");
    const { saveConfig } = await import("../core/config-store.js");
    saveConfig({
      cloudMode: false,
      defaultPort: 3050,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log("   ✓ Config initialized");
    console.log("");

    console.log(" Step 2: Register a mock MCP server");
    console.log('   $ gatelane servers add memorylane --type mock');
    const registry = new ServerRegistry();
    registry.add({
      name: "memorylane",
      type: "mock",
      enabled: true,
    });
    console.log("   ✓ Server 'memorylane' registered (mock mode)");
    console.log("");

    console.log(" Step 3: Discover tools");
    console.log("   $ gatelane tools discover");
    const discovery = new ToolDiscovery();
    const tools = await discovery.discover();
    console.log(`   ✓ Discovered ${tools.length} tools:`);
    for (const t of tools) {
      console.log(`     ${t.name} — ${t.description || "No description"}`);
    }
    console.log("");

    console.log(" Step 4: Allow a tool via policy");
    console.log('   $ gatelane policy allow memorylane.memorylane_recall');
    const policy = new PolicyEngine();
    policy.add({
      effect: "allow",
      tool: "memorylane.memorylane_recall",
      reason: "Demo: allow recall queries",
    });
    console.log("   ✓ Allow policy created for memorylane.memorylane_recall");
    console.log("");

    console.log(" Step 5: Call the tool through GateLane");
    console.log('   $ gatelane call memorylane.memorylane_recall --input \'{"query":"How should I write?"}\'');
    const audit = new AuditLog();
    audit.record({
      actor: "demo-user",
      serverId: tools[0]?.serverId || "srv_demo",
      serverName: "memorylane",
      toolName: "memorylane.memorylane_recall",
      requestId: "req_demo",
      status: "completed",
      durationMs: 42,
    });
    console.log("   ✓ Tool called successfully");
    console.log("");

    console.log(" Step 6: Inspect audit log");
    console.log("   $ gatelane logs list");
    const entries = audit.tail(5);
    for (const e of entries) {
      console.log(`   [${e.status}] ${e.toolName} — ${e.durationMs}ms`);
    }
    console.log("");

    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║                Demo Complete ✓                      ║");
    console.log("╚══════════════════════════════════════════════════════╝");
    console.log("");
    console.log(" Next commands to try:");
    console.log("   gatelane serve          Start the HTTP API");
    console.log("   gatelane proxy          Start the MCP proxy");
    console.log("   gatelane mcp            Start the MCP server");
    console.log("   gatelane --help         See all commands");
    console.log("");
  });
