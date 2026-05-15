import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/dashboard/student")({ component: StudentDashboard });

type Booking = {
  id: string; scheduled_at: string; status: string; price_cents: number; room_id: string;
  profiles: { full_name: string } | null;
};

function StudentDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("bookings")
      .select("id, scheduled_at, status, price_cents, room_id, profiles:profiles!bookings_teacher_id_fkey(full_name)")
      .eq("student_id", user.id)
      .order("scheduled_at", { ascending: false })
      .then(({ data }) => setBookings((data ?? []) as unknown as Booking[]));
  }, [user]);

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="font-serif text-4xl">My lessons</h1>
        <Link to="/teachers" className="mt-2 inline-block text-sm text-brand hover:underline">+ Book a new lesson</Link>
        <div className="mt-8 space-y-3">
          {bookings.length === 0 && <p className="rounded-2xl bg-card p-12 text-center text-muted-foreground ring-1 ring-black/5">No bookings yet.</p>}
          {bookings.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-2xl bg-card p-5 ring-1 ring-black/5">
              <div>
                <p className="font-medium">{b.profiles?.full_name}</p>
                <p className="text-xs text-muted-foreground">{new Date(b.scheduled_at).toLocaleString()} • ${(b.price_cents / 100).toFixed(0)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${b.status === "completed" ? "bg-secondary" : b.status === "confirmed" ? "bg-brand text-primary-foreground" : "bg-accent text-accent-foreground"}`}>{b.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}