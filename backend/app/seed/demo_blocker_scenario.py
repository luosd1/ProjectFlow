"""Demo blocker/availability-change scenario for risk and replan demonstration.

This module documents the scenario used in the demo to trigger risk detection
and replanning. It does NOT create additional data — the scenario is already
embedded in the main seed data (demo_projectflow.py).

Scenario summary:
- 小张 reports a blocker on backend API (SQLite foreign key constraint error)
- 小张's available hours drop from 8 to 6 per week
- This triggers: dependency risk, workload risk, deadline risk
- Agent recommends: 小林 assists with backend, consider cutting non-core API
"""

# This file is intentionally minimal — the actual scenario data lives in
# demo_projectflow.py. This module exists to:
# 1. Satisfy the TECH-DESIGN directory structure
# 2. Provide a place to add more scenarios later
# 3. Be importable for documentation generation

SCENARIO_DESCRIPTION = """
## Blocker + Availability Change Scenario

### Setup
- ProjectFlow 项目处于"核心实现"阶段
- 3 个 P0 任务并行：前端 Shell、后端 API、Agent 核心
- 分工已 finalized：小王(前端)、小张(后端)、小赵(Agent)

### Trigger
1. 小张在 check-in 中报告 blocker："SQLite 外键约束报错，还在排查"
2. 小张可用时间从 8 小时/周降至 6 小时/周

### Agent Detection
- **dependency risk** (medium): 后端 API blocker 阻塞前端联调
- **workload risk** (high): 小张时间不足，后端 API 可能延期
- **deadline risk** (medium): 3 个 P0 并行，任一延期影响 Demo

### Agent Recommendation
- 小林（后端技能 4 级）协助排查外键问题
- 考虑将部分后端工作分配给小林
- 非核心功能可标记 can_cut
- 优先保证 Agent 核心流程闭环

### Expected Demo Flow
1. 展示 check-in 结果（含 blocker）
2. 运行 risk analysis → 显示 3 个风险卡
3. 运行 replan → 显示 before/after 建议
4. 展示 Agent Timeline
5. 导出评审摘要
"""
