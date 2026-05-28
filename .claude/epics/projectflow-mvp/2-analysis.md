---
issue: 2
title: Guardrails, Monorepo Bootstrap, and Health Checks
analyzed: 2026-05-28T15:04:47Z
estimated_hours: 6
parallelization_factor: 1.0
---

# Parallel Work Analysis: Issue #2

## Overview

Issue #2 establishes the repo foundation for the ProjectFlow MVP: guardrails, ignored runtime artifacts, runnable FastAPI backend, runnable Next.js frontend, `/api/health`, and basic run instructions. The task is marked `parallel: false`, so implementation should run as a single coordinated stream to avoid root-level scaffold conflicts.

## Parallel Streams

### Stream A: Foundation Bootstrap
**Scope**: Create the minimum monorepo skeleton and health checks needed by later backend, frontend, and agent tasks.
**Files**: `README.md`, `.gitignore`, `backend/**`, `frontend/**`
**Can Start**: immediately
**Estimated Hours**: 6
**Dependencies**: none

## Coordination Points

### Shared Files
- `.gitignore`
- `README.md`
- frontend package/config files
- backend package/config files

### Sequential Requirements
- Confirm guardrail docs remain aligned with `CLAUDE.md` / `AGENTS.md`.
- Add ignore rules before generating install/build artifacts.
- Add backend health test before health implementation.
- Add frontend first-screen behavior with loading, empty, error, and success states represented in the UI surface.
- Run backend and frontend verification before marking complete.

## Conflict Risk Assessment

Conflict risk is medium if multiple agents bootstrap the repo at once because root files and generated package metadata are shared. Keep this issue single-stream.

## Parallelization Strategy

Do not split this issue across agents. Finish issue #2 in one worktree, then unlock task #3 and task #6 for parallel backend/frontend implementation.

## Expected Timeline

- With parallel execution: 6h wall time
- Without: 6h
- Efficiency gain: 0%
