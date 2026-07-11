import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import { ServerRegistry } from "./core/server-registry.js";
import { ToolDiscovery } from "./core/tool-discovery.js";
import { ToolProxy } from "./core/tool-proxy.js";
import { PolicyEngine } from "./core/policy-engine.js";
import { RateLimiter } from "./core/rate-limiter.js";
import { AuditLog } from "./core/audit-log.js";
import { UsageTracker } from "./core/usage.js";
import { checkAuth, isCloudMode } from "./core/auth.js";
import { newRequestId } from "./core/ids.js";
import { GateLaneError, ToolDeniedError, RateLimitExceededError, AuthError, ValidationError } from "./core/errors.js";
import type { ToolCallRequest, ToolCallResponse, CreateServerRequest, CreatePolicyRequest, GateLaneRateLimit } from "./core/schema.js";

export interface ServerOptions {
  port?: number;
  isProxy?: boolean;
}

export function createServer(options: ServerOptions = {}): Express {
  const app = express();
  app.use(express.json());

  // CORS
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "*");
    if (_req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Auth middleware for cloud mode
  function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
    try {
      checkAuth(req);
      next();
    } catch (err) {
      if (err instanceof AuthError) {
        _res.status(401).json({ error: err.message, code: err.code });
      } else {
        next(err);
      }
    }
  }

  // Error handler
  function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof GateLaneError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
    } else {
      console.error("Unhandled error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // === Health & Info ===
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "gatelane", version: "0.1.0", cloudMode: isCloudMode() });
  });

  app.get("/v1/gatelane/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "gatelane", version: "0.1.0", cloudMode: isCloudMode() });
  });

  app.get("/v1/gatelane/capabilities", (_req: Request, res: Response) => {
    res.json({
      capabilities: [
        "server-registry",
        "tool-discovery",
        "tool-call-proxy",
        "allow-deny-policies",
        "rate-limiting",
        "audit-logs",
        "usage-tracking",
        "cloud-auth",
      ],
      version: "0.1.0",
    });
  });

  app.get("/v1/gatelane/pricing", (_req: Request, res: Response) => {
    res.json({
      local: { cost: "free", description: "Open-source, no API key required" },
      cloud: { cost: "TBD", description: "Talocode Cloud — gated by TALOCODE_API_KEY", url: "https://talocode.site" },
    });
  });

  // === Servers ===
  app.get("/v1/gatelane/servers", (_req: Request, res: Response) => {
    const registry = new ServerRegistry();
    res.json({ servers: registry.list() });
  });

  app.post("/v1/gatelane/servers", authMiddleware, (req: Request, res: Response) => {
    try {
      const body = req.body as CreateServerRequest;
      const registry = new ServerRegistry();
      const server = registry.add(body);
      res.status(201).json({ server });
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ error: err.message, code: err.code });
      } else {
        throw err;
      }
    }
  });

  app.get("/v1/gatelane/servers/:id", (req: Request, res: Response) => {
    const registry = new ServerRegistry();
    try {
      const server = registry.get(req.params.id);
      res.json({ server });
    } catch (err: unknown) {
      const e = err as Error;
      res.status(404).json({ error: e.message });
    }
  });

  app.delete("/v1/gatelane/servers/:id", authMiddleware, (req: Request, res: Response) => {
    const registry = new ServerRegistry();
    try {
      registry.remove(req.params.id);
      res.json({ status: "removed" });
    } catch (err: unknown) {
      const e = err as Error;
      res.status(404).json({ error: e.message });
    }
  });

  // === Tools ===
  app.post("/v1/gatelane/tools/discover", async (_req: Request, res: Response) => {
    const discovery = new ToolDiscovery();
    const tools = await discovery.discover();
    res.json({ tools, count: tools.length });
  });

  app.get("/v1/gatelane/tools", (_req: Request, res: Response) => {
    const discovery = new ToolDiscovery();
    res.json({ tools: discovery.list() });
  });

  app.get("/v1/gatelane/tools/:id", (req: Request, res: Response) => {
    const discovery = new ToolDiscovery();
    const tool = discovery.get(req.params.id) || discovery.list().find((t) => t.id === req.params.id);
    if (!tool) {
      res.status(404).json({ error: "Tool not found" });
      return;
    }
    res.json({ tool });
  });

  // === Tool Call ===
  app.post("/v1/gatelane/call", authMiddleware, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = newRequestId();
    const body = req.body as ToolCallRequest;

    try {
      if (!body.tool) {
        throw new ValidationError("'tool' is required");
      }

      const discovery = new ToolDiscovery();
      let tools = discovery.list();
      if (tools.length === 0) {
        tools = await discovery.discover();
      }

      const toolDef = discovery.get(body.tool);
      if (!toolDef) {
        res.status(404).json({ error: `Tool '${body.tool}' not found` });
        return;
      }

      const policy = new PolicyEngine();
      const { allowed, reason } = policy.check(body.tool, body.actor);
      if (!allowed) {
        throw new ToolDeniedError(body.tool, reason);
      }

      const rateLimiter = new RateLimiter();
      rateLimiter.check(toolDef.serverName, body.tool, body.actor);

      const audit = new AuditLog();
      const usage = new UsageTracker();

      const proxy = new ToolProxy();
      const { result, durationMs } = await proxy.call(toolDef, body.input || {});
      const auditEntry = audit.record({
        actor: body.actor || "api",
        serverId: toolDef.serverId,
        serverName: toolDef.serverName,
        toolName: body.tool,
        requestId,
        status: "completed",
        durationMs,
      });

      usage.record({
        actor: body.actor || "api",
        serverId: toolDef.serverId,
        toolName: body.tool,
        requestId,
        credits: 1,
      });

      const response: ToolCallResponse = {
        requestId,
        status: "completed",
        tool: body.tool,
        result,
        auditId: auditEntry.id,
        durationMs,
      };

      res.json(response);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const audit = new AuditLog();

      let status: "denied" | "failed" = "failed";
      let statusCode = 500;
      let message = "Call failed";

      if (err instanceof ToolDeniedError) {
        status = "denied";
        statusCode = 403;
        message = err.message;
      } else if (err instanceof RateLimitExceededError) {
        statusCode = 429;
        message = err.message;
      } else if (err instanceof ValidationError) {
        statusCode = 400;
        message = err.message;
      }

      audit.record({
        actor: body?.actor || "api",
        toolName: body?.tool,
        requestId,
        status,
        reason: message,
        durationMs,
      });

      res.status(statusCode).json({
        requestId,
        status,
        tool: body?.tool,
        error: message,
        auditId: `audit_pending`,
        durationMs,
      });
    }
  });

  // === Policies ===
  app.get("/v1/gatelane/policies", (_req: Request, res: Response) => {
    const engine = new PolicyEngine();
    res.json({ policies: engine.list() });
  });

  app.post("/v1/gatelane/policies", authMiddleware, (req: Request, res: Response) => {
    const body = req.body as CreatePolicyRequest;
    const engine = new PolicyEngine();
    const policy = engine.add(body);
    res.status(201).json({ policy });
  });

  app.delete("/v1/gatelane/policies/:id", authMiddleware, (req: Request, res: Response) => {
    const engine = new PolicyEngine();
    engine.remove(req.params.id);
    res.json({ status: "removed" });
  });

  // === Rate Limits ===
  app.get("/v1/gatelane/rate-limits", (_req: Request, res: Response) => {
    const limiter = new RateLimiter();
    res.json({ rateLimits: limiter.list() });
  });

  app.post("/v1/gatelane/rate-limits", authMiddleware, (req: Request, res: Response) => {
    const body = req.body as { scope: GateLaneRateLimit["scope"]; target: string; limit: number; windowSeconds: number };
    const limiter = new RateLimiter();
    const rl = limiter.add(body.scope, body.target, body.limit, body.windowSeconds);
    res.status(201).json({ rateLimit: rl });
  });

  app.delete("/v1/gatelane/rate-limits/:id", authMiddleware, (req: Request, res: Response) => {
    const limiter = new RateLimiter();
    limiter.remove(req.params.id);
    res.json({ status: "removed" });
  });

  // === Audit Logs ===
  app.get("/v1/gatelane/audit", (req: Request, res: Response) => {
    const audit = new AuditLog();
    const entries = audit.list();
    res.json({ entries, count: entries.length });
  });

  app.get("/v1/gatelane/audit/tail", (req: Request, res: Response) => {
    const audit = new AuditLog();
    const n = parseInt(req.query.n as string) || 10;
    res.json({ entries: audit.tail(n) });
  });

  // === Usage ===
  app.get("/v1/gatelane/usage", (_req: Request, res: Response) => {
    const usage = new UsageTracker();
    res.json({
      events: usage.getUsage(),
      totalCredits: usage.getTotalCredits(),
    });
  });

  app.use(errorHandler);

  return app;
}
