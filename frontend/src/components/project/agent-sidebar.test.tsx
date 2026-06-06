import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  AgentArtifact,
  AgentConversation,
  AgentSuggestion,
  ProjectState,
} from "@/lib/types";
import { AgentSidebar } from "./agent-sidebar";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseProjectState: ProjectState = {
  workspace: {
    workspace_id: "ws-1",
    name: "测试工作区",
    owner_user_id: "user-1",
    description: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  },
  project: {
    id: "proj-1",
    workspace_id: "ws-1",
    name: "测试项目",
    idea: "做一个测试项目",
    deadline: "2026-07-01",
    deliverables: "演示",
    status: "active",
    current_stage_id: "stage-1",
    direction_card: {
      title: "测试方向",
      summary: "方向摘要",
      assumptions: [],
      unknowns: [],
      mvp_boundary: "",
      decision_points: [],
      source_summary: "",
    },
    created_by: "user-1",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
  },
  stages: [
    {
      id: "stage-1",
      project_id: "proj-1",
      name: "开发阶段",
      objective: "完成开发",
      time_range: "第1-2周",
      deliverables: "可运行原型",
      completion_criteria: "核心功能可用",
      order: 1,
      status: "active",
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    },
  ],
  tasks: [
    {
      id: "task-1",
      stage_id: "stage-1",
      title: "后端 API 与数据模型",
      description: "实现核心 API",
      priority: "P0",
      status: "in_progress",
      is_optional: false,
      can_skip: false,
      estimated_hours: 8,
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    },
  ],
  resources: [],
  members: [],
  member_profiles: [],
  assignment_proposals: [],
  agent_proposals: [],
  timeline: [],
};

const conversationFixture: AgentConversation = {
  id: "conv-1",
  workspace_id: "ws-1",
  project_id: "proj-1",
  status: "active",
  summary: "",
  current_focus: "执行推进",
  messages: [
    {
      id: "msg-1",
      conversation_id: "conv-1",
      role: "assistant",
      content: "现在最有效的是根据签到调整计划。",
      structured_payload: {},
      created_at: "2026-06-07T10:00:00Z",
    },
  ],
  created_at: "2026-06-07T00:00:00Z",
  updated_at: "2026-06-07T10:00:00Z",
};

const suggestionsFixture: AgentSuggestion[] = [
  {
    id: "suggestion-1",
    label: "根据签到调整计划",
    user_instruction: "根据签到调整计划",
    priority: "primary",
  },
  {
    id: "suggestion-2",
    label: "先解释风险来源",
    user_instruction: "先解释风险来源",
    priority: "secondary",
  },
];

const artifactsFixture: AgentArtifact[] = [
  {
    id: "proposal-artifact-1",
    type: "proposal",
    status: "pending_confirmation",
    title: "计划调整草案",
    summary: "建议把后端协助前置。",
    rationale: "签到显示后端阻塞。",
    impact: ["影响 3 个任务"],
    linked_entity_ids: ["proposal-1"],
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentSidebar", () => {
  it("sends suggestion clicks as user instructions", () => {
    const onSendMessage = vi.fn();

    render(
      <AgentSidebar
        state={baseProjectState}
        conversation={conversationFixture}
        conversationSuggestions={suggestionsFixture}
        onRunAgent={vi.fn()}
        onSendMessage={onSendMessage}
      />
    );

    const button = screen.getByRole("button", { name: "根据签到调整计划" });
    fireEvent.click(button);

    expect(onSendMessage).toHaveBeenCalledWith("根据签到调整计划");
  });

  it("shows pending instruction and run status while Agent is working", () => {
    render(
      <AgentSidebar
        state={baseProjectState}
        conversation={conversationFixture}
        pendingConversation
        pendingConversationInstruction="根据签到调整计划"
        onRunAgent={vi.fn()}
      />
    );

    expect(screen.getAllByText("根据签到调整计划").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Agent 正在处理")).toBeTruthy();
    expect(screen.getByText("读取项目状态")).toBeTruthy();
  });

  it("renders conversation artifacts with confirmation actions", () => {
    render(
      <AgentSidebar
        state={baseProjectState}
        conversation={conversationFixture}
        conversationArtifacts={artifactsFixture}
        onRunAgent={vi.fn()}
        onConfirmArtifact={vi.fn()}
      />
    );

    expect(screen.getByText("计划调整草案")).toBeTruthy();
    expect(screen.getByText("建议把后端协助前置。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "确认应用" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "继续修改" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "查看影响" })).toBeTruthy();
  });
});
