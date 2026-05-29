"use client";

import { CalendarDays, Flag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Stage, Task } from "@/lib/types";

type StagePlanBoardProps = {
  stages: Stage[];
  tasks: Task[];
  currentStageId?: string | null;
};

function statusClass(status: Stage["status"]) {
  if (status === "active") return "bg-moss/15 text-moss";
  if (status === "at_risk") return "bg-coral/15 text-coral";
  if (status === "completed") return "bg-ink/10 text-ink/60";
  return "bg-white text-ink/55";
}

export function StagePlanBoard({ stages, tasks, currentStageId }: StagePlanBoardProps) {
  const completed = stages.filter((stage) => stage.status === "completed").length;
  const progress = stages.length > 0 ? Math.round((completed / stages.length) * 100) : 0;

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Plan board</h2>
          <p className="mt-1 text-sm text-ink/60">Stages, milestones, deliverables, and completion criteria.</p>
        </div>
        <div className="w-44">
          <Progress value={progress} className="h-2" />
          <p className="mt-1 text-right text-xs text-ink/50">{progress}% complete</p>
        </div>
      </div>

      {stages.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-ink/15 bg-paper/70 p-6 text-sm text-ink/55">
          No stages yet. Generate a stage plan after the direction card is confirmed.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {stages.map((stage) => {
            const stageTasks = tasks.filter((task) => task.stage_id === stage.id);
            const isCurrent = stage.id === currentStageId || stage.status === "active";
            return (
              <article
                key={stage.id}
                className="rounded-lg border border-ink/10 bg-paper/60 p-4"
                data-current={isCurrent ? "true" : "false"}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-ink">{stage.name}</h3>
                      {isCurrent && <Badge className="bg-citron/40 text-ink">current</Badge>}
                      <Badge className={statusClass(stage.status)}>{stage.status}</Badge>
                    </div>
                    <p className="mt-1 max-w-2xl text-sm text-ink/65">{stage.goal}</p>
                  </div>
                  <div className="text-right text-xs text-ink/55">
                    <div className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {stage.start_date} {" -> "} {stage.end_date}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr]">
                  <div className="rounded-md bg-white p-3">
                    <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                      <Flag className="h-3.5 w-3.5" />
                      Deliverable
                    </p>
                    <p className="mt-1 text-sm text-ink/75">{stage.deliverable}</p>
                  </div>
                  <div className="rounded-md bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Tasks</p>
                    <p className="mt-1 text-sm text-ink/75">
                      {stageTasks.length === 0 ? "No tasks yet" : `${stageTasks.length} task${stageTasks.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
