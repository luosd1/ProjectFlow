import type { AgentState, ProjectActionCard, StageRow, TeamMember } from "./types";

export const agentStates: AgentState[] = [
  { label: "加载中", detail: "生成中" },
  { label: "空状态", detail: "等待输入" },
  { label: "错误", detail: "需重试" },
  { label: "成功", detail: "已确认" },
];

export const actionCards: ProjectActionCard[] = [
  {
    owner: "队长",
    title: "确认方向卡",
    reason: "先固定项目边界，后续任务拆解才不会漂移。",
  },
  {
    owner: "Agent",
    title: "生成阶段计划",
    reason: "把 6 月 1 日前的闭环压缩成可验收阶段。",
  },
  {
    owner: "成员",
    title: "补齐个人信息",
    reason: "分工建议必须引用技能、时间和限制，不能凭空编造。",
  },
];

export const stageRows: StageRow[] = [
  { name: "方向澄清", output: "方向卡和边界", status: "就绪", active: false },
  { name: "阶段计划", output: "3-5 个阶段", status: "进行中", active: true },
  { name: "任务拆解", output: "P0/P1/P2 任务树", status: "下一步", active: false },
];

export const teamMembers: TeamMember[] = [
  { name: "小林", role: "负责人", capacity: 78 },
  { name: "Mia", role: "前端 / 视觉", capacity: 64 },
  { name: "Chen", role: "后端 / 数据", capacity: 58 },
  { name: "Ava", role: "调研 / 展示", capacity: 42, risk: true },
];
