import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SiteNav } from "@/components/site-nav";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Reset Password — Quick Tutor" }] }),
});

const BACKEND = (import.meta as any).env.VITE_BACKEND_URL || "http://localhost:4000";
const fieldClass = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand";

function ForgotPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to request password reset");
      setSent(true);
      toast.success("Reset link sent! Please check your email (or console for mock).");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reset password");
      
      toast.success("Password reset successfully! You can now log in.");
      navigate({ to: "/auth", search: { mode: "login", role: "student" } });
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
        <h1 className="font-serif text-4xl leading-tight">
          {token ? "Set new password" : "Reset your password"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {token 
            ? "Enter your new password below." 
            : "Enter the email associated with your account and we'll send you a link to reset your password."}
        </p>

        {!token ? (
          <form onSubmit={handleRequestReset} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={fieldClass} disabled={sent} />
            </div>
            
            <button type="submit" disabled={busy || sent} className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60 hover:bg-brand/90 transition-colors">
              {busy ? "Sending..." : sent ? "Link Sent!" : "Send reset link"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="mt-8 space-y-4">
            <div>
              <label htmlFor="password" className="text-sm font-medium">New Password</label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-ink"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm New Password</label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={fieldClass}
              />
            </div>
            
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60 hover:bg-brand/90 transition-colors">
              {busy ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link to="/auth" search={{ mode: "login", role: "student" }} className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
