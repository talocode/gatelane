import { loadPolicies, savePolicies } from "./config-store.js";
import type { GateLanePolicy, CreatePolicyRequest } from "./schema.js";
import { newPolicyId } from "./ids.js";
import { ToolDeniedError } from "./errors.js";

export class PolicyEngine {
  private policies: GateLanePolicy[];

  constructor() {
    this.policies = loadPolicies();
  }

  list(): GateLanePolicy[] {
    return this.policies;
  }

  add(req: CreatePolicyRequest): GateLanePolicy {
    const policy: GateLanePolicy = {
      id: newPolicyId(),
      name: `${req.effect}-${req.tool || req.server || "all"}-${Date.now()}`,
      effect: req.effect,
      server: req.server,
      tool: req.tool,
      actor: req.actor,
      reason: req.reason,
      createdAt: new Date().toISOString(),
    };
    this.policies.push(policy);
    savePolicies(this.policies);
    return policy;
  }

  remove(id: string): void {
    const idx = this.policies.findIndex((p) => p.id === id || p.name === id);
    if (idx !== -1) {
      this.policies.splice(idx, 1);
      savePolicies(this.policies);
    }
  }

  check(tool: string, actor?: string): { allowed: boolean; reason?: string } {
    const toolParts = tool.split(".");
    const serverName = toolParts[0];
    const toolName = toolParts.slice(1).join(".");

    // Deny policies are checked first (most specific wins)
    const denyPolicies = this.policies.filter(
      (p) =>
        p.effect === "deny" &&
        this.matches(p, serverName, toolName, actor),
    );

    if (denyPolicies.length > 0) {
      return { allowed: false, reason: denyPolicies[0].reason };
    }

    // If there are any allow policies, at least one must match
    const allowPolicies = this.policies.filter((p) => p.effect === "allow");
    if (allowPolicies.length > 0) {
      const matched = allowPolicies.some((p) =>
        this.matches(p, serverName, toolName, actor),
      );
      if (!matched) {
        return { allowed: false, reason: "No matching allow policy" };
      }
    }

    return { allowed: true };
  }

  private matches(
    policy: GateLanePolicy,
    serverName: string,
    toolName: string,
    actor?: string,
  ): boolean {
    if (policy.server && policy.server !== serverName) return false;
    if (policy.tool) {
      // policy.tool can be "server.tool" or just "tool"
      const policyParts = policy.tool.split(".");
      if (policyParts.length === 2) {
        if (policyParts[0] !== serverName || policyParts[1] !== toolName) return false;
      } else {
        if (policyParts[0] !== toolName) return false;
      }
    }
    if (policy.actor && policy.actor !== actor) return false;
    return true;
  }

  reload(): void {
    this.policies = loadPolicies();
  }
}
