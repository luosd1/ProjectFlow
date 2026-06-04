import type { ProjectState } from "@/lib/types";

export type AgentAction = "clarify" | "plan" | "breakdown" | "assign" | "push" | "analyze-checkins" | "risk-analysis" | "replan";

export const ACTION_LABELS: Record<AgentAction, string> = {
  clarify: "澄清方向",
  plan: "生成阶段计划",
  breakdown: "分解任务",
  assign: "推荐分工",
  push: "主动推进",
  "analyze-checkins": "分析签到",
  "risk-analysis": "风险分析",
  replan: "调整计划",
};

export function inferRecommendedAction(state: ProjectState): AgentAction | null {
  const { project, stages, tasks, assignment_proposals } = state;
  if (!project.direction_card) return "clarify";
  if (stages.length === 0) return "plan";
  if (tasks.length === 0) return "breakdown";
  if (assignment_proposals.length === 0) return "assign";
  const hasFinalized = assignment_proposals.some((p) => p.status === "finalized");
  if (!hasFinalized) return "assign";
  return "push";
}
