/**
 * POST /runs — Start a new agent run.
 * Receives RunStartRequest from FastAPI, initiates the runtime loop.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { parseRunStartRequest } from "@/types/wire.js";
import { createRunState } from "@/types/run-state.js";
import { executeRun } from "@/runtime/pi-runtime.js";
import type { RunContext } from "./utils.js";
import { sendJson, readJsonBody } from "./utils.js";

export async function handleStartRun(
  req: IncomingMessage,
  res: ServerResponse,
  _params: Record<string, string>,
  ctx: RunContext,
): Promise<void> {
  const bodyText = (req as any).bodyText as string;

  const parsed = readJsonBody(res, bodyText, parseRunStartRequest);
  if (!parsed) return;

  // Create initial run state
  const runState = createRunState({
    conversationId: parsed.conversation_id,
    workspaceId: parsed.workspace_id,
    projectId: parsed.project_id,
    model: {
      provider: parsed.runtime_config?.model?.provider ?? ctx.config.defaultModelProvider,
      name: parsed.runtime_config?.model?.name ?? ctx.config.defaultModelName,
    },
    maxSteps: parsed.runtime_config?.max_steps ?? ctx.config.defaults.maxSteps,
    maxToolCalls: parsed.runtime_config?.max_tool_calls ?? ctx.config.defaults.maxToolCalls,
    timeoutMs: parsed.runtime_config?.timeout_ms ?? ctx.config.defaults.timeoutMs,
  });

  // Store run in session store
  ctx.sessionStore.set(runState.runId, runState);

  // Return run_id immediately, execute loop asynchronously
  sendJson(res, 200, {
    run_id: runState.runId,
    status: runState.status,
  });

  // Start the runtime loop asynchronously
  executeRun(
    runState,
    {
      conversationId: parsed.conversation_id,
      workspaceId: parsed.workspace_id,
      projectId: parsed.project_id,
      userContent: parsed.user_content ?? "",
      workspaceState: parsed.workspace_state,
      recentMessages: parsed.recent_messages,
      pendingProposals: parsed.pending_proposals,
    },
    ctx.toolRegistry,
    // Model router will be resolved inside executeRun
    { resolve: () => ({ provider: runState.model.provider, name: runState.model.name }) } as any,
    ctx.fastapiClient,
    ctx.stream,
    {
      traceIncludeSensitiveData: parsed.runtime_config?.trace_include_sensitive_data ?? ctx.config.traceIncludeSensitiveData,
    },
    {
      onEvent: (type, payload) => {
        ctx.stream.emit(type as any, { type, ...payload } as any);
      },
      onComplete: (state) => {
        console.log(`[agent-bridge] run ${state.runId} completed`);
      },
      onError: (error, state) => {
        console.error(`[agent-bridge] run ${state.runId} failed:`, error.message);
      },
    },
  ).catch((err) => {
    console.error(`[agent-bridge] run ${runState.runId} uncaught error:`, err);
  });
}
