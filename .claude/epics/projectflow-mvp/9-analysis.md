---
issue: 9
title: Action Cards, Check-in, Risk, Timeline, and Export UI
analyzed: 2026-05-29T07:07:00Z
estimated_hours: 8
parallelization_factor: 4.0
---

# Parallel Work Analysis: Issue #9

## Overview

Build the frontend surfaces for the execution loop: action cards, check-in submission, manual task status updates, risk cards, replan diff, agent timeline, and review summary export. This is a frontend-only issue (no backend changes). The backend APIs for check-in, risk, action cards, timeline, and export already exist in `api.ts`.

## Parallel Streams

### Stream A: Action Cards & Dashboard Next-Action Panel
**Scope**: 
- Personal action cards component (`frontend/src/components/agent/action-card.tsx`)
- Team next action cards list
- Integrate into `ProjectDashboard` to foreground current next action (not passive list)
- Demo reset control UI

**Files**: 
- `frontend/src/components/agent/action-card.tsx` (new)
- `frontend/src/components/agent/team-actions-panel.tsx` (new)
- `frontend/src/components/project/project-dashboard.tsx` (modify)

**Can Start**: immediately
**Estimated Hours**: 2
**Dependencies**: none

### Stream B: Check-in Form & Task Status Update
**Scope**: 
- Check-in form component (`frontend/src/components/checkin/checkin-form.tsx`)
- Manual task status update component (`frontend/src/components/task/task-status-update.tsx`)
- Integrate into dashboard or a dedicated check-in page

**Files**: 
- `frontend/src/components/checkin/checkin-form.tsx` (new)
- `frontend/src/components/task/task-status-update.tsx` (new)
- `frontend/src/app/checkin/page.tsx` or integrate into dashboard

**Can Start**: immediately
**Estimated Hours**: 2
**Dependencies**: none

### Stream C: Risk Cards & Replan Diff
**Scope**: 
- Risk card component (`frontend/src/components/risk/risk-card.tsx`)
- Risk list/panel
- Replan diff view showing before/after changes and impact

**Files**: 
- `frontend/src/components/risk/risk-card.tsx` (new)
- `frontend/src/components/risk/risk-panel.tsx` (new)
- `frontend/src/components/risk/replan-diff.tsx` (new)

**Can Start**: immediately
**Estimated Hours**: 2
**Dependencies**: none

### Stream D: Agent Timeline & Export UI
**Scope**: 
- Agent timeline component showing evidence, decision, action, and fallback events
- Export UI for review summary (request, display, copy)

**Files**: 
- `frontend/src/components/agent/timeline.tsx` (new)
- `frontend/src/components/agent/export-panel.tsx` (new)

**Can Start**: immediately
**Estimated Hours**: 2
**Dependencies**: none

## Coordination Points

### Shared Files
- `frontend/src/components/project/project-dashboard.tsx` — all streams may need to add their components to the dashboard layout. Stream A owns the dashboard modifications; others add their sections as children props or separate sections.
- `frontend/src/lib/api.ts` — already has all needed APIs, no modifications expected.
- `frontend/src/lib/types.ts` — already has all needed types, no modifications expected.

### Sequential Requirements
- None. All four streams are UI-component-only and touch different files. Dashboard integration can be done incrementally as each stream completes.

## Conflict Risk Assessment

Low. Each stream creates new component files. The only shared file is `project-dashboard.tsx`, and changes are additive (importing and rendering new components). Stream A should handle the main dashboard layout updates; other streams can add their sections via props or separate layout areas.

## Parallelization Strategy

Launch all 4 agents simultaneously. Each agent:
1. Creates its assigned components with loading, empty, error, success states
2. Uses existing shadcn/ui components (Badge, Button, Card, Dialog, etc.)
3. Uses existing `api.ts` functions for data fetching
4. Commits frequently with `Issue #9: <stream> <description>`

After all streams complete, do a final integration pass to wire all new components into `ProjectDashboard` and verify the build/lint passes.

## Expected Timeline
- With parallel execution: 2h wall time (longest stream)
- Without: 8h
- Efficiency gain: 75%
