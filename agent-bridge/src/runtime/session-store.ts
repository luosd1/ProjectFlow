/**
 * Session store — runtime session metadata only.
 * NOT for business facts (those live in FastAPI/DB).
 */

import type { AgentRunState } from "@/types/run-state.js";

export class SessionStore {
  private readonly runs = new Map<string, AgentRunState>();

  /** Store a run state. */
  set(runId: string, state: AgentRunState): void {
    this.runs.set(runId, state);
  }

  /** Get a run state by ID. */
  get(runId: string): AgentRunState | undefined {
    return this.runs.get(runId);
  }

  /** Check if a run exists. */
  has(runId: string): boolean {
    return this.runs.has(runId);
  }

  /** Remove a run. */
  delete(runId: string): boolean {
    return this.runs.delete(runId);
  }

  /** Get all active runs. */
  getActiveRuns(): AgentRunState[] {
    return Array.from(this.runs.values()).filter(
      (s) => !["completed", "cancelled", "failed"].includes(s.status),
    );
  }

  /** Get the number of stored runs. */
  get size(): number {
    return this.runs.size;
  }

  /** Clear all runs. */
  clear(): void {
    this.runs.clear();
  }
}

// Global session store instance (sidecar-internal)
let globalStore: SessionStore | undefined;

export function getSessionStore(): SessionStore {
  if (!globalStore) {
    globalStore = new SessionStore();
  }
  return globalStore;
}
