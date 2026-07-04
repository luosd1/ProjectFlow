/**
 * POST /runs — Start a new agent run.
 * Receives RunStartRequest from FastAPI, initiates the runtime loop.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { SidecarConfig } from "../config.js";
import { parseRunStartRequest } from "@/types/wire.js";
import { createRunState, type AgentRunState } from "@/types/run-state.js";
import { sendJson, readJsonBody } from "./utils.js";

export async function handleStartRun(
  req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
): Promise<void> {
  const config = (req as any).config as SidecarConfig;
  const bodyText = (req as any).bodyText as string;

  const parsed = readJsonBody(res, bodyText, parseRunStartRequest);
  if (!parsed) return;

  // Create initial run state (sidecar-local, not persisted — FastAPI owns durable state)
  const runState = createRunState({
    conversationId: parsed.conversation_id,
    workspaceId: parsed.workspace_id,
    projectId: parsed.project_id,
    model: {
      provider: parsed.runtime_config?.model?.provider ?? config.defaultModelProvider,
      name: parsed.runtime_config?.model?.name ?? config.defaultModelName,
    },
    maxSteps: parsed.runtime_config?.max_steps ?? config.defaults.maxSteps,
    maxToolCalls: parsed.runtime_config?.max_tool_calls ?? config.defaults.maxToolCalls,
    timeoutMs: parsed.runtime_config?.timeout_ms ?? config.defaults.timeoutMs,
  });

  // Store run in memory (session store)
  const store = (globalThis as any).__runStore as Map<string, AgentRunState> | undefined;
  if (store) {
    store.set(runState.runId, runState);
  }

  // TODO: Actually start the runtime loop (S3 Pi runtime adapter)
  // For now, return the run_id immediately
  sendJson(res, 200, {
    run_id: runState.runId,
    status: runState.status,
  });
}
