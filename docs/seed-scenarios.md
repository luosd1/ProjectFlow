# ProjectFlow Seed Scenarios

Status: current as of 2026-05-29.

Documents the scenarios embedded in the demo seed data for risk detection and replanning demonstration.

## Scenario 1: Blocker + Availability Change

### Context

The ProjectFlow project is in the "核心实现" stage with 3 P0 tasks running in parallel:

| Task | Owner | Status | Due |
|------|-------|--------|-----|
| 前端 Shell 与核心页面 | 小王 | in_progress | 2026-06-03 |
| 后端 API 与数据模型 | 小张 | in_progress | 2026-06-03 |
| Agent 核心流程 | 小赵 | in_progress | 2026-06-05 |

Assignments are finalized based on member skills and preferences.

### Trigger Events

1. Check-in response from 小张 reports a blocker: "SQLite 外键约束报错，还在排查".
2. 小张's available hours drop from 8h/week to 6h/week.

### Agent Detection

The Agent detects 3 risks from the check-in data.

#### Risk 1: Dependency (Medium)

- Title: 后端 API 外键约束问题
- Evidence:
  - 小张 check-in reports blocker: "SQLite 外键约束报错"
  - 后端 API is P0 task and blocks frontend integration
- Recommendation: 小林 assists with debugging; if unresolved in 1 day, simplify data model

#### Risk 2: Workload (High)

- Title: 小张可用时间下降
- Evidence:
  - 小张 check-in reports `available_hours_next_cycle: 6`
  - 小张 profile has `available_hours_per_week: 8`
  - 小张 constraint: "周末经常回家"
- Recommendation: consider assigning part of backend work to 小林, or cut non-core API work

#### Risk 3: Deadline (Medium)

- Title: 核心实现阶段时间紧张
- Evidence:
  - 3 P0 tasks simultaneously in progress
  - Stage deadline 2026-06-07
  - Agent core is the largest estimated task
- Recommendation: prioritize Agent core flow closure; non-core features can be marked `can_cut`

### Expected Replan Proposal

If replan is triggered, the Agent should propose:

1. Move part of backend API support from 小张 to 小林.
2. Cut or defer non-essential API endpoints.
3. Prioritize Agent core flow because it carries the highest demo value.

### Demo Flow

1. Show check-in results with the blocker highlighted.
2. Run risk analysis and display risk cards with evidence.
3. Run replan and display before/after comparison.
4. Show Agent timeline with all events.
5. Export the review summary.

## Scenario Data Location

The scenario data is embedded in `backend/app/seed/demo_projectflow.py`:

- Check-in responses: IDs `demo-checkin-resp-001` through `demo-checkin-resp-003`
- Risks: IDs `demo-risk-001` through `demo-risk-003`
- Action cards: IDs `demo-action-001` through `demo-action-005`
- Agent events: IDs `demo-event-001` through `demo-event-005`

The scenario documentation module is at `backend/app/seed/demo_blocker_scenario.py`.

## Adding New Scenarios

1. Create a new seed function in `backend/app/seed/`.
2. Add a seed API endpoint if needed.
3. Document the scenario in this file.
4. Update `docs/demo-script.md` if the scenario changes the demo flow.
