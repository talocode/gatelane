import { Command } from "commander";
import { AuditLog } from "../core/audit-log.js";

export const logsCommand = new Command("logs")
  .description("View audit logs");

logsCommand
  .command("list")
  .description("List audit log entries")
  .option("--tail <n>", "Show last N entries", "20")
  .action((options) => {
    const audit = new AuditLog();
    const entries = audit.tail(parseInt(options.tail) || 20);
    if (entries.length === 0) {
      console.log(" No audit log entries.");
      return;
    }
    for (const e of entries) {
      const duration = e.durationMs ? `${e.durationMs}ms` : "";
      const actor = e.actor ? `by ${e.actor}` : "";
      console.log(` [${e.status}] ${e.toolName || "(unknown)"} ${duration} ${actor}`);
      console.log(`   ID: ${e.id} | ${e.createdAt}`);
      if (e.reason) console.log(`   Reason: ${e.reason}`);
    }
  });

logsCommand
  .command("tail")
  .description("Tail last 10 audit log entries")
  .action(() => {
    const audit = new AuditLog();
    const entries = audit.tail(10);
    if (entries.length === 0) {
      console.log(" No audit log entries.");
      return;
    }
    for (const e of entries) {
      console.log(` [${e.status}] ${e.toolName || "(unknown)"} ${e.durationMs || ""}ms by ${e.actor || "?"} — ${e.createdAt}`);
    }
  });
