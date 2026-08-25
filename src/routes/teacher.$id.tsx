import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { BookingDialog } from "@/components/booking-dialog";
import { MessageSquare } from "lucide-react";

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

type RatingItem = {
  id?: string;
  stars: number;
  comment: string | null;
  created_at?: string;
  student_name?: string;
  student_avatar?: string | null;
  bookings?: { scheduled_at: string; location: string | null } | null;
};

type TeacherProfile = {
  user_id: string;
  headline: string;
  hourly_rate_cents: number;
  years_experience: number;
  location: string;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  exam_types: ExamType[];
  avg_stars?: number | null;
  review_count?: number;
  profiles: { full_name: string; bio: string | null; avatar_url: string | null } | null;
  subjects: { name: string } | null;
};

import { getBackendUrl } from "@/lib/config";

const BACKEND = getBackendUrl();

function TeacherDetail() {
  const { id } = Route.useParams();
  const { user, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [t, setT] = useState<TeacherProfile | null>(null);
  const [topics, setTopics] = useState<{ id: string; name: string; is_specialty: boolean }[]>([]);
  const [ratings, setRatings] = useState<RatingItem[]>([]);
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

  // Automatic calculated average rating from total accumulation of ratings
  const totalStars = ratings.reduce((a, r) => a + (Number(r.stars) || 0), 0);
  const avg = ratings.length > 0 ? (totalStars / ratings.length).toFixed(1) : null;

  const starCounts = [5, 4, 3, 2, 1].map(stars => {
    const count = ratings.filter(r => r.stars === stars).length;
    const pct = ratings.length > 0 ? Math.round((count / ratings.length) * 100) : 0;
    return { stars, count, pct };
  });

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
            <Link to="/teachers" search={{ q: undefined }} className="mt-6 inline-block h-10 rounded-full bg-brand px-5 text-sm font-medium leading-10 text-primary-foreground">Browse tutors</Link>
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
          <Link to="/teachers" search={{ q: undefined }} className="text-sm text-primary-foreground/50 hover:text-primary-foreground/80 transition-colors">← Back to tutors</Link>
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
                <button
                  onClick={() => isAuthed ? navigate({ to: "/messages", search: { contactId: id } }) : navigate({ to: "/auth", search: { mode: "login", role: "student" } })}
                  className="mt-2 w-full h-10 rounded-full border border-white/20 text-xs font-semibold text-primary-foreground hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="size-3.5" />
                  Message Tutor
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

            {/* Verified Student Reviews & Ratings */}
            <div className="rounded-2xl bg-card p-6 ring-1 ring-black/5 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-ink">Student Reviews &amp; Ratings</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically accumulated and averaged from verified completed lessons.
                  </p>
                </div>
                {avg ? (
                  <div className="flex items-center gap-3 bg-amber-500/10 px-4 py-2.5 rounded-2xl border border-amber-500/20">
                    <span className="font-serif text-3xl font-bold text-amber-600 dark:text-amber-400">{avg}</span>
                    <div>
                      <div className="text-amber-500 text-sm font-bold">{"★".repeat(Math.round(Number(avg)))}{"☆".repeat(5 - Math.round(Number(avg)))}</div>
                      <p className="text-[10px] font-semibold text-muted-foreground">{ratings.length} verified rating{ratings.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-secondary text-xs text-muted-foreground font-medium">New Tutor</span>
                )}
              </div>

              {ratings.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-4 bg-secondary/30 p-4 rounded-xl border border-border">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rating Distribution</p>
                    {starCounts.map(({ stars, count, pct }) => (
                      <div key={stars} className="flex items-center gap-2 text-xs">
                        <span className="w-6 text-muted-foreground font-semibold">{stars} ★</span>
                        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-right text-[10px] text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col justify-center items-start sm:border-l sm:border-border sm:pl-4 space-y-1">
                    <p className="text-xs font-semibold text-ink">100% Verified Reviews</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Only students who have completed and paid for a session can submit a rating. Ratings cannot be manually altered.
                    </p>
                  </div>
                </div>
              )}

              {ratings.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <div className="text-2xl">✨</div>
                  <p className="text-sm font-semibold text-ink">No reviews yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Be the first student to book a session with {t.profiles?.full_name?.split(" ")[0]} and leave a review after your lesson!
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {ratings.map((r, i) => (
                    <div key={r.id || i} className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center font-bold text-xs text-brand overflow-hidden">
                            {r.student_avatar ? (
                              <img src={r.student_avatar} alt="" className="size-full object-cover" />
                            ) : (
                              (r.student_name?.[0] ?? "S")
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-ink">{r.student_name || "Verified Student"}</p>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">
                                Verified Lesson
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {r.created_at ? new Date(r.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : (r.bookings?.scheduled_at ? new Date(r.bookings.scheduled_at).toLocaleDateString() : 'Recent')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center text-amber-500 text-xs font-bold">
                          {"★".repeat(r.stars)}
                          <span className="text-muted-foreground/30">{"★".repeat(5 - r.stars)}</span>
                        </div>
                      </div>

                      {r.comment && (
                        <p className="text-xs text-ink/90 italic leading-relaxed pl-1 border-l-2 border-brand/40">
                          "{r.comment}"
                        </p>
                      )}
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