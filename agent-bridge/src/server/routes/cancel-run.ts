/**
 * POST /runs/:runId/cancel — Cancel a running agent run.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AgentRunState } from "@/types/run-state.js";
import { sendJson } from "./utils.js";

export async function handleCancelRun(
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
): Promise<void> {
  const runId = params.runId ?? "";
  const store = (globalThis as any).__runStore as Map<string, AgentRunState> | undefined;
  const run = store?.get(runId);

  if (!run) {
    sendJson(res, 404, { error: "not_found", message: `Run ${runId} not found` });
    return;
  }

  // Parse optional reason from body
  try {
    const bodyText = (req as any).bodyText as string | undefined;
    if (bodyText) {
      const body = JSON.parse(bodyText);
      if (typeof body.reason === "string") {
        // reason stored for future use
      }
    }
  } catch {
    // ignore parse errors
  }

  // Transition to cancelling (actual cancellation is async)
  const cancelableStatuses = ["created", "context_building", "model_streaming", "tool_preparing", "tool_running", "persisting_tool_result"];
  if (cancelableStatuses.includes(run.status)) {
    run.status = "cancelling";
    run.updatedAt = new Date().toISOString();
    // TODO: Signal the runtime loop to stop (S3 Pi runtime adapter)
  }

  sendJson(res, 200, {
    run_id: run.runId,
    status: run.status,
    cancelled: run.status === "cancelling",
  });
}
