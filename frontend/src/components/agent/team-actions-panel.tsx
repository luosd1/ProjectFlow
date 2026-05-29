"use client";

import { Lightbulb } from "lucide-react";

import { ActionCardsList } from "@/components/agent/action-card";
import type { ActionCard } from "@/lib/types";

type TeamActionsPanelProps = {
  cards: ActionCard[];
  onDismiss?: (cardId: string) => void | Promise<void>;
  onComplete?: (cardId: string) => void | Promise<void>;
  pending?: boolean;
};

export function TeamActionsPanel({ cards, onDismiss, onComplete, pending }: TeamActionsPanelProps) {
  const teamCards = cards.filter(
    (card) => card.type === "team_next_step" || card.type === "kickoff_tip" || card.type === "reminder"
  );

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Team next actions</h2>
          <p className="mt-1 text-sm text-ink/60">
            Shared next steps and reminders surfaced by the agent.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-citron/35 px-3 py-1 text-xs font-medium text-ink">
          <Lightbulb className="h-3.5 w-3.5" />
          {teamCards.filter((c) => c.status === "active").length} active
        </div>
      </div>

      <div className="mt-5">
        <ActionCardsList
          cards={teamCards}
          emptyText="No team action cards yet. Run active push after assignments are confirmed."
          onDismiss={onDismiss}
          onComplete={onComplete}
          pending={pending}
        />
      </div>
    </section>
  );
}
