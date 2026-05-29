"use client";

import { AlertTriangle, GitBranch, Scissors } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Stage, Task } from "@/lib/types";

type TaskBreakdownBoardProps = {
  stages: Stage[];
  tasks: Task[];
};

function priorityClass(priority: Task["priority"]) {
  if (priority === "P0") return "bg-coral/15 text-coral";
  if (priority === "P1") return "bg-harbor/15 text-harbor";
  return "bg-ink/8 text-ink/55";
}

function statusClass(status: Task["status"]) {
  if (status === "blocked") return "bg-coral/15 text-coral";
  if (status === "done") return "bg-moss/15 text-moss";
  if (status === "in_progress") return "bg-citron/40 text-ink";
  return "bg-white text-ink/55";
}

export function TaskBreakdownBoard({ stages, tasks }: TaskBreakdownBoardProps) {
  const stageNameById = new Map(stages.map((stage) => [stage.id, stage.name]));
  const taskTitleById = new Map(tasks.map((task) => [task.id, task.title]));

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-ink">Task breakdown</h2>
        <p className="mt-1 text-sm text-ink/60">Tasks keep priority, dependencies, due dates, and cut/delay signals visible.</p>
      </div>

      {tasks.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-ink/15 bg-paper/70 p-6 text-sm text-ink/55">
          No tasks yet. Run task breakdown after a stage plan exists.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {tasks.map((task) => {
            const dependencies = task.dependency_ids.map((id) => taskTitleById.get(id) ?? id);
            return (
              <article key={task.id} className="rounded-lg border border-ink/10 bg-paper/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={priorityClass(task.priority)}>{task.priority}</Badge>
                      <h3 className="font-semibold text-ink">{task.title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-ink/60">{task.description}</p>
                  </div>
                  <Badge className={statusClass(task.status)}>{task.status}</Badge>
                </div>

                <div className="mt-4 grid gap-2 text-xs text-ink/60 sm:grid-cols-3">
                  <div className="rounded-md bg-white px-3 py-2">
                    <span className="font-semibold text-ink/70">Stage:</span> {stageNameById.get(task.stage_id) ?? "Unassigned"}
                  </div>
                  <div className="rounded-md bg-white px-3 py-2">
                    <span className="font-semibold text-ink/70">Due:</span> {task.due_date}
                  </div>
                  <div className="rounded-md bg-white px-3 py-2">
                    <span className="font-semibold text-ink/70">Estimate:</span> {task.estimated_hours}h
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {dependencies.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-ink/65">
                      <GitBranch className="h-3.5 w-3.5" />
                      Depends on: {dependencies.join(", ")}
                    </span>
                  )}
                  {task.can_cut && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-citron/35 px-2 py-1 text-ink">
                      <Scissors className="h-3.5 w-3.5" />
                      Can cut
                    </span>
                  )}
                  {task.status === "blocked" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-coral/15 px-2 py-1 text-coral">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Delay marker
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
