/**
 * Budget manager — enforces step, tool-call, timeout, token, and byte limits per run.
 *
 * On budget exceed, emits runtime.error event with code: "BUDGET_EXCEEDED".
 */

export interface BudgetConfig {
  maxSteps: number;
  maxToolCalls: number;
  timeoutMs: number;
  maxOutputTokens: number;
  maxToolResultBytes: number;
}

export interface BudgetState {
  stepsUsed: number;
  toolCallsUsed: number;
  outputTokensUsed: number;
  startTimeMs: number;
}

export type BudgetType = "steps" | "tool_calls" | "timeout" | "output_tokens" | "tool_result_bytes";

export interface BudgetCheckResult {
  allowed: boolean;
  exceeded?: BudgetType;
  message?: string;
}

export class BudgetManager {
  private readonly config: BudgetConfig;
  private readonly state: BudgetState;

  constructor(config: BudgetConfig) {
    this.config = config;
    this.state = {
      stepsUsed: 0,
      toolCallsUsed: 0,
      outputTokensUsed: 0,
      startTimeMs: Date.now(),
    };
  }

  /** Check if a new step is allowed. */
  checkStep(): BudgetCheckResult {
    if (this.state.stepsUsed >= this.config.maxSteps) {
      return {
        allowed: false,
        exceeded: "steps",
        message: `已达到最大步数限制 (${this.config.maxSteps})`,
      };
    }
    return { allowed: true };
  }

  /** Record a step usage. */
  useStep(): void {
    this.state.stepsUsed++;
  }

  /** Check if a new tool call is allowed. */
  checkToolCall(): BudgetCheckResult {
    if (this.state.toolCallsUsed >= this.config.maxToolCalls) {
      return {
        allowed: false,
        exceeded: "tool_calls",
        message: `已达到最大工具调用次数限制 (${this.config.maxToolCalls})`,
      };
    }
    return { allowed: true };
  }

  /** Record a tool call usage. */
  useToolCall(): void {
    this.state.toolCallsUsed++;
  }

  /** Check if the run has timed out. */
  checkTimeout(): BudgetCheckResult {
    const elapsed = Date.now() - this.state.startTimeMs;
    if (elapsed >= this.config.timeoutMs) {
      return {
        allowed: false,
        exceeded: "timeout",
        message: `运行超时 (${Math.floor(elapsed / 1000)}s >= ${Math.floor(this.config.timeoutMs / 1000)}s)`,
      };
    }
    return { allowed: true };
  }

  /** Check if output token limit would be exceeded. */
  checkOutputTokens(estimatedTokens: number): BudgetCheckResult {
    if (this.state.outputTokensUsed + estimatedTokens > this.config.maxOutputTokens) {
      return {
        allowed: false,
        exceeded: "output_tokens",
        message: `输出 token 将超出限制 (${this.state.outputTokensUsed} + ${estimatedTokens} > ${this.config.maxOutputTokens})`,
      };
    }
    return { allowed: true };
  }

  /** Record output token usage. */
  useOutputTokens(tokens: number): void {
    this.state.outputTokensUsed += tokens;
  }

  /** Check if a tool result size is within limits. */
  checkToolResultSize(bytes: number): BudgetCheckResult {
    if (bytes > this.config.maxToolResultBytes) {
      return {
        allowed: false,
        exceeded: "tool_result_bytes",
        message: `工具结果大小超出限制 (${bytes} > ${this.config.maxToolResultBytes})`,
      };
    }
    return { allowed: true };
  }

  /** Run all budget checks. Returns the first exceeded budget, or allowed. */
  checkAll(): BudgetCheckResult {
    const checks = [this.checkTimeout(), this.checkStep(), this.checkToolCall()];
    for (const check of checks) {
      if (!check.allowed) return check;
    }
    return { allowed: true };
  }

  /** Get current budget state summary. */
  getState(): {
    stepsUsed: number;
    maxSteps: number;
    toolCallsUsed: number;
    maxToolCalls: number;
    elapsedMs: number;
    timeoutMs: number;
    outputTokensUsed: number;
    maxOutputTokens: number;
  } {
    return {
      stepsUsed: this.state.stepsUsed,
      maxSteps: this.config.maxSteps,
      toolCallsUsed: this.state.toolCallsUsed,
      maxToolCalls: this.config.maxToolCalls,
      elapsedMs: Date.now() - this.state.startTimeMs,
      timeoutMs: this.config.timeoutMs,
      outputTokensUsed: this.state.outputTokensUsed,
      maxOutputTokens: this.config.maxOutputTokens,
    };
  }
}
