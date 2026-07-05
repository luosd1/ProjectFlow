/**
 * GET /tools/list — return all model-callable tool manifests.
 * Informational endpoint for debugging and tool discovery.
 *
 * Wire payload is snake_case (manifests are camelCase internally); converted
 * via snakifyKeys before serialization.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { snakifyKeys } from "@/types/wire.js";
import type { RunContext } from "./utils.js";

export async function handleListTools(
  _req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
  ctx: RunContext,
): Promise<void> {
  const manifests = ctx.toolRegistry.getModelCallableManifests();
  const wire = manifests.map((m) => snakifyKeys(m));
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ tools: wire }, null, 2));
}
