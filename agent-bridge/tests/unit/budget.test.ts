import { describe, it, expect } from "vitest";
import { BudgetManager } from "../../src/policy/budget.js";

describe("BudgetManager", () => {
  const defaultConfig = {
    maxSteps: 3,
    maxToolCalls: 2,
    timeoutMs: 60000,
    maxOutputTokens: 1000,
    maxToolResultBytes: 1024,
  };

  it("allows operations within budget", () => {
    const budget = new BudgetManager(defaultConfig);
    expect(budget.checkStep().allowed).toBe(true);
    expect(budget.checkToolCall().allowed).toBe(true);
    expect(budget.checkTimeout().allowed).toBe(true);
    expect(budget.checkOutputTokens(100).allowed).toBe(true);
    expect(budget.checkToolResultSize(512).allowed).toBe(true);
  });

  it("blocks when max steps exceeded", () => {
    const budget = new BudgetManager({ ...defaultConfig, maxSteps: 2 });
    budget.useStep();
    budget.useStep();
    const result = budget.checkStep();
    expect(result.allowed).toBe(false);
    expect(result.exceeded).toBe("steps");
  });

  it("blocks when max tool calls exceeded", () => {
    const budget = new BudgetManager({ ...defaultConfig, maxToolCalls: 1 });
    budget.useToolCall();
    const result = budget.checkToolCall();
    expect(result.allowed).toBe(false);
    expect(result.exceeded).toBe("tool_calls");
  });

  it("blocks when output tokens exceeded", () => {
    const budget = new BudgetManager({ ...defaultConfig, maxOutputTokens: 100 });
    budget.useOutputTokens(80);
    const result = budget.checkOutputTokens(30);
    expect(result.allowed).toBe(false);
    expect(result.exceeded).toBe("output_tokens");
  });

  it("blocks when tool result size exceeded", () => {
    const budget = new BudgetManager(defaultConfig);
    const result = budget.checkToolResultSize(2048);
    expect(result.allowed).toBe(false);
    expect(result.exceeded).toBe("tool_result_bytes");
  });

  it("tracks budget state correctly", () => {
    const budget = new BudgetManager(defaultConfig);
    budget.useStep();
    budget.useStep();
    budget.useToolCall();
    budget.useOutputTokens(500);

    const state = budget.getState();
    expect(state.stepsUsed).toBe(2);
    expect(state.maxSteps).toBe(3);
    expect(state.toolCallsUsed).toBe(1);
    expect(state.maxToolCalls).toBe(2);
    expect(state.outputTokensUsed).toBe(500);
    expect(state.maxOutputTokens).toBe(1000);
  });

  it("checkAll returns first exceeded budget", () => {
    const budget = new BudgetManager({ ...defaultConfig, maxSteps: 1 });
    budget.useStep();
    const result = budget.checkAll();
    expect(result.allowed).toBe(false);
    expect(result.exceeded).toBe("steps");
  });
});
