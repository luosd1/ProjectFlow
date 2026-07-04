import { describe, it, expect } from "vitest";
import { mapPiEvent } from "../../src/events/event-mapper.js";
import type { PiEvent } from "../../src/events/event-mapper.js";

describe("event-mapper", () => {
  const runId = "run_123";

  it("maps agent_start to agent.started", () => {
    const piEvent: PiEvent = { type: "agent_start", data: {} };
    const result = mapPiEvent(piEvent, runId);
    expect(result.type).toBe("agent.started");
    expect(result.newStatus).toBe("context_building");
  });

  it("maps message_delta to agent.delta", () => {
    const piEvent: PiEvent = { type: "message_delta", data: { content: "hello" } };
    const result = mapPiEvent(piEvent, runId);
    expect(result.type).toBe("agent.delta");
    expect(result.newStatus).toBe("model_streaming");
  });

  it("maps tool_execution_start to tool.started", () => {
    const piEvent: PiEvent = { type: "tool_execution_start", data: { tool_name: "test" } };
    const result = mapPiEvent(piEvent, runId);
    expect(result.type).toBe("tool.started");
    expect(result.newStatus).toBe("tool_running");
  });

  it("maps successful tool_execution_end to tool.completed", () => {
    const piEvent: PiEvent = { type: "tool_execution_end", data: {} };
    const result = mapPiEvent(piEvent, runId);
    expect(result.type).toBe("tool.completed");
    expect(result.newStatus).toBe("persisting_tool_result");
  });

  it("maps failed tool_execution_end to tool.failed", () => {
    const piEvent: PiEvent = {
      type: "tool_execution_end",
      data: {},
      error: { code: "TIMEOUT", message: "Tool timed out" },
    };
    const result = mapPiEvent(piEvent, runId);
    expect(result.type).toBe("tool.failed");
    expect(result.payload.error).toEqual({ code: "TIMEOUT", message: "Tool timed out" });
  });

  it("maps agent_end to agent.completed", () => {
    const piEvent: PiEvent = { type: "agent_end", data: {} };
    const result = mapPiEvent(piEvent, runId);
    expect(result.type).toBe("agent.completed");
    expect(result.newStatus).toBe("completed");
  });

  it("maps policy_block to tool.blocked", () => {
    const piEvent: PiEvent = { type: "policy_block", data: { reason: "策略拒绝" } };
    const result = mapPiEvent(piEvent, runId);
    expect(result.type).toBe("tool.blocked");
  });

  it("maps budget_exceeded to runtime.error", () => {
    const piEvent: PiEvent = {
      type: "budget_exceeded",
      data: { scope: "tool_calls" },
    };
    const result = mapPiEvent(piEvent, runId);
    expect(result.type).toBe("runtime.error");
    expect(result.payload.code).toBe("BUDGET_EXCEEDED");
    expect(result.newStatus).toBe("failed");
  });

  it("maps proposal_created correctly", () => {
    const piEvent: PiEvent = { type: "proposal_created", data: { proposal_id: "p1" } };
    const result = mapPiEvent(piEvent, runId);
    expect(result.type).toBe("proposal.created");
    expect(result.payload.proposal_id).toBe("p1");
  });

  it("maps advisory_created correctly", () => {
    const piEvent: PiEvent = { type: "advisory_created", data: { record_id: "r1" } };
    const result = mapPiEvent(piEvent, runId);
    expect(result.type).toBe("advisory_record.created");
  });
});
