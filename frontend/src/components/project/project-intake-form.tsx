"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Lightbulb, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createProject, addResource } from "@/lib/api";
import type { Project, AddResourceRequest } from "@/lib/types";
import { ResourceInputPanel } from "./resource-input-panel";

interface ProjectIntakeFormProps {
  workspaceId: string;
  defaultCreatedBy?: string;
  onCreated?: (project: Project) => void;
}

export function ProjectIntakeForm({ workspaceId, defaultCreatedBy, onCreated }: ProjectIntakeFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [createdBy, setCreatedBy] = useState(defaultCreatedBy ?? "");
  const [resources, setResources] = useState<AddResourceRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Project | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !idea.trim() || !deadline || !deliverables.trim() || !createdBy.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject(workspaceId, {
        name: name.trim(),
        idea: idea.trim(),
        deadline,
        deliverables: deliverables.trim(),
        created_by: createdBy.trim(),
      });
      // Add resources if any
      const failedResources: string[] = [];
      for (const res of resources) {
        try {
          await addResource(project.id, res);
        } catch {
          failedResources.push(res.title || "untitled");
        }
      }
      if (failedResources.length > 0) {
        setError(`Project created, but ${failedResources.length} resource(s) failed to save: ${failedResources.join(", ")}`);
      }
      setCreated(project);
      onCreated?.(project);
    } catch {
      setError("Failed to create project. Please try again.");
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
            <p className="text-lg font-bold">Project Created</p>
            <p className="text-sm text-ink/60">{created.name}</p>
            <p className="text-xs font-mono text-ink/40">{created.id}</p>
            <Button className="mt-2 bg-moss text-white hover:bg-moss/80" onClick={() => router.push(`/projects/${created.id}`)}>
              Open Project
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-citron" />
            Project Intake
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projName">Project Name *</Label>
              <Input
                id="projName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ProjectFlow"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projIdea">Project Idea *</Label>
              <Textarea
                id="projIdea"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Describe the project idea, goals, and motivation..."
                rows={4}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="projDeadline">Deadline *</Label>
                <Input
                  id="projDeadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projCreatedBy">Created By (User ID) *</Label>
                <Input
                  id="projCreatedBy"
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  placeholder="UUID of project creator"
                  required
                  disabled={!!defaultCreatedBy}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="projDeliverables">Deliverables *</Label>
              <Textarea
                id="projDeliverables"
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
                placeholder="Expected outputs: MVP demo, README, demo video..."
                rows={3}
                required
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-coral">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={submitting || !name.trim() || !idea.trim() || !deadline || !deliverables.trim() || !createdBy.trim()}
              className="w-full bg-ink text-white hover:bg-ink/80"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Project"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <ResourceInputPanel onChange={setResources} />
    </motion.div>
  );
}
