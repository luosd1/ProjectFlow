import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentProposalPanel } from "./agent-proposal-panel";
import type { AgentEvent, AgentProposal } from "@/lib/types";

describe("AgentProposalPanel", () => {
  it("shows generation status from the linked timeline event", () => {
    const proposal: AgentProposal = {
      id: "proposal-clarify",
      project_id: "project-1",
      workspace_id: "workspace-1",
      proposal_type: "clarify",
      status: "pending",
      agent_event_id: "event-clarify",
      payload: {
        problem: "方向还不够清晰。",
        users: "学生项目小队。",
        value: "确认 MVP 边界。",
        deliverables: ["方向卡"],
        boundaries: ["不扩展到生产部署"],
        risks: ["范围过大"],
        suggested_questions: ["演示必须证明什么？"],
        reason: "需要先确认方向。",
      },
      confirmed_by: null,
      confirmed_at: null,
      created_at: "2026-06-03T00:00:00Z",
    };
    const event: AgentEvent = {
      id: "event-clarify",
      project_id: "project-1",
      workspace_id: "workspace-1",
      event_type: "clarify",
      status: "fallback",
      input_snapshot: {},
      output_snapshot: {},
      reasoning_summary: "LLM 超时后使用基础建议。",
      user_confirmed: false,
      created_at: "2026-06-03T00:00:00Z",
    };

    render(<AgentProposalPanel proposals={[proposal]} timeline={[event]} />);

    expect(screen.getByText("Agent 提案")).toBeTruthy();
    expect(screen.getByText("基础建议")).toBeTruthy();
  });

  it("leaves replan proposals to the dedicated risk adjustment panel", () => {
    const replanProposal: AgentProposal = {
      id: "proposal-replan",
      project_id: "project-1",
      workspace_id: "workspace-1",
      proposal_type: "replan",
      status: "pending",
      agent_event_id: "event-1",
      payload: {
        reason: "检测到任务阻塞，需要最小调整。",
        before: { task: "Build API" },
        after: { status: "blocked" },
        impact: "仅调整一个任务。",
      },
      confirmed_by: null,
      confirmed_at: null,
      created_at: "2026-06-03T00:00:00Z",
    };

    render(<AgentProposalPanel proposals={[replanProposal]} />);

    expect(screen.queryByText("Agent 提案")).toBeNull();
    expect(screen.queryByText(/Build API/)).toBeNull();
  });
});
