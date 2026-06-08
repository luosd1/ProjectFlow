"use client";

import dynamic from "next/dynamic";
import remarkGfm from "remark-gfm";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        ol: ({ children, ...props }) => (
          <ol className="list-decimal pl-4 space-y-0.5" {...props}>{children}</ol>
        ),
        ul: ({ children, ...props }) => (
          <ul className="list-disc pl-4 space-y-0.5" {...props}>{children}</ul>
        ),
        li: ({ children, ...props }) => (
          <li className="text-xs leading-5" {...props}>{children}</li>
        ),
        p: ({ children, ...props }) => (
          <p className="text-xs leading-5" {...props}>{children}</p>
        ),
        strong: ({ children, ...props }) => (
          <strong className="font-semibold" {...props}>{children}</strong>
        ),
        code: ({ children, className, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return <code className="rounded bg-neutral-200/60 px-1 py-0.5 text-[11px]" {...props}>{children}</code>;
          }
          return (
            <pre className="my-1 overflow-x-auto rounded-md bg-neutral-200/60 p-2">
              <code className="text-[11px]" {...props}>{children}</code>
            </pre>
          );
        },
        table: ({ children, ...props }) => (
          <div className="my-1 overflow-x-auto">
            <table className="text-xs" {...props}>{children}</table>
          </div>
        ),
        th: ({ children, ...props }) => (
          <th className="border-b border-neutral-200 px-2 py-1 text-left font-semibold" {...props}>{children}</th>
        ),
        td: ({ children, ...props }) => (
          <td className="border-b border-neutral-100 px-2 py-1" {...props}>{children}</td>
        ),
      }}
    >
        {content}
      </ReactMarkdown>
    </div>
  );
}
