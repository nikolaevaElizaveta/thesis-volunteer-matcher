"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  User,
  KeyRound,
  ArrowRight,
  Building2,
  HandHelping,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/context/RoleContext";
import Button from "@/components/Button";

type RegRole = "shelter" | "volunteer";

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<RegRole>("volunteer");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (!loading && user) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim()) {
      setError("Enter username");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!displayName.trim()) {
      setError(
        role === "shelter"
          ? "Enter shelter name (used as task owner)"
          : "Enter how your name appears to coordinators",
      );
      return;
    }
    setSubmitting(true);
    try {
      await register({
        username: username.trim(),
        password,
        display_name: displayName.trim(),
        role,
      });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50/40 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-200">
            <Heart size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create account
          </h1>
          <p className="mt-1 text-sm text-muted">
            Shelter or volunteer — coordinators use a seeded account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
        >
          <div className="mb-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole("shelter")}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all ${
                role === "shelter"
                  ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100"
                  : "border-border hover:border-slate-300"
              }`}
            >
              <Building2
                size={22}
                className={role === "shelter" ? "text-indigo-500" : "text-muted"}
              />
              <span className="text-sm font-medium">Shelter</span>
            </button>
            <button
              type="button"
              onClick={() => setRole("volunteer")}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all ${
                role === "volunteer"
                  ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100"
                  : "border-border hover:border-slate-300"
              }`}
            >
              <HandHelping
                size={22}
                className={role === "volunteer" ? "text-emerald-500" : "text-muted"}
              />
              <span className="text-sm font-medium">Volunteer</span>
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              Username <span className="text-danger">*</span>
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
                placeholder="login id (lowercase, no spaces)"
                autoComplete="username"
                className="w-full rounded-lg border border-border bg-background py-2.5 pr-3 pl-9 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-muted">
              {role === "shelter" ? "Shelter / organization name" : "Your display name"}{" "}
              <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={
                role === "shelter"
                  ? "e.g. City Animal Shelter"
                  : "e.g. Alex Smith"
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-[11px] text-muted">
              {role === "shelter"
                ? "Must match how you filter “my tasks” in the app."
                : "Shown on offers and assignments."}
            </p>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-muted">
              Password <span className="text-danger">*</span> (min 6)
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
                autoComplete="new-password"
                className="w-full rounded-lg border border-border bg-background py-2.5 pr-3 pl-9 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-muted">
              Confirm password
            </label>
            <div className="relative">
              <KeyRound
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-lg border border-border bg-background py-2.5 pr-3 pl-9 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <Button
            type="submit"
            className="mt-6 w-full"
            disabled={submitting}
          >
            {submitting ? "Creating account…" : "Create account"}
            <ArrowRight size={16} />
          </Button>

          <Link
            href="/"
            className="mt-4 flex items-center justify-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>
        </form>
      </div>
    </div>
  );
}
