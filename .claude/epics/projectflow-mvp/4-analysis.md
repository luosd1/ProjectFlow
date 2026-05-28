---
issue: 4
title: Core Workspace and Project APIs
analyzed: 2026-05-29T10:00:00Z
estimated_hours: 10
parallelization_factor: 2.0
---

# Parallel Work Analysis: Issue #4

## Overview

Build all deterministic APIs and services on top of the domain models from #3. The models already exist; this task creates schemas, services, routes, WorkspaceState assembly, and smoke tests.

## Parallel Streams

### Stream A: Account & Workspace Domain
**Scope**: User, Workspace, Invitation, MemberProfile — schemas, services, routes
**Files**:
- `backend/app/schemas/user.py`
- `backend/app/schemas/workspace.py`
- `backend/app/schemas/invitation.py`
- `backend/app/schemas/member_profile.py`
- `backend/app/services/user_service.py`
- `backend/app/services/workspace_service.py`
- `backend/app/services/invitation_service.py`
- `backend/app/services/member_profile_service.py`
- `backend/app/api/routes_users.py`
- `backend/app/api/routes_workspaces.py`
- `backend/app/api/routes_invitations.py`
- `backend/app/api/routes_member_profiles.py`
**Can Start**: immediately
**Estimated Hours**: 5
**Dependencies**: none

### Stream B: Project Domain
**Scope**: Project, Resource, Stage, Task — schemas, services, routes
**Files**:
- `backend/app/schemas/project.py`
- `backend/app/schemas/resource.py`
- `backend/app/schemas/stage.py`
- `backend/app/schemas/task.py`
- `backend/app/services/project_service.py`
- `backend/app/services/resource_service.py`
- `backend/app/services/stage_service.py`
- `backend/app/services/task_service.py`
- `backend/app/api/routes_projects.py`
- `backend/app/api/routes_resources.py`
- `backend/app/api/routes_stages.py`
- `backend/app/api/routes_tasks.py`
**Can Start**: immediately
**Estimated Hours**: 5
**Dependencies**: none

### Stream C: WorkspaceState & Smoke Tests
**Scope**: WorkspaceState assembly endpoint, comprehensive API smoke tests
**Files**:
- `backend/app/schemas/workspace_state.py`
- `backend/app/services/workspace_state_service.py`
- `backend/app/api/routes_workspace_state.py`
- `backend/app/tests/test_api_workspace_project.py`
**Can Start**: after Stream A and Stream B
**Estimated Hours**: 3
**Dependencies**: Stream A, Stream B

## Coordination Points

### Shared Files
- `backend/app/main.py` — both streams add routers; Stream C also adds router
- `backend/app/schemas/__init__.py` — both streams add imports
- `backend/app/api/__init__.py` — both streams may touch

### Sequential Requirements
- Stream C needs all schemas and services from A and B to assemble WorkspaceState

## Conflict Risk Assessment

- `main.py` router registration: low risk — each stream adds distinct routers, merge is additive
- `schemas/__init__.py`: low risk — additive imports
- No model file conflicts — models are read-only from #3

## Parallelization Strategy

Run Stream A and Stream B as parallel agents. After both complete, run Stream C sequentially.

## Expected Timeline
- With parallel execution: 8h wall time (5h parallel + 3h sequential)
- Without: 13h
- Efficiency gain: 38%
