import { loadRateLimits, saveRateLimits } from "./config-store.js";
import type { GateLaneRateLimit } from "./schema.js";
import { newRateLimitId } from "./ids.js";
import { RateLimitExceededError } from "./errors.js";

interface Bucket {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private limits: GateLaneRateLimit[];
  private buckets: Map<string, Bucket> = new Map();

  constructor() {
    this.limits = loadRateLimits();
  }

  list(): GateLaneRateLimit[] {
    return this.limits;
  }

  add(scope: GateLaneRateLimit["scope"], target: string, limit: number, windowSeconds: number): GateLaneRateLimit {
    const rl: GateLaneRateLimit = {
      id: newRateLimitId(),
      scope,
      target,
      limit,
      windowSeconds,
      createdAt: new Date().toISOString(),
    };
    this.limits.push(rl);
    saveRateLimits(this.limits);
    return rl;
  }

  remove(id: string): void {
    const idx = this.limits.findIndex((l) => l.id === id);
    if (idx !== -1) {
      this.limits.splice(idx, 1);
      saveRateLimits(this.limits);
    }
  }

  check(serverName?: string, toolName?: string, actor?: string): void {
    const now = Date.now();

    for (const limit of this.limits) {
      let target = "";
      switch (limit.scope) {
        case "global":
          target = "__global__";
          break;
        case "server":
          target = `server:${serverName}`;
          break;
        case "tool":
          target = `tool:${toolName}`;
          break;
        case "actor":
          target = `actor:${actor}`;
          break;
      }

      if (!target) continue;
      if (limit.scope === "server" && serverName !== limit.target) continue;
      if (limit.scope === "tool" && toolName !== limit.target) continue;
      if (limit.scope === "actor" && actor !== limit.target) continue;

      const bucketKey = `${limit.id}:${target}`;
      let bucket = this.buckets.get(bucketKey);

      if (!bucket || now - bucket.windowStart > limit.windowSeconds * 1000) {
        bucket = { count: 0, windowStart: now };
        this.buckets.set(bucketKey, bucket);
      }

      bucket.count++;

      if (bucket.count > limit.limit) {
        throw new RateLimitExceededError(target);
      }
    }
  }

  reload(): void {
    this.limits = loadRateLimits();
  }
}
