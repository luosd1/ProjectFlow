"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Plus,
  X,
} from "lucide-react";

import type { Skill } from "@/lib/types";
import Link from "next/link";
import { upsertMemberProfile } from "@/lib/api";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";

interface MemberProfileWizardProps {
  userId: string;
  workspaceId: string;
}

type SubmitState = "idle" | "loading" | "error" | "success";

const TOTAL_STEPS = 3;

const stepVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

export function MemberProfileWizard({ userId, workspaceId }: MemberProfileWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: Skills
  const [skills, setSkills] = useState<Skill[]>([]);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState("3");

  // Step 2: Availability & Role
  const [availableHours, setAvailableHours] = useState<number>(10);
  const [rolePreference, setRolePreference] = useState("");

  // Step 3: Interests & Constraints
  const [interests, setInterests] = useState("");
  const [constraints, setConstraints] = useState("");
  const [collaborationPreference, setCollaborationPreference] = useState("");

  // Submit state
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // --- Skill management ---
  const addSkill = () => {
    const name = newSkillName.trim();
    if (!name) return;
    if (skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
    setSkills([...skills, { name, level: Number(newSkillLevel) }]);
    setNewSkillName("");
    setNewSkillLevel("3");
  };

  const removeSkill = (name: string) => {
    setSkills(skills.filter((s) => s.name !== name));
  };

  // --- Navigation ---
  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 0:
        return skills.length > 0;
      case 1:
        return availableHours > 0 && rolePreference.trim().length > 0;
      case 2:
        return interests.trim().length > 0 && constraints.trim().length > 0;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // --- Submit ---
  const handleSubmit = async () => {
    setSubmitState("loading");
    setErrorMessage("");

    try {
      await upsertMemberProfile(workspaceId, userId, {
        skills,
        available_hours_per_week: availableHours,
        role_preference: rolePreference.trim(),
        interests: interests.trim(),
        constraints: constraints.trim(),
        collaboration_preference: collaborationPreference.trim() || null,
      });
      setSubmitState("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save profile");
      setSubmitState("error");
    }
  };

  const handleRetry = () => {
    setSubmitState("idle");
    setErrorMessage("");
  };

  // --- Success state ---
  if (submitState === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="border-moss/30 bg-moss/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-moss" />
              <CardTitle className="text-moss">Profile Saved</CardTitle>
            </div>
            <CardDescription>
              Your member profile has been saved. The agent will use this information for task assignments and recommendations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-ink/10 bg-white p-3 text-sm">
              <p className="text-ink/60">Skills</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <Badge key={s.name} className="bg-moss/15 text-moss">
                    {s.name} Lv.{s.level}
                  </Badge>
                ))}
              </div>
            </div>
            <Link
              href="/workspaces/new"
              className="inline-flex items-center gap-2 rounded-lg bg-moss px-5 py-3 text-sm font-bold text-white transition hover:bg-moss/90 focus:outline-none focus:ring-2 focus:ring-citron"
            >
              Create Workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // --- Error state ---
  if (submitState === "error") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="border-coral/30 bg-coral/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-coral" />
              <CardTitle className="text-coral">Save Failed</CardTitle>
            </div>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleRetry}
              className="gap-2 border-coral/30 text-coral hover:bg-coral/10"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
            <Button
              variant="ghost"
              onClick={goBack}
              className="gap-2 text-ink/60"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Form
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // --- Step indicator ---
  const stepLabels = ["Skills", "Availability", "Preferences"];

  const renderStepIndicator = () => (
    <div className="mb-6 space-y-3">
      <Progress value={((currentStep + 1) / TOTAL_STEPS) * 100}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-moss">
            Step {currentStep + 1} of {TOTAL_STEPS}
          </span>
          <span className="text-xs text-ink/50">
            {Math.round(((currentStep + 1) / TOTAL_STEPS) * 100)}%
          </span>
        </div>
      </Progress>
      <ProgressTrack className="h-2">
        <ProgressIndicator
          className={cn(
            "transition-all duration-300",
            currentStep === 0 && "bg-harbor",
            currentStep === 1 && "bg-citron",
            currentStep === 2 && "bg-moss"
          )}
          style={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
        />
      </ProgressTrack>
      <div className="flex gap-1">
        {stepLabels.map((label, i) => (
          <div
            key={label}
            className={cn(
              "flex-1 rounded-md py-1.5 text-center text-xs font-semibold transition",
              i < currentStep && "bg-moss/15 text-moss",
              i === currentStep && "bg-harbor/15 text-harbor",
              i > currentStep && "bg-ink/5 text-ink/35"
            )}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );

  // --- Step 1: Skills ---
  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Skills</CardTitle>
        <CardDescription>
          Add your skills and rate your proficiency (1 = beginner, 5 = expert).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing skills */}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <Badge
                key={skill.name}
                className="gap-1.5 bg-moss/15 py-1 pl-2.5 pr-1.5 text-moss"
              >
                {skill.name}
                <span className="text-ink/40">Lv.{skill.level}</span>
                <button
                  onClick={() => removeSkill(skill.name)}
                  className="ml-0.5 rounded-full p-0.5 transition hover:bg-coral/20 hover:text-coral"
                  aria-label={`Remove ${skill.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {skills.length === 0 && (
          <p className="py-3 text-center text-sm text-ink/40">
            No skills added yet. Add at least one to continue.
          </p>
        )}

        <Separator className="bg-ink/8" />

        {/* Add skill form */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="skillName" className="text-xs text-ink/60">
              Skill Name
            </Label>
            <Input
              id="skillName"
              placeholder="e.g. React, Python, Design"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              className="border-ink/15 bg-white focus-visible:border-moss focus-visible:ring-moss/30"
            />
          </div>
          <div className="w-24 space-y-1.5">
            <Label className="text-xs text-ink/60">Level</Label>
            <Select value={newSkillLevel} onValueChange={(v) => v && setNewSkillLevel(v)}>
              <SelectTrigger className="w-full border-ink/15 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addSkill}
            disabled={!newSkillName.trim()}
            className="gap-1 border-moss/30 text-moss hover:bg-moss/10"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // --- Step 2: Availability & Role ---
  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Availability & Role</CardTitle>
        <CardDescription>
          How much time can you commit, and what role do you prefer?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="availableHours" className="text-ink/80">
            Available Hours per Week
          </Label>
          <Input
            id="availableHours"
            type="number"
            min={1}
            max={80}
            value={availableHours}
            onChange={(e) => setAvailableHours(Math.max(1, Number(e.target.value) || 1))}
            className="border-ink/15 bg-white focus-visible:border-moss focus-visible:ring-moss/30"
          />
          <p className="text-xs text-ink/40">
            Typically 5-20 hours for student projects.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rolePreference" className="text-ink/80">
            Role Preference <span className="text-coral">*</span>
          </Label>
          <Input
            id="rolePreference"
            placeholder="e.g. Frontend Developer, Designer, PM"
            value={rolePreference}
            onChange={(e) => setRolePreference(e.target.value)}
            className="border-ink/15 bg-white focus-visible:border-moss focus-visible:ring-moss/30"
          />
        </div>
      </CardContent>
    </Card>
  );

  // --- Step 3: Interests & Constraints ---
  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Interests & Constraints</CardTitle>
        <CardDescription>
          Help the agent understand what motivates you and any limitations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="interests" className="text-ink/80">
            Interests <span className="text-coral">*</span>
          </Label>
          <Textarea
            id="interests"
            placeholder="e.g. I enjoy building UI, data visualization, and user research..."
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            rows={3}
            className="border-ink/15 bg-white focus-visible:border-moss focus-visible:ring-moss/30"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="constraints" className="text-ink/80">
            Constraints <span className="text-coral">*</span>
          </Label>
          <Textarea
            id="constraints"
            placeholder="e.g. Not available on weekends, exam period until June 15..."
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            rows={3}
            className="border-ink/15 bg-white focus-visible:border-moss focus-visible:ring-moss/30"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="collaboration" className="text-ink/80">
            Collaboration Preference <span className="text-ink/40">(optional)</span>
          </Label>
          <Textarea
            id="collaboration"
            placeholder="e.g. Prefer async communication, like pair programming..."
            value={collaborationPreference}
            onChange={(e) => setCollaborationPreference(e.target.value)}
            rows={2}
            className="border-ink/15 bg-white focus-visible:border-moss focus-visible:ring-moss/30"
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderStep1();
      case 1:
        return renderStep2();
      case 2:
        return renderStep3();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {renderStepIndicator()}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: "easeInOut" }}
        >
          {renderCurrentStep()}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="ghost"
          onClick={goBack}
          disabled={currentStep === 0}
          className="gap-2 text-ink/60"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {currentStep < TOTAL_STEPS - 1 ? (
          <Button
            onClick={goNext}
            disabled={!canGoNext()}
            className="gap-2 bg-moss text-white hover:bg-moss/90"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitState === "loading" || !canGoNext()}
            className="gap-2 bg-moss text-white hover:bg-moss/90"
          >
            {submitState === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Submit Profile
                <CheckCircle2 className="h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
