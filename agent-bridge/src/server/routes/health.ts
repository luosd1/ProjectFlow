/**
 * GET /health — Health check endpoint.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "./utils.js";

export async function handleHealth(
  _req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
): Promise<void> {
  sendJson(res, 200, {
    status: "ok",
    service: "agent-bridge",
    version: "0.1.0",
    uptime_s: Math.floor(process.uptime()),
  });
}
