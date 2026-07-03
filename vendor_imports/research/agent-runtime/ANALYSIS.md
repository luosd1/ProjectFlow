# ProjectFlow Agent Runtime Vendor Research

Date: 2026-07-03

This directory is a local research cache for the ProjectFlow Agent runtime
refactor. It is not a production dependency tree.

## Imported Repositories

| Path | Source | Purpose | Decision |
| --- | --- | --- | --- |
| `repos/pi` | `https://github.com/earendil-works/pi.git` | Pi monorepo source for `packages/ai`, `packages/agent`, `packages/coding-agent`, `packages/orchestrator`, `packages/tui` | Primary implementation reference |
| `repos/openai-agents-python` | `https://github.com/openai/openai-agents-python.git` | Compare OpenAI Agents SDK model/provider/tool/HITL patterns | Secondary adapter/reference |
| `repos/langgraph` | `https://github.com/langchain-ai/langgraph.git` | Compare graph runtime, durable execution, interrupt/resume | Graph-runtime reference only |

## Imported NPM Packages

| Package | Version | Local tarball | Usefulness |
| --- | ---: | --- | --- |
| `@earendil-works/pi-ai` | `0.80.3` | `npm/earendil-works-pi-ai-0.80.3.tgz` | Core candidate |
| `@earendil-works/pi-agent-core` | `0.80.3` | `npm/earendil-works-pi-agent-core-0.80.3.tgz` | Core candidate |
| `@earendil-works/pi-coding-agent` | `0.80.3` | `npm/earendil-works-pi-coding-agent-0.80.3.tgz` | Reference only |
| `pi-mcp-adapter` | `2.10.0` | `npm/pi-mcp-adapter-2.10.0.tgz` | MCP contract reference |
| `pi-subagents` | `0.32.0` | `npm/pi-subagents-0.32.0.tgz` | Reference only |
| `@gotgenes/pi-subagents` | `18.0.1` | `npm/gotgenes-pi-subagents-18.0.1.tgz` | Subagent contract reference |
| `@gotgenes/pi-permission-system` | `18.1.1` | `npm/gotgenes-pi-permission-system-18.1.1.tgz` | Policy reference |
| `pi-landstrip` | `0.16.22` | `npm/pi-landstrip-0.16.22.tgz` | Sandbox reference |
| `pi-hermes-memory` | `0.7.23` | `npm/pi-hermes-memory-0.7.23.tgz` | Memory/search reference |

The Pi package catalog contains thousands of packages, so the import is curated
around ProjectFlow runtime needs: model routing, agent loop, tool calls, MCP,
subagents, permissions, sandboxing, and memory. Pulling the entire catalog would
add noise without improving this design decision.

## Package Fit

### Core: use in the sidecar

`@earendil-works/pi-ai` is the best model/provider layer candidate.

- Exposes standard ESM imports and typed exports.
- Supports provider collections, provider factories, custom providers, and
  OpenAI-compatible chat completions/responses style APIs.
- Built-in provider list covers OpenAI, Anthropic, Google, DeepSeek, OpenRouter,
  Groq, Cerebras, Mistral, Bedrock, Fireworks, Together, Hugging Face, Moonshot,
  Kimi, Xiaomi, and more.
- Tool-call support is first-class: tool schemas are converted into provider
  formats, including OpenAI completions/responses.

`@earendil-works/pi-agent-core` is the best agent-loop candidate.

- Exposes a stateful `Agent`.
- Supports `AgentTool`, TypeBox parameter schemas, validated arguments,
  tool execution updates, sequential/parallel tool execution, and abort signals.
- Provides `beforeToolCall` and `afterToolCall` hooks, which map directly to
  ProjectFlow policy gates and event mapping.
- Emits lifecycle events: `agent_start`, `turn_start`, `message_*`,
  `tool_execution_start/update/end`, `turn_end`, `agent_end`.

### Reference only: do not make the current target depend on these

`@earendil-works/pi-coding-agent` is a full coding-agent host, not a clean
ProjectFlow runtime base.

- Useful references: SDK examples, session runtime, resource loading, extension
  loader, skill loading, custom tool wrappers.
- Not recommended as the ProjectFlow runtime because it brings coding-agent file,
  shell, TUI, project trust, and extension semantics that are not native to a
  project-management product.

`pi-mcp-adapter` is useful for MCP-compatible contract design, especially its proxy-tool
approach that avoids loading every MCP tool schema into the context.

- Good idea to copy: one compact discovery/proxy surface with optional direct
  tools.
- Not a direct runtime dependency now: ProjectFlow should first stabilize its own
  Tool Contract with MCP-compatible safety metadata, then expose or consume MCP
  through an adapter.

`pi-subagents` and `@gotgenes/pi-subagents` are subagent contract references.

- Useful ideas: child session records, background runs, steering, lifecycle
  events, workspace provider seam, concurrency limit.
- Not a direct runtime dependency now: ProjectFlow's current best architecture is
  one reliable project-management agent loop with clean context isolation points,
  not a role-play multi-agent topology.

`@gotgenes/pi-permission-system` is a strong policy reference but not a direct
dependency for the current target.

- Useful ideas: allow/ask/deny, surface-specific rules, most-restrictive-wins,
  fail-closed, path/external-directory gates, custom tool input preview.
- Not direct dependency: it is coupled to Pi coding-agent tool surfaces and
  extension lifecycle. ProjectFlow needs a business-level policy gate in the
  sidecar plus deterministic FastAPI commit authorization.

`pi-landstrip` is a sandbox reference.

- Useful if the sidecar ever exposes shell/file/network tools.
- For the ProjectFlow runtime, shell/file tools should be absent, so sandboxing is a
  deployment hardening layer, not a core runtime requirement.

`pi-hermes-memory` is a memory/session-search reference.

- Useful ideas: policy-only memory injection, searchable session history,
  secret scanning, project/global tiers.
- Not direct dependency: ProjectFlow's factual state already belongs in DB.
  Agent memory must not become a competing project state source.

## OpenAI Agents SDK Comparison

OpenAI Agents SDK is not limited to official OpenAI models. It supports
OpenAI-compatible endpoints, per-run `ModelProvider`, per-agent concrete model
objects, and third-party adapter paths.

The issue is not "can it use custom models"; it can. The issue is feature
consistency:

- Its richest path is OpenAI Responses.
- Many non-OpenAI providers still map better to Chat Completions.
- Some advanced tool features, especially hosted/deferred tool search, are
  Responses-only.
- It is Python-native, which fits FastAPI but less cleanly solves the need for
  multi-provider TS-sidecar components already present in Pi.

Recommendation: keep OpenAI Agents SDK as an alternate adapter and benchmark,
not the primary runtime.

## LangGraph Comparison

LangGraph is strongest when the problem is a long-running, checkpointed graph:
durable execution, human interrupts, resume, state inspection, and explicit
branching.

For the current ProjectFlow target, this is more machinery than needed. The immediate gap is
not graph checkpointing; it is autonomous tool selection, tool lifecycle events,
stable ProjectFlow tools, and proposal-confirm boundaries.

Recommendation: keep LangGraph as a reference for explicit graph semantics,
not as the primary runtime.

## ProjectFlow Current Code Fit

Current backend code already has valuable assets:

- `CoordinatorAgent` as a facade over fixed agent modules.
- `AgentModuleRequest` builders for clarify/plan/breakdown/assign/push/checkin/risk/replan/retrospective.
- `generate_structured_output()` with JSON repair, schema validation, fallback,
  provider error handling, and `AgentEvent` logging.
- `validate_agent_output()` and output schemas.
- `agent_flow_service` that persists outputs to proposals, assignment proposals,
  risks, action cards, and task status updates.
- `agent_conversation_service` that already implements a light planner,
  policy block checks, SSE status/token/done events, suggestions, and artifacts.
- `AgentProposal`, `AgentEvent`, `AgentConversation`, `AgentMessage`, `AgentRun`
  models.

This means the old Coordinator should not be the final runtime, but it also
should not be deleted early. The right migration is to turn existing modules and
services into ProjectFlow tools behind a stable Tool Contract.

## Knowledge Base Constraints

The local agent knowledge base at `/Users/robertwu/Documents/Projects/agent_tech`
supports a single target architecture, not a framework rewrite.

- `concepts/agent-harness-three-layer-model.md`: separate model, harness, and
  business agent responsibilities. ProjectFlow should not push DB truth,
  proposal confirmation, or commit authority into the model loop.
- `concepts/agents-best-practices-framework.md`: the model proposes actions;
  the harness validates, authorizes, executes, records, and returns observations.
  Every tool call must produce exactly one result, including denial, timeout,
  validation failure, or abort.
- `concepts/agents-best-practices-framework.md`: draft and commit must remain
  separate. ProjectFlow's proposal-confirm flow is a runtime safety boundary,
  not just UX.
- `concepts/composable-harness-architecture.md`: harness should be composable
  workers, not a monolith. ProjectFlow should implement replaceable units for
  model adapter, tool registry, policy gate, event bridge, context builder, and
  budget/trace hooks.
- `concepts/mcp-protocol-deep-dive.md`: each ProjectFlow tool should carry
  MCP-compatible annotations: read-only, destructive, idempotent, and open-world.
  These annotations should drive default policy, retries, audit, and future MCP
  exposure.
- `concepts/agentic-memory-systems.md`: memory is working/episodic/semantic/
  procedural context. ProjectFlow's DB remains the factual state source; agent
  memory can only supply retrieval/context hints unless a human-approved tool
  persists changes through FastAPI.
- `concepts/agent-skills-specification.md`: skills should use progressive
  disclosure. ProjectFlow domain skills should start as metadata + selected
  instructions, not full project dumps in every prompt.
- `synthesis/agent-harness-landscape.md`: the best fit is controlled harness
  composition, because ProjectFlow needs precise product/business boundaries
  more than an all-in-one coding-agent host.

## Current Target Direction

This is one target architecture. Implementation can be sliced for verification,
but the runtime boundary should be designed once.

Use a TypeScript Agent Bridge sidecar built on:

- `@earendil-works/pi-ai`
- `@earendil-works/pi-agent-core`

Keep FastAPI as:

- DB fact source
- WorkspaceState assembler
- Proposal creator/confirmer/rejecter
- deterministic commit authority
- AgentEvent/AgentRun/Conversation persistence
- internal API server for sidecar tools

The sidecar should own:

- runtime session
- model/provider routing
- ProjectFlow tool registry
- ProjectFlow skill loading
- `beforeToolCall` policy checks
- `afterToolCall` result normalization
- Pi event to ProjectFlow event mapping
- SSE/WebSocket stream adapter back to FastAPI/frontend

Do not expose generic shell/edit/write tools in the ProjectFlow runtime.

## ProjectFlow Tool Contract

Register narrow typed tools, each with a capability manifest:

- `get_workspace_state`
- `get_agent_conversation`
- `list_pending_proposals`
- `get_timeline_slice`
- `generate_direction_card_proposal`
- `generate_stage_plan_proposal`
- `generate_task_breakdown_proposal`
- `recommend_assignment`
- `analyze_checkins_and_risks`
- `generate_replan_proposal`

Each tool manifest should include:

- name and version
- input schema and output schema
- risk category: read-only, analysis, draft-only, internal write, destructive,
  open-world
- MCP-compatible hints: read-only, destructive, idempotent, open-world
- allowed caller: model-callable, sidecar-only, human-triggered only
- timeout, retry policy, and result-size limit
- event mapping and trace fields
- FastAPI endpoint or service function behind the tool

Risk policy:

- read-only tools: auto allow
- analysis tools: auto allow plus trace
- proposal tools: allow proposal creation only
- commit/confirm/reject tools: human-triggered only, not LLM-callable
- shell/file/network tools: not registered

Trace envelope:

- `run_id`, `conversation_id`, `project_id`, `workspace_id`
- `tool_call_id`, `tool_name`, `tool_version`
- provider, model, latency, token/cost budget
- policy decision, approval reference, denial reason
- input hash, output hash, result status, structured error
- linked `AgentEvent`, `AgentRun`, `AgentProposal`, and created domain IDs

## Delivery Plan for One Target Architecture

These are delivery slices, not architecture phases.

1. Define ProjectFlow Tool Contract, capability manifest, trace envelope, and
   unified AgentEvent schema in FastAPI/TS.
2. Add sidecar skeleton with `pi-ai` and `pi-agent-core`.
3. Implement read-only tools first: workspace state, conversation, proposals, timeline.
4. Map Pi agent events into existing ProjectFlow stream/status shapes.
5. Wrap existing coordinator modules as proposal/analysis tool endpoints.
6. Switch one narrow flow, likely clarify or plan, from fixed route to sidecar.
7. Add parity tests comparing old Coordinator output persistence with new tool path.
8. Gradually migrate breakdown, assign, risk, replan.
9. Keep old Coordinator as fallback until every production path has parity tests.
10. Only after stable parity, remove or shrink Coordinator into legacy adapter code.

AI coding assistance lowers implementation effort and makes this broader refactor
realistic, but it does not remove the need for contract tests and stepwise
verification. The risk to avoid is not "one big rewrite"; it is letting the
runtime own business truth or bypass proposal-confirm.

## Decision

Primary path: Pi components, not full Pi coding-agent.

Use:

- `@earendil-works/pi-ai`
- `@earendil-works/pi-agent-core`

Reference:

- `@earendil-works/pi-coding-agent`
- `pi-mcp-adapter`
- `pi-subagents`
- `@gotgenes/pi-subagents`
- `@gotgenes/pi-permission-system`
- `pi-landstrip`
- `pi-hermes-memory`
- OpenAI Agents SDK
- LangGraph
