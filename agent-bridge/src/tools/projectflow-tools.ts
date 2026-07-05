/**
 * ProjectFlow tool definitions.
 *
 * Read-only tools (get_workspace_state, get_agent_conversation,
 * list_pending_proposals, get_timeline_slice) allow the Agent to query
 * workspace state without modifying it.
 *
 * Proposal tools (recommend_assignment) create typed proposal records
 * without committing Primary Project State. Final owner is only written
 * by finalize_assignment_proposal (human-triggered).
 *
 * All tools go through the unified internal contract:
 *   POST /internal/agent-tools/{tool-name}
 * with a single envelope (run_id, tool_call_id, arguments, trace, ...) built by
 * createFastapiToolExecutor.
 */

import type { ProjectFlowToolManifest } from "@/types/tool-manifest.js";
import type { FastapiClient } from "./fastapi-client.js";
import type { RegisteredTool } from "./registry.js";
import { createFastapiToolExecutor } from "./registry.js";

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
    endpoint: "POST /internal/agent-tools/workspace-state",
    method: "POST",
  },
};

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
    endpoint: "POST /internal/agent-tools/conversation",
    method: "POST",
  },
};

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
    endpoint: "POST /internal/agent-tools/pending-proposals",
    method: "POST",
  },
};

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
    endpoint: "POST /internal/agent-tools/timeline-slice",
    method: "POST",
  },
};

// ─── Tool: recommend_assignment ───────────────────────────────────────────────

const recommendAssignmentManifest: ProjectFlowToolManifest = {
  schemaVersion: 1,
  version: 1,
  name: "recommend_assignment",
  description:
    "生成分工建议：为指定任务推荐负责人和备选负责人，创建 AssignmentProposal 待确认记录。不直接写入 Task.owner_user_id，需人工确认后才生效。",
  riskCategory: "draft_only",
  modelCallable: true,
  sidecarOnly: false,
  humanTriggeredOnly: false,
  annotations: {
    readOnly: false,
    destructive: false,
    idempotent: true,
    openWorld: false,
  },
  inputSchema: {
    type: "object",
    properties: {
      stage_id: { type: "string", description: "阶段 ID" },
      task_id: { type: "string", description: "任务 ID" },
      recommended_owner_user_id: { type: "string", description: "推荐负责人用户 ID" },
      backup_owner_user_id: { type: "string", description: "备选负责人用户 ID（可选）" },
      reason: { type: "string", description: "推荐理由" },
      skill_match: { type: "string", description: "技能匹配说明（可选）" },
      availability_match: { type: "string", description: "时间匹配说明（可选）" },
      preference_match: { type: "string", description: "意向匹配说明（可选）" },
      constraint_respected: { type: "string", description: "限制条件遵守说明（可选）" },
      risk_note: { type: "string", description: "风险提示（可选）" },
    },
    required: ["stage_id", "task_id", "recommended_owner_user_id", "reason"],
  },
  outputSchema: {
    type: "object",
    description:
      "ProjectFlowToolResult — status=success, data=AssignmentProposalRead (id, project_id, stage_id, task_id, recommended_owner_user_id, backup_owner_user_id, reason, status, created_at), side_effect_status=proposal_persisted, links.proposal_id, links.created_ids",
  },
  backend: {
    owner: "fastapi",
    endpoint: "POST /internal/agent-tools/assignment-recommendation",
    method: "POST",
  },
  execution: {
    mode: "sequential",
    concurrencyGroup: "project_proposal_write",
    maxConcurrency: 1,
    providerParallelToolCallsAllowed: false,
  },
  timeoutMs: 30000,
  retry: {
    maxAttempts: 2,
    retryOn: ["timeout", "network_error"],
  },
  resultLimit: {
    maxBytes: 65536,
    redaction: "none",
  },
  effects: {
    effectType: "proposal_create",
    idempotencyKeyRequired: true,
    replaySafe: true,
  },
  proposalConfirmation: {
    createsProposal: true,
    requiredBeforeCommit: true,
    publicActionOnly: true,
    resumesModelLoopByDefault: false,
  },
  privacy: {
    dataClassification: "project_sensitive",
    traceIncludeInputs: false,
    traceIncludeOutputs: false,
  },
  errors: {
    modelVisibleErrorPolicy: "normalized_summary",
  },
  resume: {
    manifestVersion: 1,
    incompatibleVersionPolicy: "regenerate",
  },
  trace: {
    emits: ["tool.started", "tool.completed"],
  },
};

// ─── Export: all tools ──────────────────────────────────────────────────────

/**
 * Build all ProjectFlow tools. Each executor is produced by
 * createFastapiToolExecutor, which wraps the args in the unified
 * POST /internal/agent-tools/{name} envelope (run_id, tool_call_id,
 * arguments, trace, idempotency_key, ...).
 *
 * The tool-specific args (workspace_id, project_id, limit, since, ...)
 * are passed by the caller as `args` and arrive at the backend as
 * `arguments`.
 */
export function createReadOnlyTools(fastapiClient: FastapiClient): RegisteredTool[] {
  return [
    {
      manifest: getWorkspaceStateManifest,
      execute: createFastapiToolExecutor(fastapiClient, "workspace-state"),
    },
    {
      manifest: getAgentConversationManifest,
      execute: createFastapiToolExecutor(fastapiClient, "conversation"),
    },
    {
      manifest: listPendingProposalsManifest,
      execute: createFastapiToolExecutor(fastapiClient, "pending-proposals"),
    },
    {
      manifest: getTimelineSliceManifest,
      execute: createFastapiToolExecutor(fastapiClient, "timeline-slice"),
    },
  ];
}

/** Build proposal/write tools. */
export function createProposalTools(fastapiClient: FastapiClient): RegisteredTool[] {
  return [
    {
      manifest: recommendAssignmentManifest,
      execute: createFastapiToolExecutor(fastapiClient, "assignment-recommendation"),
    },
  ];
}
