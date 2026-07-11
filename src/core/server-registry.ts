import { loadServers, saveServers } from "./config-store.js";
import type { GateLaneServer, CreateServerRequest } from "./schema.js";
import { newServerId } from "./ids.js";
import { ServerNotFoundError, ValidationError } from "./errors.js";

export class ServerRegistry {
  private servers: GateLaneServer[];

  constructor() {
    this.servers = loadServers();
  }

  list(): GateLaneServer[] {
    return this.servers;
  }

  get(nameOrId: string): GateLaneServer {
    const server = this.servers.find(
      (s) => s.name === nameOrId || s.id === nameOrId,
    );
    if (!server) throw new ServerNotFoundError(nameOrId);
    return server;
  }

  add(req: CreateServerRequest): GateLaneServer {
    if (!req.name || !req.type) {
      throw new ValidationError("name and type are required");
    }
    if (this.servers.find((s) => s.name === req.name)) {
      throw new ValidationError(`Server '${req.name}' already exists`);
    }
    const server: GateLaneServer = {
      id: newServerId(),
      name: req.name,
      type: req.type,
      command: req.command,
      args: req.args,
      url: req.url,
      env: req.env,
      enabled: req.enabled ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.servers.push(server);
    saveServers(this.servers);
    return server;
  }

  remove(nameOrId: string): void {
    const idx = this.servers.findIndex(
      (s) => s.name === nameOrId || s.id === nameOrId,
    );
    if (idx === -1) throw new ServerNotFoundError(nameOrId);
    this.servers.splice(idx, 1);
    saveServers(this.servers);
  }

  reload(): void {
    this.servers = loadServers();
  }
}
