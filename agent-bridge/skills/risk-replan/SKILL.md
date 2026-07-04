---
name: risk-replan
description: 当有阻塞任务、风险或需要重新规划时触发。分析风险并生成重新规划建议。
allowed-tools:
  - get_workspace_state
  - get_timeline_slice
  - analyze_checkins_and_risks
  - generate_replan_proposal
references:
  - references/risk-replan-playbook.md
---

# 风险分析与重新规划

当项目遇到阻塞或风险需要重新规划时触发。

## 触发条件

- 用户提到"风险"、"阻塞"、"重新规划"、"延期"
- 有 blocked 状态的任务
- 需要分析风险并建议调整

## 工作流程

1. 读取 workspace 状态，识别阻塞和风险
2. 分析风险类型（deadline/dependency/workload/scope/review/assignment/checkin）
3. 为每个风险提供证据（evidence）
4. 如果风险需要调整计划，生成 replan proposal
5. 咨询记录（Risk）可以直接创建
6. 涉及主状态变更的 mitigation 必须走 replan proposal

## 输出规范

- 风险必须包含证据（evidence）
- 高严重度风险的 mitigation 如涉及主状态变更，必须通过 replan proposal
- Risk 行本身是 advisory record，可直接创建
- 不直接修改 Task/Stage/Project 状态
