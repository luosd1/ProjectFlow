import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentProposalPanel } from "./agent-proposal-panel";
import type { AgentProposal } from "@/lib/types";

describe("AgentProposalPanel", () => {
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
