"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, UserPlus, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createUser, listUsers } from "@/lib/api";
import type { User } from "@/lib/types";

export function AccountSetupForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<User | null>(null);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch(() => setError("Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const user = await createUser({
        display_name: displayName.trim(),
        email: email.trim() || null,
      });
      setCreatedUser(user);
      setUsers((prev) => [...prev, user]);
    } catch {
      setError("Failed to create account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-moss" />
      </div>
    );
  }

  if (createdUser) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-moss/30 bg-moss/5">
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-10 w-10 text-moss" />
            <p className="text-lg font-bold">Account Created</p>
            <p className="text-sm text-ink/60">{createdUser.display_name}</p>
            <Button className="mt-2 bg-moss text-white hover:bg-moss/80" onClick={() => window.location.href = `/onboarding/profile?userId=${createdUser.user_id}`}>
              Fill Member Profile
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
            <UserPlus className="h-5 w-5 text-moss" />
            Create Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-coral">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <Button type="submit" disabled={submitting || !displayName.trim()} className="w-full bg-ink text-white hover:bg-ink/80">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {users.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="mb-3 text-sm font-semibold text-ink/60">Or select an existing demo user:</p>
            <div className="space-y-2">
              {users.map((user) => (
                <a
                  key={user.user_id}
                  href={`/onboarding/profile?userId=${user.user_id}`}
                  className="flex items-center justify-between rounded-lg border border-ink/10 bg-white p-3 transition hover:border-moss/40 hover:bg-moss/5"
                >
                  <span className="font-medium">{user.display_name}</span>
                  <Badge variant="secondary" className="text-xs">Select</Badge>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
