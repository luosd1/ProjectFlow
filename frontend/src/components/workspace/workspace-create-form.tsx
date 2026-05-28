"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, FolderOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { createWorkspace } from "@/lib/api";
import type { Workspace } from "@/lib/types";

interface WorkspaceCreateFormProps {
  ownerUserId?: string;
  onCreated?: (workspace: Workspace) => void;
}

export function WorkspaceCreateForm({ ownerUserId, onCreated }: WorkspaceCreateFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState(ownerUserId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Workspace | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ownerId.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const ws = await createWorkspace({
        name: name.trim(),
        owner_user_id: ownerId.trim(),
        description: description.trim() || null,
      });
      setCreated(ws);
      onCreated?.(ws);
    } catch {
      setError("Failed to create workspace. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-moss/30 bg-moss/5">
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-10 w-10 text-moss" />
            <p className="text-lg font-bold">Workspace Created</p>
            <p className="text-sm text-ink/60">{created.name}</p>
            <p className="text-xs font-mono text-ink/40">{created.workspace_id}</p>
            <Button className="mt-2 bg-moss text-white hover:bg-moss/80" onClick={() => router.push(`/onboarding/profile?userId=${ownerId}&workspaceId=${created.workspace_id}`)}>
              Fill Member Profile
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderOpen className="h-5 w-5 text-moss" />
            Create Workspace
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wsName">Workspace Name *</Label>
              <Input
                id="wsName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ProjectFlow Team"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wsDesc">Description (optional)</Label>
              <Textarea
                id="wsDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Team workspace description..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wsOwner">Owner User ID *</Label>
              <Input
                id="wsOwner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                placeholder="UUID of the team lead"
                required
                disabled={!!ownerUserId}
              />
              <p className="text-xs text-ink/40">
                Paste the user ID from account setup, or enter a demo ID.
              </p>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-coral">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={submitting || !name.trim() || !ownerId.trim()}
              className="w-full bg-ink text-white hover:bg-ink/80"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Workspace"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
