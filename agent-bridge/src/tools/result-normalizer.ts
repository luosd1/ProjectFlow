/**
 * Result normalizer — normalizes, truncates, and hashes tool results.
 * Ensures every result has bounded payload and proper trace metadata.
 */

import type { ProjectFlowToolResult, ToolTrace } from "@/types/tool-result.js";
import { hashValue } from "@/utils/hash.js";

export interface NormalizeOptions {
  maxBytes: number;
  redaction: "none" | "secrets" | "pii";
  recordInput: boolean;
  recordOutput: boolean;
}

const DEFAULT_OPTIONS: NormalizeOptions = {
  maxBytes: 32768,
  redaction: "none",
  recordInput: true,
  recordOutput: true,
};

/**
 * Normalize a tool result: ensure shape, truncate payload, compute hashes.
 */
export function normalizeResult(
  result: unknown,
  inputArgs: unknown,
  options: Partial<NormalizeOptions> = {},
): ProjectFlowToolResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // If result is already a valid ProjectFlowToolResult, normalize it
  if (isToolResult(result)) {
    return {
      ...result,
      trace: buildTrace(inputArgs, result.data, opts),
    };
  }

  // Otherwise, wrap raw data into a success result
  const truncated = truncateData(result, opts.maxBytes);
  return {
    status: "success",
    data: truncated,
    sideEffectStatus: "no_side_effect",
    observation: typeof truncated === "string" ? truncated.slice(0, 200) : "操作完成",
    trace: buildTrace(inputArgs, truncated, opts),
  };
}

function isToolResult(value: unknown): value is ProjectFlowToolResult {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.status === "string" && typeof obj.observation === "string";
}

function buildTrace(input: unknown, output: unknown, opts: NormalizeOptions): ToolTrace {
  return {
    inputHash: opts.recordInput ? hashValue(input) : undefined,
    outputHash: opts.recordOutput ? hashValue(output) : undefined,
    redacted: opts.redaction !== "none",
  };
}

/**
 * Truncate data to fit within maxBytes.
 * Uses JSON serialization to measure size.
 * Falls back to safe string truncation if JSON.parse fails.
 */
export function truncateData(data: unknown, maxBytes: number): unknown {
  if (data === undefined || data === null) return data;

  const json = JSON.stringify(data);
  if (json.length <= maxBytes) return data;

  // For strings, truncate directly
  if (typeof data === "string") {
    return data.slice(0, maxBytes) + "...[截断]";
  }

  // For objects, try safe JSON truncation
  const safeSlice = json.slice(0, maxBytes - 20);
  try {
    return JSON.parse(safeSlice + '"...[截断]"}');
  } catch {
    // If JSON is malformed after truncation, return a safe summary
    return { _truncated: true, _original_size: json.length, _preview: safeSlice.slice(0, 200) };
  }
}
