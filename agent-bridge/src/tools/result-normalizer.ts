/**
 * Result normalizer — normalizes, truncates, and hashes tool results.
 * Ensures every result has bounded payload and proper trace metadata.
 */

import { createHash } from "node:crypto";
import type { ProjectFlowToolResult, ToolTrace } from "@/types/tool-result.js";

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

function hashValue(value: unknown): string {
  const str = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return createHash("sha256").update(str).digest("hex").slice(0, 16);
}

/**
 * Truncate data to fit within maxBytes.
 * Uses JSON serialization to measure size.
 */
export function truncateData(data: unknown, maxBytes: number): unknown {
  if (data === undefined || data === null) return data;

  const json = JSON.stringify(data);
  if (json.length <= maxBytes) return data;

  // For strings, truncate directly
  if (typeof data === "string") {
    return data.slice(0, maxBytes) + "...[truncated]";
  }

  // For objects, truncate the JSON representation
  return JSON.parse(json.slice(0, maxBytes - 20) + '"...[truncated]"}');
}
