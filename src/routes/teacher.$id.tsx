import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/teacher/$id")({
  component: TeacherDetail,
});

type TeacherDetail = {
  user_id: string;
  headline: string;
  hourly_rate_cents: number;
  years_experience: number;
  profiles: { full_name: string; bio: string | null; avatar_url: string | null } | null;
  subjects: { name: string } | null;
};

function TeacherDetail() {
  const { id } = Route.useParams();
  const { user, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [t, setT] = useState<TeacherDetail | null>(null);
  const [topics, setTopics] = useState<{ id: string; name: string; is_specialty: boolean }[]>([]);
  const [ratings, setRatings] = useState<{ stars: number; comment: string | null; bookings: { scheduled_at: string; location: string | null } | null }[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("17:30");
  const [topicId, setTopicId] = useState<string>("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("teacher_profiles").select(
      "user_id, headline, hourly_rate_cents, years_experience, profiles:profiles!teacher_profiles_user_id_fkey(full_name, bio, avatar_url), subjects:subjects!teacher_profiles_primary_subject_id_fkey(name)"
    ).eq("user_id", id).maybeSingle().then(({ data }) => setT(data as unknown as TeacherDetail));

    supabase.from("teacher_topics").select("is_specialty, topics(id, name)").eq("teacher_id", id)
      .then(({ data }) => setTopics((data ?? []).map((r: { is_specialty: boolean; topics: { id: string; name: string } | null }) => ({ id: r.topics?.id ?? "", name: r.topics?.name ?? "", is_specialty: r.is_specialty })).filter((x) => x.id)));

    supabase.from("ratings").select("stars, comment, bookings:bookings!ratings_booking_id_fkey(scheduled_at, location)").eq("teacher_id", id).order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => setRatings((data ?? []) as unknown as { stars: number; comment: string | null; bookings: { scheduled_at: string; location: string | null } | null }[]));
  }, [id]);

  const avg = ratings.length ? (ratings.reduce((a, r) => a + r.stars, 0) / ratings.length).toFixed(1) : null;

  const book = async () => {
    if (!isAuthed) { navigate({ to: "/auth", search: { mode: "signup", role: "student" } }); return; }
    if (!date) { toast.error("Pick a date"); return; }
    if (!t || !user) return;
    setBusy(true);
    const scheduledAt = new Date(`${date}T${time}:00`);
    const { error } = await supabase.from("bookings").insert({
      student_id: user.id,
      teacher_id: t.user_id,
      topic_id: topicId || null,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: 60,
      price_cents: t.hourly_rate_cents,
      status: "pending",
      location: location.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Booking created — pay from your dashboard");
    navigate({ to: "/dashboard/student" });
  };

  if (!t) return <div className="min-h-screen bg-surface"><SiteNav /><div className="p-12 text-center text-muted-foreground">Loading...</div></div>;

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <Link to="/teachers" className="text-sm text-muted-foreground hover:text-brand">← Back to teachers</Link>
        <div className="mt-6 grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-6">
              <div className="size-32 rounded-3xl bg-secondary outline outline-1 -outline-offset-1 outline-black/5">
                {t.profiles?.avatar_url && <img src={t.profiles.avatar_url} alt="" className="size-full rounded-3xl object-cover" />}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-brand">Mentor</span>
                <h1 className="mt-2 font-serif text-4xl leading-tight">{t.profiles?.full_name}</h1>
                <p className="mt-1 text-muted-foreground">{t.subjects?.name ?? "Tutor"} • {t.years_experience}y experience {avg && `• ★ ${avg}`}</p>
              </div>
            </div>
            <p className="mt-10 text-pretty text-lg leading-relaxed text-muted-foreground">{t.profiles?.bio || t.headline || "Experienced educator."}</p>

            {topics.length > 0 && (
              <div className="mt-8">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Topics taught</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {topics.map((tp) => (
                    <span key={tp.id} className={`rounded-full px-3 py-1 text-xs ${tp.is_specialty ? "bg-brand text-primary-foreground" : "bg-secondary"}`}>
                      {tp.name}{tp.is_specialty && " ★"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {ratings.length > 0 && (
              <div className="mt-8 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recent ratings</h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                    <svg viewBox="0 0 24 24" className="size-3" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                    Verified sessions
                  </span>
                </div>
                {ratings.map((r, i) => (
                  <div key={i} className="rounded-2xl bg-secondary p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-brand">{"★".repeat(r.stars)}<span className="text-muted-foreground">{"★".repeat(5 - r.stars)}</span></div>
                      {r.bookings?.scheduled_at && (
                        <span title="This review is from a completed, confirmed booking" className="inline-flex items-center gap-1 rounded-full bg-accent-gold/20 px-2 py-0.5 text-[10px] font-semibold text-ink">
                          <svg viewBox="0 0 24 24" className="size-3" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                          Verified session
                        </span>
                      )}
                    </div>
                    {r.comment && <p className="mt-2 text-sm italic text-muted-foreground">"{r.comment}"</p>}
                    {r.bookings?.scheduled_at && (
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <svg viewBox="0 0 24 24" className="size-3 text-brand" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>
                        Session on {new Date(r.bookings.scheduled_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                        {r.bookings.location ? ` · ${r.bookings.location}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <div className="sticky top-8 rounded-3xl border border-border bg-card p-8 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-semibold">${(t.hourly_rate_cents / 100).toFixed(0)}<span className="text-sm font-normal text-muted-foreground">/session</span></span>
                <span className="text-sm text-muted-foreground">60 min lesson</span>
              </div>
              <div className="mt-8 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Time</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm" />
                </div>
                {topics.length > 0 && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Topic (optional)</label>
                    <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm">
                      <option value="">Any topic</option>
                      {topics.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Session location (optional)</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Accra, Online, Kumasi" className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm" />
                </div>
              </div>
              <Button onClick={book} disabled={busy} className="mt-8 w-full rounded-xl bg-ink py-6 text-sm font-semibold text-primary-foreground hover:bg-ink/90">
                {busy ? "Booking..." : "Confirm Booking"}
              </Button>
              <p className="mt-4 text-center text-[11px] text-muted-foreground">Payment processed securely</p>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}