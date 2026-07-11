import { Command } from "commander";
import { ToolDiscovery } from "../core/tool-discovery.js";
import { ToolProxy } from "../core/tool-proxy.js";
import { PolicyEngine } from "../core/policy-engine.js";
import { RateLimiter } from "../core/rate-limiter.js";
import { AuditLog } from "../core/audit-log.js";
import { UsageTracker } from "../core/usage.js";
import { newRequestId } from "../core/ids.js";
import { ToolDeniedError, RateLimitExceededError, GateLaneError } from "../core/errors.js";

export const callCommand = new Command("call")
  .description("Call a tool through GateLane")
  .argument("<tool>", "Tool name in format <server.tool>")
  .option("--input <json>", "JSON input for the tool", "{}")
  .option("--actor <actor>", "Actor identifier")
  .action(async (tool, options) => {
    const startTime = Date.now();
    const requestId = newRequestId();
    const discovery = new ToolDiscovery();
    const policy = new PolicyEngine();
    const rateLimiter = new RateLimiter();
    const audit = new AuditLog();
    const usage = new UsageTracker();
    const proxy = new ToolProxy();

    let tools = discovery.list();
    if (tools.length === 0) {
      tools = await discovery.discover();
    }

    const toolDef = discovery.get(tool);
    if (!toolDef) {
      console.error(` Error: Tool '${tool}' not found.`);
      console.error(" Run 'gatelane tools discover' first.");
      return;
    }

    let input: Record<string, unknown>;
    try {
      input = JSON.parse(options.input);
    } catch {
      console.error(" Error: Invalid JSON in --input");
      return;
    }

    try {
      const { allowed, reason } = policy.check(tool, options.actor);
      if (!allowed) {
        throw new ToolDeniedError(tool, reason);
      }

      rateLimiter.check(toolDef.serverName, tool, options.actor);

      const { result, durationMs } = await proxy.call(toolDef, input);

      audit.record({
        actor: options.actor || "cli",
        serverId: toolDef.serverId,
        serverName: toolDef.serverName,
        toolName: tool,
        requestId,
        status: "completed",
        durationMs,
      });

      usage.record({
        actor: options.actor || "cli",
        serverId: toolDef.serverId,
        toolName: tool,
        requestId,
        credits: 1,
      });

      console.log(` Tool call: ${tool}`);
      console.log(`   Request ID: ${requestId}`);
      console.log(`   Status: completed`);
      console.log(`   Duration: ${durationMs}ms`);
      console.log(`   Input: ${JSON.stringify(input)}`);
      console.log(`   Result: ${JSON.stringify(result)}`);
    } catch (err: unknown) {
      const e = err as Error;
      const durationMs = Date.now() - startTime;
      const isDenied = e instanceof ToolDeniedError;
      const isRateLimit = e instanceof RateLimitExceededError;
      const status = isDenied ? "denied" : "failed";

      audit.record({
        actor: options.actor || "cli",
        toolName: tool,
        requestId,
        status,
        reason: e.message,
        durationMs,
      });

      console.error(` Tool call ${status}: ${tool}`);
      console.error(`   Request ID: ${requestId}`);
      console.error(`   Status: ${status}`);
      console.error(`   Reason: ${e.message}`);
    }
  });
