"use client";

import { Copy, RefreshCw, ListTodo } from "lucide-react";
import type { AgentConversationMessage } from "@/lib/types";

interface MessageActionsProps {
  message: AgentConversationMessage;
  onCopy?: () => void;
  onRetry?: () => void;
  onAction?: (instruction: string) => void;
}

export function MessageActions({ message, onCopy, onRetry, onAction }: MessageActionsProps) {
  return (
    <div className="mt-2 flex items-center gap-1 border-t border-neutral-100 pt-2">
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="复制内容"
        >
          <Copy className="h-3 w-3" />
          复制
        </button>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="重新发送"
        >
          <RefreshCw className="h-3 w-3" />
          重试
        </button>
      )}
      {onAction && (
        <button
          type="button"
          onClick={() => onAction("把这条建议转为具体任务")}
          className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium text-moss transition hover:bg-moss/10"
          aria-label="转为任务"
        >
          <ListTodo className="h-3 w-3" />
          转为任务
        </button>
      )}
    </div>
  );
}
