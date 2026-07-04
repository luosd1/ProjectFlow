/**
 * RuntimeEvent — events emitted by the sidecar during a run.
 * Mapped from Pi lifecycle events to ProjectFlow event types.
 */

import type { RunStatus } from "./run-state.js";

export type RuntimeEventType =
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "run.cancelled"
  | "tool.started"
  | "tool.completed"
  | "tool.blocked"
  | "tool.failed"
  | "model.streaming"
  | "state.changed"
  | "proposal.created"
  | "proposal.confirmed"
  | "proposal.rejected"
  | "runtime.error"
  | "agent.started"
  | "agent.status"
  | "agent.delta"
  | "agent.completed"
  | "tool.progress"
  | "advisory_record.created"
  | "proposal_confirmation.confirmed"
  | "proposal_confirmation.rejected"
  | "proposal_confirmation.committed"
  | "run.state_changed";

export interface RuntimeEventState {
  status: RunStatus;
  schemaVersion: number;
}

export interface RuntimeEvent {
  type: RuntimeEventType;
  runId: string;
  eventSeq: number;
  timestamp: string;
  state: RuntimeEventState;
  trace?: TraceSummary;
  payload: Record<string, unknown>;
}

export interface TraceSummary {
  runId: string;
  toolCallId?: string;
  toolName?: string;
  proposalId?: string;
  inputHash?: string;
  outputHash?: string;
}

/** Create a runtime event with defaults. */
export function createEvent(
  type: RuntimeEventType,
  runId: string,
  status: RunStatus,
  payload: Record<string, unknown> = {},
  trace?: TraceSummary,
): RuntimeEvent {
  return {
    type,
    runId,
    eventSeq: 0, // assigned by FastAPI append API
    timestamp: new Date().toISOString(),
    state: { status, schemaVersion: 1 },
    ...(trace ? { trace } : {}),
    payload,
  };
}
