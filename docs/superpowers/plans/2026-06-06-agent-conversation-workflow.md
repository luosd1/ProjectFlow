# Agent Conversation Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the project Agent sidebar's button-first workflow with a backend LLM-driven conversation workflow that accepts user instructions, chooses or revises Agent modules, and preserves deterministic confirmation gates.

**Architecture:** Add an `AgentConversationOrchestrator` above the existing `CoordinatorAgent`. The orchestrator stores conversation messages, asks the LLM for a structured `AgentTurnPlan`, validates that plan against project state policy, runs the selected Agent module with `user_instruction`, and links responses to existing `AgentEvent` / `AgentProposal` records. The frontend sends natural-language messages to the backend and renders messages, review queue, suggestions, and current focus.

**Tech Stack:** FastAPI, SQLModel, Pydantic v2, existing ProjectFlow agent modules, Next.js, React, TypeScript, Tailwind, Vitest, pytest.

---

### Task 1: Backend Conversation Persistence

**Files:**
- Create: `backend/app/models/agent_conversation.py`
- Create: `backend/app/schemas/agent_conversation.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/core/database.py`
- Test: `backend/app/tests/test_agent_conversation_flow.py`

- [ ] **Step 1: Write failing persistence/API-shape tests**
  - Assert conversation, user message, assistant message, and agent run records can be created and read through service helpers.
  - Assert persisted messages can link to `AgentEvent` and `AgentProposal`.

- [ ] **Step 2: Implement SQLModel tables and read/create schemas**
  - `AgentConversation`: `workspace_id`, `project_id`, `status`, `summary`, `current_focus`.
  - `AgentMessage`: `conversation_id`, `role`, `content`, `structured_payload`, `linked_event_id`, `linked_proposal_id`.
  - `AgentRun`: `conversation_id`, `project_id`, `user_instruction`, `selected_module`, `status`, `model`, `attempts`, `verifier_status`, `agent_event_id`, `proposal_id`.

- [ ] **Step 3: Register models and SQLite drift migration**
  - Import models in `backend/app/models/__init__.py`.
  - Keep `SQLModel.metadata.create_all()` as the primary table creator.

### Task 2: LLM Turn Planning and Policy Gate

**Files:**
- Create: `backend/app/agent/conversation.py`
- Create: `backend/app/services/agent_conversation_service.py`
- Modify: `backend/app/agent/llm_client.py` if helper reuse is needed
- Test: `backend/app/tests/test_agent_conversation_flow.py`

- [ ] **Step 1: Write failing turn-plan tests**
  - User asks to break down tasks before confirmed stages: orchestrator returns a blocked assistant response and does not run `breakdown`.
  - User asks to regenerate a plan with constraints: orchestrator selects `plan`, stores `user_instruction`, creates pending proposal.
  - User asks why next action is blocked: orchestrator answers without running a module.

- [ ] **Step 2: Implement `AgentTurnPlan` schema**
  - Fields: `response_type`, `selected_module`, `user_instruction`, `rationale`, `required_inputs`, `expected_artifact`, `risk_level`, `requires_confirmation`.

- [ ] **Step 3: Implement policy gate**
  - `clarify` allowed when project exists.
  - `plan` allowed only after confirmed direction card.
  - `breakdown` allowed only after stages exist.
  - `assign` allowed only after tasks exist.
  - `push` allowed only after finalized assignment exists.
  - `risk` allowed after tasks exist.
  - `replan` allowed after risks, blockers, overdue tasks, or explicit user instruction with existing stages/tasks.

### Task 3: User Instruction Injection Into Agent Modules

**Files:**
- Modify: `backend/app/schemas/agent_flow.py`
- Modify: `backend/app/services/agent_flow_service.py`
- Modify: `backend/app/agent/coordinator.py`
- Modify: `backend/app/agent/modules/common.py`
- Modify: `backend/app/agent/modules/*.py`
- Modify: `backend/app/agent/prompts.py`
- Test: `backend/app/tests/test_agent_modules.py`
- Test: `backend/app/tests/test_agent_conversation_flow.py`

- [ ] **Step 1: Write failing prompt-context tests**
  - `build_prompt_messages()` includes `<user_instruction>` when provided.
  - Conversation run passes the exact user instruction into the selected module request.

- [ ] **Step 2: Extend request objects**
  - Add `user_instruction: str | None` to `AgentFlowRequest` and agent module request data.
  - Preserve existing direct agent endpoints by making the field optional.

- [ ] **Step 3: Inject instruction into prompts**
  - Add an XML-delimited user instruction block.
  - Explicitly tell the model to follow it unless it conflicts with WorkspaceState or confirmation rules.

### Task 4: Conversation API

**Files:**
- Create: `backend/app/api/routes_agent_conversations.py`
- Modify: `backend/app/main.py`
- Modify: `docs/api-contract.md`
- Test: `backend/app/tests/test_agent_conversation_flow.py`

- [ ] **Step 1: Write failing endpoint tests**
  - `GET /api/projects/{project_id}/agent-conversation` returns or creates the active conversation.
  - `POST /api/agent/conversations/{conversation_id}/messages` persists user and assistant messages and returns review metadata.

- [ ] **Step 2: Implement routes**
  - Route layer only handles request/response.
  - Service owns conversation creation, orchestration, and persistence.

### Task 5: Frontend Conversation Sidebar

**Files:**
- Create: `frontend/src/components/project/agent-conversation-sidebar.tsx`
- Create or modify: `frontend/src/components/project/agent-guidance.ts`
- Modify: `frontend/src/components/project/agent-sidebar.tsx`
- Modify: `frontend/src/components/project/workspace-layout.tsx`
- Modify: `frontend/src/components/project/project-layout.tsx`
- Modify: `frontend/src/app/workspaces/[workspaceId]/page.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/types.ts`
- Test: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Write failing frontend API tests**
  - `getAgentConversation(projectId)` calls the project conversation endpoint.
  - `sendAgentConversationMessage(conversationId, content)` posts message content and returns assistant result.

- [ ] **Step 2: Replace always-visible action list**
  - Show conversation messages, current focus, review queue count, and suggestions.
  - Keep advanced actions behind a compact “更多” menu.

- [ ] **Step 3: Wire message send**
  - Sending a message calls the backend conversation endpoint.
  - On success, reload project state so proposals, action cards, risks, and timeline update.

### Task 6: Verification

**Files:**
- Backend and frontend test suites.

- [ ] **Step 1: Run targeted backend tests**
  - `rtk .venv/bin/python -m pytest app/tests/test_agent_conversation_flow.py -q`
  - `rtk .venv/bin/python -m pytest app/tests/test_agent_modules.py -q`

- [ ] **Step 2: Run full backend quality checks**
  - `rtk .venv/bin/python -m pytest app/tests -q`
  - `rtk .venv/bin/ruff check app`

- [ ] **Step 3: Run frontend checks**
  - From `frontend/`: `../scripts/npm run test`
  - From `frontend/`: `../scripts/npm run lint`
  - From `frontend/`: `../scripts/npm run build`
