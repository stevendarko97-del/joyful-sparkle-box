import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

const BACKEND = (import.meta as any).env.VITE_BACKEND_URL || "http://localhost:4000";

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

/* ── Paystack inline popup helper ── */
function openPaystackPopup({
  email,
  amountCents,
  reference,
  onSuccess,
  onClose,
}: {
  email: string;
  amountCents: number;
  reference: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const publicKey = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY as string;
  if (!publicKey || publicKey === "pk_test_placeholder") {
    // Dev mode — skip payment and mark success
    toast.info("Paystack key not set — simulating payment success (dev mode)");
    onSuccess();
    return;
  }
  const handler = (window as any).PaystackPop?.setup({
    key: publicKey,
    email,
    amount: amountCents,
    currency: "GHS",
    ref: reference,
    callback: () => { onSuccess(); },
    onClose,
  });
  handler?.openIframe();
}

export function BookingDialog({ open, onClose, teacher }: Props) {
  const { user, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [location, setLocation] = useState("");
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [availByDow, setAvailByDow] = useState<Map<number, number[]>>(new Map());
  const [step, setStep] = useState<"pick" | "pay" | "done">("pick");
  const [busy, setBusy] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

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
    setSelectedDay(0); setSelectedHour(null); setLocation(""); setStep("pick"); setCreatedBookingId(null);
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    // Load existing bookings for taken slots
    fetch(`${BACKEND}/api/teacher/${teacher.user_id}/bookings-taken`, { headers })
      .then(r => r.ok ? r.json() : { taken: [] })
      .then(d => {
        const s = new Set<string>();
        (d.taken ?? []).forEach((b: any) => {
          const dt = new Date(b.scheduled_at);
          s.add(`${ymd(dt)}-${dt.getHours()}`);
        });
        setTaken(s);
      })
      .catch(() => {});

    // Load availability
    fetch(`${BACKEND}/api/teacher/${teacher.user_id}/availability`, { headers })
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => {
        const m = new Map<number, number[]>();
        (d.data ?? []).forEach((r: any) => {
          const hrs = m.get(r.day_of_week) ?? [];
          for (let h = r.start_hour; h < r.end_hour; h++) if (!hrs.includes(h)) hrs.push(h);
          hrs.sort((a, b) => a - b);
          m.set(r.day_of_week, hrs);
        });
        setAvailByDow(m);
      })
      .catch(() => {});
  }, [open, teacher]);

  if (!open || !teacher) return null;

  const now = new Date();
  const dayDate = days[selectedDay];
  const hasAnyAvailability = availByDow.size > 0;
  const DEFAULT_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const dayHours = hasAnyAvailability ? (availByDow.get(dayDate.getDay()) ?? []) : DEFAULT_HOURS;

  const isSlotDisabled = (hour: number) => {
    if (taken.has(`${ymd(dayDate)}-${hour}`)) return true;
    if (selectedDay === 0 && hour <= now.getHours()) return true;
    return false;
  };

  const createBooking = async () => {
    if (!isAuthed || !user) {
      onClose();
      navigate({ to: "/auth", search: { mode: "signup", role: "student" } });
      return;
    }
    if (selectedHour === null) { toast.error("Pick a time slot"); return; }
    setBusy(true);
    try {
      const scheduledAt = new Date(dayDate);
      scheduledAt.setHours(selectedHour, 0, 0, 0);
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND}/api/student/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          teacher_id: teacher.user_id,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: 60,
          price_cents: teacher.hourly_rate_cents,
          location: location || "Online",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Booking failed");
      setCreatedBookingId(data.booking_id ?? null);
      setStep("pay");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePayment = () => {
    if (!user) return;
    const reference = `qt-${createdBookingId ?? Date.now()}-${Math.random().toString(36).slice(2)}`;
    openPaystackPopup({
      email: user.email,
      amountCents: teacher.hourly_rate_cents,
      reference,
      onSuccess: async () => {
        // Verify payment on backend
        const token = localStorage.getItem("token");
        try {
          await fetch(`${BACKEND}/api/paystack/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ reference, booking_id: createdBookingId }),
          });
        } catch { /* best effort */ }
        setStep("done");
        toast.success("Payment confirmed! Your booking is confirmed.");
        setTimeout(() => {
          onClose();
          navigate({ to: "/dashboard/student" });
        }, 2000);
      },
      onClose: () => toast.info("Payment cancelled — you can pay from your dashboard."),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border p-5">
          <div>
            <h3 className="text-lg font-semibold">Book a session</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              with {teacher.full_name} · GH₵{(teacher.hourly_rate_cents / 100).toFixed(0)}/hr · 60 min
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-secondary" aria-label="Close">✕</button>
        </div>

        {/* Step: Pick time */}
        {step === "pick" && (
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
                {dayHours.map(h => {
                  const disabled = isSlotDisabled(h);
                  const selected = selectedHour === h;
                  const label = `${h > 12 ? h - 12 : h}:00${h >= 12 ? "pm" : "am"}`;
                  return (
                    <button
                      key={h}
                      disabled={disabled}
                      onClick={() => setSelectedHour(h)}
                      className={`h-10 rounded-lg text-xs font-medium transition-colors ${
                        selected ? "bg-brand text-primary-foreground"
                        : disabled ? "cursor-not-allowed bg-secondary/50 text-muted-foreground line-through opacity-50"
                        : "border border-border bg-surface hover:bg-secondary"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Greyed-out slots are already booked.
              {!hasAnyAvailability && " This tutor hasn't published a calendar yet — pick a time and they'll confirm."}
            </p>

            <label className="mt-5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Session location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              maxLength={100}
              placeholder="e.g. Accra, Online, Kumasi"
              className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        )}

        {/* Step: Pay */}
        {step === "pay" && (
          <div className="p-5 text-center">
            <div className="inline-flex size-16 items-center justify-center rounded-full bg-brand/10 text-3xl mb-4">💳</div>
            <h4 className="text-lg font-semibold">Complete your booking</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Pay GH₵{(teacher.hourly_rate_cents / 100).toFixed(2)} to confirm your session with {teacher.full_name}.
              You can also pay later from your dashboard.
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={handlePayment}
                className="w-full h-11 rounded-full bg-brand text-sm font-semibold text-primary-foreground hover:bg-brand/90 transition-colors"
              >
                Pay Now with MoMo / Card
              </button>
              <button
                onClick={() => { toast.success("Booking created — pay from your dashboard."); onClose(); navigate({ to: "/dashboard/student" }); }}
                className="w-full h-11 rounded-full border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Pay Later from Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="p-5 text-center">
            <div className="inline-flex size-16 items-center justify-center rounded-full bg-green-100 text-3xl mb-4">✅</div>
            <h4 className="text-lg font-semibold">You're booked!</h4>
            <p className="mt-2 text-sm text-muted-foreground">Redirecting to your dashboard…</p>
          </div>
        )}

        {/* Footer actions */}
        {step === "pick" && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 p-4">
            <button onClick={onClose} className="h-10 rounded-full px-4 text-xs font-medium hover:bg-secondary">Cancel</button>
            <button
              onClick={createBooking}
              disabled={busy || selectedHour === null}
              className="h-10 rounded-full bg-ink px-6 text-xs font-semibold text-primary-foreground transition-opacity hover:bg-ink/90 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Confirm booking"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}