import { appendUsageEvent, loadUsageEvents } from "./config-store.js";
import type { GateLaneUsageEvent } from "./schema.js";
import { newUsageId } from "./ids.js";

export class UsageTracker {
  record(event: Omit<GateLaneUsageEvent, "id" | "createdAt">): GateLaneUsageEvent {
    const entry: GateLaneUsageEvent = {
      ...event,
      id: newUsageId(),
      createdAt: new Date().toISOString(),
    };
    appendUsageEvent(entry);
    return entry;
  }

  getUsage(): GateLaneUsageEvent[] {
    return loadUsageEvents();
  }

  getTotalCredits(): number {
    return loadUsageEvents().reduce((sum, e) => sum + e.credits, 0);
  }
}
