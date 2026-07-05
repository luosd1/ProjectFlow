/**
 * GET /tools/list — return all model-callable tool manifests.
 * Informational endpoint for debugging and tool discovery.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { RunContext } from "./utils.js";

export async function handleListTools(
  _req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
  ctx: RunContext,
): Promise<void> {
  const manifests = ctx.toolRegistry.getModelCallableManifests();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ tools: manifests }, null, 2));
}
