---
name: projectflow-mvp
description: "ProjectFlow MVP active project agent loop for student teams"
status: active
created: 2026-05-28T13:58:36Z
---

# PRD: projectflow-mvp

## Executive Summary

ProjectFlow MVP is a local-first web app for college project teams. It helps a 3-8 person team move from a vague project idea to an executable plan, stage tasks, task ownership, check-ins, risk analysis, replanning, and next action cards.

The MVP must prove that the core value is active project propulsion, not another passive task board. The demo path must show that the agent reads workspace state, explains its suggestions, waits for human confirmation on high-impact proposals, and reacts to state changes after work starts.

Canonical source documents:
- `docs/PRD-ProjectFlow-MVP.md`
- `docs/TECH-DESIGN.md`

## Problem Statement

Student project teams usually do not fail because they lack a place to record tasks. They fail because they lack a stable mechanism that keeps the project executable after ideas, availability, blockers, and deadlines change.

ProjectFlow must answer these questions continuously:
- What direction should this project take now?
- What should happen next?
- Who is suited to own each task?
- Which risks are visible from the current state?
- What should be cut, reassigned, or delayed?

## User Stories

### Project lead

As a project lead, I want to create a lightweight workspace, invite members, input the project idea, deadline, deliverables, and supporting resources, so that the team has one shared state for the agent to reason over.

Acceptance criteria:
- The lead can create or select a lightweight user identity.
- The lead can create one demo workspace.
- The lead can invite or simulate invited members joining.
- The lead can create one project with idea, deadline, deliverables, and resource text/link/file metadata.

### Team member

As a team member, I want to provide my skills, availability, interests, and constraints, so that task recommendations reflect my real situation.

Acceptance criteria:
- A member can create or select a lightweight identity.
- A member can join the workspace.
- A member can submit a profile containing skills, weekly availability, preferred role, interests, and constraints.
- The agent can read member profiles from WorkspaceState.

### Team planning

As a project team, we want the agent to ask clarification questions, generate a direction card, produce stages, and break down current-stage tasks, so that the team can quickly move from vague idea to executable work.

Acceptance criteria:
- The agent can generate clarification questions.
- The agent can generate a direction card with target user, problem, goal, deliverables, boundaries, and risks.
- The agent can generate 3-5 stages with goals, time ranges, deliverables, and completion criteria.
- The agent can break a stage into tasks with priority, suggested due date, dependencies, and cut/delay markers.
- Direction card, stage plan, and task breakdown require human confirmation before final state changes.

### Assignment coordination

As a project team, we want the agent to recommend owners and backup owners, allow members to accept or reject, support one lightweight swap negotiation, and require final confirmation, so that assignments are explainable and not finalized prematurely.

Acceptance criteria:
- Each recommended assignment includes owner, backup owner, and reason.
- Assignment proposals are bound to a stage.
- A member can accept or reject a proposal.
- A rejected member can indicate a preferred task.
- The system can create a lightweight negotiation or swap proposal.
- Only the project lead can finalize stage assignments.

### Execution and risk handling

As a project team, we want task cards, active push suggestions, check-ins, risk cards, and replanning suggestions, so that the project stays executable after status changes.

Acceptance criteria:
- Each member can see personal task cards with goal, starter advice, completion criteria, due date, and reason.
- The team can see next action cards.
- The lead can set a lightweight check-in cadence.
- Members can submit what they did, blockers, and next-cycle availability.
- Members can manually update task status.
- The agent can identify at least 3 risk categories.
- Replan suggestions include reason, evidence, impact, before/after, and require confirmation.

## Functional Requirements

1. Provide lightweight account creation or identity selection for demo users.
2. Provide one-workspace, one-project MVP flow.
3. Support workspace membership and simple invitation simulation.
4. Collect member profiles with skills, availability, preferences, interests, and constraints.
5. Capture project intake with idea, deadline, deliverables, and resources.
6. Maintain WorkspaceState across users, workspace, project, stages, tasks, assignments, check-ins, risks, action cards, and timeline events.
7. Implement deterministic backend services for persistence, state transition, confirmation, and validation.
8. Implement a single Coordinator Agent with structured Pydantic outputs.
9. Keep agent suggestions as proposals until deterministic services commit confirmed state.
10. Implement clarification, planning, breakdown, assignment recommendation, assignment negotiation, active push, check-in analysis, risk analysis, and replanning modules.
11. Provide frontend screens for onboarding, workspace, project intake, dashboard, plan board, assignment flow, action cards, check-in, risk/replan, agent timeline, and export.
12. Include loading, empty, error, and success states for core UI surfaces.
13. Include seed data, reset flow, and review summary export for a stable demo.

## Non-Functional Requirements

- Local demo first: Next.js frontend, FastAPI backend, SQLite database.
- No production authentication, OAuth, multi-workspace support, or external integrations in MVP.
- All LLM calls go through the backend.
- API keys stay in `.env` and never enter source, commits, or logs.
- Agent outputs must be structured and Pydantic-validated.
- Agent failures must fall back through JSON repair, retry, template fallback, and timeline logging.
- The main demo should be explainable within 5 minutes.
- Backend routes must stay thin; business logic belongs in services.
- Frontend API calls belong in `frontend/src/lib/api.ts`.
- Frontend types belong in `frontend/src/lib/types.ts` and should stay aligned with backend schemas.

## Success Criteria

- By 2026-06-01, the local app can run the initial MVP loop from project intake to next action cards.
- By 2026-06-07, the demo can run stably without crashes or dead ends.
- The demo shows at least one active push scenario.
- The demo shows at least one blocker or availability-change scenario that triggers risk analysis and replanning.
- Assignment recommendation, risk detection, and replanning each include explicit reasons.
- The implementation is not a static fake page and not a passive task list.

## Constraints & Assumptions

- MVP scope is one team, one workspace, one active project.
- Lightweight account identity is enough; no password or OAuth.
- Resource uploads can be stored as text/link/file metadata only.
- SQLite is acceptable for local demo.
- The agent is a single Coordinator Agent; no multi-agent architecture.
- LangGraph is optional and should not be introduced unless it clearly reduces complexity after the deterministic workflow is stable.
- High-risk suggestions wait for human confirmation.
- The current primary source docs are already drafted and remain the product/technical source of truth.

## Out of Scope

- GitHub, Feishu, calendar, or other external integrations.
- Multiple workspaces or enterprise project management features.
- Production authentication, RBAC, billing, deployment, or commercial launch.
- Mentor-facing deep collaboration.
- Complex document parsing for PDF/Word uploads.
- Multi-agent orchestration.

## Dependencies

- Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, and Framer Motion for frontend.
- FastAPI, SQLModel, Pydantic, and SQLite for backend.
- LLM provider adapter with `LLM_PROVIDER` and provider-specific API key in `.env`.
- Demo seed data and reset support to make the review path deterministic.
