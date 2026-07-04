/**
 * ProjectFlowToolResult — universal tool output shape.
 * Every tool call (success, blocked, failed, timeout, aborted, validation_error)
 * must return this shape.
 */

import type { SideEffectStatus } from "./run-state.js";

export type ToolResultStatus =
  | "success"
  | "blocked"
  | "failed"
  | "aborted"
  | "timeout"
  | "validation_error";

export interface ToolError {
  code: string;
  reason?: string;
  message: string;
  details?: unknown;
}

export interface ToolLinks {
  agentEventId?: string;
  agentRunId?: string;
  proposalId?: string;
  createdIds?: string[];
}

export interface ToolTrace {
  inputHash?: string;
  outputHash?: string;
  redacted: boolean;
}

export interface ProjectFlowToolResult<T = unknown> {
  status: ToolResultStatus;
  data?: T;
  error?: ToolError;
  sideEffectStatus: SideEffectStatus;
  idempotencyKey?: string;
  links?: ToolLinks;
  observation: string;
  trace: ToolTrace;
}

/** Create a success result. */
export function successResult<T>(data: T, observation: string, links?: ToolLinks): ProjectFlowToolResult<T> {
  return {
    status: "success",
    data,
    sideEffectStatus: "no_side_effect",
    observation,
    trace: { redacted: false },
    ...(links ? { links } : {}),
  };
}

/** Create a blocked result (policy denied). */
export function blockedResult(reason: string): ProjectFlowToolResult {
  return {
    status: "blocked",
    sideEffectStatus: "no_side_effect",
    error: {
      code: "POLICY_DENIED",
      message: reason,
    },
    observation: `操作被拒绝: ${reason}`,
    trace: { redacted: true },
  };
}

/** Create a failed result. */
export function failedResult(code: string, message: string, details?: unknown): ProjectFlowToolResult {
  return {
    status: "failed",
    sideEffectStatus: "unknown",
    error: { code, message, details },
    observation: `操作失败: ${message}`,
    trace: { redacted: false },
  };
}

/** Create a timeout result. */
export function timeoutResult(toolName: string, timeoutMs: number): ProjectFlowToolResult {
  return {
    status: "timeout",
    sideEffectStatus: "unknown",
    error: {
      code: "TOOL_TIMEOUT",
      message: `工具 ${toolName} 执行超时 (${timeoutMs}ms)`,
    },
    observation: `工具执行超时`,
    trace: { redacted: false },
  };
}
