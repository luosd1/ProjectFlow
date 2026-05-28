"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, FileText, Link2, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AddResourceRequest } from "@/lib/types";

interface ResourceInputPanelProps {
  onChange: (resources: AddResourceRequest[]) => void;
}

const typeIcons: Record<string, React.ElementType> = {
  text_note: FileText,
  link: Link2,
  file_stub: File,
};

const typeLabels: Record<string, string> = {
  text_note: "Text Note",
  link: "Link",
  file_stub: "File",
};

export function ResourceInputPanel({ onChange }: ResourceInputPanelProps) {
  const [resources, setResources] = useState<AddResourceRequest[]>([]);

  const addResource = () => {
    const updated = [...resources, { type: "text_note" as const, title: "", content_text: "" }];
    setResources(updated);
    onChange(updated);
  };

  const removeResource = (index: number) => {
    const updated = resources.filter((_, i) => i !== index);
    setResources(updated);
    onChange(updated);
  };

  const updateResource = (index: number, updates: Partial<AddResourceRequest>) => {
    const updated = resources.map((r, i) => (i === index ? { ...r, ...updates } : r));
    setResources(updated);
    onChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Related Resources</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addResource}
            className="gap-1 text-xs"
          >
            <Plus className="h-3 w-3" />
            Add
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {resources.length === 0 && (
          <p className="py-3 text-center text-sm text-ink/40">
            No resources added. Click &quot;Add&quot; to attach text notes, links, or file references.
          </p>
        )}

        <AnimatePresence>
          {resources.map((res, index) => {
            const Icon = typeIcons[res.type] ?? FileText;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-lg border border-ink/10 bg-paper p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-ink/50" />
                    <Badge variant="secondary" className="text-xs">
                      {typeLabels[res.type]}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeResource(index)}
                    className="h-6 w-6 p-0 text-ink/40 hover:text-coral"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-ink/60">Type</Label>
                    <Select
                      value={res.type}
                      onValueChange={(v) =>
                        updateResource(index, {
                          type: v as AddResourceRequest["type"],
                          content_text: v === "text_note" ? (res.content_text ?? "") : null,
                          url: v === "link" ? (res.url ?? "") : null,
                          file_name: v === "file_stub" ? (res.file_name ?? "") : null,
                        })
                      }
                    >
                      <SelectTrigger className="border-ink/15 bg-white text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text_note">Text Note</SelectItem>
                        <SelectItem value="link">Link</SelectItem>
                        <SelectItem value="file_stub">File Reference</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-ink/60">Title *</Label>
                    <Input
                      value={res.title}
                      onChange={(e) => updateResource(index, { title: e.target.value })}
                      placeholder="Resource title"
                      className="border-ink/15 bg-white text-sm"
                    />
                  </div>

                  {res.type === "text_note" && (
                    <div className="space-y-1">
                      <Label className="text-xs text-ink/60">Content</Label>
                      <Textarea
                        value={res.content_text ?? ""}
                        onChange={(e) => updateResource(index, { content_text: e.target.value })}
                        placeholder="Paste or type the content here..."
                        rows={3}
                        className="border-ink/15 bg-white text-sm"
                      />
                    </div>
                  )}

                  {res.type === "link" && (
                    <div className="space-y-1">
                      <Label className="text-xs text-ink/60">URL</Label>
                      <Input
                        value={res.url ?? ""}
                        onChange={(e) => updateResource(index, { url: e.target.value })}
                        placeholder="https://..."
                        className="border-ink/15 bg-white text-sm"
                      />
                    </div>
                  )}

                  {res.type === "file_stub" && (
                    <div className="space-y-1">
                      <Label className="text-xs text-ink/60">File Name</Label>
                      <Input
                        value={res.file_name ?? ""}
                        onChange={(e) => updateResource(index, { file_name: e.target.value })}
                        placeholder="document.pdf"
                        className="border-ink/15 bg-white text-sm"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
