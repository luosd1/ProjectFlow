"use client";

import { AlertCircle, ChevronRight, Loader2, PlayCircle, RotateCcw, Sparkles } from "lucide-react";

import { DirectionCardPanel } from "@/components/agent/direction-card-panel";
import { ActionCardsList } from "@/components/agent/action-card";
import { TeamActionsPanel } from "@/components/agent/team-actions-panel";
import { AgentTimeline } from "@/components/agent/timeline";
import { ExportPanel } from "@/components/agent/export-panel";
import { AssignmentFlowPanel } from "@/components/assignment/assignment-flow-panel";
import { CheckInForm } from "@/components/checkin/checkin-form";
import { RiskPanel } from "@/components/risk/risk-panel";
import { ReplanDiff } from "@/components/risk/replan-diff";
import { StagePlanBoard } from "@/components/stage/stage-plan-board";
import { TaskBreakdownBoard } from "@/components/task/task-breakdown-board";
import { TaskStatusUpdateList } from "@/components/task/task-status-update";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectState } from "@/lib/types";

export type AgentAction = "clarify" | "plan" | "breakdown" | "assign" | "push" | "analyze-checkins" | "risk-analysis" | "replan";

type ProjectDashboardProps = {
  state: ProjectState;
  currentUserId?: string;
  pendingAction?: AgentAction | null;
  actionError?: string | null;
  onRunAgent?: (action: AgentAction) => void | Promise<void>;
  onRespondToAssignment?: (
    proposalId: string,
    userId: string,
    response: "accept" | "reject",
    preferredTaskId?: string,
    reason?: string,
  ) => void | Promise<void>;
  onStartNegotiation?: (
    proposalId: string,
    fromUserId: string,
    desiredTaskId: string,
  ) => void | Promise<void>;
  onFinalizeAssignments?: (stageId: string) => void | Promise<void>;
  onSubmitCheckin?: (data: {
    user_id: string;
    task_id?: string;
    what_done: string;
    blocker?: string;
    available_hours_next_cycle?: number;
    mood_or_confidence?: "low" | "medium" | "high";
  }) => void | Promise<void>;
  onUpdateTaskStatus?: (data: {
    task_id: string;
    user_id: string;
    status: "not_started" | "in_progress" | "done" | "blocked";
    progress_note?: string;
    blocker?: string;
    available_hours_change?: number;
  }) => void | Promise<void>;
  onResolveRisk?: (riskId: string) => void | Promise<void>;
  onAcceptRisk?: (riskId: string) => void | Promise<void>;
  onIgnoreRisk?: (riskId: string) => void | Promise<void>;
  onDismissActionCard?: (cardId: string) => void | Promise<void>;
  onCompleteActionCard?: (cardId: string) => void | Promise<void>;
  onResetDemo?: () => void | Promise<void>;
};

function projectStatusClass(status: ProjectState["project"]["status"]) {
  if (status === "active") return "bg-moss/15 text-moss";
  if (status === "at_risk") return "bg-coral/15 text-coral";
  if (status === "completed") return "bg-ink/10 text-ink/55";
  return "bg-white text-ink/60";
}

function actionLabel(action: AgentAction) {
  const labels: Record<AgentAction, string> = {
    clarify: "Run clarification",
    plan: "Generate plan",
    breakdown: "Break down tasks",
    assign: "Recommend assignments",
    push: "Active push",
    "analyze-checkins": "Analyze check-ins",
    "risk-analysis": "Risk analysis",
    replan: "Replan",
  };
  return labels[action];
}

export function ProjectDashboard({
  state,
  currentUserId,
  pendingAction,
  actionError,
  onRunAgent,
  onRespondToAssignment,
  onStartNegotiation,
  onFinalizeAssignments,
  onSubmitCheckin,
  onUpdateTaskStatus,
  onResolveRisk,
  onAcceptRisk,
  onIgnoreRisk,
  onDismissActionCard,
  onCompleteActionCard,
  onResetDemo,
}: ProjectDashboardProps) {
  const { project, stages, tasks, action_cards, risks, timeline } = state;
  const currentStage = stages.find((stage) => stage.id === project.current_stage_id)
    ?? stages.find((stage) => stage.status === "active")
    ?? stages[0];
  const nextAction = action_cards.find((card) => card.status === "active");
  const p0OpenCount = tasks.filter((task) => task.priority === "P0" && task.status !== "done").length;
  const ownerCoverage = tasks.length === 0
    ? 0
    : Math.round((tasks.filter((task) => task.owner_user_id).length / tasks.length) * 100);

  const personalCards = action_cards.filter(
    (card) => card.user_id === currentUserId && card.status === "active"
  );

  const runButton = (action: AgentAction) => (
    <Button
      key={action}
      variant={action === "assign" ? "default" : "outline"}
      disabled={Boolean(pendingAction)}
      onClick={() => onRunAgent?.(action)}
      className={action === "assign" ? "bg-ink text-white hover:bg-ink/85" : ""}
    >
      {pendingAction === action ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
      {pendingAction === action ? "Running..." : actionLabel(action)}
    </Button>
  );

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <header className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={projectStatusClass(project.status)}>{project.status}</Badge>
              <span className="text-xs text-ink/45">Deadline {project.deadline}</span>
            </div>
            <h1 className="font-display mt-3 text-3xl font-black leading-tight text-ink md:text-4xl">
              {project.name}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-ink/65">{project.idea}</p>
          </div>
          <div className="grid min-w-56 gap-2 rounded-lg bg-paper p-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Current stage</p>
              <p className="mt-1 font-semibold text-ink">{currentStage?.name ?? "No stage yet"}</p>
            </div>
            <div className="border-t border-ink/10 pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Next recommended action</p>
              <p className="mt-1 font-semibold text-ink">{nextAction?.title ?? "Create the next agent proposal"}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-ink/10 pt-5 md:grid-cols-3">
          <div className="rounded-lg bg-paper px-4 py-3">
            <p className="text-xs text-ink/50">Open P0 tasks</p>
            <p className="mt-1 text-2xl font-black text-ink">{p0OpenCount}</p>
          </div>
          <div className="rounded-lg bg-paper px-4 py-3">
            <p className="text-xs text-ink/50">Owner coverage</p>
            <p className="mt-1 text-2xl font-black text-ink">{ownerCoverage}%</p>
          </div>
          <div className="rounded-lg bg-paper px-4 py-3">
            <p className="text-xs text-ink/50">Active action cards</p>
            <p className="mt-1 text-2xl font-black text-ink">{action_cards.filter((card) => card.status === "active").length}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(["clarify", "plan", "breakdown", "assign", "push", "analyze-checkins", "risk-analysis", "replan"] as AgentAction[]).map(runButton)}
          {onResetDemo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetDemo}
              className="text-ink/50 hover:text-coral"
            >
              <RotateCcw className="h-4 w-4" />
              Reset demo
            </Button>
          )}
        </div>

        {actionError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-coral/20 bg-coral/10 p-3 text-sm text-coral">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <p>{actionError}</p>
          </div>
        )}
      </header>

      {nextAction && (
        <section className="mt-5 rounded-lg border border-moss/20 bg-moss/10 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 h-5 w-5 text-moss" />
            <div>
              <p className="font-semibold text-ink">{nextAction.title}</p>
              <p className="mt-1 text-sm text-ink/65">{nextAction.content}</p>
              <p className="mt-2 flex items-center gap-1 text-xs text-ink/50">
                Reason <ChevronRight className="h-3 w-3" /> {nextAction.reason}
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="mt-5 grid gap-5">
        <DirectionCardPanel
          directionCard={project.direction_card}
          timeline={state.timeline}
          pending={pendingAction === "clarify"}
          onRunClarification={() => onRunAgent?.("clarify")}
        />
        <StagePlanBoard stages={stages} tasks={tasks} currentStageId={project.current_stage_id} />
        <TaskBreakdownBoard stages={stages} tasks={tasks} />
        <AssignmentFlowPanel
          proposals={state.assignment_proposals}
          negotiations={state.assignment_negotiations}
          stages={stages}
          tasks={tasks}
          members={state.members}
          pending={Boolean(pendingAction)}
          onRespondToAssignment={onRespondToAssignment}
          onStartNegotiation={onStartNegotiation}
          onFinalizeAssignments={onFinalizeAssignments}
        />

        <Tabs defaultValue="actions" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="actions">Action cards</TabsTrigger>
            <TabsTrigger value="checkin">Check-in & Status</TabsTrigger>
            <TabsTrigger value="risks">Risks & Replan</TabsTrigger>
            <TabsTrigger value="timeline">Timeline & Export</TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="space-y-5">
            {personalCards.length > 0 && (
              <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-ink">Your actions</h2>
                  <p className="mt-1 text-sm text-ink/60">
                    Personal tasks and reminders assigned to you.
                  </p>
                </div>
                <div className="mt-5">
                  <ActionCardsList
                    cards={personalCards}
                    onDismiss={onDismissActionCard}
                    onComplete={onCompleteActionCard}
                    pending={Boolean(pendingAction)}
                  />
                </div>
              </section>
            )}
            <TeamActionsPanel
              cards={action_cards}
              onDismiss={onDismissActionCard}
              onComplete={onCompleteActionCard}
              pending={Boolean(pendingAction)}
            />
          </TabsContent>

          <TabsContent value="checkin" className="space-y-5">
            {currentUserId && onSubmitCheckin && (
              <CheckInForm
                tasks={tasks}
                userId={currentUserId}
                onSubmit={onSubmitCheckin}
                pending={Boolean(pendingAction)}
              />
            )}
            {currentUserId && onUpdateTaskStatus && (
              <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-ink">Update task status</h2>
                  <p className="mt-1 text-sm text-ink/60">
                    Manually update progress, blockers, and completion.
                  </p>
                </div>
                <div className="mt-5">
                  <TaskStatusUpdateList
                    tasks={tasks.filter((t) => t.owner_user_id === currentUserId)}
                    userId={currentUserId}
                    onUpdate={onUpdateTaskStatus}
                    pending={Boolean(pendingAction)}
                  />
                </div>
              </section>
            )}
          </TabsContent>

          <TabsContent value="risks" className="space-y-5">
            <RiskPanel
              risks={risks}
              onResolve={onResolveRisk}
              onAccept={onAcceptRisk}
              onIgnore={onIgnoreRisk}
              pending={Boolean(pendingAction)}
            />
            <ReplanDiff before={tasks} after={tasks} />
          </TabsContent>

          <TabsContent value="timeline" className="space-y-5">
            <AgentTimeline events={timeline} />
            <ExportPanel projectId={project.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
