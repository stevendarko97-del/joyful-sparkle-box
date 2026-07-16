import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type VerificationStatus = Database["public"]["Enums"]["verification_status"];
type Availability = { id?: string; day_of_week: number; start_hour: number; end_hour: number };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const Route = createFileRoute("/dashboard/teacher")({ component: TeacherDashboard });

type ExamType = "BECE" | "WASSCE" | "NOV_DEC" | "SHS_REMEDIAL" | "JHS_REMEDIAL";
const EXAM_OPTIONS: { value: ExamType; label: string }[] = [
  { value: "WASSCE", label: "WASSCE" },
  { value: "BECE", label: "BECE" },
  { value: "NOV_DEC", label: "NOV/DEC" },
  { value: "SHS_REMEDIAL", label: "SHS Remedial" },
  { value: "JHS_REMEDIAL", label: "JHS Remedial" },
];
const GH_REGIONS = [
  "Greater Accra", "Ashanti", "Western", "Central", "Eastern", "Volta",
  "Northern", "Upper East", "Upper West", "Bono", "Bono East", "Ahafo",
  "Western North", "Oti", "Savannah", "North East", "Online",
];

function TeacherDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [rate, setRate] = useState(40);
  const [years, setYears] = useState(0);
  const [primarySubject, setPrimarySubject] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [examTypes, setExamTypes] = useState<Set<ExamType>>(new Set());
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [topics, setTopics] = useState<{ id: string; name: string; subject_id: string }[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [specialties, setSpecialties] = useState<Set<string>>(new Set());
  const [bookings, setBookings] = useState<{ id: string; scheduled_at: string; status: string; profiles: { full_name: string } | null }[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [verification, setVerification] = useState<{ status: VerificationStatus; id_document_url: string | null; qualification_document_url: string | null; notes: string | null }>({ status: "unverified", id_document_url: null, qualification_document_url: null, notes: null });
  const [uploading, setUploading] = useState<"id" | "qual" | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    supabase.from("subjects").select("id, name").order("name").then(({ data }) => setSubjects(data ?? []));
    supabase.from("topics").select("id, name, subject_id").order("name").then(({ data }) => setTopics(data ?? []));
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("teacher_profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setHeadline(data.headline ?? "");
        setRate(Math.round((data.hourly_rate_cents ?? 4000) / 100));
        setYears(data.years_experience ?? 0);
        setPrimarySubject(data.primary_subject_id ?? "");
        setLocation((data as { location?: string }).location ?? "");
        setExamTypes(new Set(((data as { exam_types?: ExamType[] }).exam_types ?? []) as ExamType[]));
        const d = data as unknown as { verification_status?: VerificationStatus; id_document_url?: string | null; qualification_document_url?: string | null; verification_notes?: string | null };
        setVerification({
          status: d.verification_status ?? "unverified",
          id_document_url: d.id_document_url ?? null,
          qualification_document_url: d.qualification_document_url ?? null,
          notes: d.verification_notes ?? null,
        });
      }
    });
    supabase.from("profiles").select("bio").eq("id", user.id).maybeSingle().then(({ data }) => setBio(data?.bio ?? ""));
    supabase.from("teacher_topics").select("topic_id, is_specialty").eq("teacher_id", user.id).then(({ data }) => {
      const sel = new Set<string>(); const sp = new Set<string>();
      (data ?? []).forEach((r) => { sel.add(r.topic_id); if (r.is_specialty) sp.add(r.topic_id); });
      setSelectedTopics(sel); setSpecialties(sp);
    });
    supabase.from("bookings").select("id, scheduled_at, status, profiles:profiles!bookings_student_id_fkey(full_name)")
      .eq("teacher_id", user.id).order("scheduled_at", { ascending: false })
      .then(({ data }) => setBookings((data ?? []) as unknown as typeof bookings));
    supabase.from("teacher_availability").select("id, day_of_week, start_hour, end_hour").eq("teacher_id", user.id)
      .order("day_of_week").then(({ data }) => setAvailability(data ?? []));
  }, [user]);

  const toggleTopic = (id: string) => {
    const s = new Set(selectedTopics); s.has(id) ? s.delete(id) : s.add(id); setSelectedTopics(s);
    if (!s.has(id)) { const sp = new Set(specialties); sp.delete(id); setSpecialties(sp); }
  };
  const toggleSpecialty = (id: string) => {
    const sp = new Set(specialties); sp.has(id) ? sp.delete(id) : sp.add(id); setSpecialties(sp);
  };

  const save = async () => {
    if (!user) return;
    const { error: e1 } = await supabase.from("teacher_profiles").upsert({
      user_id: user.id, headline, hourly_rate_cents: rate * 100, years_experience: years,
      primary_subject_id: primarySubject || null, is_active: true,
      location, exam_types: Array.from(examTypes),
    } as never);
    const { error: e2 } = await supabase.from("profiles").update({ bio }).eq("id", user.id);
    await supabase.from("teacher_topics").delete().eq("teacher_id", user.id);
    if (selectedTopics.size > 0) {
      await supabase.from("teacher_topics").insert(Array.from(selectedTopics).map((tid) => ({
        teacher_id: user.id, topic_id: tid, is_specialty: specialties.has(tid),
      })));
    }
    if (e1 || e2) { toast.error("Failed to save"); return; }
    toast.success("Profile updated");
  };

  const filteredTopics = primarySubject ? topics.filter((t) => t.subject_id === primarySubject) : topics;

  const addAvailability = () => setAvailability([...availability, { day_of_week: 1, start_hour: 9, end_hour: 17 }]);
  const updateAvailability = (i: number, patch: Partial<Availability>) => {
    const next = [...availability]; next[i] = { ...next[i], ...patch }; setAvailability(next);
  };
  const removeAvailability = (i: number) => setAvailability(availability.filter((_, x) => x !== i));
  const saveAvailability = async () => {
    if (!user) return;
    await supabase.from("teacher_availability").delete().eq("teacher_id", user.id);
    if (availability.length > 0) {
      const { error } = await supabase.from("teacher_availability").insert(
        availability.map((a) => ({ teacher_id: user.id, day_of_week: a.day_of_week, start_hour: a.start_hour, end_hour: a.end_hour }))
      );
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Availability saved");
  };

  const uploadDoc = async (kind: "id" | "qual", file: File) => {
    if (!user) return;
    setUploading(kind);
    const path = `${user.id}/${kind}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("verification-docs").upload(path, file, { upsert: true });
    if (upErr) { setUploading(null); toast.error(upErr.message); return; }
    const field = kind === "id" ? "id_document_url" : "qualification_document_url";
    const { error: dbErr } = await supabase.from("teacher_profiles").update({ [field]: path } as never).eq("user_id", user.id);
    setUploading(null);
    if (dbErr) { toast.error(dbErr.message); return; }
    setVerification((v) => ({ ...v, [field]: path } as typeof v));
    toast.success("Uploaded");
  };

  const submitVerification = async () => {
    if (!user) return;
    if (!verification.id_document_url || !verification.qualification_document_url) {
      toast.error("Upload both documents first"); return;
    }
    const { error } = await supabase.from("teacher_profiles").update({ verification_status: "pending" } as never).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    setVerification((v) => ({ ...v, status: "pending" }));
    toast.success("Submitted for review");
  };

  const statusBadge = {
    unverified: { label: "Not submitted", cls: "bg-secondary text-muted-foreground" },
    pending: { label: "Under review", cls: "bg-accent-gold/30 text-ink" },
    verified: { label: "Verified ✓", cls: "bg-brand/10 text-brand" },
    rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive" },
  }[verification.status];

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="font-serif text-4xl">Teacher dashboard</h1>

        <section className="mt-8 rounded-3xl bg-card p-8 ring-1 ring-black/5">
          <h2 className="font-serif text-2xl">Your profile</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div><Label>Headline</Label><Input value={headline} maxLength={120} onChange={(e) => setHeadline(e.target.value)} className="mt-1" placeholder="AP Calculus specialist" /></div>
            <div><Label>Hourly rate (GH₵)</Label><Input type="number" min={1} max={500} value={rate} onChange={(e) => setRate(+e.target.value)} className="mt-1" /></div>
            <div><Label>Years experience</Label><Input type="number" min={0} max={60} value={years} onChange={(e) => setYears(+e.target.value)} className="mt-1" /></div>
            <div>
              <Label>Primary subject</Label>
              <select value={primarySubject} onChange={(e) => setPrimarySubject(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-border bg-card px-3 text-sm">
                <option value="">Select subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Location</Label>
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-border bg-card px-3 text-sm">
                <option value="">Select region</option>
                {GH_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>Exams you prep students for</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXAM_OPTIONS.map((e) => {
                  const on = examTypes.has(e.value);
                  return (
                    <button key={e.value} type="button"
                      onClick={() => {
                        const s = new Set(examTypes);
                        s.has(e.value) ? s.delete(e.value) : s.add(e.value);
                        setExamTypes(s);
                      }}
                      className={`rounded-full px-3 py-1 text-xs ${on ? "bg-brand text-primary-foreground" : "border border-border bg-card"}`}>
                      {e.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="md:col-span-2"><Label>Bio</Label><Textarea value={bio} maxLength={1000} onChange={(e) => setBio(e.target.value)} className="mt-1" rows={4} /></div>
          </div>

          <div className="mt-6">
            <Label>Topics you teach (★ marks specialty)</Label>
            <div className="mt-3 flex flex-wrap gap-2">
              {filteredTopics.map((t) => {
                const sel = selectedTopics.has(t.id); const sp = specialties.has(t.id);
                return (
                  <div key={t.id} className="flex items-center gap-1">
                    <button type="button" onClick={() => toggleTopic(t.id)} className={`rounded-full px-3 py-1 text-xs ${sel ? "bg-brand text-primary-foreground" : "border border-border bg-card"}`}>
                      {t.name}
                    </button>
                    {sel && (
                      <button type="button" onClick={() => toggleSpecialty(t.id)} className={`rounded-full px-2 py-1 text-xs ${sp ? "bg-ink text-primary-foreground" : "border border-border"}`}>★</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Button onClick={save} className="mt-8 rounded-xl bg-brand">Save profile</Button>
        </section>

        <section className="mt-8 rounded-3xl bg-card p-8 ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">Verification</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.cls}`}>{statusBadge.label}</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Upload a government ID and your WAEC/teaching qualification. Verified tutors get a badge on search results.</p>
          {verification.notes && verification.status === "rejected" && (
            <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">Admin note: {verification.notes}</p>
          )}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border p-4">
              <Label>Government ID</Label>
              <p className="mt-1 text-xs text-muted-foreground">Ghana Card, passport, or driver's license</p>
              <input type="file" accept="image/*,application/pdf" disabled={uploading !== null || verification.status === "pending"}
                onChange={(e) => e.target.files?.[0] && uploadDoc("id", e.target.files[0])}
                className="mt-3 block w-full text-xs" />
              {verification.id_document_url && <p className="mt-2 text-xs text-brand">✓ Uploaded</p>}
            </div>
            <div className="rounded-2xl border border-border p-4">
              <Label>WAEC / teaching qualification</Label>
              <p className="mt-1 text-xs text-muted-foreground">Certificate for the subject you teach</p>
              <input type="file" accept="image/*,application/pdf" disabled={uploading !== null || verification.status === "pending"}
                onChange={(e) => e.target.files?.[0] && uploadDoc("qual", e.target.files[0])}
                className="mt-3 block w-full text-xs" />
              {verification.qualification_document_url && <p className="mt-2 text-xs text-brand">✓ Uploaded</p>}
            </div>
          </div>
          {(verification.status === "unverified" || verification.status === "rejected") && (
            <Button onClick={submitVerification} className="mt-6 rounded-xl bg-brand">Submit for review</Button>
          )}
        </section>

        <section className="mt-8 rounded-3xl bg-card p-8 ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">Weekly availability</h2>
            <Button onClick={addAvailability} variant="outline" size="sm" className="rounded-full">+ Add slot</Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Set the hours you're available each week. Students can only book inside these windows.</p>
          <div className="mt-6 space-y-2">
            {availability.length === 0 && <p className="text-sm text-muted-foreground">No availability set — add at least one slot so students can book.</p>}
            {availability.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3">
                <select value={a.day_of_week} onChange={(e) => updateAvailability(i, { day_of_week: +e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
                  {DAYS.map((d, x) => <option key={x} value={x}>{d}</option>)}
                </select>
                <select value={a.start_hour} onChange={(e) => updateAvailability(i, { start_hour: +e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
                </select>
                <span className="text-xs text-muted-foreground">to</span>
                <select value={a.end_hour} onChange={(e) => updateAvailability(i, { end_hour: +e.target.value })} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
                  {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{h}:00</option>)}
                </select>
                <button onClick={() => removeAvailability(i)} className="ml-auto text-xs text-destructive hover:underline">Remove</button>
              </div>
            ))}
          </div>
          <Button onClick={saveAvailability} className="mt-6 rounded-xl bg-brand">Save availability</Button>
        </section>

        <section className="mt-8 rounded-3xl bg-card p-8 ring-1 ring-black/5">
          <h2 className="font-serif text-2xl">Upcoming bookings</h2>
          <div className="mt-4 space-y-2">
            {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet.</p>}
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl bg-secondary p-4">
                <div>
                  <p className="text-sm font-medium">{b.profiles?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(b.scheduled_at).toLocaleString()}</p>
                </div>
                <span className="text-xs">{b.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}