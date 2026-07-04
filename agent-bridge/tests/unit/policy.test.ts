import { describe, it, expect } from "vitest";
import {
  evaluatePolicy,
  canExecuteInParallel,
  validateManifestSafety,
} from "../../src/policy/policy-engine.js";
import type { ProjectFlowToolManifest } from "../../src/types/tool-manifest.js";

function makeManifest(overrides: Partial<ProjectFlowToolManifest> = {}): ProjectFlowToolManifest {
  return {
    schemaVersion: 1,
    name: "test-tool",
    version: 1,
    description: "A test tool",
    riskCategory: "read_only",
    modelCallable: true,
    sidecarOnly: false,
    humanTriggeredOnly: false,
    annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
    inputSchema: {},
    outputSchema: {},
    execution: { mode: "parallel", maxConcurrency: 1, providerParallelToolCallsAllowed: true },
    timeoutMs: 5000,
    retry: { maxAttempts: 1, retryOn: [] },
    resultLimit: { maxBytes: 32768, redaction: "none" },
    backend: { owner: "fastapi", endpoint: "/internal/agent-tools/test", method: "POST" },
    effects: { effectType: "none", idempotencyKeyRequired: false, replaySafe: true },
    privacy: { dataClassification: "public", traceIncludeInputs: true, traceIncludeOutputs: true },
    errors: { modelVisibleErrorPolicy: "normalized_summary" },
    resume: { manifestVersion: 1, incompatibleVersionPolicy: "regenerate" },
    trace: { emits: ["tool.started", "tool.completed"] },
    ...overrides,
  };
}

describe("policy-engine", () => {
  describe("evaluatePolicy", () => {
    it("allows read_only tools", () => {
      const manifest = makeManifest({ riskCategory: "read_only" });
      const result = evaluatePolicy(manifest);
      expect(result.decision).toBe("allow");
    });

    it("allows analysis tools", () => {
      const manifest = makeManifest({ riskCategory: "analysis" });
      const result = evaluatePolicy(manifest);
      expect(result.decision).toBe("allow");
    });

    it("allows draft_only tools with proposal_create effect", () => {
      const manifest = makeManifest({
        riskCategory: "draft_only",
        effects: { effectType: "proposal_create", idempotencyKeyRequired: true, replaySafe: false },
      });
      const result = evaluatePolicy(manifest);
      expect(result.decision).toBe("allow");
    });

    it("denies draft_only tools with wrong effect type", () => {
      const manifest = makeManifest({
        riskCategory: "draft_only",
        effects: { effectType: "none", idempotencyKeyRequired: false, replaySafe: true },
      });
      const result = evaluatePolicy(manifest);
      expect(result.decision).toBe("deny");
    });

    it("allows advisory_write tools with advisory_record_create effect", () => {
      const manifest = makeManifest({
        riskCategory: "advisory_write",
        effects: { effectType: "advisory_record_create", idempotencyKeyRequired: true, replaySafe: true },
      });
      const result = evaluatePolicy(manifest);
      expect(result.decision).toBe("allow");
    });

    it("blocks destructive tools", () => {
      const manifest = makeManifest({ riskCategory: "destructive" });
      const result = evaluatePolicy(manifest);
      expect(result.decision).toBe("block");
    });

    it("blocks open_world tools", () => {
      const manifest = makeManifest({ riskCategory: "open_world" });
      const result = evaluatePolicy(manifest);
      expect(result.decision).toBe("block");
    });

    it("blocks human-triggered-only tools", () => {
      const manifest = makeManifest({ humanTriggeredOnly: true, modelCallable: false });
      const result = evaluatePolicy(manifest);
      expect(result.decision).toBe("block");
    });

    it("blocks non-model-callable tools", () => {
      const manifest = makeManifest({ modelCallable: false });
      const result = evaluatePolicy(manifest);
      expect(result.decision).toBe("block");
    });

    it("allows internal_write tools when sidecarOnly", () => {
      const manifest = makeManifest({
        riskCategory: "internal_write",
        sidecarOnly: true,
        effects: { effectType: "runtime_metadata_write", idempotencyKeyRequired: false, replaySafe: true },
      });
      const result = evaluatePolicy(manifest);
      expect(result.decision).toBe("allow");
    });

    it("denies internal_write tools when not sidecarOnly", () => {
      const manifest = makeManifest({
        riskCategory: "internal_write",
        sidecarOnly: false,
        effects: { effectType: "runtime_metadata_write", idempotencyKeyRequired: false, replaySafe: true },
      });
      const result = evaluatePolicy(manifest);
      expect(result.decision).toBe("deny");
    });
  });

  describe("canExecuteInParallel", () => {
    it("returns true when all tools allow parallel", () => {
      const manifests = [
        makeManifest({ execution: { mode: "parallel", maxConcurrency: 1, providerParallelToolCallsAllowed: true } }),
        makeManifest({ execution: { mode: "parallel", maxConcurrency: 1, providerParallelToolCallsAllowed: true } }),
      ];
      expect(canExecuteInParallel(manifests)).toBe(true);
    });

    it("returns false when any tool is sequential", () => {
      const manifests = [
        makeManifest({ execution: { mode: "parallel", maxConcurrency: 1, providerParallelToolCallsAllowed: true } }),
        makeManifest({ execution: { mode: "sequential", maxConcurrency: 1, providerParallelToolCallsAllowed: false } }),
      ];
      expect(canExecuteInParallel(manifests)).toBe(false);
    });

    it("returns false when provider parallel calls not allowed", () => {
      const manifests = [
        makeManifest({ execution: { mode: "parallel", maxConcurrency: 1, providerParallelToolCallsAllowed: false } }),
      ];
      expect(canExecuteInParallel(manifests)).toBe(false);
    });

    it("returns false when any parallel-capable tool is not read_only", () => {
      const manifests = [
        makeManifest({
          riskCategory: "draft_only",
          effects: { effectType: "proposal_create", idempotencyKeyRequired: true, replaySafe: false },
          execution: { mode: "parallel", maxConcurrency: 1, providerParallelToolCallsAllowed: true },
        }),
      ];
      expect(canExecuteInParallel(manifests)).toBe(false);
    });
  });

  describe("validateManifestSafety", () => {
    it("passes for safe draft_only manifest", () => {
      const manifest = makeManifest({
        riskCategory: "draft_only",
        effects: { effectType: "proposal_create", idempotencyKeyRequired: true, replaySafe: false },
      });
      const errors = validateManifestSafety(manifest);
      expect(errors).toHaveLength(0);
    });

    it("fails for draft_only with wrong effect type", () => {
      const manifest = makeManifest({
        riskCategory: "draft_only",
        effects: { effectType: "advisory_record_create", idempotencyKeyRequired: false, replaySafe: true },
      });
      const errors = validateManifestSafety(manifest);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("fails for advisory_write with wrong effect type", () => {
      const manifest = makeManifest({
        riskCategory: "advisory_write",
        effects: { effectType: "proposal_create", idempotencyKeyRequired: false, replaySafe: true },
      });
      const errors = validateManifestSafety(manifest);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
