---
name: task-breakdown
description: 当需要拆分任务时触发。将阶段目标分解为可执行的任务。
allowed-tools:
  - get_workspace_state
  - generate_task_breakdown_proposal
references:
  - references/breakdown-checklist.md
---

# 任务拆分

当阶段计划已确定，需要将阶段目标分解为具体任务时触发。

## 触发条件

- 用户提到"拆分"、"任务"、"分解"
- 当前阶段需要任务拆分
- 阶段计划已确认

## 工作流程

1. 读取当前阶段目标和交付物
2. 分析完成标准，识别所需工作
3. 将工作分解为可管理的任务
4. 为每个任务设置优先级（P0/P1/P2）和预估时间
5. 创建 AgentProposal 供团队确认

## 输出规范

- 任务标题简洁明确
- 包含优先级和预估时间
- 考虑任务间依赖关系
- 可砍标记（can_cut）用于范围管理
- 不直接修改项目状态
