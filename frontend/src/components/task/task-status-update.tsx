"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Task } from "@/lib/types";

type TaskStatusUpdateProps = {
  task: Task;
  onUpdate: (data: {
    user_id: string;
    status: "not_started" | "in_progress" | "done" | "blocked";
    progress_note?: string;
    blocker?: string;
  }) => void | Promise<void>;
  userId: string;
  pending?: boolean;
};

function statusClass(status: Task["status"]) {
  if (status === "blocked") return "bg-coral/15 text-coral";
  if (status === "done") return "bg-moss/15 text-moss";
  if (status === "in_progress") return "bg-citron/40 text-ink";
  return "bg-white text-ink/55";
}

export function TaskStatusUpdate({ task, onUpdate, userId, pending }: TaskStatusUpdateProps) {
  const [status, setStatus] = useState<Task["status"]>(task.status);
  const [progressNote, setProgressNote] = useState("");
  const [blocker, setBlocker] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    setError(null);
    setSuccess(false);

    try {
      await onUpdate({
        user_id: userId,
        status,
        progress_note: progressNote.trim() || undefined,
        blocker: status === "blocked" ? blocker.trim() || undefined : undefined,
      });
      setSuccess(true);
      setProgressNote("");
      setBlocker("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-ink">{task.title}</h3>
        <Badge className={statusClass(task.status)}>{task.status}</Badge>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="space-y-2">
          <Label htmlFor={`status-${task.id}`}>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as Task["status"])}
          >
            <SelectTrigger id={`status-${task.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">Not started</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`note-${task.id}`}>Progress note</Label>
          <Textarea
            id={`note-${task.id}`}
            value={progressNote}
            onChange={(e) => setProgressNote(e.target.value)}
            placeholder="What changed? (optional)"
            rows={2}
          />
        </div>

        {status === "blocked" && (
          <div className="space-y-2">
            <Label htmlFor={`blocker-${task.id}`}>Blocker reason</Label>
            <Textarea
              id={`blocker-${task.id}`}
              value={blocker}
              onChange={(e) => setBlocker(e.target.value)}
              placeholder="What is blocking this task?"
              rows={2}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-coral/20 bg-coral/10 p-3 text-sm text-coral">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-moss/20 bg-moss/10 p-3 text-sm text-moss">
          <CheckCircle2 className="mt-0.5 h-4 w-4" />
          <p>Status updated.</p>
        </div>
      )}

      <div className="mt-4">
        <Button
          disabled={pending || status === task.status}
          onClick={handleUpdate}
          className="bg-ink text-white hover:bg-ink/85"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {pending ? "Updating..." : "Update status"}
        </Button>
      </div>
    </div>
  );
}

type TaskStatusUpdateListProps = {
  tasks: Task[];
  userId: string;
  onUpdate: TaskStatusUpdateProps["onUpdate"];
  pending?: boolean;
};

export function TaskStatusUpdateList({ tasks, userId, onUpdate, pending }: TaskStatusUpdateListProps) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-ink/15 bg-paper/70 p-6 text-sm text-ink/55">
        No tasks to update.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {tasks.map((task) => (
        <TaskStatusUpdate
          key={task.id}
          task={task}
          userId={userId}
          onUpdate={onUpdate}
          pending={pending}
        />
      ))}
    </div>
  );
}
