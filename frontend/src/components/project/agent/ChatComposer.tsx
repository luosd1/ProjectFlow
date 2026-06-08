"use client";

import { useCallback, useRef, useEffect, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Loader2, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (content: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  maxLength?: number;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  disabled,
  isStreaming,
  maxLength = 4000,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 20;
    const maxLines = 6;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * maxLines)}px`;
  }, [value]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSubmit(trimmed);
    },
    [value, disabled, onSubmit],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSubmit(trimmed);
      }
      if (e.key === "Escape" && value.length > 0) {
        e.preventDefault();
        onChange("");
      }
    },
    [value, disabled, onSubmit, onChange],
  );

  const nearLimit = value.length > maxLength * 0.9;

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-md border border-neutral-200 bg-white p-2.5 transition-all duration-200 focus-within:border-neutral-400">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="告诉 Agent 你想推进什么..."
          className="min-h-12 w-full resize-none bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-500"
          disabled={disabled}
          maxLength={maxLength}
          aria-label="输入消息"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className={cn("text-[10px] transition-colors", nearLimit ? "text-coral" : "text-neutral-300")}>
            {nearLimit ? `${value.length}/${maxLength}` : value.length === 0 ? "Enter 发送 · Shift+Enter 换行 · Esc 清空" : ""}
          </span>
          <div className="flex gap-1.5">
            {isStreaming && onStop ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-coral/30 px-3 text-xs text-coral hover:bg-coral/10"
                onClick={onStop}
              >
                <Square className="h-3 w-3" />
                停止
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                className="h-8 gap-1.5 bg-moss px-3 text-xs text-white shadow-sm shadow-moss/20 hover:bg-moss/90 active:shadow-none"
                disabled={!value.trim() || disabled}
              >
                {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                发送
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
