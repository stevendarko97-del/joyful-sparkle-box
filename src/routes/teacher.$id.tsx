import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { BookingDialog } from "@/components/booking-dialog";

export const Route = createFileRoute("/teacher/$id")({
  component: TeacherDetail,
  head: () => ({ meta: [{ title: "Tutor Profile — Quick Tutor" }] }),
});

type ExamType = "BECE" | "WASSCE" | "NOV_DEC" | "SHS_REMEDIAL" | "JHS_REMEDIAL";
const EXAM_TYPES: { value: ExamType; label: string }[] = [
  { value: "WASSCE", label: "WASSCE" },
  { value: "BECE", label: "BECE" },
  { value: "NOV_DEC", label: "NOV/DEC" },
  { value: "SHS_REMEDIAL", label: "SHS Remedial" },
  { value: "JHS_REMEDIAL", label: "JHS Remedial" },
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type TeacherProfile = {
  user_id: string;
  headline: string;
  hourly_rate_cents: number;
  years_experience: number;
  location: string;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  exam_types: ExamType[];
  profiles: { full_name: string; bio: string | null; avatar_url: string | null } | null;
  subjects: { name: string } | null;
};

const BACKEND = (import.meta as any).env.VITE_BACKEND_URL || "http://localhost:4000";

function TeacherDetail() {
  const { id } = Route.useParams();
  const { user, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [t, setT] = useState<TeacherProfile | null>(null);
  const [topics, setTopics] = useState<{ id: string; name: string; is_specialty: boolean }[]>([]);
  const [ratings, setRatings] = useState<{ stars: number; comment: string | null; bookings: { scheduled_at: string; location: string | null } | null }[]>([]);
  const [availability, setAvailability] = useState<{ day_of_week: number; start_hour: number; end_hour: number }[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND}/api/teachers/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.t) { setNotFound(true); return; }
        setT(data.t);
        setTopics(data.topics ?? []);
        setAvailability(data.availability ?? []);
        setRatings(data.ratings ?? []);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  const avg = ratings.length ? (ratings.reduce((a, r) => a + r.stars, 0) / ratings.length).toFixed(1) : null;

  const weeklyAvailability = DAYS.map((day, dow) => {
    const slots = availability.filter(s => s.day_of_week === dow).map(s => `${s.start_hour}:00 – ${s.end_hour}:00`);
    return { day, slots };
  }).filter(e => e.slots.length > 0);

  if (notFound) {
    return (
      <div className="min-h-screen bg-surface">
        <SiteNav />
        <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
          <div>
            <h1 className="font-serif text-4xl">Tutor not found</h1>
            <p className="mt-2 text-muted-foreground">This profile doesn't exist or has been removed.</p>
            <Link to="/teachers" className="mt-6 inline-block h-10 rounded-full bg-brand px-5 text-sm font-medium leading-10 text-primary-foreground">Browse tutors</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!t) {
    return (
      <div className="min-h-screen bg-surface">
        <SiteNav />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-brand" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />

      {/* Hero banner */}
      <section className="bg-ink py-16">
        <div className="mx-auto max-w-7xl px-6">
          <Link to="/teachers" className="text-sm text-primary-foreground/50 hover:text-primary-foreground/80 transition-colors">← Back to tutors</Link>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="size-24 shrink-0 rounded-2xl overflow-hidden border-2 border-white/10 bg-brand flex items-center justify-center text-3xl font-bold text-primary-foreground">
              {t.profiles?.avatar_url
                ? <img src={t.profiles.avatar_url} alt="" className="size-full object-cover" />
                : (t.profiles?.full_name?.[0] ?? "T")}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {t.verification_status === "verified" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-bold text-brand-soft border border-brand/20">
                    ✓ Verified
                  </span>
                )}
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/40">Expert Mentor</span>
              </div>
              <h1 className="mt-2 font-serif text-4xl text-primary-foreground">{t.profiles?.full_name}</h1>
              <p className="mt-2 text-sm text-primary-foreground/60">
                {t.subjects?.name ?? "General Tutor"}
                {t.years_experience ? ` · ${t.years_experience} yr${t.years_experience === 1 ? "" : "s"} experience` : ""}
                {avg ? ` · ★ ${avg}` : ""}
                {t.location ? ` · 📍 ${t.location}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(t.exam_types ?? []).map(e => (
                  <span key={e} className="rounded-full bg-brand/20 px-3 py-1 text-[10px] font-bold text-primary-foreground/80 border border-brand/20">
                    {EXAM_TYPES.find(x => x.value === e)?.label ?? e}
                  </span>
                ))}
              </div>
            </div>
            {/* Book button */}
            <div className="sm:ml-auto sm:shrink-0">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-center min-w-[200px]">
                <p className="font-serif text-3xl text-primary-foreground">
                  GH₵{(t.hourly_rate_cents / 100).toFixed(0)}
                  <span className="text-base font-normal text-primary-foreground/50">/hr</span>
                </p>
                <p className="mt-1 text-xs text-primary-foreground/40">60-min session</p>
                <button
                  onClick={() => isAuthed ? setBookingOpen(true) : navigate({ to: "/auth", search: { mode: "signup", role: "student" } })}
                  className="mt-4 w-full h-11 rounded-full bg-brand text-sm font-semibold text-primary-foreground hover:bg-brand/90 transition-colors"
                >
                  Book a session
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main */}
          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            {t.profiles?.bio && (
              <div className="rounded-2xl bg-card p-6 ring-1 ring-black/5">
                <h2 className="font-serif text-2xl">About {t.profiles.full_name?.split(" ")[0]}</h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t.profiles.bio}</p>
              </div>
            )}

            {/* Topics */}
            {topics.length > 0 && (
              <div className="rounded-2xl bg-card p-6 ring-1 ring-black/5">
                <h2 className="font-serif text-2xl">Topics covered</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {topics.map(tp => (
                    <span key={tp.id} className={`rounded-full px-3 py-1.5 text-xs font-medium ${tp.is_specialty ? "bg-brand/10 text-brand ring-1 ring-brand/20" : "bg-secondary text-ink"}`}>
                      {tp.is_specialty && <span className="mr-1 text-accent-gold">★</span>}
                      {tp.name}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-muted-foreground"><span className="text-accent-gold">★</span> = specialty topic</p>
              </div>
            )}

            {/* Reviews */}
            <div className="rounded-2xl bg-card p-6 ring-1 ring-black/5">
              <div className="flex items-center gap-4 mb-6">
                <h2 className="font-serif text-2xl">Reviews</h2>
                {avg && (
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-4xl">{avg}</span>
                    <div>
                      <div className="text-accent-gold">{"★".repeat(Math.round(Number(avg)))}</div>
                      <p className="text-[10px] text-muted-foreground">{ratings.length} review{ratings.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                )}
              </div>
              {ratings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet. Be the first to review after a session!</p>
              ) : (
                <div className="space-y-4">
                  {ratings.map((r, i) => (
                    <div key={i} className="border-t border-border pt-4 first:border-0 first:pt-0">
                      <div className="flex items-center justify-between">
                        <span className="text-accent-gold">{"★".repeat(r.stars)}</span>
                        {r.bookings?.scheduled_at && (
                          <span className="text-[11px] text-muted-foreground">{new Date(r.bookings.scheduled_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      {r.comment && <p className="mt-2 text-sm text-muted-foreground italic">"{r.comment}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Availability */}
            <div className="rounded-2xl bg-card p-5 ring-1 ring-black/5">
              <h3 className="font-semibold text-sm mb-4">Weekly Availability</h3>
              {weeklyAvailability.length === 0 ? (
                <p className="text-xs text-muted-foreground">This tutor hasn't published availability yet. Book a session to request a time.</p>
              ) : (
                <div className="space-y-2">
                  {weeklyAvailability.map(({ day, slots }) => (
                    <div key={day} className="flex items-start gap-3">
                      <span className="w-8 shrink-0 text-xs font-semibold text-muted-foreground">{day}</span>
                      <div className="space-y-0.5">
                        {slots.map(s => <p key={s} className="text-xs text-ink">{s}</p>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Book now card */}
            <div className="rounded-2xl bg-brand p-5 text-primary-foreground">
              <p className="font-serif text-xl">Ready to book?</p>
              <p className="mt-1 text-sm opacity-70">One-on-one session · 60 minutes</p>
              <p className="mt-3 font-serif text-3xl">GH₵{(t.hourly_rate_cents / 100).toFixed(0)}</p>
              <button
                onClick={() => isAuthed ? setBookingOpen(true) : navigate({ to: "/auth", search: { mode: "signup", role: "student" } })}
                className="mt-4 w-full h-11 rounded-full bg-white text-sm font-semibold text-brand hover:bg-white/90 transition-colors"
              >
                Book a session
              </button>
            </div>

            {/* Exam types sidebar */}
            {(t.exam_types ?? []).length > 0 && (
              <div className="rounded-2xl bg-card p-5 ring-1 ring-black/5">
                <h3 className="font-semibold text-sm mb-4">Exams tutored</h3>
                <div className="space-y-2">
                  {(t.exam_types ?? []).map(e => (
                    <div key={e} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-brand" />
                      <span className="text-sm">{EXAM_TYPES.find(x => x.value === e)?.label ?? e}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <SiteFooter />

      <BookingDialog
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        teacher={t ? {
          user_id: t.user_id,
          full_name: t.profiles?.full_name ?? "Tutor",
          hourly_rate_cents: t.hourly_rate_cents,
        } : null}
      />
    </div>
  );
}