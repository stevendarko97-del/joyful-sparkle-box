import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional().default("login"),
  role: z.enum(["student", "teacher"]).optional().default("student"),
});

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Sign in — Scribe" }] }),
});

function AuthPage() {
  const { mode: initialMode, role: initialRole } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [role, setRole] = useState<"student" | "teacher">(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, role },
          },
        });
        if (error) throw error;
        toast.success("Account created!");
        navigate({ to: role === "teacher" ? "/dashboard/teacher" : "/dashboard/student" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-serif text-4xl leading-tight">{mode === "signup" ? "Join Scribe" : "Welcome back"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signup" ? "Create your account in seconds." : "Sign in to continue."}
        </p>

        {mode === "signup" && (
          <div className="mt-8 grid grid-cols-2 gap-2 rounded-full bg-secondary p-1">
            <button type="button" onClick={() => setRole("student")} className={`rounded-full py-2 text-sm font-medium transition-colors ${role === "student" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
              I'm a student
            </button>
            <button type="button" onClick={() => setRole("teacher")} className={`rounded-full py-2 text-sm font-medium transition-colors ${role === "teacher" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
              I'm a teacher
            </button>
          </div>
        )}

        <form onSubmit={handle} className="mt-8 space-y-4">
          {mode === "signup" && (
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" maxLength={100} />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
          </div>
          <Button type="submit" disabled={busy} className="w-full rounded-xl bg-brand py-6 text-sm font-semibold">
            {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signup" ? "Already have an account? " : "New to Scribe? "}
          <button onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="font-medium text-brand hover:underline">
            {mode === "signup" ? "Sign in" : "Create account"}
          </button>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-ink">← Back home</Link>
        </p>
      </div>
    </div>
  );
}