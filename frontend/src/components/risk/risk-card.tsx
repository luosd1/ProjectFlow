"use client";

import { AlertTriangle, CheckCircle2, EyeOff, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Risk } from "@/lib/types";

type RiskCardProps = {
  risk: Risk;
  onAccept?: (riskId: string) => void | Promise<void>;
  onIgnore?: (riskId: string) => void | Promise<void>;
  onResolve?: (riskId: string) => void | Promise<void>;
  pending?: boolean;
};

function severityClass(severity: Risk["severity"]) {
  if (severity === "high") return "bg-coral/15 text-coral";
  if (severity === "medium") return "bg-citron/40 text-ink";
  return "bg-ink/8 text-ink/55";
}

function typeLabel(type: Risk["type"]) {
  const labels: Record<Risk["type"], string> = {
    deadline: "Deadline",
    dependency: "Dependency",
    workload: "Workload",
    scope: "Scope",
    review: "Review",
    assignment: "Assignment",
    checkin: "Check-in",
  };
  return labels[type];
}

function typeClass(type: Risk["type"]) {
  switch (type) {
    case "deadline":
      return "bg-coral/15 text-coral";
    case "dependency":
      return "bg-harbor/15 text-harbor";
    case "workload":
      return "bg-citron/40 text-ink";
    case "scope":
      return "bg-ink/8 text-ink/55";
    default:
      return "bg-ink/8 text-ink/55";
  }
}

export function RiskCard({ risk, onAccept, onIgnore, onResolve, pending }: RiskCardProps) {
  return (
    <article className="rounded-lg border border-ink/10 bg-paper/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-coral" />
            <h3 className="font-semibold text-ink">{risk.title}</h3>
            <Badge className={severityClass(risk.severity)}>{risk.severity}</Badge>
            <Badge className={typeClass(risk.type)}>{typeLabel(risk.type)}</Badge>
            <Badge
              className={
                risk.status === "open"
                  ? "bg-coral/15 text-coral"
                  : risk.status === "resolved"
                    ? "bg-moss/15 text-moss"
                    : "bg-ink/8 text-ink/55"
              }
            >
              {risk.status}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-ink/70">{risk.description}</p>

          {risk.evidence.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Evidence</p>
              <ul className="mt-1 space-y-1">
                {risk.evidence.map((item, index) => (
                  <li key={index} className="text-xs text-ink/60">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {risk.recommendation && (
            <div className="mt-3 rounded-md bg-white px-3 py-2 text-sm text-ink/75">
              <span className="font-semibold text-ink/70">Recommendation:</span> {risk.recommendation}
            </div>
          )}
        </div>

        {risk.status === "open" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => onResolve?.(risk.id)}
              className="bg-moss text-white hover:bg-moss/85"
            >
              <ShieldCheck className="h-4 w-4" />
              Resolve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => onAccept?.(risk.id)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => onIgnore?.(risk.id)}
            >
              <EyeOff className="h-4 w-4" />
              Ignore
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
