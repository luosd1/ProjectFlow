---
name: projectflow-mvp-usable-ready
description: Turn the current demo-ready MVP into a usable MVP with real LLM-backed Agent flows and transparent failure handling.
status: backlog
created: 2026-05-29T13:07:13Z
---

# PRD: projectflow-mvp-usable-ready

## Executive Summary

The current ProjectFlow MVP can run a local demo path, but it is not yet usable as a real Agent product. Agent actions default to `mock`, rely heavily on fallback output, and several planning outputs are logged without becoming confirmed project state. This PRD defines the next round required to make ProjectFlow "MVP Usable Ready": a student team can enter a real project, connect a real OpenAI-compatible model, run the core Agent loop, review generated proposals, confirm state changes, and understand when the Agent succeeded, repaired output, fell back, or failed.

## Problem Statement

ProjectFlow's product promise is not a static dashboard. It must actively help a student team clarify direction, plan stages, break down tasks, recommend assignments, push next actions, detect risks, and suggest replans. The current system proves the data model and UI shell, but it does not yet meet the "team can directly use it" bar because:

- Real model configuration is not validated through a product-facing path.
- Agent success and fallback states are not clearly distinguished in the UI.
- Clarification, planning, and task breakdown do not yet have a complete review/confirm path that commits useful state.
- Prompt quality has not been tested against real messy project input.
- Failure cases such as missing API key, invalid JSON, timeout, and quota/provider errors are not surfaced well enough for a user to recover.

## User Stories

### Story 1: Project owner connects a real model

As a project owner, I want the backend to use a configured OpenAI-compatible LLM provider, so Agent suggestions come from a real model rather than mock fallback.

Acceptance criteria:
- [ ] `.env.example` documents required LLM variables without exposing secrets.
- [ ] Backend startup or first Agent call reports a clear error when real provider configuration is incomplete.
- [ ] A provider health or dry-run check can verify model connectivity.
- [ ] API keys remain backend-only and are never exposed to frontend logs or responses.

### Story 2: Team runs real Agent planning

As a project owner, I want Agent clarification, stage planning, and task breakdown results to be reviewable and confirmable, so the system turns real model output into project state only after human approval.

Acceptance criteria:
- [ ] Clarification output can update the project direction card after confirmation.
- [ ] Stage planning output can create or update stages after confirmation.
- [ ] Task breakdown output can create or update tasks after confirmation.
- [ ] Confirmed state changes are recorded in Agent Timeline with reason and source event.
- [ ] Agent cannot invent members, stages, or tasks outside the validated workspace state.

### Story 3: Team sees Agent quality and failure state

As a user, I want to know whether the Agent actually succeeded, repaired output, used fallback, or failed, so I do not mistake template fallback for model intelligence.

Acceptance criteria:
- [ ] Agent action responses expose status, attempts, fallback usage, and user-facing message.
- [ ] Frontend displays `success`, `repaired`, `fallback`, and `failed` states distinctly.
- [ ] Fallback output is clearly labeled as baseline fallback.
- [ ] Failed Agent calls provide a retry path and a concise cause.
- [ ] Agent loading states show which project context is being analyzed.

### Story 4: Team gets useful recommendations from real project data

As a student team, we want assignment, active push, risk, and replan suggestions to cite skills, availability, task priority, blockers, and deadlines, so recommendations are actionable and explainable.

Acceptance criteria:
- [ ] Assignment reasons cite member skills, availability, preferences, or constraints.
- [ ] Active push cards include goal, start suggestion, due date, and reason.
- [ ] Risks include evidence from task status, check-ins, workload, dependency, or deadline.
- [ ] Replan proposals include before/after, impact, and confirmation requirement.
- [ ] Real LLM output is validated through Pydantic schemas before any persistence.

### Story 5: Maintainer can verify MVP Usable Ready

As a maintainer, I want a repeatable manual and automated verification path, so we can prove the MVP can be used beyond seed data.

Acceptance criteria:
- [ ] A real-LLM manual test script covers intake through review export.
- [ ] Automated tests cover LLM provider errors, fallback labeling, and confirm-to-persist behavior.
- [ ] Runbook documents mock mode, real provider mode, and troubleshooting.
- [ ] Final status report states exactly what is usable, what is fallback, and what remains out of scope.

## Functional Requirements

1. Add safe real-provider configuration and diagnostics for OpenAI-compatible LLMs.
2. Preserve mock mode for deterministic tests and offline demo.
3. Add explicit Agent run status/error surfaces to backend and frontend.
4. Implement confirm-to-persist behavior for direction card, stage plan, and task breakdown outputs.
5. Improve prompts and output schemas so real model suggestions cite project state and produce actionable recommendations.
6. Add frontend review panels for Agent outputs before committing state.
7. Add real-LLM manual acceptance script and update runbook/docs.

## Non-Functional Requirements

- Real API keys must never be committed or exposed to the browser.
- Agent requests must time out with clear user feedback.
- Agent outputs must remain schema-validated.
- Existing local demo flow must continue to work in mock mode.
- Backend tests, frontend tests, lint, build, and audit must pass.

## Success Criteria

- A user can configure a real OpenAI-compatible provider and run the full MVP loop on a non-seed project.
- Clarify, plan, breakdown, assign, active push, risk, and replan each produce visible, explainable output.
- Direction card, stages, tasks, assignments, action cards, risks, and replans can be persisted only through explicit confirmation where required.
- Fallback is never presented as full Agent success.
- The runbook contains a repeatable real-provider verification checklist.

## Constraints & Assumptions

- MVP remains single workspace and single active project.
- No production auth or OAuth will be added in this round.
- Provider target is OpenAI-compatible chat completions first.
- The user will provide real API credentials locally in `.env`; Codex must not create or edit `.env`.
- SQLite remains the local database.

## Out of Scope

- Multi-agent orchestration.
- Production deployment.
- OAuth/JWT authentication.
- Real file parsing or vector search.
- GitHub/Feishu/calendar integrations.
- Multi-team workspace support.

## Dependencies

- Existing ProjectFlow MVP implementation on `main`.
- Existing FastAPI backend, Next.js frontend, SQLite models, and Agent workflow.
- A user-provided OpenAI-compatible API key for real-provider verification.
