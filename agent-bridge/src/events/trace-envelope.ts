/**
 * Trace envelope — run/tool/proposal correlation.
 * Records trace metadata without secrets.
 */

import { hashValue as sharedHashValue } from "@/utils/hash.js";

export interface TraceEnvelopeData {
  runId: string;
  toolCallId?: string;
  toolName?: string;
  proposalId?: string;
  spans: TraceSpan[];
  attributes: Record<string, unknown>;
  includeSensitiveData: boolean;
}

export interface TraceSpan {
  name: string;
  startMs: number;
  endMs?: number;
  attributes?: Record<string, unknown>;
}

export class TraceEnvelope {
  private readonly data: TraceEnvelopeData;
  private spans: TraceSpan[] = [];

  constructor(data: TraceEnvelopeData) {
    this.data = data;
  }

  /** Start a new span. */
  startSpan(name: string, attributes?: Record<string, unknown>): TraceSpan {
    const span: TraceSpan = {
      name,
      startMs: Date.now(),
      attributes,
    };
    this.spans.push(span);
    return span;
  }

  /** End a span. */
  endSpan(span: TraceSpan, attributes?: Record<string, unknown>): void {
    span.endMs = Date.now();
    if (attributes) {
      span.attributes = { ...span.attributes, ...attributes };
    }
  }

  /** Hash a value for trace (delegates to shared utility). */
  hashValue(value: unknown): string {
    return sharedHashValue(value);
  }

  /** Build the trace output for inclusion in events/results. */
  toTraceSummary(): {
    run_id: string;
    tool_call_id?: string;
    tool_name?: string;
    proposal_id?: string;
    spans: Array<{
      name: string;
      start_ms: number;
      end_ms?: number;
      duration_ms?: number;
      attributes?: Record<string, unknown>;
    }>;
  } {
    return {
      run_id: this.data.runId,
      ...(this.data.toolCallId ? { tool_call_id: this.data.toolCallId } : {}),
      ...(this.data.toolName ? { tool_name: this.data.toolName } : {}),
      ...(this.data.proposalId ? { proposal_id: this.data.proposalId } : {}),
      spans: this.spans.map((s) => ({
        name: s.name,
        start_ms: s.startMs,
        end_ms: s.endMs,
        duration_ms: s.endMs ? s.endMs - s.startMs : undefined,
        ...(s.attributes ? { attributes: s.attributes } : {}),
      })),
    };
  }

  /** Build wire-format trace for ProjectFlowToolResult. */
  toResultTrace(inputHash?: string, outputHash?: string): {
    input_hash?: string;
    output_hash?: string;
    redacted: boolean;
  } {
    return {
      ...(inputHash ? { input_hash: inputHash } : {}),
      ...(outputHash ? { output_hash: outputHash } : {}),
      redacted: !this.data.includeSensitiveData,
    };
  }
}

/** Create a trace envelope for a tool call. */
export function createToolTrace(
  runId: string,
  toolCallId: string,
  toolName: string,
  includeSensitiveData: boolean = false,
): TraceEnvelope {
  return new TraceEnvelope({
    runId,
    toolCallId,
    toolName,
    spans: [],
    attributes: {},
    includeSensitiveData,
  });
}

/** Create a trace envelope for a run. */
export function createRunTrace(
  runId: string,
  includeSensitiveData: boolean = false,
): TraceEnvelope {
  return new TraceEnvelope({
    runId,
    spans: [],
    attributes: {},
    includeSensitiveData,
  });
}
