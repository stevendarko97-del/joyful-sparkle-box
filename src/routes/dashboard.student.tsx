import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Calendar, Clock, CreditCard, CheckCircle2 } from "lucide-react";
export const Route = createFileRoute("/dashboard/student")({ component: StudentDashboard });

type Booking = {
  id: string;
  scheduled_at: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  price_cents: number;
  room_id: string | null;
  teacher_id: string;
  profiles: { full_name: string } | null;
};

const BACKEND = (import.meta as any).env.VITE_BACKEND_URL || "http://localhost:4000";

function formatDateTime(v: string) {
  return new Date(v).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function openPaystackPopup(email: string, amountCents: number, reference: string, onSuccess: () => void, onClose: () => void) {
  const publicKey = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY as string;
  if (!publicKey || publicKey === "pk_test_placeholder") {
    toast.info("Paystack key not set — simulating payment (dev mode)");
    onSuccess(); return;
  }
  const handler = (window as any).PaystackPop?.setup({ key: publicKey, email, amount: amountCents, currency: "GHS", ref: reference, callback: onSuccess, onClose });
  handler?.openIframe();
}

function StudentDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed" | "cancelled" | "pending">("all");
  const [loadingData, setLoadingData] = useState(true);

  // Review modal
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reschedule modal
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [newDate, setNewDate] = useState("");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const loadDashboard = async () => {
    setLoadingData(true);
    const token = localStorage.getItem("token");
    const res = await fetch(`${BACKEND}/api/student/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setBookings(data.bookings ?? []);
      setRatedIds(new Set(data.ratedIds ?? []));
    }
    setLoadingData(false);
  };

  useEffect(() => { if (user) loadDashboard(); }, [user]);

  const cancelBooking = async (id: string) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${BACKEND}/api/student/bookings/${id}/cancel`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) { toast.success("Booking cancelled"); loadDashboard(); }
    else toast.error("Failed to cancel");
  };

  const reschedule = async () => {
    if (!rescheduleBooking || !newDate) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${BACKEND}/api/student/bookings/${rescheduleBooking.id}/reschedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ scheduled_at: new Date(newDate).toISOString() }),
    });
    if (res.ok) { toast.success("Rescheduled!"); setRescheduleBooking(null); setNewDate(""); loadDashboard(); }
    else toast.error("Failed to reschedule");
  };

  const submitReview = async () => {
    if (!reviewBooking) return;
    setSubmitting(true);
    const token = localStorage.getItem("token");
    const res = await fetch(`${BACKEND}/api/student/bookings/${reviewBooking.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ teacher_id: reviewBooking.teacher_id, stars, comment }),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Review submitted!");
      setReviewBooking(null); setStars(5); setComment("");
      loadDashboard();
    } else toast.error("Failed to submit review");
  };

  const handlePayNow = (b: Booking) => {
    if (!user) return;
    const reference = `qt-${b.id}-${Date.now()}`;
    openPaystackPopup(user.email, b.price_cents, reference,
      async () => {
        const token = localStorage.getItem("token");
        await fetch(`${BACKEND}/api/paystack/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reference, booking_id: b.id }),
        }).catch(() => {});
        toast.success("Payment confirmed!"); loadDashboard();
      },
      () => toast.info("Payment cancelled.")
    );
  };

  const now = new Date();
  const filtered = filter === "all" ? bookings
    : filter === "upcoming" ? bookings.filter(b => (b.status === "confirmed" || b.status === "pending") && new Date(b.scheduled_at) > now)
    : bookings.filter(b => b.status === filter);

  const upcoming = bookings.find(b => b.status === "confirmed" && new Date(b.scheduled_at) > now);

  const FILTERS = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Upcoming" },
    { key: "pending", label: "Pending" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ] as const;

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">Student Dashboard</p>
          <h1 className="mt-1 font-serif text-4xl">My Learning</h1>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Sessions", value: bookings.length, icon: "📅" },
            { label: "Upcoming", value: bookings.filter(b => b.status === "confirmed" && new Date(b.scheduled_at) > now).length, icon: "⏰" },
            { label: "Pending Payment", value: bookings.filter(b => b.status === "pending").length, icon: "💳" },
            { label: "Completed", value: bookings.filter(b => b.status === "completed").length, icon: "✅" },
          ].map(s => (
            <div key={s.label} className="rounded-3xl bg-card p-6 border border-border/80 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <span className="text-xl">{s.icon}</span>
              </div>
              <p className="mt-2 font-serif text-3xl leading-none">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Next session banner */}
        {upcoming && (
          <div className="mb-6 rounded-3xl bg-brand p-6 sm:p-8 text-primary-foreground shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-16 -mr-16 size-64 rounded-full bg-white/10 blur-3xl transition-transform duration-700 group-hover:scale-150" />
            <div className="relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full inline-block">Next Session</p>
              <p className="mt-3 font-serif text-3xl sm:text-4xl">{upcoming.profiles?.full_name ?? "Your tutor"}</p>
              <p className="mt-1 text-sm opacity-90 flex items-center gap-1.5"><Clock className="size-4" /> {formatDateTime(upcoming.scheduled_at)}</p>
              <Link
                to="/room/$id"
                params={{ id: upcoming.id }}
                className="mt-6 inline-flex items-center gap-2 h-10 rounded-full bg-white px-6 text-sm font-bold text-brand hover:bg-white/90 hover:scale-105 transition-all shadow-sm"
              >
                Join Lesson
              </Link>
            </div>
          </div>
        )}

        {/* Bookings */}
        <div className="rounded-2xl bg-card p-5 ring-1 ring-black/5">
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <h3 className="font-semibold mr-4">My Sessions</h3>
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`h-8 rounded-full px-3 text-xs font-medium capitalize transition-colors ${filter === f.key ? "bg-ink text-primary-foreground" : "border border-border hover:bg-secondary"}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loadingData ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-xl bg-secondary animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Calendar className="size-8 opacity-50" />
              </div>
              <p className="text-sm text-muted-foreground">No sessions found.</p>
              <Link to="/teachers" className="mt-4 inline-block h-10 rounded-full bg-brand px-6 text-sm font-semibold leading-10 text-primary-foreground hover:bg-brand/90 hover:scale-105 transition-all duration-300 shadow-md">
                Find a tutor
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(b => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card border border-border p-5 hover:shadow-md hover:border-brand/30 transition-all duration-300 group">
                  <div>
                    <p className="text-sm font-medium">{b.profiles?.full_name ?? "Tutor"}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(b.scheduled_at)}</p>
                    <p className="text-xs text-muted-foreground">GH₵{(b.price_cents / 100).toFixed(2)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      b.status === "confirmed" ? "bg-green-100 text-green-700"
                      : b.status === "pending" ? "bg-yellow-100 text-yellow-700"
                      : b.status === "completed" ? "bg-blue-100 text-blue-700"
                      : "bg-red-100 text-red-700"
                    }`}>{b.status}</span>

                    {b.status === "pending" && (
                      <button onClick={() => handlePayNow(b)} className="h-8 rounded-full bg-brand px-3 text-xs font-medium text-primary-foreground hover:bg-brand/90">
                        Pay Now
                      </button>
                    )}
                    {b.status === "confirmed" && new Date(b.scheduled_at) > now && (
                      <>
                        <Link to="/room/$id" params={{ id: b.id }} className="h-8 rounded-full bg-ink px-3 text-xs font-medium text-primary-foreground leading-8">
                          Join
                        </Link>
                        <button onClick={() => setRescheduleBooking(b)} className="h-8 rounded-full border border-border px-3 text-xs font-medium hover:bg-secondary">
                          Reschedule
                        </button>
                        <button onClick={() => cancelBooking(b.id)} className="h-8 rounded-full border border-border px-3 text-xs font-medium text-destructive hover:bg-secondary">
                          Cancel
                        </button>
                      </>
                    )}
                    {b.status === "completed" && !ratedIds.has(b.id) && (
                      <button onClick={() => setReviewBooking(b)} className="h-8 rounded-full bg-accent-gold/20 px-3 text-xs font-medium text-ink hover:bg-accent-gold/30">
                        Leave Review
                      </button>
                    )}
                    {b.status === "completed" && ratedIds.has(b.id) && (
                      <span className="text-xs text-muted-foreground">✓ Reviewed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Browse CTA */}
        <div className="mt-6 rounded-2xl bg-secondary p-6 text-center">
          <p className="text-sm text-muted-foreground">Looking for more tutors?</p>
          <Link to="/teachers" className="mt-3 inline-block h-10 rounded-full bg-brand px-6 text-sm font-semibold leading-10 text-primary-foreground hover:bg-brand/90 transition-colors">
            Browse All Tutors
          </Link>
        </div>
      </div>

      {/* Review modal */}
      {reviewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
            <h3 className="font-serif text-2xl font-semibold">Leave a review</h3>
            <p className="mt-1 text-sm text-muted-foreground">for {reviewBooking.profiles?.full_name ?? "your tutor"}</p>
            <div className="mt-4 flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setStars(n)} className={`text-2xl transition-transform hover:scale-110 ${n <= stars ? "text-accent-gold" : "text-muted-foreground/30"}`}>★</button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Share your experience…"
              rows={3}
              className="mt-4 w-full rounded-xl border border-border px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setReviewBooking(null)} className="h-9 rounded-full px-4 text-sm hover:bg-secondary">Cancel</button>
              <button onClick={submitReview} disabled={submitting} className="h-9 rounded-full bg-brand px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule modal */}
      {rescheduleBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-card p-8 shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
            <h3 className="font-serif text-2xl font-semibold">Reschedule Session</h3>
            <p className="mt-1 text-sm text-muted-foreground">with {rescheduleBooking.profiles?.full_name ?? "your tutor"}</p>
            <div className="mt-4">
              <label className="text-xs font-medium text-muted-foreground">New date & time</label>
              <input type="datetime-local" value={newDate} onChange={e => setNewDate(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRescheduleBooking(null)} className="h-9 rounded-full px-4 text-sm hover:bg-secondary">Cancel</button>
              <button onClick={reschedule} disabled={!newDate} className="h-9 rounded-full bg-brand px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                Reschedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
