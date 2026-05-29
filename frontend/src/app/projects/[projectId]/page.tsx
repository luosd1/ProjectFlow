"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { ProjectDashboard, type AgentAction } from "@/components/project/project-dashboard";
import { Button } from "@/components/ui/button";
import {
  finalizeAssignments,
  getProjectState,
  respondToAssignment,
  runAssignment,
  runBreakdown,
  runClarification,
  runPlanning,
  startNegotiation,
} from "@/lib/api";
import type { ProjectState } from "@/lib/types";

const AGENT_RUNNERS: Record<AgentAction, (projectId: string) => Promise<unknown>> = {
  clarify: runClarification,
  plan: runPlanning,
  breakdown: runBreakdown,
  assign: runAssignment,
};

export default function ProjectDashboardPage() {
  const params = useParams();
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
      pendingAction={pendingAction}
      actionError={actionError}
      onRunAgent={runAgent}
      onRespondToAssignment={handleAssignmentResponse}
      onStartNegotiation={handleStartNegotiation}
      onFinalizeAssignments={handleFinalizeAssignments}
    />
  );
}
