"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { ProjectDashboard, type AgentAction } from "@/components/project/project-dashboard";
import { Button } from "@/components/ui/button";
import {
  finalizeAssignments,
  createCheckinCycle,
  getProjectState,
  respondToAssignment,
  resetDemo,
  runActivePush,
  runAssignment,
  runBreakdown,
  runCheckinAnalysis,
  runClarification,
  runPlanning,
  runReplan,
  runRiskAnalysis,
  startNegotiation,
  submitCheckinResponse,
  updateActionCardStatus,
  updateRiskStatus,
  updateTaskStatus,
} from "@/lib/api";
import type { ProjectState } from "@/lib/types";

const AGENT_RUNNERS: Record<AgentAction, (projectId: string) => Promise<unknown>> = {
  clarify: runClarification,
  plan: runPlanning,
  breakdown: runBreakdown,
  assign: runAssignment,
  push: runActivePush,
  "analyze-checkins": runCheckinAnalysis,
  "risk-analysis": runRiskAnalysis,
  replan: runReplan,
};

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [state, setState] = useState<ProjectState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<AgentAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reloadProject = useCallback(async () => {
    setError(null);
    const nextState = await getProjectState(projectId);
    setState(nextState);
  }, [projectId]);

  useEffect(() => {
    let ignore = false;

    getProjectState(projectId)
      .then((nextState) => {
        if (!ignore) setState(nextState);
      })
      .catch(() => {
        if (!ignore) setError("Failed to load project dashboard.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [projectId]);

  const runAgent = async (action: AgentAction) => {
    setPendingAction(action);
    setActionError(null);
    try {
      await AGENT_RUNNERS[action](projectId);
      await reloadProject();
    } catch {
      setActionError("This agent action is not available yet. Keep the current dashboard state and retry after backend routes are implemented.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleAssignmentResponse = async (
    proposalId: string,
    userId: string,
    response: "accept" | "reject",
    preferredTaskId?: string,
    reason?: string,
  ) => {
    setActionError(null);
    try {
      await respondToAssignment(proposalId, userId, response, preferredTaskId, reason);
      await reloadProject();
    } catch {
      setActionError("Assignment response route is not available yet. The UI is ready for the backend flow.");
    }
  };

  const handleStartNegotiation = async (
    proposalId: string,
    fromUserId: string,
    desiredTaskId: string,
  ) => {
    setActionError(null);
    try {
      await startNegotiation(projectId, proposalId, fromUserId, desiredTaskId);
      await reloadProject();
    } catch {
      setActionError("Negotiation route is not available yet. The rejection state remains local until backend support lands.");
    }
  };

  const handleFinalizeAssignments = async (stageId: string) => {
    if (!state) return;
    setActionError(null);
    try {
      await finalizeAssignments(stageId, state.project.created_by);
      await reloadProject();
    } catch {
      setActionError("Final assignment confirmation route is not available yet. No task owner was changed.");
    }
  };

  const activeStage = state?.stages.find((stage) => stage.id === state.project.current_stage_id)
    ?? state?.stages.find((stage) => stage.status === "active")
    ?? state?.stages[0];
  const currentUserId = state?.project.created_by;

  const handleSubmitCheckin = async (data: {
    user_id: string;
    task_id?: string;
    what_done: string;
    blocker?: string;
    available_hours_next_cycle?: number;
    mood_or_confidence?: "low" | "medium" | "high";
  }) => {
    if (!state || !activeStage) return;
    setActionError(null);
    try {
      const existingCycle = state.checkins.find(
        (cycle) => cycle.stage_id === activeStage.id && cycle.status === "active",
      );
      const cycle = existingCycle ?? await createCheckinCycle(
        state.project.id,
        activeStage.id,
        2,
        new Date().toISOString().slice(0, 10),
        state.project.created_by,
      );
      await submitCheckinResponse(cycle.id, {
        ...data,
        project_id: state.project.id,
        stage_id: activeStage.id,
      });
      await reloadProject();
    } catch {
      setActionError("Check-in submission failed. The current dashboard state was preserved.");
    }
  };

  const handleUpdateTaskStatus = async (data: {
    task_id: string;
    user_id: string;
    status: "not_started" | "in_progress" | "done" | "blocked";
    progress_note?: string;
    blocker?: string;
    available_hours_change?: number;
  }) => {
    setActionError(null);
    try {
      await updateTaskStatus(data.task_id, data);
      await reloadProject();
    } catch {
      setActionError("Task status update failed. No local-only status was applied.");
    }
  };

  const handleRiskStatus = async (
    riskId: string,
    status: "accepted" | "ignored" | "resolved",
  ) => {
    setActionError(null);
    try {
      await updateRiskStatus(riskId, status);
      await reloadProject();
    } catch {
      setActionError("Risk status update failed.");
    }
  };

  const handleActionCardStatus = async (
    cardId: string,
    status: "done" | "dismissed",
  ) => {
    setActionError(null);
    try {
      await updateActionCardStatus(cardId, status);
      await reloadProject();
    } catch {
      setActionError("Action card update failed.");
    }
  };

  const handleResetDemo = async () => {
    setActionError(null);
    try {
      const demo = await resetDemo();
      if (demo.project_id === projectId) {
        await reloadProject();
      } else {
        router.push(`/projects/${demo.project_id}`);
      }
    } catch {
      setActionError("Demo reset failed. Existing project data was not changed by the frontend.");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-4xl place-items-center px-5">
        <div className="w-full rounded-lg border border-ink/10 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-moss" />
            <p className="font-semibold text-ink">Loading project dashboard</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="h-24 animate-pulse rounded-lg bg-ink/5" />
            <div className="h-24 animate-pulse rounded-lg bg-ink/5" />
            <div className="h-24 animate-pulse rounded-lg bg-ink/5" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-5 text-center">
        <AlertCircle className="h-8 w-8 text-coral" />
        <p className="text-sm text-coral">{error ?? "Project not found"}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <ProjectDashboard
      state={state}
      currentUserId={currentUserId}
      pendingAction={pendingAction}
      actionError={actionError}
      onRunAgent={runAgent}
      onRespondToAssignment={handleAssignmentResponse}
      onStartNegotiation={handleStartNegotiation}
      onFinalizeAssignments={handleFinalizeAssignments}
      onSubmitCheckin={handleSubmitCheckin}
      onUpdateTaskStatus={handleUpdateTaskStatus}
      onResolveRisk={(riskId) => handleRiskStatus(riskId, "resolved")}
      onAcceptRisk={(riskId) => handleRiskStatus(riskId, "accepted")}
      onIgnoreRisk={(riskId) => handleRiskStatus(riskId, "ignored")}
      onCompleteActionCard={(cardId) => handleActionCardStatus(cardId, "done")}
      onDismissActionCard={(cardId) => handleActionCardStatus(cardId, "dismissed")}
      onResetDemo={handleResetDemo}
    />
  );
}
