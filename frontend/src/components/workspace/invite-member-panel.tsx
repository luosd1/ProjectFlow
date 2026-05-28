"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, UserPlus, Copy, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createInvitation } from "@/lib/api";
import type { Invitation } from "@/lib/types";

interface InviteMemberPanelProps {
  workspaceId: string;
}

export function InviteMemberPanel({ workspaceId }: InviteMemberPanelProps) {
  const [invitedName, setInvitedName] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitedName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const inv = await createInvitation(workspaceId, {
        invited_name: invitedName.trim(),
        invited_email: invitedEmail.trim() || null,
      });
      setInvitations((prev) => [...prev, inv]);
      setInvitedName("");
      setInvitedEmail("");
    } catch {
      setError("Failed to send invitation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  const statusColor: Record<string, string> = {
    pending: "bg-citron/30 text-ink",
    accepted: "bg-moss/20 text-moss",
    expired: "bg-ink/10 text-ink/50",
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5 text-harbor" />
            Invite Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invName">Name *</Label>
              <Input
                id="invName"
                value={invitedName}
                onChange={(e) => setInvitedName(e.target.value)}
                placeholder="Member name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invEmail">Email (optional)</Label>
              <Input
                id="invEmail"
                type="email"
                value={invitedEmail}
                onChange={(e) => setInvitedEmail(e.target.value)}
                placeholder="member@example.com"
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
              disabled={submitting || !invitedName.trim()}
              className="w-full bg-harbor text-white hover:bg-harbor/80"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invitation"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink/60">Sent Invitations</p>
            <AnimatePresence>
              {invitations.map((inv) => (
                <motion.div
                  key={inv.invitation_id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{inv.invited_name}</p>
                    {inv.invited_email && (
                      <p className="truncate text-xs text-ink/50">{inv.invited_email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColor[inv.status] ?? ""}>{inv.status}</Badge>
                    {inv.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLink(inv.token)}
                        className="h-7 gap-1 text-xs"
                      >
                        {copiedToken === inv.token ? (
                          <><CheckCircle2 className="h-3 w-3" /> Copied</>
                        ) : (
                          <><Copy className="h-3 w-3" /> Copy Link</>
                        )}
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </motion.div>
  );
}
