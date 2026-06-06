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
  source_summary?: string;
  assumptions?: string[];
  unknowns?: string[];
  mvp_boundary?: {
    must_have?: string[];
    defer?: string[];
    out_of_scope?: string[];
  };
  decision_points?: string[];
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
      <div className={cn("mt-1 text-sm leading-6 text-ink/75 break-all", emphasized && "text-base font-semibold leading-7 text-ink")}>
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
  const assumptions = safeStringList(content.assumptions);
  const unknowns = safeStringList(content.unknowns);
  const decisionPoints = safeStringList(content.decision_points);
  const mustHave = safeStringList(content.mvp_boundary?.must_have);
  const defer = safeStringList(content.mvp_boundary?.defer);
  const outOfScope = safeStringList(content.mvp_boundary?.out_of_scope);
  const hasAudienceOrValue = Boolean(content.users || content.value);
  const hasConstraints = boundaries.length > 0 || risks.length > 0;
  const hasMvpBoundary = mustHave.length > 0 || defer.length > 0 || outOfScope.length > 0;

  return (
    <article className={cn("space-y-6", compact && "space-y-4")}>
      {content.reason && (
        <p className="rounded-md bg-moss/5 px-3 py-2 text-sm leading-6 text-ink/65">
          {content.reason}
        </p>
      )}

      {content.source_summary && (
        <section className="border-b border-ink/8 pb-4">
          <FieldBlock label="依据摘要">
            {content.source_summary}
          </FieldBlock>
        </section>
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
                  <li key={deliverable} className="flex gap-2 break-all">
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
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-ink/75">
                {boundaries.map((boundary) => (
                  <li key={boundary} className="break-all whitespace-normal">
                    {boundary}
                  </li>
                ))}
              </ul>
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
                  <li key={risk} className="flex gap-2 break-all">
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
                  <li key={question} className="break-all">{question}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {(assumptions.length > 0 || unknowns.length > 0) && (
        <section className="grid gap-5 border-t border-ink/8 pt-5 md:grid-cols-2">
          {assumptions.length > 0 && (
            <div>
              <SectionTitle>当前假设</SectionTitle>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-ink/75">
                {assumptions.map((item) => (
                  <li key={item} className="break-all">{item}</li>
                ))}
              </ul>
            </div>
          )}
          {unknowns.length > 0 && (
            <div>
              <SectionTitle>关键信息缺口</SectionTitle>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-coral/85">
                {unknowns.map((item) => (
                  <li key={item} className="break-all">{item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {(hasMvpBoundary || decisionPoints.length > 0) && (
        <section className="grid gap-5 border-t border-ink/8 pt-5 md:grid-cols-2">
          {hasMvpBoundary && (
            <div>
              <SectionTitle>MVP 边界</SectionTitle>
              <div className="mt-2 grid gap-3 text-sm leading-6 text-ink/75">
                {mustHave.length > 0 && (
                  <BoundaryGroup label="必须完成" items={mustHave} tone="moss" />
                )}
                {defer.length > 0 && (
                  <BoundaryGroup label="可推迟" items={defer} tone="ink" />
                )}
                {outOfScope.length > 0 && (
                  <BoundaryGroup label="不做" items={outOfScope} tone="coral" />
                )}
              </div>
            </div>
          )}
          {decisionPoints.length > 0 && (
            <div>
              <SectionTitle>待决策点</SectionTitle>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-ink/75">
                {decisionPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

function BoundaryGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "moss" | "ink" | "coral";
}) {
  const toneClass = {
    moss: "border-moss/20 bg-moss/5 text-moss",
    ink: "border-ink/10 bg-ink/3 text-ink/65",
    coral: "border-coral/20 bg-coral/5 text-coral",
  }[tone];

  return (
    <div>
      <Badge variant="outline" className={cn("mb-1 border px-2 py-0.5", toneClass)}>
        {label}
      </Badge>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
