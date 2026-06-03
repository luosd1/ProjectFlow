"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DirectionDecisionContent = {
  problem?: string;
  users?: string;
  value?: string;
  deliverables?: string[];
  boundaries?: string[];
  risks?: string[];
  suggested_questions?: string[];
  reason?: string;
};

type DirectionDecisionViewProps = {
  content: DirectionDecisionContent;
  compact?: boolean;
};

function safeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function FieldBlock({
  label,
  children,
  emphasized,
}: {
  label: string;
  children: ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-ink/45">{label}</p>
      <div className={cn("mt-1 text-sm leading-6 text-ink/75", emphasized && "text-base font-semibold leading-7 text-ink")}>
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-ink/45">{children}</p>;
}

export function DirectionDecisionView({ content, compact }: DirectionDecisionViewProps) {
  const deliverables = safeStringList(content.deliverables);
  const boundaries = safeStringList(content.boundaries);
  const risks = safeStringList(content.risks);
  const questions = safeStringList(content.suggested_questions);
  const hasAudienceOrValue = Boolean(content.users || content.value);
  const hasConstraints = boundaries.length > 0 || risks.length > 0;

  return (
    <article className={cn("space-y-6", compact && "space-y-4")}>
      {content.reason && (
        <p className="rounded-md bg-moss/5 px-3 py-2 text-sm leading-6 text-ink/65">
          {content.reason}
        </p>
      )}

      {(content.problem || hasAudienceOrValue) && (
        <section className="space-y-4">
          {content.problem && (
            <div className="border-b border-ink/8 pb-4">
              <FieldBlock label="核心问题" emphasized>
                {content.problem}
              </FieldBlock>
            </div>
          )}
          {hasAudienceOrValue && (
            <div className="grid gap-4 sm:grid-cols-2">
              {content.users && (
                <FieldBlock label="目标用户">
                  {content.users}
                </FieldBlock>
              )}
              {content.value && (
                <FieldBlock label="核心价值">
                  {content.value}
                </FieldBlock>
              )}
            </div>
          )}
        </section>
      )}

      {(deliverables.length > 0 || boundaries.length > 0) && (
        <section className="grid gap-5 border-t border-ink/8 pt-5 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          {deliverables.length > 0 && (
            <div>
              <SectionTitle>交付物</SectionTitle>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-ink/75">
                {deliverables.map((deliverable) => (
                  <li key={deliverable} className="flex gap-2">
                    <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-moss" />
                    <span>{deliverable}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {boundaries.length > 0 && (
            <div>
              <SectionTitle>边界</SectionTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                {boundaries.map((boundary) => (
                  <Badge key={boundary} variant="outline" className="border-ink/15 bg-white text-ink/70">
                    {boundary}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {(risks.length > 0 || questions.length > 0) && (
        <section className="grid gap-5 border-t border-ink/8 pt-5 md:grid-cols-2">
          {risks.length > 0 && (
            <div>
              <SectionTitle>风险</SectionTitle>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-coral/85">
                {risks.map((risk) => (
                  <li key={risk} className="flex gap-2">
                    <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {questions.length > 0 && (
            <div>
              <SectionTitle>澄清问题</SectionTitle>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-ink/75">
                {questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </article>
  );
}
