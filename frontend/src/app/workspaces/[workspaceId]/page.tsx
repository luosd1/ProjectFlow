"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, Users, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getWorkspaceState } from "@/lib/api";
import type { WorkspaceState } from "@/lib/types";

export default function WorkspaceDashboardPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [state, setState] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getWorkspaceState(workspaceId)
      .then(setState)
      .catch(() => setError("Failed to load workspace"))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-moss" />
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <AlertCircle className="h-8 w-8 text-coral" />
        <p className="text-sm text-coral">{error ?? "Workspace not found"}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl px-5 py-8"
    >
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">Workspace</p>
        <h1 className="font-display mt-2 text-3xl font-black">{state.workspace.name}</h1>
        {state.workspace.description && (
          <p className="mt-2 text-sm text-ink/60">{state.workspace.description}</p>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-harbor" />
              Members ({state.memberships.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.memberships.length === 0 ? (
              <p className="text-sm text-ink/40">No members yet.</p>
            ) : (
              state.memberships.map((m) => {
                const user = state.users.find((u) => u.user_id === m.user_id);
                const profile = state.member_profiles.find((p) => p.user_id === m.user_id);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-ink/10 p-3"
                  >
                    <div>
                      <p className="font-medium">{user?.display_name ?? "Unknown"}</p>
                      {profile && (
                        <p className="text-xs text-ink/50">
                          {profile.role_preference} &middot; {profile.available_hours_per_week}h/wk
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary">{m.role}</Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderOpen className="h-5 w-5 text-moss" />
              Projects ({state.projects.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.projects.length === 0 ? (
              <p className="text-sm text-ink/40">No projects yet.</p>
            ) : (
              state.projects.map((p) => (
                <a
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-ink/10 p-3 transition hover:border-moss/40 hover:bg-moss/5"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-ink/50">{p.status}</p>
                  </div>
                  <Badge
                    className={
                      p.status === "active"
                        ? "bg-moss/20 text-moss"
                        : p.status === "at_risk"
                          ? "bg-coral/20 text-coral"
                          : ""
                    }
                  >
                    {p.status}
                  </Badge>
                </a>
              ))
            )}
            <Separator className="my-2" />
            <Button variant="outline" className="w-full gap-2" onClick={() => window.location.href = `/projects/new?workspaceId=${workspaceId}`}>
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
