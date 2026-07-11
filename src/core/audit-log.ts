import { appendAuditLog, loadAuditLogs } from "./config-store.js";
import type { GateLaneAuditEvent } from "./schema.js";
import { newAuditId } from "./ids.js";

export class AuditLog {
  record(event: Omit<GateLaneAuditEvent, "id" | "createdAt">): GateLaneAuditEvent {
    const entry: GateLaneAuditEvent = {
      ...event,
      id: newAuditId(),
      createdAt: new Date().toISOString(),
    };
    appendAuditLog(entry);
    return entry;
  }

  list(): GateLaneAuditEvent[] {
    return loadAuditLogs().reverse(); // newest first
  }

  tail(count = 10): GateLaneAuditEvent[] {
    return this.list().slice(0, count);
  }
}
