import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

type Props = {
  open: boolean;
  onClose: () => void;
  teacher: {
    user_id: string;
    full_name: string;
    hourly_rate_cents: number;
  } | null;
};

function fmtDay(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function ymd(d: Date) {
  return d.toISOString().split("T")[0];
}

export function BookingDialog({ open, onClose, teacher }: Props) {
  const { user, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [location, setLocation] = useState("");
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [availByDow, setAvailByDow] = useState<Map<number, number[]>>(new Map());
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => {
    const out: Date[] = [];
    const base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i); out.push(d);
    }
    return out;
  }, []);

  useEffect(() => {
    if (!open || !teacher) return;
    setSelectedDay(0); setSelectedHour(null); setLocation("");
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setDate(from.getDate() + 7);
    supabase.from("bookings")
      .select("scheduled_at, status")
      .eq("teacher_id", teacher.user_id)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", from.toISOString())
      .lt("scheduled_at", to.toISOString())
      .then(({ data }) => {
        const s = new Set<string>();
        (data ?? []).forEach((b) => {
          const d = new Date(b.scheduled_at);
          s.add(`${ymd(d)}-${d.getHours()}`);
        });
        setTaken(s);
      });

    supabase.from("teacher_availability")
      .select("day_of_week, start_hour, end_hour")
      .eq("teacher_id", teacher.user_id)
      .then(({ data }) => {
        const m = new Map<number, number[]>();
        (data ?? []).forEach((r) => {
          const hrs = m.get(r.day_of_week) ?? [];
          for (let h = r.start_hour; h < r.end_hour; h++) if (!hrs.includes(h)) hrs.push(h);
          hrs.sort((a, b) => a - b);
          m.set(r.day_of_week, hrs);
        });
        setAvailByDow(m);
      });
  }, [open, teacher]);

  if (!open || !teacher) return null;

  const now = new Date();
  const dayDate = days[selectedDay];
  const dayHours = availByDow.get(dayDate.getDay()) ?? [];

  const isSlotDisabled = (hour: number) => {
    if (taken.has(`${ymd(dayDate)}-${hour}`)) return true;
    if (selectedDay === 0 && hour <= now.getHours()) return true;
    return false;
  };

  const confirm = async () => {
    if (!isAuthed || !user) {
      onClose();
      navigate({ to: "/auth", search: { mode: "signup", role: "student" } });
      return;
    }
    if (selectedHour === null) { toast.error("Pick a time slot"); return; }
    setBusy(true);
    const scheduledAt = new Date(dayDate);
    scheduledAt.setHours(selectedHour, 0, 0, 0);
    const { error } = await supabase.from("bookings").insert({
      student_id: user.id,
      teacher_id: teacher.user_id,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: 60,
      price_cents: teacher.hourly_rate_cents,
      status: "pending",
      location: location.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Booking created — pay from your dashboard");
    onClose();
    navigate({ to: "/dashboard/student" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border p-5">
          <div>
            <h3 className="text-lg font-semibold">Book a session</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              with {teacher.full_name} · GH₵{(teacher.hourly_rate_cents / 100).toFixed(0)}/hr · 60 min
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-secondary" aria-label="Close">✕</button>
        </div>

        <div className="p-5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</label>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
            {days.map((d, i) => (
              <button
                key={i}
                onClick={() => { setSelectedDay(i); setSelectedHour(null); }}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${selectedDay === i ? "bg-ink text-primary-foreground" : "border border-border bg-surface hover:bg-secondary"}`}
              >
                {fmtDay(d)}
              </button>
            ))}
          </div>

          <label className="mt-5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Time slot</label>
          {dayHours.length === 0 ? (
            <p className="mt-2 rounded-lg bg-secondary/50 p-4 text-center text-xs text-muted-foreground">
              This tutor hasn't set availability for this day.
            </p>
          ) : (
          <div className="mt-2 grid grid-cols-4 gap-2">
            {dayHours.map((h) => {
              const disabled = isSlotDisabled(h);
              const selected = selectedHour === h;
              const label = `${h > 12 ? h - 12 : h}:00${h >= 12 ? "pm" : "am"}`;
              return (
                <button
                  key={h}
                  disabled={disabled}
                  onClick={() => setSelectedHour(h)}
                  className={`h-10 rounded-lg text-xs font-medium transition-colors ${
                    selected
                      ? "bg-brand text-primary-foreground"
                      : disabled
                      ? "cursor-not-allowed bg-secondary/50 text-muted-foreground line-through opacity-50"
                      : "border border-border bg-surface hover:bg-secondary"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">Greyed-out slots are already booked.</p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 p-4">
          <button onClick={onClose} className="h-10 rounded-full px-4 text-xs font-medium hover:bg-secondary">Cancel</button>
          <button
            onClick={confirm}
            disabled={busy || selectedHour === null}
            className="h-10 rounded-full bg-ink px-6 text-xs font-semibold text-primary-foreground transition-opacity hover:bg-ink/90 disabled:opacity-50"
          >
            {busy ? "Booking…" : "Confirm booking"}
          </button>
        </div>
      </div>
    </div>
  );
}