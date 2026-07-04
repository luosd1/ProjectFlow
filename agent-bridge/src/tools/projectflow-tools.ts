/**
 * ProjectFlow read-only tool definitions.
 * These tools allow the Agent to query workspace state, conversation history,
 * pending proposals, and timeline events without modifying any state.
 *
 * All tools call existing FastAPI public API endpoints via FastapiClient.getPublic().
 */

import type { ProjectFlowToolManifest } from "@/types/tool-manifest.js";
import type { FastapiClient } from "./fastapi-client.js";
import type { RegisteredTool, ToolExecutionContext } from "./registry.js";

// ─── Shared manifest defaults for read-only tools ────────────────────────────

const READ_ONLY_DEFAULTS = {
  schemaVersion: 1,
  version: 1,
  riskCategory: "read_only" as const,
  modelCallable: true,
  sidecarOnly: false,
  humanTriggeredOnly: false,
  annotations: {
    readOnly: true,
    destructive: false,
    idempotent: true,
    openWorld: false,
  },
  execution: {
    mode: "parallel" as const,
    maxConcurrency: 4,
    providerParallelToolCallsAllowed: true,
  },
  timeoutMs: 30000,
  retry: {
    maxAttempts: 2,
    retryOn: ["timeout", "network_error"],
  },
  resultLimit: {
    maxBytes: 65536,
    redaction: "none" as const,
  },
  effects: {
    effectType: "none" as const,
    idempotencyKeyRequired: false,
    replaySafe: true,
  },
  privacy: {
    dataClassification: "project_sensitive" as const,
    traceIncludeInputs: false,
    traceIncludeOutputs: false,
  },
  errors: {
    modelVisibleErrorPolicy: "normalized_summary" as const,
  },
  resume: {
    manifestVersion: 1,
    incompatibleVersionPolicy: "regenerate" as const,
  },
  trace: {
    emits: ["tool.started", "tool.completed"],
  },
};

// ─── Tool: get_workspace_state ────────────────────────────────────────────────

const getWorkspaceStateManifest: ProjectFlowToolManifest = {
  ...READ_ONLY_DEFAULTS,
  name: "get_workspace_state",
  description: "读取当前工作区的完整状态，包括成员、项目、阶段、任务、分工、签到和资源信息。",
  inputSchema: {
    type: "object",
    properties: {
      workspace_id: { type: "string", description: "工作区 ID" },
      project_id: { type: "string", description: "项目 ID（可选，默认取最近创建的项目）" },
    },
    required: ["workspace_id"],
  },
  outputSchema: {
    type: "object",
    description: "WorkspaceStateResponse — 包含 workspace_id, workspace_name, members, project, current_date, timezone",
  },
  backend: {
    owner: "fastapi",
    endpoint: "GET /api/workspaces/{workspace_id}/state",
    method: "POST", // wire format compat; actual call is GET via getPublic
  },
};

function createGetWorkspaceStateExecutor(fastapiClient: FastapiClient) {
  return async (args: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> => {
    const workspaceId = args.workspace_id as string;
    const projectId = args.project_id as string | undefined;
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
    return fastapiClient.getPublic(`/api/workspaces/${encodeURIComponent(workspaceId)}/state${query}`);
  };
}

// ─── Tool: get_agent_conversation ─────────────────────────────────────────────

const getAgentConversationManifest: ProjectFlowToolManifest = {
  ...READ_ONLY_DEFAULTS,
  name: "get_agent_conversation",
  description: "读取当前项目的 Agent 对话历史，包括近期消息和 linked artifacts。",
  inputSchema: {
    type: "object",
    properties: {
      project_id: { type: "string", description: "项目 ID" },
    },
    required: ["project_id"],
  },
  outputSchema: {
    type: "object",
    description: "AgentConversationRead — 包含 conversation_id, project_id, messages, artifacts",
  },
  backend: {
    owner: "fastapi",
    endpoint: "GET /api/projects/{project_id}/agent-conversation",
    method: "POST",
  },
};

function createGetAgentConversationExecutor(fastapiClient: FastapiClient) {
  return async (args: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> => {
    const projectId = args.project_id as string;
    return fastapiClient.getPublic(`/api/projects/${encodeURIComponent(projectId)}/agent-conversation`);
  };
}

// ─── Tool: list_pending_proposals ─────────────────────────────────────────────

const listPendingProposalsManifest: ProjectFlowToolManifest = {
  ...READ_ONLY_DEFAULTS,
  name: "list_pending_proposals",
  description: "查询当前项目中未处理的 Agent Proposal，避免重复生成冲突方案。",
  inputSchema: {
    type: "object",
    properties: {
      project_id: { type: "string", description: "项目 ID" },
    },
    required: ["project_id"],
  },
  outputSchema: {
    type: "array",
    description: "AgentProposalRead[] — 每个包含 id, proposal_type, status, created_at, payload",
  },
  backend: {
    owner: "fastapi",
    endpoint: "GET /api/agent-proposals?project_id={project_id}&status=pending",
    method: "POST",
  },
};

function createListPendingProposalsExecutor(fastapiClient: FastapiClient) {
  return async (args: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> => {
    const projectId = args.project_id as string;
    return fastapiClient.getPublic(
      `/api/agent-proposals?project_id=${encodeURIComponent(projectId)}&status=pending`,
    );
  };
}

// ─── Tool: get_timeline_slice ─────────────────────────────────────────────────

const getTimelineSliceManifest: ProjectFlowToolManifest = {
  ...READ_ONLY_DEFAULTS,
  name: "get_timeline_slice",
  description: "读取项目近期的 AgentEvent timeline，帮助理解刚发生过什么操作和决策。支持按时间和事件类型过滤。",
  inputSchema: {
    type: "object",
    properties: {
      project_id: { type: "string", description: "项目 ID" },
      limit: { type: "number", description: "返回条数上限（默认 20）" },
      since: { type: "string", description: "只返回此时间之后的事件（ISO 8601 格式，如 2026-07-01T00:00:00Z）" },
      event_types: {
        type: "array",
        items: { type: "string" },
        description: "只返回指定类型的事件（如 agent.started, tool.completed）",
      },
    },
    required: ["project_id"],
  },
  outputSchema: {
    type: "array",
    description: "AgentEventRead[] — 每个包含 id, event_type, status, input_snapshot, output_snapshot, created_at",
  },
  backend: {
    owner: "fastapi",
    endpoint: "GET /api/projects/{project_id}/timeline",
    method: "POST",
  },
};

function createGetTimelineSliceExecutor(fastapiClient: FastapiClient) {
  return async (args: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> => {
    const projectId = args.project_id as string;
    const limit = (args.limit as number) ?? 20;
    const since = args.since as string | undefined;
    const eventTypes = args.event_types as string[] | undefined;

    const params = new URLSearchParams({ limit: String(limit) });
    if (since) params.set("since", since);
    if (eventTypes?.length) params.set("event_types", eventTypes.join(","));

    return fastapiClient.getPublic(
      `/api/projects/${encodeURIComponent(projectId)}/timeline?${params.toString()}`,
    );
  };
}

// ─── Export: all read-only tools ──────────────────────────────────────────────

export function createReadOnlyTools(fastapiClient: FastapiClient): RegisteredTool[] {
  return [
    {
      manifest: getWorkspaceStateManifest,
      execute: createGetWorkspaceStateExecutor(fastapiClient),
    },
    {
      manifest: getAgentConversationManifest,
      execute: createGetAgentConversationExecutor(fastapiClient),
    },
    {
      manifest: listPendingProposalsManifest,
      execute: createListPendingProposalsExecutor(fastapiClient),
    },
    {
      manifest: getTimelineSliceManifest,
      execute: createGetTimelineSliceExecutor(fastapiClient),
    },
  ];
}
