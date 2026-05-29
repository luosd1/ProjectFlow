"use client";

import { CheckCircle2, HelpCircle, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AgentEvent, DirectionCard } from "@/lib/types";

type DirectionCardPanelProps = {
  directionCard?: DirectionCard | null;
  timeline: AgentEvent[];
  pending?: boolean;
  onRunClarification?: () => void;
};

function readStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function latestClarification(timeline: AgentEvent[]) {
  return [...timeline].reverse().find((event) => event.event_type === "clarify");
}

export function DirectionCardPanel({
  directionCard,
  timeline,
  pending,
  onRunClarification,
}: DirectionCardPanelProps) {
  const clarification = latestClarification(timeline);
  const questions = readStringList(clarification?.output_snapshot.suggested_questions);
  const confirmed = Boolean(directionCard);

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Clarification</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink/60">
            Direction is confirmed before planning so later task and owner suggestions do not drift.
          </p>
        </div>
        <Badge className={confirmed ? "bg-moss/15 text-moss" : "bg-citron/35 text-ink"}>
          {confirmed ? "confirmed" : "waiting"}
        </Badge>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-lg border border-ink/10 bg-paper/70 p-4">
          {directionCard ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Problem</p>
                <p className="mt-1 text-sm font-semibold text-ink">{directionCard.problem}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Target users</p>
                  <p className="mt-1 text-sm text-ink/75">{directionCard.target_users}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">Core value</p>
                  <p className="mt-1 text-sm text-ink/75">{directionCard.core_value}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {directionCard.constraints.map((constraint) => (
                  <Badge key={constraint} variant="outline" className="border-ink/15 bg-white text-ink/70">
                    {constraint}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-start justify-center gap-3">
              <HelpCircle className="h-6 w-6 text-harbor" />
              <div>
                <p className="font-semibold text-ink">No direction card yet</p>
                <p className="mt-1 text-sm text-ink/60">Run clarification after project intake and resources are ready.</p>
              </div>
              <Button onClick={onRunClarification} disabled={pending} className="bg-ink text-white hover:bg-ink/85">
                <Sparkles className="h-4 w-4" />
                Run clarification
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-ink/10 bg-white p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-moss" />
            <p className="font-semibold text-ink">Agent questions</p>
          </div>
          {questions.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {questions.map((question) => (
                <li key={question} className="rounded-md bg-paper px-3 py-2 text-sm text-ink/75">
                  {question}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink/50">Questions will appear after clarification runs.</p>
          )}
        </div>
      </div>
    </section>
  );
}
