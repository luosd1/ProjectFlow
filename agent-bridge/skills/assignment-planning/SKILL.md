---
name: assignment-planning
description: 当需要分工时触发。基于成员技能和可用时间推荐任务分配。
allowed-tools:
  - get_workspace_state
  - recommend_assignment
references:
  - references/assignment-rubric.md
---

# 分工推荐

当任务已拆分，需要分配给团队成员时触发。

## 触发条件

- 用户提到"分工"、"分配"、"谁做"
- 任务已拆分但未分配
- 需要基于成员技能推荐分配

## 工作流程

1. 读取 workspace 状态，获取成员技能和可用时间
2. 分析每个任务的技能需求
3. 匹配成员技能与任务需求
4. 推荐 owner 和 backup owner
5. 为每个推荐提供理由
6. 创建 AssignmentProposal（不写 Task.owner_user_id）

## 输出规范

- 推荐包含 owner + backup owner + 理由
- 考虑成员可用时间和技能匹配
- 不能编造成员或任务
- AssignmentProposal 是 draft record，需人工确认
- 不直接修改 Task.owner_user_id
