import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useNavigate, Link } from "@tanstack/react-router";
import { CalendarX, MessageSquare, Loader2, Clock, AlertCircle } from "lucide-react";
import { getBackendUrl } from "@/lib/config";

const BACKEND = getBackendUrl();

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
function loadPaystackScript(): Promise<void> {
  if ((window as any).PaystackPop) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Paystack script')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack script'));
    document.body.appendChild(script);
  });
}

async function openPaystackPopup({
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
  const envKey = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY as string;
  const publicKey = (envKey && envKey !== "pk_test_placeholder") 
    ? envKey 
    : "pk_test_d923dcac32522f2aa54f4f5ceb9efd3d7f4be793";

  if (!publicKey) {
    toast.info("Paystack key not set — simulating payment success (dev mode)");
    onSuccess();
    return;
  }
  try {
    await loadPaystackScript();
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
  } catch (err: any) {
    console.error("Paystack load error:", err);
    toast.error("Could not load Paystack checkout. Please try again.");
    onClose();
  }
}

export function BookingDialog({ open, onClose, teacher }: Props) {
  const { user, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [location, setLocation] = useState("");
  const [tutorTaken, setTutorTaken] = useState<Set<string>>(new Set());
  const [studentTaken, setStudentTaken] = useState<Set<string>>(new Set());
  const [availByDow, setAvailByDow] = useState<Map<number, number[]>>(new Map());
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [step, setStep] = useState<"pick" | "pay" | "done">("pick");
  const [busy, setBusy] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  const days = useMemo(() => {
    const out: Date[] = [];
    const base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i); out.push(d);
    }
    return out;
  }, []);

  useEffect(() => {
    if (!open || !teacher) return;
    setSelectedDay(0);
    setSelectedHour(null);
    setLocation("");
    setStep("pick");
    setCreatedBookingId(null);
    setLoadingSchedule(true);

    const token = localStorage.getItem("token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    // 1. Fetch tutor availability
    const p1 = fetch(`${BACKEND}/api/teacher/${teacher.user_id}/availability`, { headers })
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

    // 2. Fetch tutor's taken slots
    const p2 = fetch(`${BACKEND}/api/teacher/${teacher.user_id}/bookings-taken`, { headers })
      .then(r => r.ok ? r.json() : { taken: [] })
      .then(d => {
        const s = new Set<string>();
        (d.taken ?? []).forEach((b: any) => {
          const dt = new Date(b.scheduled_at);
          s.add(`${ymd(dt)}-${dt.getHours()}`);
        });
        setTutorTaken(s);
      })
      .catch(() => {});

    // 3. Fetch student's own taken slots (if logged in)
    const p3 = token
      ? fetch(`${BACKEND}/api/student/bookings-taken`, { headers })
          .then(r => r.ok ? r.json() : { taken: [] })
          .then(d => {
            const s = new Set<string>();
            (d.taken ?? []).forEach((b: any) => {
              const dt = new Date(b.scheduled_at);
              s.add(`${ymd(dt)}-${dt.getHours()}`);
            });
            setStudentTaken(s);
          })
          .catch(() => {})
      : Promise.resolve();

    Promise.all([p1, p2, p3]).finally(() => {
      setLoadingSchedule(false);
    });
  }, [open, teacher]);

  if (!open || !teacher) return null;

  const now = new Date();
  const dayDate = days[selectedDay];
  const hasPublishedAvailability = availByDow.size > 0;
  const dayHours = hasPublishedAvailability ? (availByDow.get(dayDate.getDay()) ?? []) : [];

  const getSlotStatus = (hour: number): { disabled: boolean; reason?: "tutor_booked" | "student_booked" | "past" } => {
    const key = `${ymd(dayDate)}-${hour}`;
    if (selectedDay === 0 && hour <= now.getHours()) {
      return { disabled: true, reason: "past" };
    }
    if (tutorTaken.has(key)) {
      return { disabled: true, reason: "tutor_booked" };
    }
    if (studentTaken.has(key)) {
      return { disabled: true, reason: "student_booked" };
    }
    return { disabled: false };
  };

  const createBooking = async () => {
    if (!isAuthed || !user) {
      onClose();
      navigate({ to: "/auth", search: { mode: "signup", role: "student" } });
      return;
    }

    if (user.id === teacher.user_id) {
      toast.error("You cannot book a lesson with yourself.");
      return;
    }

    if (selectedHour === null) {
      toast.error("Please pick an available time slot");
      return;
    }

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
        const token = localStorage.getItem("token");
        try {
          await fetch(`${BACKEND}/api/paystack/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ reference, booking_id: createdBookingId }),
          });
        } catch { /* best effort */ }
        setStep("done");
        toast.success("Payment confirmed! Your lesson booking is active.");
        setTimeout(() => {
          onClose();
          navigate({ to: "/dashboard/student" });
        }, 2000);
      },
      onClose: () => toast.info("Payment cancelled — you can pay anytime from your dashboard."),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-2xl border border-border"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border p-5">
          <div>
            <h3 className="text-lg font-semibold text-ink">Book a session</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              with {teacher.full_name} · GH₵{(teacher.hourly_rate_cents / 100).toFixed(0)}/hr · 60 min
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary transition-colors" aria-label="Close">✕</button>
        </div>

        {/* Step: Pick time */}
        {step === "pick" && (
          <div className="p-5">
            {loadingSchedule ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                <Loader2 className="size-8 animate-spin text-brand" />
                <p className="text-xs text-muted-foreground">Loading tutor availability calendar…</p>
              </div>
            ) : !hasPublishedAvailability ? (
              /* Tutor has not set calendar availability yet */
              <div className="rounded-2xl border border-amber-200 bg-amber-500/10 p-6 text-center space-y-3">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-600">
                  <CalendarX className="size-6" />
                </div>
                <h4 className="font-semibold text-sm text-ink">Availability Schedule Not Yet Set</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {teacher.full_name} has not published their weekly calendar schedule yet. Booking is disabled until the tutor sets their available teaching hours.
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      if (isAuthed) {
                        navigate({ to: "/messages", search: { contactId: teacher.user_id } });
                      } else {
                        navigate({ to: "/auth", search: { mode: "login", role: "student" } });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-brand/90 transition-colors"
                  >
                    <MessageSquare className="size-3.5" />
                    Message {teacher.full_name.split(" ")[0]}
                  </button>
                </div>
              </div>
            ) : (
              /* Tutor has published availability */
              <>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Select Date</label>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {days.map((d, i) => {
                    const isSelected = selectedDay === i;
                    const hasSlotsOnDay = (availByDow.get(d.getDay()) ?? []).length > 0;
                    return (
                      <button
                        key={i}
                        onClick={() => { setSelectedDay(i); setSelectedHour(null); }}
                        className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-all text-center flex flex-col items-center min-w-[64px] ${
                          isSelected
                            ? "bg-brand text-primary-foreground shadow-sm"
                            : hasSlotsOnDay
                            ? "border border-border bg-surface hover:bg-secondary text-ink"
                            : "border border-border/50 bg-secondary/30 text-muted-foreground/60 opacity-60"
                        }`}
                      >
                        <span className="text-[10px] font-semibold">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                        <span className="text-xs font-bold mt-0.5">{d.getDate()}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Available Slots for {fmtDay(dayDate)}
                  </label>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" /> 60-min session
                  </span>
                </div>

                {dayHours.length === 0 ? (
                  <div className="mt-2 rounded-xl bg-secondary/40 border border-border p-5 text-center space-y-1">
                    <p className="text-xs font-semibold text-ink">No availability on this day</p>
                    <p className="text-[11px] text-muted-foreground">
                      {teacher.full_name.split(" ")[0]} has no scheduled teaching hours on {dName(dayDate.getDay())}s. Please choose another date above.
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                    {dayHours.map(h => {
                      const { disabled, reason } = getSlotStatus(h);
                      const selected = selectedHour === h;
                      const label = `${h > 12 ? h - 12 : h === 0 ? 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`;
                      return (
                        <button
                          key={h}
                          disabled={disabled}
                          onClick={() => setSelectedHour(h)}
                          title={
                            reason === "tutor_booked" ? "This tutor is already booked at this time" :
                            reason === "student_booked" ? "You already have another lesson at this time" :
                            reason === "past" ? "This time slot has already passed" : undefined
                          }
                          className={`h-11 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center p-1 ${
                            selected
                              ? "bg-brand text-primary-foreground shadow-md ring-2 ring-brand/30"
                              : disabled
                              ? "cursor-not-allowed bg-secondary/60 text-muted-foreground/50 border border-transparent line-through opacity-60"
                              : "border border-border bg-card text-ink hover:border-brand/50 hover:bg-secondary/50"
                          }`}
                        >
                          <span>{label}</span>
                          {reason === "tutor_booked" && <span className="text-[9px] no-underline font-normal text-red-500">Booked</span>}
                          {reason === "student_booked" && <span className="text-[9px] no-underline font-normal text-amber-600">Your Lesson</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-brand" /> Available
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-red-400" /> Tutor Booked
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-400" /> Your Other Lesson
                  </div>
                </div>

                <label className="mt-5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Session location (optional)</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Online Classroom, Accra, Kumasi"
                  className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </>
            )}
          </div>
        )}

        {/* Step: Pay */}
        {step === "pay" && (
          <div className="p-5 text-center">
            <div className="inline-flex size-16 items-center justify-center rounded-full bg-brand/10 text-3xl mb-4">💳</div>
            <h4 className="text-lg font-semibold text-ink">Complete your booking</h4>
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
                onClick={() => { toast.success("Booking created — you can complete payment from your dashboard."); onClose(); navigate({ to: "/dashboard/student" }); }}
                className="w-full h-11 rounded-full border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Pay Later from Dashboard
              </button>
            </div>
            <p className="mt-4 text-center text-[10px] text-muted-foreground leading-relaxed">
              🛡️ Protected by <Link to="/terms" onClick={onClose} className="text-brand font-semibold hover:underline">QuickTutor Escrow</Link>. Funds are held safely until your lesson is completed.
            </p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="p-5 text-center">
            <div className="inline-flex size-16 items-center justify-center rounded-full bg-green-100 text-3xl mb-4">✅</div>
            <h4 className="text-lg font-semibold text-ink">You're booked!</h4>
            <p className="mt-2 text-sm text-muted-foreground">Redirecting to your student dashboard…</p>
          </div>
        )}

        {/* Footer actions */}
        {step === "pick" && (
          <div className="flex items-center justify-between border-t border-border bg-secondary/20 p-4">
            <button onClick={onClose} className="h-10 rounded-full px-4 text-xs font-medium hover:bg-secondary transition-colors">Cancel</button>
            {hasPublishedAvailability && (
              <button
                onClick={createBooking}
                disabled={busy || selectedHour === null || loadingSchedule}
                className="h-10 rounded-full bg-brand px-6 text-xs font-semibold text-primary-foreground transition-opacity hover:bg-brand/90 disabled:opacity-50"
              >
                {busy ? "Booking…" : "Confirm Booking"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function dName(dow: number) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dow] ?? "Day";
}