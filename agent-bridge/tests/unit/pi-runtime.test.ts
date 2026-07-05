import { describe, expect, it } from "vitest";
import { EventStream } from "../../src/events/stream.js";
import { executeRun } from "../../src/runtime/pi-runtime.js";
import { ModelRouter } from "../../src/runtime/model-router.js";
import { createRunState } from "../../src/types/run-state.js";
import { successResult } from "../../src/types/tool-result.js";
import type { ProjectFlowToolManifest } from "../../src/types/tool-manifest.js";
import type { FastapiClient } from "../../src/tools/fastapi-client.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { registerMockTools } from "../../src/tools/mock-tools.js";
import type { WireAppendRequest, WireAppendResponse } from "../../src/types/wire.js";

function createState() {
  return createRunState({
    conversationId: "conv_1",
    workspaceId: "ws_1",
    projectId: "proj_1",
    model: { provider: "mock", name: "mock-model" },
    maxSteps: 8,
    maxToolCalls: 6,
    timeoutMs: 180000,
  });
}

function createModelRouter(): ModelRouter {
  return new ModelRouter({
    defaultProvider: "mock",
    defaultModel: "mock-model",
    providers: {},
  });
}

function createFastapiClient(calls: WireAppendRequest[]): FastapiClient {
  return {
    appendEvents: async (_runId: string, request: WireAppendRequest): Promise<WireAppendResponse> => {
      calls.push(request);
      return { state_version: calls.length, events: [], tool_results: [] };
    },
  } as unknown as FastapiClient;
}

function makeManifest(name: string): ProjectFlowToolManifest {
  return {
    schemaVersion: 1,
    name,
    version: 1,
    description: `Tool ${name}`,
    riskCategory: "read_only",
    modelCallable: true,
    sidecarOnly: false,
    humanTriggeredOnly: false,
    annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    outputSchema: { type: "object" },
    execution: { mode: "parallel", maxConcurrency: 1, providerParallelToolCallsAllowed: true },
    timeoutMs: 5000,
    retry: { maxAttempts: 1, retryOn: [] },
    resultLimit: { maxBytes: 32768, redaction: "none" },
    backend: { owner: "fastapi", endpoint: `/internal/agent-tools/${name}`, method: "POST" },
    effects: { effectType: "none", idempotencyKeyRequired: false, replaySafe: true },
    privacy: { dataClassification: "public", traceIncludeInputs: true, traceIncludeOutputs: true },
    errors: { modelVisibleErrorPolicy: "normalized_summary" },
    resume: { manifestVersion: 1, incompatibleVersionPolicy: "regenerate" },
    trace: { emits: [] },
  };
}

describe("pi-runtime", () => {
  it("runs a complete mock provider/tool loop", async () => {
    const calls: WireAppendRequest[] = [];
    const registry = new ToolRegistry();
    registerMockTools(registry);

    const state = await executeRun(
      createState(),
      {
        conversationId: "conv_1",
        workspaceId: "ws_1",
        projectId: "proj_1",
        userContent: "跑一次 mock loop",
      },
      registry,
      createModelRouter(),
      createFastapiClient(calls),
      new EventStream(),
    );

    expect(state.status).toBe("completed");
    expect(state.lastEventSeq).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.tool_results?.[0]?.tool_name).toBe("mock_get_workspace_state");
  });

  it("applies skill allowed-tools to actual Pi runtime tools", async () => {
    const calls: WireAppendRequest[] = [];
    const registry = new ToolRegistry();
    registry.register({
      manifest: makeManifest("blocked_tool"),
      execute: async () => successResult({}, "blocked"),
    });
    registry.register({
      manifest: makeManifest("allowed_tool"),
      execute: async () => successResult({}, "allowed"),
    });

    await executeRun(
      createState(),
      {
        conversationId: "conv_1",
        workspaceId: "ws_1",
        projectId: "proj_1",
        userContent: "使用 skill",
        skillContext: {
          name: "test-skill",
          description: "test",
          body: "body",
          allowedTools: ["allowed_tool"],
        },
      },
      registry,
      createModelRouter(),
      createFastapiClient(calls),
      new EventStream(),
    );

    expect(calls[0]!.tool_results?.[0]?.tool_name).toBe("allowed_tool");
  });

  it("returns cancelled when the run signal is already aborted", async () => {
    const registry = new ToolRegistry();
    registerMockTools(registry);
    const controller = new AbortController();
    controller.abort();

    const state = await executeRun(
      createState(),
      {
        conversationId: "conv_1",
        workspaceId: "ws_1",
        projectId: "proj_1",
        userContent: "取消",
      },
      registry,
      createModelRouter(),
      createFastapiClient([]),
      new EventStream(),
      { signal: controller.signal },
    );

    expect(state.status).toBe("cancelled");
  });
});
