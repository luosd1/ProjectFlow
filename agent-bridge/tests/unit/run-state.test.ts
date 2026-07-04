import { describe, it, expect } from "vitest";
import { createRunState, isValidTransition } from "../../src/types/run-state.js";

describe("run-state", () => {
  describe("createRunState", () => {
    it("creates a valid initial run state", () => {
      const state = createRunState({
        conversationId: "conv_123",
        workspaceId: "ws_456",
        projectId: "proj_789",
        model: { provider: "mock", name: "mock-model" },
        maxSteps: 8,
        maxToolCalls: 6,
        timeoutMs: 180000,
      });

      expect(state.runId).toMatch(/^run_\d+_\d+$/);
      expect(state.conversationId).toBe("conv_123");
      expect(state.workspaceId).toBe("ws_456");
      expect(state.projectId).toBe("proj_789");
      expect(state.status).toBe("created");
      expect(state.currentTurn).toBe(0);
      expect(state.currentStep).toBe(0);
      expect(state.model).toEqual({ provider: "mock", name: "mock-model" });
      expect(state.sideEffects).toEqual([]);
      expect(state.lastEventSeq).toBe(0);
    });

    it("generates unique run IDs", () => {
      const state1 = createRunState({
        conversationId: "c", workspaceId: "w", projectId: "p",
        model: { provider: "mock", name: "m" },
        maxSteps: 8, maxToolCalls: 6, timeoutMs: 180000,
      });
      const state2 = createRunState({
        conversationId: "c", workspaceId: "w", projectId: "p",
        model: { provider: "mock", name: "m" },
        maxSteps: 8, maxToolCalls: 6, timeoutMs: 180000,
      });
      expect(state1.runId).not.toBe(state2.runId);
    });
  });

  describe("isValidTransition", () => {
    it("allows valid forward transitions", () => {
      expect(isValidTransition("created", "context_building")).toBe(true);
      expect(isValidTransition("context_building", "model_streaming")).toBe(true);
      expect(isValidTransition("model_streaming", "tool_preparing")).toBe(true);
      expect(isValidTransition("tool_preparing", "tool_running")).toBe(true);
      expect(isValidTransition("tool_running", "persisting_tool_result")).toBe(true);
      expect(isValidTransition("persisting_tool_result", "model_streaming")).toBe(true);
      expect(isValidTransition("model_streaming", "completed")).toBe(true);
    });

    it("allows cancel from any active state", () => {
      expect(isValidTransition("created", "cancelling")).toBe(true);
      expect(isValidTransition("context_building", "cancelling")).toBe(true);
      expect(isValidTransition("model_streaming", "cancelling")).toBe(true);
      expect(isValidTransition("tool_preparing", "cancelling")).toBe(true);
      expect(isValidTransition("tool_running", "cancelling")).toBe(true);
      expect(isValidTransition("persisting_tool_result", "cancelling")).toBe(true);
    });

    it("allows failure from any active state", () => {
      expect(isValidTransition("created", "failed")).toBe(true);
      expect(isValidTransition("context_building", "failed")).toBe(true);
      expect(isValidTransition("model_streaming", "failed")).toBe(true);
    });

    it("disallows invalid transitions", () => {
      expect(isValidTransition("completed", "model_streaming")).toBe(false);
      expect(isValidTransition("cancelled", "created")).toBe(false);
      expect(isValidTransition("failed", "completed")).toBe(false);
      expect(isValidTransition("created", "completed")).toBe(false);
    });

    it("allows cancelling to cancelled or failed", () => {
      expect(isValidTransition("cancelling", "cancelled")).toBe(true);
      expect(isValidTransition("cancelling", "failed")).toBe(true);
    });
  });
});
