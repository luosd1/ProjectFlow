---
issue: 7
title: Planning and Assignment Dashboard UI
analyzed: 2026-05-29T01:10:00Z
estimated_hours: 10
parallelization_factor: 1.4
---

# Parallel Work Analysis: Issue #7

## Overview

Build the project dashboard surfaces that show current stage, next recommended action, direction clarification, stage plan, task breakdown, assignment recommendation, response/rejection, lightweight negotiation, and final assignment confirmation. The backend assignment/check-in/risk routes are planned for later issues, so this issue should wire UI against existing implemented APIs where possible and expose empty/error/success states for planned data without inventing agent reasoning in frontend-only static data.

## Parallel Streams

### Stream A: API State Composition and Tests
**Scope**: Align project dashboard data loading with currently implemented backend endpoints and add frontend tests that lock dashboard behavior.
**Files**: `frontend/src/lib/api.ts`, `frontend/src/lib/types.ts`, dashboard/component tests.
**Can Start**: immediately
**Estimated Hours**: 2
**Dependencies**: none

### Stream B: Planning Dashboard Surfaces
**Scope**: Dashboard overview, direction card, stage plan board, task/dependency board, loading/empty/error/success states.
**Files**: `frontend/src/app/projects/[projectId]/page.tsx`, `frontend/src/components/agent/*`, `frontend/src/components/stage/*`, `frontend/src/components/task/*`.
**Can Start**: after Stream A test contract
**Estimated Hours**: 4
**Dependencies**: Stream A

### Stream C: Assignment Interaction Surfaces
**Scope**: Assignment recommendation list, accept/reject controls, rejection preferred-task selector, negotiation panel, final assignment board copy that makes final owner changes confirmation-gated.
**Files**: `frontend/src/components/assignment/*`, shared dashboard composition.
**Can Start**: after Stream A test contract
**Estimated Hours**: 4
**Dependencies**: Stream A

## Coordination Points

### Shared Files
- `frontend/src/app/projects/[projectId]/page.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/types.ts`

### Sequential Requirements
- Test contract comes first.
- API composition must not rely on planned-only endpoints.
- Dashboard and assignment components should receive typed props; page only fetches and manages top-level UI state.

## Conflict Risk Assessment

Moderate if multiple writers edit the project page and types at the same time. Lower risk with one local execution stream because the dashboard state, tab composition, and assignment forms share the same data model.

## Parallelization Strategy

Use a single local implementation stream for this issue. Splitting into parallel agents would create avoidable conflicts in the shared page, `ProjectState` shape, and component props. Keep CCPM stream tracking, but execute sequentially: tests and API contract first, then planning surfaces, then assignment surfaces.

## Expected Timeline
- With parallel execution: 7h wall time
- Without: 10h
- Efficiency gain: 30%
