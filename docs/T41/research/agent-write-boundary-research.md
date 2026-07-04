# Agent Write Boundary Research

Date: 2026-07-04

Scope: ProjectFlow T41 Agent Runtime write boundary. This note is based only on first-party repo sources: current backend/frontend code, models, schemas, tests, ADR, and T41 design docs.

## Core Conclusion

LLM-callable tools should not be allowed to directly write the database in the sense of owning SQL sessions, bypassing FastAPI services, or committing primary project facts. The T41 runtime boundary is explicit: FastAPI/DB remains the fact source and commit authority, while sidecar/runtime tools call typed FastAPI internal endpoints only (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:18, docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:226, docs/T41/ProjectFlow_Agent_Runtime_Team_TDD.md:428).

LLM-callable tools may create narrow, reviewable, or runtime-owned records through FastAPI:

- runtime metadata: AgentConversation, AgentMessage, AgentRun, AgentEvent, AgentRunState/tool events;
- pending proposal records: AgentProposal for clarify/plan/breakdown/replan;
- typed draft proposal records: AssignmentProposal, because final Task owner is still human-confirmed;
- any-severity advisory records such as Risk and ActionCard, if docs explicitly classify them as non-primary advisory records and the endpoint is idempotent.

They must not directly commit Primary Project State. In current code, the clearest violation is `CheckInAnalysisOutput` writing `TaskStatusUpdate` and mutating `Task.status` directly from the Agent flow; that can also trigger stage auto-advance (backend/app/services/agent_flow_service.py:154, backend/app/services/task_service.py:71, backend/app/services/task_service.py:78). That path should move behind the existing replan proposal confirmation path.

Decision update after review: Risk severity alone does not make Risk creation a Primary Project State commit. High-severity Risk may still be created directly as an advisory record; only mitigation that changes task status, ownership, dates, stages, or project state requires proposal confirmation.

Decision update after review: Agent-inferred task status changes should not introduce `TaskStatusChangeProposal`; they should be bundled into the existing `replan` AgentProposal. Human-originated status updates can still use the public status-update API directly.

## Evidence From T41 / ADR

The accepted ADR says the current human confirmation boundary is AgentProposal confirmation: LLM-callable tools may read, analyze, and create pending proposals, but not perform open-world, destructive, or direct-commit actions (docs/adr/0001-agent-runtime-confirmation-boundary.md:5). Tool approval is only a future extension for external or real-user effects (docs/adr/0001-agent-runtime-confirmation-boundary.md:7).

The runtime foundation says the Agent base keeps FastAPI/DB as the fact source and commit center (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:18), and the base does not directly access DB or mutate project business state (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:22). Sidecar must not hold DB credentials and only calls FastAPI internal APIs (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:57).

T41's transaction boundary is FastAPI: sidecar does not directly create proposal, AgentEvent, or business objects; tool success is valid only after FastAPI persistence (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:224, docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:231). It also says unknown side-effect status cannot auto-fallback (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:233).

The policy table allows `draft_only` tools to create proposals, blocks `internal_write` unless sidecar-only, and blocks destructive/open-world/human-triggered-only tools (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:420). The same section says models can create proposals or request tool approval, but cannot confirm/reject/commit proposals (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:442).

Tools & Skills design forbids `commit_project_state` and `confirm_proposal` as tools (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:38). It also states LLM-callable manifests cannot have commit effect type (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:139), and LLM-callable tool results should not return `commit_persisted` (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:407).

The tool-specific rules already draw the intended boundary:

- direction/stage/task proposal tools create AgentProposal and do not commit project state (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:261, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:282, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:295);
- assignment recommendation must not directly write `task.owner_user_id` (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:307);
- risk/check-in analysis may write Risk/ActionCard through FastAPI service, but must not directly modify task status (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:324, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:326);
- confirm/reject/commit, direct task update, direct stage update, and direct assignment overwrite are human-triggered APIs, not LLM-callable tools (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:343).

## Working Definition: Primary Project State

Use this distinction in T41 docs and code:

- Primary Project State: facts that define the current project plan/execution truth and drive downstream WorkspaceState decisions: `Project.direction_card`, `Project.status`, `Project.current_stage_id`, Stage rows/dates/status, Task rows/status/owner/due date/cut flag, and finalized task assignment ownership.
- Reviewable Draft Records: durable proposals whose payload can become Primary Project State only after human confirmation, such as AgentProposal and AssignmentProposal.
- Advisory Project Records: durable, user-visible Agent outputs that annotate or guide work but do not themselves rewrite plan/task facts, such as Risk and ActionCard. These still belong to FastAPI/DB, but are not commits to the plan.
- Runtime Metadata: conversation, run, event, trace, and tool-result records used for observability/replay, not business commitments.

T41 currently says `Project/Stage/Task/Member/Risk` are FastAPI/DB-owned state (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:529). That is correct for ownership, but not precise enough for confirmation policy. Risk is persistent project state, but should be documented separately from Stage/Task/owner commits.

## Current Agent Direct Write Inventory

| Write | Current write path | Changes Primary Project State? | Reviewable / reversible? | Existing confirmation chain | Boundary judgment |
|---|---|---:|---|---|---|
| AgentEvent | `generate_structured_output()` logs AgentEvent with input/output snapshots before `agent_flow_service` persists outputs (backend/app/agent/workflow.py:119, backend/app/agent/workflow.py:315). Confirmation also writes a confirmation AgentEvent (backend/app/services/agent_proposal_service.py:107). Model fields include snapshots, summary, `user_confirmed` (backend/app/models/timeline.py:11). | No. Runtime/product timeline metadata. | Reviewable in timeline; no undo needed, but should be append-only/idempotent in new runtime. | None; event append is runtime persistence. | Allow direct FastAPI write. Must be runtime metadata, bounded, redacted, idempotent. |
| AgentConversation / AgentMessage | Conversation is created if missing (backend/app/services/agent_conversation_service.py:72). User/assistant AgentMessage are added and committed around a turn (backend/app/services/agent_conversation_service.py:141, backend/app/services/agent_conversation_service.py:206). Model stores structured payload and linked event/proposal IDs (backend/app/models/agent_conversation.py:23). | No. Conversation state, not project facts. | Reviewable transcript; no business rollback. | None. | Allow direct FastAPI write as runtime metadata. |
| AgentRun | Conversation service creates AgentRun after selected module execution, linking event/proposal and model/attempts (backend/app/services/agent_conversation_service.py:184). Model stores run status, model, attempts, event/proposal links (backend/app/models/agent_conversation.py:47). | No. Runtime metadata. | Reviewable; should be idempotent in new runtime. | None. | Allow direct FastAPI write as runtime metadata. |
| AgentProposal | `DirectionCardOutput`, `StagePlanOutput`, `TaskBreakdownOutput`, and `ReplanOutput` create pending AgentProposal (backend/app/services/agent_flow_service.py:82, backend/app/services/agent_flow_service.py:87, backend/app/services/agent_flow_service.py:92, backend/app/services/agent_flow_service.py:175). Model has status, payload, confirmed fields, rejection reason (backend/app/models/agent_proposal.py:10). | Pending record does not. Confirming does. | Reviewable via payload; reject stores reason; confirmed proposals are not automatically undoable. | `/agent-proposals/{id}/confirm|reject` public API (backend/app/api/routes_agent_proposals.py:64, backend/app/api/routes_agent_proposals.py:78). Confirm persists by type (backend/app/services/agent_proposal_service.py:82). Tests assert unconfirmed clarify/plan/breakdown do not mutate project/stages/tasks (backend/app/tests/test_agent_proposal_confirm.py:114, backend/app/tests/test_agent_proposal_confirm.py:170, backend/app/tests/test_agent_proposal_confirm.py:279). | Allow as draft/proposal write. This is the main boundary. |
| AgentProposal confirmation: clarify | `_persist_clarification()` writes `Project.direction_card` and `updated_at` (backend/app/services/agent_proposal_service.py:156). | Yes. Direction card becomes project truth. | Human-confirmed; no explicit undo. | AgentProposal confirm API. | Must remain human-triggered only. |
| AgentProposal confirmation: plan | `_persist_stage_plan()` creates Stage rows, may set first new stage active and update project status/current stage (backend/app/services/agent_proposal_service.py:176, backend/app/services/agent_proposal_service.py:210). | Yes. Stage plan/current stage/project status. | Human-confirmed; no explicit undo. | AgentProposal confirm API. | Must remain human-triggered only. |
| AgentProposal confirmation: breakdown | `_persist_task_breakdown()` creates Task rows (backend/app/services/agent_proposal_service.py:219). | Yes. Task list. | Human-confirmed; no explicit undo. | AgentProposal confirm API. | Must remain human-triggered only. |
| AgentProposal confirmation: replan | `_persist_replan()` delegates to `confirm_replan()` (backend/app/services/agent_proposal_service.py:245). `confirm_replan()` changes Stage dates, Task title/status/owner/due/can_cut, and creates ActionCards (backend/app/services/replan_service.py:25, backend/app/services/replan_service.py:36, backend/app/services/replan_service.py:69). | Yes. Stage/Task facts and possibly owner/status. | Human-confirmed; guard prevents changing owner on finalized assignment (backend/app/services/replan_service.py:40). | AgentProposal confirm API. Tests assert replan first creates pending proposal, then confirm applies changes (backend/app/tests/test_replan_proposal_flow.py:70, backend/app/tests/test_replan_proposal_flow.py:86). | Must remain human-triggered only. |
| AssignmentProposal | AssignmentRecommendationOutput creates AssignmentProposal rows, not Task owner (backend/app/services/agent_flow_service.py:97). Service validates relationships, rejects already-owned tasks, and stores status `proposed` (backend/app/services/assignment_service.py:28, backend/app/services/assignment_service.py:99). Model stores recommended/backup owner, reasons, status, `created_by_agent` (backend/app/models/assignment.py:7). | Not canonical owner yet, but it is a visible workflow fact and blocks duplicate proposals. | Reviewable by recommended owner; accept/reject creates AssignmentResponse. | Recommended owner response API, then finalize API writes Task owner (backend/app/api/routes_assignments.py:80, backend/app/api/routes_assignments.py:97). Service only writes owner on finalize (backend/app/services/assignment_service.py:218). Test proves task owner remains null until finalize (backend/app/tests/test_assignment_flow.py:78, backend/app/tests/test_assignment_flow.py:105, backend/app/tests/test_assignment_flow.py:108). | Allow as typed draft proposal write. Document it as Proposal-Confirm, but not generic AgentProposal. |
| AssignmentResponse / AssignmentNegotiation | Human response changes AssignmentProposal to owner_confirmed/owner_rejected and creates response (backend/app/services/assignment_service.py:164). Rejection can create AssignmentNegotiation (backend/app/services/assignment_service.py:272). | Response is workflow state; not task owner. Negotiation is workflow state. | Human-authored response; negotiation can guide next steps. | Human-triggered assignment APIs. | Not LLM-callable direct commit. Agent negotiation output currently timeline-only (backend/app/services/agent_flow_service.py:127). |
| ActionCard | ActivePushOutput directly creates ActionCard rows with `created_by_agent=True` (backend/app/services/agent_flow_service.py:131). Service writes card with status active (backend/app/services/action_card_service.py:9). Model is persistent and linked to project/stage/task/user (backend/app/models/action_card.py:7). | No Stage/Task/Project fact change, but it changes visible project action queue. | User can mark done/dismissed (backend/app/services/action_card_service.py:39); frontend exposes done/dismiss (frontend/src/app/workspaces/[workspaceId]/page.tsx:650). No pre-write confirmation. | None before creation; artifact is `draft` and only locally dismissible in chat (backend/app/services/agent_conversation_service.py:873, frontend/src/components/project/agent-conversation-cards.tsx:259). | Allow only if classified as advisory direct write with idempotency. Otherwise convert to proposal. |
| Risk | RiskAnalysisOutput and CheckInAnalysisOutput directly create Risk rows (backend/app/services/agent_flow_service.py:170, backend/app/services/agent_flow_service.py:172). Service requires evidence and dedups open/accepted task+type risks (backend/app/services/risk_service.py:11, backend/app/services/risk_service.py:20). Model is persistent with severity/status (backend/app/models/risk.py:7). | Does not rewrite task/stage/project facts, but changes project risk ledger. | User can accept/ignore/resolve (backend/app/services/risk_service.py:58); frontend exposes accept/ignore/resolve (frontend/src/app/workspaces/[workspaceId]/page.tsx:647). No pre-write confirmation. | None before creation; risk artifact is `draft` (backend/app/services/agent_conversation_service.py:860). | Risk of any severity can be an advisory direct write; mitigation that changes Primary Project State must be proposal-confirmed. |
| TaskStatusUpdate / Task.status | CheckInAnalysisOutput creates TaskStatusUpdate for each task update (backend/app/services/agent_flow_service.py:154). `create_status_update()` also mutates `Task.status` and can run `try_advance_stage()` when done (backend/app/services/task_service.py:59, backend/app/services/task_service.py:71, backend/app/services/task_service.py:78). Model shows TaskStatusUpdate is history while Task.status is current task fact (backend/app/models/task.py:7, backend/app/models/task.py:32). | Yes. Current task status and possibly stage/project progression. | Human public API exists, but Agent path has no proposal confirmation or undo. | Human route `/tasks/{task_id}/status-updates` exists (backend/app/api/routes_tasks.py:103); Agent path bypasses human confirmation. | Must change. Agent should not directly commit Task.status. |

## Frontend Confirmation / Artifact Evidence

Backend artifact schema supports `proposal`, `risk_analysis`, and `action_card`, with statuses including `draft` and `pending_confirmation` (backend/app/schemas/agent_conversation.py:86).

Conversation service maps AgentProposal to `proposal` artifact and converts pending proposal status to `pending_confirmation` (backend/app/services/agent_conversation_service.py:889). It maps risk and push results to `risk_analysis` / `action_card` artifacts with status `draft` (backend/app/services/agent_conversation_service.py:860, backend/app/services/agent_conversation_service.py:873).

Frontend only renders “确认应用” when `artifact.type === "proposal"` and the artifact is pending confirmation (frontend/src/components/project/agent-conversation-cards.tsx:223). Non-proposal draft artifacts only get a dismiss-style “知道了” action (frontend/src/components/project/agent-conversation-cards.tsx:259). Workspace page confirms only proposal artifacts by calling `confirmAgentProposal()` (frontend/src/app/workspaces/[workspaceId]/page.tsx:452). Main AgentProposalPanel also says Agent suggestions are applied only after confirmation (frontend/src/components/agent/agent-proposal-panel.tsx:372).

This means current UI cannot provide real confirmation for Risk/ActionCard direct writes. By the time the user sees those artifacts, the rows already exist.

## Current Mismatches To Adjust

1. `CheckInAnalysisOutput.task_updates` directly commits Task.status.
   The T41 tool design says risk/check-in analysis may create Risk/ActionCard but must not directly modify task status (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:324). Current Agent flow calls `create_status_update()` for task updates and that function mutates `Task.status` plus stage advancement (backend/app/services/agent_flow_service.py:154, backend/app/services/task_service.py:71, backend/app/services/task_service.py:78). This is the highest-risk mismatch.

2. High-severity risk `requires_confirmation` is misleading.
   `RiskAnalysisOutput` rejects high risks unless `requires_confirmation=True` (backend/app/agent/output_schemas.py:221), and tests lock that validator (backend/app/tests/test_agent_output_schemas.py:289). But Risk creation itself is now classified as advisory, so this flag should refer to mitigation/replan confirmation, not to whether the Risk row may be created.

3. Risk/ActionCard direct writes are not represented in ToolManifest effects.
   T41 manifest effects currently list `none`, `event_write`, `proposal_create`, and `runtime_metadata_write` (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:102). But T41 also says risk/check-in analysis may write Risk/ActionCard through FastAPI service (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:324). The docs need a named effect for advisory project record creation, or must reclassify those writes as proposal-only.

4. AssignmentProposal is a proposal but not an AgentProposal.
   This is acceptable, but the docs should say “Proposal-Confirm” includes typed domain proposal flows. Current T41 says keep assignment proposal mode if the business path already uses it and do not write `task.owner_user_id` (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:311). Code follows that, but the current manifest language mainly centers `AgentProposal`.

5. AgentFlowRead lacks new runtime side-effect metadata.
   Existing legacy flow returns `created_ids` and `proposal_id` (backend/app/services/agent_flow_service.py:59), but T41 requires terminal tool result, side effect status, idempotency key, and links (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:367). New internal tool endpoints should not reuse `AgentFlowRead` as-is.

6. Proposal creation links to the latest AgentEvent by type.
   `_create_agent_proposal()` finds the latest event ID for project/workspace/type (backend/app/services/agent_flow_service.py:214). In a tool runtime with concurrency/retry, the proposal endpoint should receive the exact `agent_event_id` or append result from the same idempotent transaction, not query “latest”.

## Option A: Strict Proposal-Only Writes

Rule: LLM-callable tools can write only runtime metadata and pending proposals. All Risk, ActionCard, AssignmentProposal, TaskStatusUpdate, and any business-visible record must be created as AgentProposal payload first.

Pros:

- Simple mental model: model creates drafts; humans commit everything.
- Strongest safety posture and closest to the ADR wording.
- No ambiguity around high-severity Risk or ActionCard.

Cons:

- Too much confirmation friction for low-value advisory outputs.
- Breaks current assignment flow unless AssignmentProposal is wrapped again in AgentProposal.
- Makes Agent feel slow for benign “生成下一步行动卡” / “分析当前风险” operations.

Cost: High. Requires new proposal types and commit handlers for risk/action cards/assignment/status updates, plus frontend preview/confirmation UI.

UX impact: Safest but noisy. Users must confirm many low-stakes artifacts before they are useful.

## Option B: Tiered Write Boundary

Rule: LLM-callable tools can write through FastAPI only in three buckets:

- Runtime metadata: AgentEvent, AgentRun, AgentMessage, AgentRunState/tool result.
- Reviewable draft records: AgentProposal and typed AssignmentProposal.
- Advisory direct records: Risk of any severity and ActionCard, with idempotency, created IDs, user-visible dismiss/resolve/done controls, and no mutation of Project/Stage/Task canonical facts.

Primary Project State commits still require human-triggered confirmation: AgentProposal confirm, Assignment finalize, or public human task/status actions. TaskStatusUpdate generated by Agent becomes a replan proposal, not a direct write. Risk of any severity can be recorded directly as advisory; Risk mitigation that changes status/owner/date/stage/project state must produce an AgentProposal/replan proposal.

Pros:

- Matches most current code and T41 intent.
- Keeps UX fast for low-stakes advisory artifacts.
- Preserves strong boundary for Project/Stage/Task/owner/status commits.
- Lets AssignmentProposal stay as the existing domain-specific confirmation flow.

Cons:

- Requires precise terminology and tests; otherwise “Risk is DB state” can be misunderstood.
- Needs a new ToolManifest effect/status for advisory writes.
- Requires special handling for high-severity risk and task status changes.

Cost: Medium. Main code changes are check-in task updates, high-risk mitigation confirmation handling, advisory effect typing/idempotency, and tests.

UX impact: Balanced. Users see useful Risk/ActionCard outputs immediately, but high-impact facts still wait for confirmation.

## Option C: Tool Approval Before Write

Rule: Allow tools to write Risk/ActionCard/TaskStatusUpdate only after tool approval before execution.

Pros:

- General mechanism can handle any side-effecting tool.
- Prevents unwanted writes before they occur.

Cons:

- Conflicts with the accepted ADR for current runtime, which keeps ToolExecutionApproval out of the current first-class state and uses AgentProposal confirmation as the human boundary (docs/adr/0001-agent-runtime-confirmation-boundary.md:5).
- Poor UX for contentful outputs: users approve a tool call before seeing the concrete payload.
- More complex resume/state machinery.

Cost: High. Requires approval state, paused runs, resume, frontend approval UI, and sidecar/FastAPI state persistence.

UX impact: Interruptive. Better for external/open-world actions than ProjectFlow internal planning facts.

## Option D: Keep Legacy Direct Writes

Rule: Preserve current Agent flow behavior. Add manifest labels but keep direct Risk, ActionCard, AssignmentProposal, and TaskStatusUpdate writes.

Pros:

- Lowest short-term cost.
- Existing tests mostly continue passing.
- Current demo behavior remains unchanged.

Cons:

- Violates T41 “do not directly modify task status”.
- Makes `requires_confirmation` misleading for high-severity risk.
- Creates hidden commits from Agent conversation, especially stage auto-advance through `Task.status=done`.
- Does not provide idempotency/side-effect status required by T41.

Cost: Low now, high later.

UX impact: Fast but unsafe; users may discover after the fact that Agent changed task state.

## Recommended Option

Use Option B: Tiered Write Boundary.

Reasoning:

- It respects the hard boundary that LLM-callable tools cannot commit Project/Stage/Task/owner/status facts.
- It does not overcorrect by forcing every advisory artifact through AgentProposal.
- It matches current assignment architecture: AssignmentProposal is already a typed proposal with human response/finalize before owner commit.
- It leaves Risk/ActionCard useful as immediate advisory records, while closing the mitigation and task-status gaps.
- It gives the new runtime a clean ToolManifest model: `proposal_create` for draft records, `runtime_metadata_write` for run/event/message state, and a new advisory write effect for Risk/ActionCard.

## Concrete Adjustment List

Backend/service:

- Change Agent-generated `CheckInAnalysisOutput.task_updates` so it does not call `create_status_update()` directly. Store inferred status changes in the existing replan proposal payload. Human public status updates can keep using `/tasks/{task_id}/status-updates`.
- Reinterpret or rename high-severity `RiskAnalysisOutput.requires_confirmation` so it means mitigation/replan confirmation is required, not Risk-row creation confirmation.
- Keep Risk direct writes only if they are advisory records with idempotent dedup and linked created IDs.
- Keep ActionCard direct writes only if docs classify them as advisory records, not task commits. If ActionCard is used as a task-like obligation, move it to proposal.
- Keep AssignmentProposal direct creation, but make manifest/result language say this is `assignment_proposal_create`, not task owner commit.
- Add idempotency and exact event/proposal links to new internal tool endpoints; do not find “latest AgentEvent” by type under concurrency.
- Return T41-style `ProjectFlowToolResult` from internal tool endpoints, including `side_effect_status`, `idempotency_key`, `links.agent_event_id`, `links.proposal_id`, and `links.created_ids`.

Frontend:

- Keep proposal artifact confirmation as-is for AgentProposal.
- Add explicit UI semantics for advisory Risk/ActionCard: “已记录，可忽略/解决/完成”, not “草稿” if already persisted.
- If high-risk mitigation becomes pending, render the mitigation proposal with a confirmation action or route it to AgentProposalPanel.
- Do not present Risk/ActionCard artifact dismiss as if it undoes persistence unless it actually calls status update.

Tests:

- Add a regression test that Agent check-in analysis does not mutate `Task.status` before confirmation.
- Add a high-risk analysis test proving Risk creation remains advisory while any proposed mitigation that changes Primary Project State is not committed without confirmation.
- Add idempotency tests for advisory Risk/ActionCard creation.
- Add parity tests that AssignmentProposal creation still leaves `Task.owner_user_id` unchanged until finalize.

## Documentation Terms / Rules To Update

Add these terms to T41 docs:

- Primary Project State: Project direction/status/current stage, Stage rows/dates/status, Task rows/status/owner/due/cut flag, finalized assignment ownership.
- Reviewable Draft Record: AgentProposal and typed domain proposals such as AssignmentProposal.
- Advisory Project Record: Risk and ActionCard records created for guidance, not commits to the plan.
- Runtime Metadata: AgentConversation, AgentMessage, AgentRun, AgentRunState, AgentEvent, tool result/trace.
- Commit Effect: any write that changes Primary Project State; forbidden for LLM-callable tools.
- Advisory Write Effect: FastAPI-owned, idempotent write of Risk/ActionCard with created IDs and user-visible dismissal/resolution controls.

Update rules:

- “LLM-callable tools may write DB” should be replaced with “LLM-callable tools may request FastAPI-owned, manifest-declared writes in approved buckets; they never own DB sessions and never commit Primary Project State.”
- `commit_persisted` remains human-triggered only.
- `proposal_create` includes generic AgentProposal and typed proposal records; specify `agent_proposal_create` vs `assignment_proposal_create` if needed.
- `analyze_checkins_and_risks` must say: Risk/ActionCard advisory writes are allowed only for non-primary effects; Task.status changes are proposal-only.
- High-severity Risk with `requires_confirmation=true` must route Primary Project State mitigation through a concrete confirmation lifecycle, not block advisory Risk creation.
