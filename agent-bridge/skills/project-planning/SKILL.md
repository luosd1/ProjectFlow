---
name: project-planning
description: 当需要阶段计划时触发。将项目方向转化为可执行的阶段计划。
allowed-tools:
  - get_workspace_state
  - list_pending_proposals
  - get_timeline_slice
references:
  - references/planning-rubric.md
---

# 阶段计划生成

当项目方向已明确，需要制定阶段计划时触发。

## 触发条件

- 用户提到"计划"、"阶段"、"规划"
- 项目处于 clarification 完成后的阶段
- 需要将方向转化为可执行的阶段计划

## 工作流程

1. 读取 workspace 状态和方向卡
2. 根据项目截止日期和资源情况，划分合理阶段
3. 每个阶段包含：目标、时间范围、交付物、完成标准
4. 创建 AgentProposal 供团队确认

## 输出规范

- 阶段时间范围使用 YYYY-MM-DD 格式
- 每个阶段有明确的完成标准
- 考虑团队成员可用时间和技能
- 不直接修改项目状态
