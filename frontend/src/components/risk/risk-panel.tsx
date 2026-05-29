"use client";

import { ShieldAlert } from "lucide-react";

import { RiskCard } from "@/components/risk/risk-card";
import type { Risk } from "@/lib/types";

type RiskPanelProps = {
  risks: Risk[];
  onAccept?: (riskId: string) => void | Promise<void>;
  onIgnore?: (riskId: string) => void | Promise<void>;
  onResolve?: (riskId: string) => void | Promise<void>;
  pending?: boolean;
};

export function RiskPanel({ risks, onAccept, onIgnore, onResolve, pending }: RiskPanelProps) {
  const openRisks = risks.filter((risk) => risk.status === "open");
  const highSeverityCount = openRisks.filter((risk) => risk.severity === "high").length;

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Risks</h2>
          <p className="mt-1 text-sm text-ink/60">
            Agent-identified risks with evidence and recommendations.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-coral/15 px-3 py-1 text-xs font-medium text-coral">
          <ShieldAlert className="h-3.5 w-3.5" />
          {openRisks.length} open{highSeverityCount > 0 && `, ${highSeverityCount} high`}
        </div>
      </div>

      <div className="mt-5">
        {risks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink/15 bg-paper/70 p-6 text-sm text-ink/55">
            No risks identified yet. Run risk analysis after check-ins are submitted.
          </div>
        ) : (
          <div className="grid gap-3">
            {openRisks.length === 0 && (
              <div className="rounded-lg border border-dashed border-ink/15 bg-paper/70 p-6 text-sm text-ink/55">
                All risks are resolved or ignored.
              </div>
            )}
            {openRisks.map((risk) => (
              <RiskCard
                key={risk.id}
                risk={risk}
                onAccept={onAccept}
                onIgnore={onIgnore}
                onResolve={onResolve}
                pending={pending}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
