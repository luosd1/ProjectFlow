"use client";

import { MarkdownContent } from "./MarkdownContent";

interface StreamingTextProps {
  buffer: string;
  className?: string;
}

export function StreamingText({ buffer, className }: StreamingTextProps) {
  if (!buffer) return null;

  return (
    <div className={className}>
      <MarkdownContent content={buffer} />
      <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-moss" />
    </div>
  );
}
