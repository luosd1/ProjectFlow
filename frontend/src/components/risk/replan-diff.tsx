"use client";

import { ArrowRight, GitBranch, Minus, Plus, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Task } from "@/lib/types";

type ReplanDiffProps = {
  before: Task[];
  after: Task[];
  /** Replan proposal metadata — when available, show before/after/impact/reason/confirmation */
  proposal?: {
    before: Record<string, unknown> | unknown[];
    after: Record<string, unknown> | unknown[];
    impact: string;
    reason: string;
    requires_confirmation: boolean;
  } | null;
};

type DiffItem = {
  kind: "added" | "removed" | "modified" | "unchanged";
  task: Task;
  beforeTask?: Task;
  changes: string[];
};

function buildDiff(before: Task[], after: Task[]): DiffItem[] {
  const beforeMap = new Map(before.map((t) => [t.id, t]));
  const afterMap = new Map(after.map((t) => [t.id, t]));
  const allIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const items: DiffItem[] = [];

  for (const id of allIds) {
    const b = beforeMap.get(id);
    const a = afterMap.get(id);

    if (!b && a) {
      items.push({ kind: "added", task: a, changes: ["新增任务"] });
    } else if (b && !a) {
      items.push({ kind: "removed", task: b, changes: ["移除任务"] });
    } else if (b && a) {
      const changes: string[] = [];
      if (b.status !== a.status) changes.push(`状态：${b.status} → ${a.status}`);
      if (b.owner_user_id !== a.owner_user_id) changes.push("负责人已调整");
      if (b.due_date !== a.due_date) changes.push(`截止：${b.due_date} → ${a.due_date}`);
      if (b.priority !== a.priority) changes.push(`优先级：${b.priority} → ${a.priority}`);
      if (changes.length > 0) {
        items.push({ kind: "modified", task: a, beforeTask: b, changes });
      } else {
        items.push({ kind: "unchanged", task: a, changes: [] });
      }
    }
  }

  return items;
}

function kindClass(kind: DiffItem["kind"]) {
  switch (kind) {
    case "added":
      return "border-moss/30 bg-moss/5";
    case "removed":
      return "border-coral/30 bg-coral/5";
    case "modified":
      return "border-citron/50 bg-citron/10";
    default:
      return "border-ink/10 bg-paper/40";
  }
}

function kindBadgeClass(kind: DiffItem["kind"]) {
  switch (kind) {
    case "added":
      return "bg-moss/15 text-moss";
    case "removed":
      return "bg-coral/15 text-coral";
    case "modified":
      return "bg-citron/40 text-ink";
    default:
      return "bg-ink/8 text-ink/55";
  }
}

function kindLabel(kind: DiffItem["kind"]) {
  switch (kind) {
    case "added":
      return "新增";
    case "removed":
      return "移除";
    case "modified":
      return "调整";
    default:
      return "未变化";
  }
}

function kindIcon(kind: DiffItem["kind"]) {
  switch (kind) {
    case "added":
      return <Plus className="h-4 w-4 text-moss" />;
    case "removed":
      return <Minus className="h-4 w-4 text-coral" />;
    case "modified":
      return <RefreshCw className="h-4 w-4 text-harbor" />;
    default:
      return <GitBranch className="h-4 w-4 text-ink/40" />;
  }
}

/** Render a before/after summary — handles dict, list, or string */
function renderSummary(value: Record<string, unknown> | unknown[]) {
  if (Array.isArray(value)) {
    return <span className="text-ink/60">{JSON.stringify(value)}</span>;
  }
  if (typeof value === "object" && value !== null) {
    return (
      <div className="space-y-1">
        {Object.entries(value).map(([key, val]) => (
          <div key={key} className="text-xs text-ink/60">
            <span className="font-medium text-ink/70">{key}</span>: {String(val)}
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-ink/60">{String(value)}</span>;
}

export function ReplanDiff({ before, after, proposal }: ReplanDiffProps) {
  const diff = buildDiff(before, after);
  const added = diff.filter((d) => d.kind === "added");
  const removed = diff.filter((d) => d.kind === "removed");
  const modified = diff.filter((d) => d.kind === "modified");

  if (diff.length === 0 && !proposal) {
    return (
      <div className="rounded-lg border border-dashed border-ink/15 bg-paper/70 p-6 text-sm text-ink/55">
        暂无可展示的调整。
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">计划调整</h2>
          <p className="mt-1 text-sm text-ink/60">展示最近一次重排后的任务变化。</p>
        </div>
        <div className="flex gap-2">
          {added.length > 0 && (
            <Badge className="bg-moss/15 text-moss">
              <Plus className="mr-1 h-3 w-3" />
              {added.length}
            </Badge>
          )}
          {removed.length > 0 && (
            <Badge className="bg-coral/15 text-coral">
              <Minus className="mr-1 h-3 w-3" />
              {removed.length}
            </Badge>
          )}
          {modified.length > 0 && (
            <Badge className="bg-citron/40 text-ink">
              <RefreshCw className="mr-1 h-3 w-3" />
              {modified.length}
            </Badge>
          )}
        </div>
      </div>

      {/* Replan proposal metadata */}
      {proposal && (
        <div className="mt-4 rounded-lg border border-citron/30 bg-citron/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-citron" />
            <span className="font-semibold text-ink">重排建议</span>
            {proposal.requires_confirmation && (
              <Badge className="bg-citron/40 text-ink">待确认</Badge>
            )}
          </div>

          {proposal.impact && (
            <p className="mt-2 text-sm text-ink/70">
              <span className="font-semibold text-ink/80">影响：</span> {proposal.impact}
            </p>
          )}
          {proposal.reason && (
            <p className="mt-1 text-sm text-ink/70">
              <span className="font-semibold text-ink/80">原因：</span> {proposal.reason}
            </p>
          )}

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-md bg-white px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">调整前</p>
              <div className="mt-1">{renderSummary(proposal.before)}</div>
            </div>
            <div className="rounded-md bg-white px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">调整后</p>
              <div className="mt-1">{renderSummary(proposal.after)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3">
        {diff
          .filter((d) => d.kind !== "unchanged")
          .map((item) => (
            <article
              key={item.task.id}
              className={`rounded-lg border p-4 ${kindClass(item.kind)}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {kindIcon(item.kind)}
                <h3 className="font-semibold text-ink">{item.task.title}</h3>
                <Badge className={kindBadgeClass(item.kind)}>{kindLabel(item.kind)}</Badge>
              </div>

              {item.changes.length > 0 && (
                <div className="mt-3 space-y-1">
                  {item.changes.map((change, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-ink/70">
                      <ArrowRight className="h-3 w-3 text-ink/40" />
                      {change}
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
      </div>
    </section>
  );
}
