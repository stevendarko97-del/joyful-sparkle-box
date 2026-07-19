import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/student")({ component: StudentDashboard });

type Booking = {
  id: string; scheduled_at: string; status: string; price_cents: number; room_id: string; teacher_id: string;
  profiles: { full_name: string } | null;
};

function StudentDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("bookings")
      .select("id, scheduled_at, status, price_cents, room_id, teacher_id, profiles:profiles!bookings_teacher_id_fkey(full_name)")
      .eq("student_id", user.id)
      .order("scheduled_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as Booking[];
        setBookings(rows);
        const ids = rows.map((r) => r.id);
        if (ids.length) {
          supabase.from("ratings").select("booking_id").in("booking_id", ids)
            .then(({ data: rt }) => setRatedIds(new Set((rt ?? []).map((r) => r.booking_id))));
        }
      });
  }, [user]);

  const submitReview = async (b: Booking) => {
    if (!user) return;
    if (stars < 1 || stars > 5) { toast.error("Pick 1–5 stars"); return; }
    setBusy(true);
    const { error } = await supabase.from("ratings").insert({
      booking_id: b.id,
      teacher_id: b.teacher_id,
      student_id: user.id,
      stars,
      comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Thanks for your review!");
    setRatedIds((s) => new Set(s).add(b.id));
    setOpenFor(null); setStars(5); setComment("");
  };

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="font-serif text-4xl">My lessons</h1>
        <Link to="/teachers" className="mt-2 inline-block text-sm text-brand hover:underline">+ Book a new lesson</Link>
        <div className="mt-8 space-y-3">
          {bookings.length === 0 && <p className="rounded-2xl bg-card p-12 text-center text-muted-foreground ring-1 ring-black/5">No bookings yet.</p>}
          {bookings.map((b) => (
            <div key={b.id} className="rounded-2xl bg-card p-5 ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{b.profiles?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(b.scheduled_at).toLocaleString()} • GH₵{(b.price_cents / 100).toFixed(0)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {b.status === "completed" && !ratedIds.has(b.id) && (
                    <button
                      onClick={() => { setOpenFor(openFor === b.id ? null : b.id); setStars(5); setComment(""); }}
                      className="h-8 rounded-full bg-ink px-3 text-xs font-medium text-primary-foreground hover:bg-brand"
                    >
                      {openFor === b.id ? "Cancel" : "Leave review"}
                    </button>
                  )}
                  {b.status === "completed" && ratedIds.has(b.id) && (
                    <span className="rounded-full bg-accent-gold/20 px-3 py-1 text-xs font-medium text-ink">Reviewed</span>
                  )}
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${b.status === "completed" ? "bg-secondary" : b.status === "confirmed" ? "bg-brand text-primary-foreground" : "bg-accent text-accent-foreground"}`}>{b.status}</span>
                </div>
              </div>
              {openFor === b.id && (
                <div className="mt-4 border-t border-border pt-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your rating</label>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setStars(n)}
                        className={`text-2xl transition-colors ${n <= stars ? "text-accent-gold" : "text-muted-foreground/30"}`}
                        aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      >★</button>
                    ))}
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share how the lesson went (optional)…"
                    rows={3}
                    className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => submitReview(b)}
                      disabled={busy}
                      className="h-9 rounded-full bg-brand px-5 text-xs font-semibold text-primary-foreground disabled:opacity-50 hover:bg-brand/90"
                    >
                      {busy ? "Submitting…" : "Submit review"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}