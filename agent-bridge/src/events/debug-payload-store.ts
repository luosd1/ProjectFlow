/**
 * Separate in-memory storage for debug raw payloads.
 * Raw prompt/tool payloads must never be embedded in default AgentEvent or tool-result payloads.
 */

export interface DebugPayloadRecord {
  id: string;
  runId: string;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  createdAt: string;
  expiresAt: string;
}

export interface DebugPayloadContext {
  runId: string;
  toolCallId?: string;
  toolName?: string;
}

export class DebugPayloadStore {
  private readonly records = new Map<string, DebugPayloadRecord>();
  private counter = 0;

  constructor(private readonly retentionMs: number = 30 * 60 * 1000) {}

  store(context: DebugPayloadContext, payload: { input?: unknown; output?: unknown }): DebugPayloadRecord {
    this.pruneExpired();
    this.counter++;
    const nowMs = Date.now();
    const record: DebugPayloadRecord = {
      id: `debug_${nowMs}_${this.counter}`,
      runId: context.runId,
      ...(context.toolCallId ? { toolCallId: context.toolCallId } : {}),
      ...(context.toolName ? { toolName: context.toolName } : {}),
      ...(payload.input !== undefined ? { input: payload.input } : {}),
      ...(payload.output !== undefined ? { output: payload.output } : {}),
      createdAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + this.retentionMs).toISOString(),
    };
    this.records.set(record.id, record);
    return record;
  }

  get(id: string): DebugPayloadRecord | undefined {
    this.pruneExpired();
    return this.records.get(id);
  }

  listByRun(runId: string): DebugPayloadRecord[] {
    this.pruneExpired();
    return Array.from(this.records.values()).filter((record) => record.runId === runId);
  }

  pruneExpired(nowMs: number = Date.now()): void {
    for (const [id, record] of this.records) {
      if (Date.parse(record.expiresAt) <= nowMs) {
        this.records.delete(id);
      }
    }
  }

  clear(): void {
    this.records.clear();
  }

  get size(): number {
    this.pruneExpired();
    return this.records.size;
  }
}

let globalDebugPayloadStore: DebugPayloadStore | undefined;

export function getDebugPayloadStore(): DebugPayloadStore {
  if (!globalDebugPayloadStore) {
    globalDebugPayloadStore = new DebugPayloadStore();
  }
  return globalDebugPayloadStore;
}
