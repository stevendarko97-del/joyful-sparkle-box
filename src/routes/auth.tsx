import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { SiteNav } from "@/components/site-nav";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ExamType = "BECE" | "WASSCE" | "NOV_DEC" | "SHS_REMEDIAL" | "JHS_REMEDIAL";

const EXAM_TYPES: { value: ExamType; label: string }[] = [
  { value: "BECE", label: "BECE" },
  { value: "WASSCE", label: "WASSCE" },
  { value: "NOV_DEC", label: "NOV/DEC" },
  { value: "SHS_REMEDIAL", label: "SHS remedial" },
  { value: "JHS_REMEDIAL", label: "JHS remedial" },
];

const LEVELS = ["JHS 1", "JHS 2", "JHS 3", "SHS 1", "SHS 2", "SHS 3", "Remedial / NOV-DEC candidate"];
const LANGUAGES = ["English", "Twi", "Ga", "Ewe", "Dagbani", "Hausa", "Fante"];

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional().default("login"),
  role: z.enum(["student", "teacher"]).optional().default("student"),
});

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (s: { mode?: "login" | "signup"; role?: "student" | "teacher" }): { mode?: "login" | "signup"; role?: "student" | "teacher" } => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Sign in — Quick Tutor" }] }),
});

import { getBackendUrl } from "@/lib/config";

const BACKEND = getBackendUrl();

const fieldClass = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand";

function AuthPage() {
  const { mode, role } = Route.useSearch();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const setMode = (m: "login" | "signup") =>
    navigate({ search: (prev: any) => ({ ...prev, mode: m }) });
  const setRole = (r: "student" | "teacher") =>
    navigate({ search: (prev: any) => ({ ...prev, role: r }) });

  // Shared extras
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);

  // Student details
  const [schoolName, setSchoolName] = useState("");
  const [level, setLevel] = useState("");
  const [studentExam, setStudentExam] = useState<ExamType | "">("");
  const [guardianPhone, setGuardianPhone] = useState("");

  // Teacher details
  const [headline, setHeadline] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [primarySubject, setPrimarySubject] = useState("");
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [languages, setLanguages] = useState<string[]>(["English"]);

  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch(`${BACKEND}/api/subjects`)
      .then(r => r.json())
      .then(d => setSubjects(d.subjects ?? []))
      .catch(() => {});
  }, []);

  const toggle = <T,>(list: T[], value: T, set: (v: T[]) => void) =>
    set(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        let certificateUrl;
        if (role === "teacher" && certificateFile) {
          const fileExt = certificateFile.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${fileName}`;
          const { error: uploadError } = await supabase.storage.from('verification-docs').upload(filePath, certificateFile);
          if (uploadError) throw new Error("Failed to upload certificate: " + uploadError.message);
          certificateUrl = filePath;
        }

        const res = await fetch(`${BACKEND}/api/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            fullName,
            role,
            phone,
            location,
            bio,
            // Student extras
            schoolName: role === "student" ? schoolName : undefined,
            level: role === "student" ? level : undefined,
            studentExam: role === "student" ? studentExam : undefined,
            guardianPhone: role === "student" ? guardianPhone : undefined,
            // Teacher extras
            headline: role === "teacher" ? headline : undefined,
            yearsExperience: role === "teacher" ? Number(yearsExperience) : undefined,
            hourlyRate: role === "teacher" ? Number(hourlyRate) : undefined,
            primarySubject: role === "teacher" ? primarySubject : undefined,
            examTypes: role === "teacher" ? examTypes : undefined,
            languages: role === "teacher" ? languages : undefined,
            certificateUrl: role === "teacher" ? certificateUrl : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Signup failed");
        localStorage.setItem("token", data.token);
        toast.success("Account created!");
        navigate({ to: role === "teacher" ? "/dashboard/teacher" : "/dashboard/student" });
      } else {
        const res = await fetch(`${BACKEND}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Login failed");
        localStorage.setItem("token", data.token);
        toast.success("Welcome back!");
        navigate({ to: data.user?.role === "teacher" ? "/dashboard/teacher" : data.user?.role === "admin" ? "/admin" : "/dashboard/student" });
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
      <div className={`mx-auto px-6 py-16 ${mode === "signup" ? "max-w-xl" : "max-w-md"}`}>
        <h1 className="font-serif text-4xl leading-tight">{mode === "signup" ? "Join Quick Tutor" : "Welcome back"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signup" ? "Create your account in seconds." : "Sign in to continue."}
        </p>

        {/* Mode Switcher Tabs (Sign in vs Create Account) */}
        <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-2xl bg-secondary/80 p-1 border border-border">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex items-center justify-center py-2.5 text-sm font-semibold rounded-xl transition-all ${
              mode === "login"
                ? "bg-card text-brand shadow-sm border border-border"
                : "text-muted-foreground hover:text-ink"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex items-center justify-center py-2.5 text-sm font-semibold rounded-xl transition-all ${
              mode === "signup"
                ? "bg-card text-brand shadow-sm border border-border"
                : "text-muted-foreground hover:text-ink"
            }`}
          >
            Create account
          </button>
        </div>

        {mode === "signup" && (
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-full bg-secondary p-1">
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`rounded-full py-2 text-sm font-medium transition-colors ${role === "student" ? "bg-card shadow-sm text-ink font-semibold" : "text-muted-foreground hover:text-ink"}`}
            >
              I'm a student
            </button>
            <button
              type="button"
              onClick={() => setRole("teacher")}
              className={`rounded-full py-2 text-sm font-medium transition-colors ${role === "teacher" ? "bg-card shadow-sm text-ink font-semibold" : "text-muted-foreground hover:text-ink"}`}
            >
              I'm a teacher
            </button>
          </div>
        )}

        <form onSubmit={handle} className="mt-8 space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <label htmlFor="fullName" className="text-sm font-medium">Full name</label>
                <input id="fullName" required value={fullName} onChange={e => setFullName(e.target.value)} className={fieldClass} maxLength={100} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="phone" className="text-sm font-medium">Phone (MoMo number)</label>
                  <input id="phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className={fieldClass} placeholder="024 000 0000" />
                </div>
                <div>
                  <label htmlFor="location" className="text-sm font-medium">Town / city</label>
                  <input id="location" required value={location} onChange={e => setLocation(e.target.value)} className={fieldClass} placeholder="Accra, Greater Accra" />
                </div>
              </div>
            </>
          )}

          <div>
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={fieldClass} />
          </div>

          {mode === "signup" && (
            <div>
              <label htmlFor="bio" className="text-sm font-medium">Brief description about you</label>
              <textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" maxLength={800} rows={3} placeholder={role === "student" ? "Tell us a bit about your academic goals..." : "Tell students about your teaching style..."} />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
            </div>
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
            {mode === "login" && (
              <div className="mt-2 text-right">
                <Link to="/forgot-password" className="text-sm font-medium text-brand hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}
          </div>

          {/* Student details */}
          {mode === "signup" && role === "student" && (
            <div className="space-y-4 rounded-2xl bg-secondary/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Student details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="school" className="text-sm font-medium">School</label>
                  <input id="school" value={schoolName} onChange={e => setSchoolName(e.target.value)} className={fieldClass} placeholder="Achimota School" />
                </div>
                <div>
                  <label htmlFor="level" className="text-sm font-medium">Class / level</label>
                  <select id="level" value={level} onChange={e => setLevel(e.target.value)} className={fieldClass}>
                    <option value="">Select level</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="studentExam" className="text-sm font-medium">Exam you're preparing for</label>
                <select id="studentExam" value={studentExam} onChange={e => setStudentExam(e.target.value as ExamType)} className={fieldClass}>
                  <option value="">Select exam track</option>
                  {EXAM_TYPES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="guardianPhone" className="text-sm font-medium">Parent / guardian phone (optional)</label>
                <input id="guardianPhone" type="tel" value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} className={fieldClass} />
              </div>
            </div>
          )}

          {/* Teacher details */}
          {mode === "signup" && role === "teacher" && (
            <div className="space-y-4 rounded-2xl bg-secondary/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand">Tutor details</p>
              <div>
                <label htmlFor="headline" className="text-sm font-medium">Professional headline</label>
                <input id="headline" value={headline} onChange={e => setHeadline(e.target.value)} className={fieldClass} placeholder="Elective & Core Maths specialist" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="years" className="text-sm font-medium">Years of experience</label>
                  <input id="years" type="number" min={0} max={60} value={yearsExperience} onChange={e => setYearsExperience(e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label htmlFor="rate" className="text-sm font-medium">Hourly rate (GH₵)</label>
                  <input id="rate" type="number" min={0} step="1" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} className={fieldClass} placeholder="80" />
                </div>
              </div>
              <div>
                <label htmlFor="subject" className="text-sm font-medium">Primary subject</label>
                <select id="subject" value={primarySubject} onChange={e => setPrimarySubject(e.target.value)} className={fieldClass}>
                  <option value="">Select subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Exams you tutor for</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EXAM_TYPES.map(e => (
                    <button key={e.value} type="button" onClick={() => toggle(examTypes, e.value, setExamTypes)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${examTypes.includes(e.value) ? "bg-brand text-primary-foreground ring-brand" : "bg-card ring-border text-muted-foreground"}`}>
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Languages you teach in</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {LANGUAGES.map(l => (
                    <button key={l} type="button" onClick={() => toggle(languages, l, setLanguages)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${languages.includes(l) ? "bg-brand text-primary-foreground ring-brand" : "bg-card ring-border text-muted-foreground"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="certificate" className="text-sm font-medium">License or Certificate (PDF/Image)</label>
                <input id="certificate" type="file" accept=".pdf,image/*" onChange={e => setCertificateFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80" />
              </div>
            </div>
          )}

          <button type="submit" disabled={busy} className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60 hover:bg-brand/90 transition-colors">
            {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>

          {mode === "signup" && (
            <p className="text-center text-[11px] text-muted-foreground leading-relaxed pt-1">
              By creating an account, you agree to our{" "}
              <Link to="/terms" className="text-brand font-semibold hover:underline">
                Terms &amp; Policies
              </Link>
              .
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signup" ? "Already have an account? " : "New to Quick Tutor? "}
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="font-medium text-brand hover:underline"
          >
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