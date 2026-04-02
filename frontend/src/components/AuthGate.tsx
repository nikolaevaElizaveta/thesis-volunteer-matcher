"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Heart,
  User,
  KeyRound,
  ArrowRight,
  Info,
} from "lucide-react";
import { useAuth } from "@/context/RoleContext";
import Button from "@/components/Button";

const DEMO_FILLS: { label: string; username: string }[] = [
  { label: "Coordinator", username: "coordinator" },
  { label: "Shelter", username: "demo_shelter" },
  { label: "Volunteer Alex", username: "demo_volunteer_alex" },
  { label: "Volunteer Sam", username: "demo_volunteer_sam" },
];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim()) {
      setError("Enter username");
      return;
    }
    if (!password) {
      setError("Enter password");
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-200">
            <Heart size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Volunteer Matcher
          </h1>
          <p className="mt-1 text-sm text-muted">
            Sign in with your account (JWT)
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
        >
          <h2 className="text-lg font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-muted">
            Demo password for seeded users:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">demo123</code>
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {DEMO_FILLS.map((d) => (
              <button
                key={d.username}
                type="button"
                onClick={() => {
                  setUsername(d.username);
                  setPassword("demo123");
                  setError("");
                }}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted hover:border-primary hover:text-foreground"
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <label className="mb-1.5 block text-xs font-medium text-muted">
              Username
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. demo_shelter"
                autoComplete="username"
                className="w-full rounded-lg border border-border bg-background py-2.5 pr-3 pl-9 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-muted">
              Password
            </label>
            <div className="relative">
              <KeyRound
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••••••"
                autoComplete="current-password"
                className="w-full rounded-lg border border-border bg-background py-2.5 pr-3 pl-9 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm text-danger">{error}</p>
          )}

          <Button
            type="submit"
            className="mt-6 w-full"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
            <ArrowRight size={16} />
          </Button>

          <div className="mt-4 flex gap-2 rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              With <code className="text-foreground">SEED=true</code>, demo users are created.
              Coordinators cannot self-register — use seeded <code className="text-foreground">coordinator</code>.
            </p>
          </div>

          <p className="mt-4 text-center text-sm text-muted">
            New shelter or volunteer?{" "}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline"
            >
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
