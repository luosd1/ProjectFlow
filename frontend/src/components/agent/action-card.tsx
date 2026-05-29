"use client";

import { CheckCircle2, Clock, Lightbulb, ShieldAlert, UserCheck, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActionCard } from "@/lib/types";

type ActionCardItemProps = {
  card: ActionCard;
  onDismiss?: (cardId: string) => void | Promise<void>;
  onComplete?: (cardId: string) => void | Promise<void>;
  pending?: boolean;
};

function typeIcon(type: ActionCard["type"]) {
  switch (type) {
    case "personal_task":
      return <UserCheck className="h-4 w-4" />;
    case "team_next_step":
      return <Lightbulb className="h-4 w-4" />;
    case "reminder":
      return <Clock className="h-4 w-4" />;
    case "risk_action":
      return <ShieldAlert className="h-4 w-4" />;
    default:
      return <Lightbulb className="h-4 w-4" />;
  }
}

function typeLabel(type: ActionCard["type"]) {
  const labels: Record<ActionCard["type"], string> = {
    personal_task: "Personal task",
    team_next_step: "Team next step",
    reminder: "Reminder",
    risk_action: "Risk action",
    kickoff_tip: "Kickoff tip",
    checkin_prompt: "Check-in",
    assignment_request: "Assignment",
  };
  return labels[type];
}

function typeClass(type: ActionCard["type"]) {
  switch (type) {
    case "personal_task":
      return "bg-harbor/15 text-harbor";
    case "team_next_step":
      return "bg-moss/15 text-moss";
    case "reminder":
      return "bg-citron/40 text-ink";
    case "risk_action":
      return "bg-coral/15 text-coral";
    default:
      return "bg-ink/8 text-ink/55";
  }
}

export function ActionCardItem({ card, onDismiss, onComplete, pending }: ActionCardItemProps) {
  return (
    <article className="rounded-lg border border-ink/10 bg-paper/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={typeClass(card.type)}>{typeIcon(card.type)}</span>
            <h3 className="font-semibold text-ink">{card.title}</h3>
            <Badge className={typeClass(card.type)}>{typeLabel(card.type)}</Badge>
            <Badge
              className={
                card.status === "active"
                  ? "bg-moss/15 text-moss"
                  : card.status === "done"
                    ? "bg-ink/8 text-ink/55"
                    : "bg-ink/8 text-ink/55"
              }
            >
              {card.status}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-ink/70">{card.content}</p>

          {card.goal && (
            <p className="mt-2 text-sm text-ink/70">
              <span className="font-semibold text-ink/80">Goal:</span> {card.goal}
            </p>
          )}
          {card.start_suggestion && (
            <p className="mt-1 text-sm text-ink/70">
              <span className="font-semibold text-ink/80">Start:</span> {card.start_suggestion}
            </p>
          )}
          {card.completion_standard && (
            <p className="mt-1 text-sm text-ink/70">
              <span className="font-semibold text-ink/80">Done when:</span> {card.completion_standard}
            </p>
          )}

          {card.reason && (
            <p className="mt-2 flex items-center gap-1 text-xs text-ink/50">
              <Lightbulb className="h-3 w-3" />
              {card.reason}
            </p>
          )}
          {card.due_date && (
            <p className="mt-1 text-xs text-ink/50">
              Due: {new Date(card.due_date).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {card.status === "active" && (
            <>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => onComplete?.(card.id)}
                className="bg-moss text-white hover:bg-moss/85"
              >
                <CheckCircle2 className="h-4 w-4" />
                Done
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onDismiss?.(card.id)}
              >
                <XCircle className="h-4 w-4" />
                Dismiss
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

type ActionCardsListProps = {
  cards: ActionCard[];
  emptyText?: string;
  onDismiss?: (cardId: string) => void | Promise<void>;
  onComplete?: (cardId: string) => void | Promise<void>;
  pending?: boolean;
};

export function ActionCardsList({
  cards,
  emptyText = "No action cards yet.",
  onDismiss,
  onComplete,
  pending,
}: ActionCardsListProps) {
  const activeCards = cards.filter((card) => card.status === "active");

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-ink/15 bg-paper/70 p-6 text-sm text-ink/55">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {activeCards.length === 0 && (
        <div className="rounded-lg border border-dashed border-ink/15 bg-paper/70 p-6 text-sm text-ink/55">
          No active action cards.
        </div>
      )}
      {activeCards.map((card) => (
        <ActionCardItem
          key={card.id}
          card={card}
          onDismiss={onDismiss}
          onComplete={onComplete}
          pending={pending}
        />
      ))}
    </div>
  );
}
