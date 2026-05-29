"use client";

import { useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  GitMerge,
  Lightbulb,
  ListChecks,
  MessageSquareWarning,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AgentEvent } from "@/lib/types";

type AgentTimelineProps = {
  events: AgentEvent[];
};

function eventIcon(type: AgentEvent["event_type"]) {
  switch (type) {
    case "clarify":
      return <Lightbulb className="h-4 w-4" />;
    case "plan":
      return <ClipboardList className="h-4 w-4" />;
    case "breakdown":
      return <ListChecks className="h-4 w-4" />;
    case "assign":
      return <Users className="h-4 w-4" />;
    case "negotiate":
      return <GitMerge className="h-4 w-4" />;
    case "push":
      return <Sparkles className="h-4 w-4" />;
    case "checkin":
      return <MessageSquareWarning className="h-4 w-4" />;
    case "risk":
      return <ShieldAlert className="h-4 w-4" />;
    case "replan":
      return <RefreshCw className="h-4 w-4" />;
    case "export":
      return <Bot className="h-4 w-4" />;
    default:
      return <Bot className="h-4 w-4" />;
  }
}

function eventLabel(type: AgentEvent["event_type"]) {
  const labels: Record<AgentEvent["event_type"], string> = {
    clarify: "Clarify",
    plan: "Plan",
    breakdown: "Breakdown",
    assign: "Assign",
    negotiate: "Negotiate",
    push: "Push",
    checkin: "Check-in",
    risk: "Risk",
    replan: "Replan",
    export: "Export",
  };
  return labels[type];
}

function eventClass(type: AgentEvent["event_type"]) {
  switch (type) {
    case "clarify":
      return "bg-harbor/15 text-harbor";
    case "plan":
      return "bg-moss/15 text-moss";
    case "breakdown":
      return "bg-citron/40 text-ink";
    case "assign":
      return "bg-ink/8 text-ink/55";
    case "negotiate":
      return "bg-harbor/15 text-harbor";
    case "push":
      return "bg-moss/15 text-moss";
    case "checkin":
      return "bg-citron/40 text-ink";
    case "risk":
      return "bg-coral/15 text-coral";
    case "replan":
      return "bg-coral/15 text-coral";
    case "export":
      return "bg-ink/8 text-ink/55";
    default:
      return "bg-ink/8 text-ink/55";
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupByDate(events: AgentEvent[]) {
  const groups = new Map<string, AgentEvent[]>();
  for (const event of events) {
    const date = new Date(event.created_at).toLocaleDateString();
    const existing = groups.get(date) ?? [];
    existing.push(event);
    groups.set(date, existing);
  }
  return groups;
}

function SnapshotPreview({ snapshot }: { snapshot: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);

  const preview = JSON.stringify(snapshot, null, 2);
  const lines = preview.split("\n");
  const truncated = lines.slice(0, 6).join("\n");

  if (lines.length <= 6) {
    return (
      <pre className="mt-2 rounded-md bg-ink/5 p-3 text-xs text-ink/70 overflow-auto">
        {preview}
      </pre>
    );
  }

  return (
    <div className="mt-2">
      <pre className="rounded-md bg-ink/5 p-3 text-xs text-ink/70 overflow-auto">
        {expanded ? preview : truncated + "\n..."}
      </pre>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 h-7 text-xs"
      >
        {expanded ? (
          <>
            <ChevronUp className="mr-1 h-3 w-3" />
            Show less
          </>
        ) : (
          <>
            <ChevronDown className="mr-1 h-3 w-3" />
            Show more
          </>
        )}
      </Button>
    </div>
  );
}

export function AgentTimeline({ events }: AgentTimelineProps) {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-ink/15 bg-paper/70 p-6 text-sm text-ink/55">
        No timeline events yet. Run agent actions to see the decision trail.
      </div>
    );
  }

  const groups = groupByDate(events);
  const sortedDates = Array.from(groups.keys()).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-ink">Agent timeline</h2>
        <p className="mt-1 text-sm text-ink/60">
          Decision trail with evidence, actions, and fallback events.
        </p>
      </div>

      <div className="mt-5 space-y-6">
        {sortedDates.map((date) => (
          <div key={date}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
              {date}
            </p>
            <div className="mt-3 space-y-3">
              {(groups.get(date) ?? []).map((event) => {
                const isExpanded = expandedEventId === event.id;
                return (
                  <article
                    key={event.id}
                    className="rounded-lg border border-ink/10 bg-paper/50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={eventClass(event.event_type)}>
                          {eventIcon(event.event_type)}
                        </span>
                        <Badge className={eventClass(event.event_type)}>
                          {eventLabel(event.event_type)}
                        </Badge>
                        <span className="text-xs text-ink/50">
                          {formatDate(event.created_at)}
                        </span>
                      </div>
                      {event.user_confirmed && (
                        <Badge className="bg-moss/15 text-moss">Confirmed</Badge>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-ink/75">{event.reasoning_summary}</p>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedEventId(isExpanded ? null : event.id)
                      }
                      className="mt-2 h-7 text-xs"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="mr-1 h-3 w-3" />
                          Hide details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="mr-1 h-3 w-3" />
                          View details
                        </>
                      )}
                    </Button>

                    {isExpanded && (
                      <div className="mt-2 space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                            Input
                          </p>
                          <SnapshotPreview snapshot={event.input_snapshot} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                            Output
                          </p>
                          <SnapshotPreview snapshot={event.output_snapshot} />
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
