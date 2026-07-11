import { Command } from "commander";
import { loadConfig, saveConfig } from "../core/config-store.js";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const initCommand = new Command("init")
  .description("Initialize GateLane configuration")
  .action(() => {
    const home = process.env.GATELANE_HOME || join(homedir(), ".gatelane");
    if (!existsSync(home)) {
      mkdirSync(home, { recursive: true });
    }
    saveConfig({
      cloudMode: process.env.GATELANE_CLOUD_MODE === "true",
      defaultPort: 3050,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(` GateLane initialized at ${home}`);
    console.log("");
    console.log("  Next steps:");
    console.log("    gatelane servers add <name> --type mock");
    console.log("    gatelane tools discover");
    console.log("    gatelane policy allow <server.tool>");
    console.log("    gatelane call <server.tool>");
    console.log("    gatelane logs list");
  });
