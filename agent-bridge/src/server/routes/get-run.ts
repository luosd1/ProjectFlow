/**
 * GET /runs/:runId — Get run status.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AgentRunState } from "@/types/run-state.js";
import { sendJson } from "./utils.js";

export async function handleGetRun(
  _req: IncomingMessage,
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

  sendJson(res, 200, {
    run_id: run.runId,
    status: run.status,
    current_turn: run.currentTurn,
    current_step: run.currentStep,
    last_event_seq: run.lastEventSeq,
    created_at: run.createdAt,
    updated_at: run.updatedAt,
    completed_at: run.completedAt ?? null,
  });
}
