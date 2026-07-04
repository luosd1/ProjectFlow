/**
 * Development-only mock ProjectFlow tools for the S3 sidecar loop.
 */

import { successResult } from "@/types/tool-result.js";
import type { ProjectFlowToolManifest } from "@/types/tool-manifest.js";
import type { ToolRegistry } from "./registry.js";

const mockWorkspaceStateManifest: ProjectFlowToolManifest = {
  schemaVersion: 1,
  name: "mock_get_workspace_state",
  version: 1,
  description: "读取 mock workspace state，用于验证 sidecar mock tool loop。",
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
  resultLimit: { maxBytes: 4096, redaction: "none" },
  backend: { owner: "fastapi", endpoint: "/internal/agent-tools/mock_get_workspace_state", method: "POST" },
  effects: { effectType: "none", idempotencyKeyRequired: false, replaySafe: true },
  privacy: { dataClassification: "public", traceIncludeInputs: true, traceIncludeOutputs: true },
  errors: { modelVisibleErrorPolicy: "normalized_summary" },
  resume: { manifestVersion: 1, incompatibleVersionPolicy: "regenerate" },
  trace: { emits: ["tool.started", "tool.completed"] },
};

export function registerMockTools(registry: ToolRegistry): void {
  if (registry.has(mockWorkspaceStateManifest.name)) return;

  registry.register({
    manifest: mockWorkspaceStateManifest,
    execute: async () => successResult({
      project_name: "Mock ProjectFlow 项目",
      current_stage: "planning",
      project_status: "active",
    }, "已读取 mock workspace state"),
  });
}
