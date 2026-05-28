"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, Lightbulb, Route, FileText, ListTodo, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getProjectState, runClarification } from "@/lib/api";
import type { ProjectState } from "@/lib/types";

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [state, setState] = useState<ProjectState | null>(null);
  const [clarifying, setClarifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProjectState(projectId)
      .then(setState)
      .catch(() => setError("Failed to load project"))
      .finally(() => setLoading(false));
  }, [projectId]);

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
        <p className="text-sm text-coral">{error ?? "Project not found"}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const { project, resources, stages, tasks, risks, action_cards } = state;

  const statusColor: Record<string, string> = {
    draft: "bg-ink/10 text-ink/60",
    active: "bg-moss/20 text-moss",
    at_risk: "bg-coral/20 text-coral",
    completed: "bg-moss/30 text-moss",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-4xl px-5 py-8"
    >
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">Project</p>
            <h1 className="font-display mt-2 text-3xl font-black">{project.name}</h1>
          </div>
          <Badge className={statusColor[project.status] ?? ""}>{project.status}</Badge>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Project Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-citron" />
              Project Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-ink/60">Idea</p>
              <p className="mt-1">{project.idea}</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-semibold text-ink/60">Deadline</p>
                <p>{project.deadline}</p>
              </div>
              <div>
                <p className="font-semibold text-ink/60">Deliverables</p>
                <p>{project.deliverables}</p>
              </div>
            </div>
            {project.direction_card && (
              <>
                <Separator />
                <div>
                  <p className="font-semibold text-moss">Direction Card</p>
                  <p className="mt-1">{project.direction_card.problem}</p>
                  <p className="mt-1 text-ink/50">Target: {project.direction_card.target_users}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-harbor" />
              Resources ({resources.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resources.length === 0 ? (
              <p className="text-sm text-ink/40">No resources attached.</p>
            ) : (
              resources.map((r) => (
                <div key={r.id} className="rounded-lg border border-ink/10 p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{r.type}</Badge>
                    <p className="font-medium">{r.title}</p>
                  </div>
                  {r.content_text && (
                    <p className="mt-1 line-clamp-2 text-xs text-ink/50">{r.content_text}</p>
                  )}
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs text-harbor underline">
                      {r.url}
                    </a>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Stages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Route className="h-5 w-5 text-moss" />
              Stages ({stages.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stages.length === 0 ? (
              <p className="text-sm text-ink/40">No stages yet. Run clarification first.</p>
            ) : (
              stages.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-ink/10 p-3">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-ink/50">{s.start_date} → {s.end_date}</p>
                  </div>
                  <Badge className={s.status === "active" ? "bg-moss/20 text-moss" : ""}>{s.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Tasks + Risks Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListTodo className="h-5 w-5 text-ink/60" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink/60">Tasks</span>
              <span className="font-bold">{tasks.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/60">P0 Tasks</span>
              <span className="font-bold">{tasks.filter((t) => t.priority === "P0").length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/60">Open Risks</span>
              <span className="font-bold text-coral">{risks.filter((r) => r.status === "open").length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/60">Active Action Cards</span>
              <span className="font-bold">{action_cards.filter((a) => a.status === "active").length}</span>
            </div>
            <Separator />
            <Button
              variant="outline"
              className="w-full gap-2"
              disabled={clarifying}
              onClick={async () => {
                setClarifying(true);
                try {
                  await runClarification(projectId);
                  router.refresh();
                } catch {
                  // Error shown by toast/notification when available
                } finally {
                  setClarifying(false);
                }
              }}
            >
              {clarifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {clarifying ? "Running..." : "Run Clarification"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
