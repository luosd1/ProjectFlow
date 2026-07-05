/**
 * FastAPI client — service-to-service HTTP calls to FastAPI internal endpoints.
 * The sidecar never accesses the DB directly; all persistence goes through this client.
 */

import type {
  WireRunStartRequest,
  WireRunStartResponse,
  WireRunStatusResponse,
  WireAppendRequest,
  WireAppendResponse,
  WireRunCancelRequest,
  WireRunCancelResponse,
} from "@/types/wire.js";

export interface FastapiClientConfig {
  baseUrl: string;
  serviceToken: string;
  timeoutMs?: number;
}

export class FastapiClient {
  private readonly baseUrl: string;
  private readonly serviceToken: string;
  private readonly timeoutMs: number;

  constructor(config: FastapiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.serviceToken = config.serviceToken;
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  /** Shared fetch with timeout and error handling. */
  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new FastapiError(response.status, text, url);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.serviceToken}`,
    };

    return this.fetchJson<T>(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /** Start a new agent run. */
  async startRun(request: WireRunStartRequest): Promise<WireRunStartResponse> {
    return this.request<WireRunStartResponse>("POST", "/internal/agent-runs", request);
  }

  /** Get run status. */
  async getRunStatus(runId: string): Promise<WireRunStatusResponse> {
    return this.request<WireRunStatusResponse>("GET", `/internal/agent-runs/${runId}`);
  }

  /** Append events and tool results to a run. */
  async appendEvents(runId: string, request: WireAppendRequest): Promise<WireAppendResponse> {
    return this.request<WireAppendResponse>("POST", `/internal/agent-runs/${runId}/events:append`, request);
  }

  /** Cancel a run. */
  async cancelRun(runId: string, reason?: string): Promise<WireRunCancelResponse> {
    const body: WireRunCancelRequest = { reason: reason ?? "sidecar_cancelled" };
    return this.request<WireRunCancelResponse>("POST", `/internal/agent-runs/${runId}/cancel`, body);
  }

  /**
   * Call an internal tool endpoint.
   * All tool calls go through POST /internal/agent-tools/{tool-name}.
   */
  async callTool(toolName: string, payload: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", `/internal/agent-tools/${toolName}`, payload);
  }

  /**
   * GET request to a public API endpoint (no service token).
   * Used by read-only tools that call existing public endpoints.
   */
  async getPublic<T>(path: string): Promise<T> {
    return this.fetchJson<T>(`${this.baseUrl}${path}`, { method: "GET" });
  }
}

export class FastapiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly path: string,
  ) {
    super(`FastAPI 请求失败 ${status} ${path}: ${body.slice(0, 200)}`);
    this.name = "FastapiError";
  }
}
