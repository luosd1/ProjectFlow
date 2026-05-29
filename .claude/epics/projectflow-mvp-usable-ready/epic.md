---
name: projectflow-mvp-usable-ready
status: backlog
created: 2026-05-29T13:07:13Z
updated: 2026-05-29T13:11:38Z
progress: 0%
prd: .claude/prds/projectflow-mvp-usable-ready.md
github: https://github.com/wubq511/ProjectFlow/issues/15
---

# Epic: projectflow-mvp-usable-ready

## Overview

This epic moves ProjectFlow from "demo-ready MVP" to "usable MVP." The existing system has the right data model, routes, UI surfaces, seed/reset flow, and fallback Agent workflow. The missing product-quality layer is real LLM operation, explicit Agent status transparency, confirm-to-persist behavior for planning outputs, and real-project verification.

## Architecture Decisions

- Keep the single Coordinator Agent architecture.
- Keep mock mode as a first-class offline/test provider.
- Use OpenAI-compatible chat completions as the real-provider contract.
- Keep all LLM calls in the backend.
- Do not write or modify `.env`; provide `.env.example` and runbook instructions only.
- Add explicit Agent run status to API/UI rather than hiding fallback behind generic success.
- Persist high-impact Agent outputs only through explicit confirmation.

## Technical Approach

### Frontend Components

- Add Agent run status badges and failure/retry states to dashboard Agent actions.
- Add review panels for direction card, stage plan, task breakdown, assignment, risk, and replan outputs.
- Clearly label fallback output and repaired output.
- Add loading copy that reflects context analysis without claiming unsupported work.

### Backend Services

- Harden LLM provider configuration and error mapping.
- Add provider diagnostic endpoint or dry-run service.
- Extend Agent flow responses with user-facing status/error metadata.
- Add confirm endpoints/services for direction card, stage plan, and task breakdown.
- Improve prompt modules and schema validation for real project context.
- Add tests for provider errors, confirm-to-persist behavior, fallback labeling, and real-output schema fixtures.

### Infrastructure

- Add `.env.example` and runbook guidance.
- Keep secrets ignored.
- Preserve deterministic tests using mock provider.

## Implementation Strategy

1. Establish a gap baseline and acceptance checklist.
2. Harden real LLM provider configuration and diagnostics.
3. Implement confirm-to-persist for planning outputs.
4. Improve prompts and output schema behavior for real project state.
5. Make Agent status/fallback transparent in frontend.
6. Validate the end-to-end flow with real provider mode and update docs.

## Task Breakdown Preview

- Provider readiness and diagnostics can proceed in parallel with prompt/schema hardening.
- Frontend Agent status work depends on the backend response shape.
- Confirm-to-persist services should land before final end-to-end validation.

## Dependencies

- Existing ProjectFlow MVP on `main`.
- User-provided local LLM credentials for manual real-provider validation.

## Success Criteria (Technical)

- Backend supports `mock`, `openai`, and `openai-compatible` modes with clear diagnostics.
- Agent APIs expose accurate status, attempts, fallback usage, and error messages.
- Clarification, planning, and breakdown outputs can be confirmed into persisted project state.
- UI does not present fallback as successful model intelligence.
- Real-provider manual flow passes from intake through review export.
- Backend tests, frontend tests, lint, build, and audit pass.

## Estimated Effort

- Size: L
- Estimated total: 30-40 hours

## Tasks Created

- [ ] #16 - Real LLM Provider Readiness and Diagnostics (parallel: true)
- [ ] #17 - Agent Output Persistence and Confirmation (parallel: false)
- [ ] #18 - Prompt and Schema Quality Hardening (parallel: true)
- [ ] #19 - Frontend Agent Status and Review UX (parallel: false)
- [ ] #20 - Assignment, Push, Risk, and Replan Usability Pass (parallel: true)
- [ ] #21 - Real-Provider Verification and MVP Usable Runbook (parallel: false)

Total tasks: 6
Parallel tasks: 3
Sequential tasks: 3
Estimated total effort: 36 hours
