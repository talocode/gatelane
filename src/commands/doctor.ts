import { Command } from "commander";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const doctorCommand = new Command("doctor")
  .description("Check GateLane installation and configuration")
  .action(async () => {
    let issues = 0;

    console.log(" GateLane Doctor");
    console.log("");

    const nodeVersion = process.version;
    console.log(`  Node.js: ${nodeVersion}`);
    if (parseInt(nodeVersion.slice(1)) < 18) {
      console.log("    ⚠ Node.js >= 18.0.0 recommended");
      issues++;
    }

    const home = process.env.GATELANE_HOME || join(homedir(), ".gatelane");
    const configExists = existsSync(home);
    console.log(`  Config dir: ${home} ${configExists ? "✓" : "(not created yet)"}`);

    try {
      const { loadConfig } = await import("../core/config-store.js");
      const config = loadConfig();
      console.log(`  Cloud mode: ${config.cloudMode ? "enabled (TALOCODE_API_KEY required)" : "disabled (local mode)"}`);
    } catch {
      console.log("  Config: not loaded");
    }

    console.log("");
    if (issues === 0) {
      console.log("  All checks passed. ✓");
    } else {
      console.log(`  ${issues} issue(s) found.`);
    }
  });
