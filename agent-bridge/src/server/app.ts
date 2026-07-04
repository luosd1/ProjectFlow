/**
 * HTTP server for the agent bridge sidecar.
 * Routes: POST /runs, GET /runs/:id, POST /runs/:id/cancel, GET /health
 */

import { createServer as createHttpServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { SidecarConfig } from "./config.js";
import { handleStartRun } from "./routes/start-run.js";
import { handleGetRun } from "./routes/get-run.js";
import { handleCancelRun } from "./routes/cancel-run.js";
import { handleHealth } from "./routes/health.js";

type RouteHandler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

function compileRoute(method: string, path: string, handler: RouteHandler): Route {
  const paramNames: string[] = [];
  const patternStr = path.replace(/:(\w+)/g, (_match, name) => {
    paramNames.push(name);
    return "([^/]+)";
  });
  return { method, pattern: new RegExp(`^${patternStr}$`), paramNames, handler };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function createServer(config: SidecarConfig): Server {
  const routes: Route[] = [
    compileRoute("POST", "/runs", handleStartRun),
    compileRoute("GET", "/runs/:runId", handleGetRun),
    compileRoute("POST", "/runs/:runId/cancel", handleCancelRun),
    compileRoute("GET", "/health", handleHealth),
  ];

  const server = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers for local dev
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    for (const route of routes) {
      if (req.method !== route.method) continue;
      const match = url.pathname.match(route.pattern);
      if (!match) continue;

      const params: Record<string, string> = {};
      for (let i = 0; i < route.paramNames.length; i++) {
        params[route.paramNames[i]!] = match[i + 1]!;
      }

      try {
        // Attach body reader for POST requests
        if (req.method === "POST") {
          (req as any).bodyText = await readBody(req);
        }
        (req as any).config = config;
        await route.handler(req, res, params);
      } catch (err) {
        console.error(`[agent-bridge] error in ${route.method} ${url.pathname}:`, err);
        sendJson(res, 500, { error: "internal_error", message: "Internal server error" });
      }
      return;
    }

    sendJson(res, 404, { error: "not_found", message: `No route for ${req.method} ${url.pathname}` });
  });

  return server;
}
