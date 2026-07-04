/**
 * Pi runtime adapter — wraps the agent session and runAgentLoop.
 *
 * This is the core orchestration module that:
 * 1. Receives a run request from FastAPI
 * 2. Builds model context via context-builder
 * 3. Runs the agent loop (mock or real provider)
 * 4. On each tool call: beforeToolCall → policy gate → execute → afterToolCall
 * 5. Persists events/results via FastAPI append API
 * 6. Loops until model produces final answer or budget exhausted
 *
 * Key invariants:
 * - Every tool call produces exactly one result
 * - Parameters validated before execution
 * - Policy decision recorded before every side effect
 * - Every result has a bounded payload
 * - Tool success observation only returned to model after FastAPI confirms persistence
 */

import type { AgentRunState } from "@/types/run-state.js";
import type { ContextBuildInput, SkillContext } from "./context-builder.js";
import { buildContext } from "./context-builder.js";
import type { ModelRouter } from "./model-router.js";
import type { FastapiClient } from "@/tools/fastapi-client.js";
import type { ToolRegistry, ToolExecutionContext } from "@/tools/registry.js";
import { normalizeResult } from "@/tools/result-normalizer.js";
import { evaluatePolicy } from "@/policy/policy-engine.js";
import { BudgetManager } from "@/policy/budget.js";
import { createToolTrace, createRunTrace } from "@/events/trace-envelope.js";
import type { EventStream } from "@/events/stream.js";
import { createEvent } from "@/types/runtime-event.js";

export interface RunInput {
  conversationId: string;
  workspaceId: string;
  projectId: string;
  userContent: string;
  workspaceState?: unknown;
  recentMessages?: unknown[];
  pendingProposals?: unknown[];
  skillContext?: SkillContext;
}

export interface RunCallbacks {
  onEvent?: (type: string, payload: Record<string, unknown>) => void;
  onComplete?: (state: AgentRunState) => void;
  onError?: (error: Error, state: AgentRunState) => void;
}

/**
 * Execute a complete agent run.
 * This is the main entry point for the runtime loop.
 */
export async function executeRun(
  runState: AgentRunState,
  input: RunInput,
  toolRegistry: ToolRegistry,
  modelRouter: ModelRouter,
  fastapiClient: FastapiClient,
  stream: EventStream,
  options: { traceIncludeSensitiveData?: boolean } = {},
  callbacks: RunCallbacks = {},
): Promise<AgentRunState> {
  const budget = new BudgetManager({
    maxSteps: 8,
    maxToolCalls: 6,
    timeoutMs: 180000,
    maxOutputTokens: 4096,
    maxToolResultBytes: 32768,
  });

  const runTrace = createRunTrace(runState.runId, options.traceIncludeSensitiveData ?? false);

  try {
    // Step 1: Context building
    runState.status = "context_building";
    runState.updatedAt = new Date().toISOString();
    callbacks.onEvent?.("state.changed", { run_id: runState.runId, status: runState.status });

    const contextInput: ContextBuildInput = {
      userContent: input.userContent,
      workspaceState: input.workspaceState,
      recentMessages: input.recentMessages,
      pendingProposals: input.pendingProposals,
      toolManifests: toolRegistry.getManifests(),
      skillContext: input.skillContext,
      currentTime: new Date().toISOString(),
    };
    const context = buildContext(contextInput);

    // Step 2: Start model streaming
    runState.status = "model_streaming";
    runState.currentTurn++;
    runState.updatedAt = new Date().toISOString();
    callbacks.onEvent?.("state.changed", { run_id: runState.runId, status: runState.status });

    // Step 3: Run the agent loop (mock implementation for now)
    await runAgentLoop(
      runState,
      context,
      toolRegistry,
      modelRouter,
      fastapiClient,
      budget,
      runTrace,
      options.traceIncludeSensitiveData ?? false,
      stream,
      callbacks,
    );

    // Step 4: Complete
    runState.status = "completed";
    runState.completedAt = new Date().toISOString();
    runState.updatedAt = new Date().toISOString();
    callbacks.onEvent?.("run.completed", { run_id: runState.runId });
    callbacks.onComplete?.(runState);

    return runState;
  } catch (err) {
    runState.status = "failed";
    runState.completedAt = new Date().toISOString();
    runState.updatedAt = new Date().toISOString();
    const error = err instanceof Error ? err : new Error(String(err));
    callbacks.onEvent?.("run.failed", { run_id: runState.runId, error: error.message });
    callbacks.onError?.(error, runState);
    return runState;
  }
}

/**
 * The agent loop — processes model responses and tool calls.
 * In mock mode, simulates a simple tool call sequence.
 */
async function runAgentLoop(
  runState: AgentRunState,
  context: ReturnType<typeof buildContext>,
  toolRegistry: ToolRegistry,
  _modelRouter: ModelRouter,
  fastapiClient: FastapiClient,
  budget: BudgetManager,
  _runTrace: ReturnType<typeof createRunTrace>,
  includeSensitiveData: boolean,
  stream: EventStream,
  callbacks: RunCallbacks,
): Promise<string> {
  // Mock implementation: simulate a simple loop
  // In production, this would call the actual model provider

  const toolNames = context.tools.map((t: any) => t.function?.name).filter(Boolean);
  if (toolNames.length === 0) {
    return "没有可用的工具，无法执行操作。";
  }

  // Simulate calling up to 2 tools
  const toolsToCall = toolNames.slice(0, 2);
  const observations: string[] = [];

  for (const toolName of toolsToCall) {
    // Check budget
    const budgetCheck = budget.checkAll();
    if (!budgetCheck.allowed) {
      const event = createEvent("runtime.error", runState.runId, runState.status, {
        code: "BUDGET_EXCEEDED",
        scope: budgetCheck.exceeded,
        message: budgetCheck.message,
      });
      stream.emit("runtime.error", event);
      throw new Error(budgetCheck.message);
    }

    // Check cancel signal
    if (runState.status === "cancelling") {
      runState.status = "cancelled";
      throw new Error("运行已被取消");
    }

    // Get tool manifest
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      observations.push(`工具 ${toolName} 未注册`);
      continue;
    }

    // Policy check
    const policyResult = evaluatePolicy(tool.manifest);
    if (policyResult.decision === "block") {
      const event = createEvent("tool.blocked", runState.runId, runState.status, {
        tool_name: toolName,
        reason: policyResult.reason,
      });
      stream.emit("tool.blocked", event);
      observations.push(`工具 ${toolName} 被策略阻止: ${policyResult.reason}`);
      continue;
    }

    if (policyResult.decision === "deny") {
      observations.push(`工具 ${toolName} 被策略拒绝: ${policyResult.reason}`);
      continue;
    }

    // Execute tool
    runState.status = "tool_running";
    runState.currentStep++;
    budget.useStep();
    budget.useToolCall();

    const toolCallId = `tc_${Date.now()}_${runState.currentStep}`;
    const idempotencyKey = `${runState.runId}_${toolCallId}`;

    runState.pendingToolCall = {
      toolCallId,
      toolName,
      toolVersion: tool.manifest.version,
      idempotencyKey,
    };

    // Emit tool.started event
    const startEvent = createEvent("tool.started", runState.runId, runState.status, {
      tool_name: toolName,
      tool_call_id: toolCallId,
    });
    stream.emit("tool.started", startEvent);
    callbacks.onEvent?.("tool.started", { tool_name: toolName, tool_call_id: toolCallId });

    // Create trace
    const toolTrace = createToolTrace(runState.runId, toolCallId, toolName, includeSensitiveData);
    const traceSpan = toolTrace.startSpan("tool.execution");

    try {
      const context: ToolExecutionContext = {
        runId: runState.runId,
        toolCallId,
        conversationId: runState.conversationId,
        workspaceId: runState.workspaceId,
        projectId: runState.projectId,
        idempotencyKey,
      };

      const rawResult = await tool.execute({}, context);
      toolTrace.endSpan(traceSpan, { status: "success" });

      // Normalize result
      const normalized = normalizeResult(rawResult, {}, {
        maxBytes: tool.manifest.resultLimit.maxBytes,
        redaction: tool.manifest.resultLimit.redaction,
        recordInput: tool.manifest.privacy.traceIncludeInputs,
        recordOutput: tool.manifest.privacy.traceIncludeOutputs,
      });

      // Persist via append API
      runState.status = "persisting_tool_result";
      await fastapiClient.appendEvents(runState.runId, {
        idempotency_key: idempotencyKey,
        tool_results: [{
          tool_call_id: toolCallId,
          tool_name: toolName,
          tool_version: tool.manifest.version,
          result: {
            status: normalized.status,
            data: normalized.data,
            side_effect_status: normalized.sideEffectStatus,
            observation: normalized.observation,
            trace: normalized.trace,
          },
        }],
      });

      // Record side effect
      runState.sideEffects.push({
        toolCallId,
        status: normalized.sideEffectStatus,
      });

      // Emit tool.completed
      const completeEvent = createEvent("tool.completed", runState.runId, runState.status, {
        tool_name: toolName,
        tool_call_id: toolCallId,
        status: normalized.status,
      });
      stream.emit("tool.completed", completeEvent);
      callbacks.onEvent?.("tool.completed", { tool_name: toolName, status: normalized.status });

      observations.push(normalized.observation);
    } catch (err) {
      toolTrace.endSpan(traceSpan, { status: "error", error: String(err) });

      const failEvent = createEvent("tool.failed", runState.runId, runState.status, {
        tool_name: toolName,
        tool_call_id: toolCallId,
        error: err instanceof Error ? err.message : String(err),
      });
      stream.emit("tool.failed", failEvent);
      callbacks.onEvent?.("tool.failed", { tool_name: toolName, error: String(err) });

      observations.push(`工具 ${toolName} 执行失败: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Clear pending tool call
    runState.pendingToolCall = undefined;

    // Return to model_streaming for next iteration
    runState.status = "model_streaming";
    runState.updatedAt = new Date().toISOString();
  }

  // Return final observations as the agent's response
  return observations.length > 0
    ? `执行完成。结果:\n${observations.join("\n")}`
    : "没有执行任何工具操作。";
}
