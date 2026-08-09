import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Clock,
  Calendar,
  User,
  Star,
  DollarSign,
  Settings,
  Bell,
  CheckCircle,
  XCircle,
  Video,
  LogOut,
  Sliders,
  ExternalLink,
  MessageSquare,
  ChevronRight,
  Sparkles,
  GraduationCap,
  Award,
  BookOpen
} from "lucide-react";

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
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Availability = { id?: string; day_of_week: number; start_hour: number; end_hour: number };

const BACKEND = (import.meta as any).env.VITE_BACKEND_URL || "http://localhost:4000";

function formatDateTime(v: string) {
  return new Date(v).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function TeacherDashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"overview" | "calendar" | "availability" | "profile" | "reviews" | "earnings">("overview");
  const [dashData, setDashData] = useState<any>(null);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [rate, setRate] = useState(40);
  const [years, setYears] = useState(0);
  const [primarySubject, setPrimarySubject] = useState("");
  const [location, setLocation] = useState("");
  const [examTypes, setExamTypes] = useState<Set<ExamType>>(new Set());
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [topics, setTopics] = useState<{ id: string; name: string; subject_id: string }[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [specialties, setSpecialties] = useState<Set<string>>(new Set());
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [saving, setSaving] = useState(false);
  const [bookingFilter, setBookingFilter] = useState<"all" | "pending" | "confirmed" | "completed" | "cancelled">("all");
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const loadDashboard = async () => {
    setLoadingData(true);
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND}/api/teacher/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setDashData(data);
      setSubjects(data.subjects ?? []);
      setTopics(data.topics ?? []);
      if (data.teacherProfile) {
        setHeadline(data.teacherProfile.video_url ?? "");
        setLocation(data.teacherProfile.background ?? "");
        setRate(Math.round((data.teacherProfile.hourly_rate_cents ?? 4000) / 100));
        setYears(data.teacherProfile.years_experience ?? 0);
      }
      if (data.bio) setBio(data.bio);
      const tp = new Set<string>();
      const sp = new Set<string>();
      (data.teacherTopics ?? []).forEach((r: any) => {
        tp.add(r.topic_id);
        if (r.is_specialty) sp.add(r.topic_id);
      });
      setSelectedTopics(tp);
      setSpecialties(sp);
      setAvailability(data.availability ?? []);
    } catch {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) loadDashboard();
  }, [user]);

  const toggleExam = (e: ExamType) => setExamTypes(prev => {
    const n = new Set(prev); n.has(e) ? n.delete(e) : n.add(e); return n;
  });
  const toggleTopic = (id: string) => setSelectedTopics(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleSpecialty = (id: string) => setSpecialties(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const saveProfile = async () => {
    setSaving(true);
    const token = localStorage.getItem("token");
    const res = await fetch(`${BACKEND}/api/teacher/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        headline,
        bio,
        rate,
        years,
        primarySubject,
        location,
        examTypes: [...examTypes],
        selectedTopics: [...selectedTopics],
        specialties: [...specialties]
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Profile updated successfully!");
      loadDashboard();
    } else {
      toast.error("Failed to update profile");
    }
  };

  const saveAvailability = async () => {
    setSaving(true);
    const token = localStorage.getItem("token");
    const res = await fetch(`${BACKEND}/api/teacher/availability`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ availability }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Availability schedule saved!");
      loadDashboard();
    } else {
      toast.error("Failed to save availability");
    }
  };

  const addSlot = () => setAvailability(a => [...a, { day_of_week: 1, start_hour: 9, end_hour: 17 }]);
  const removeSlot = (i: number) => setAvailability(a => a.filter((_, idx) => idx !== i));
  const updateSlot = (i: number, field: keyof Availability, value: number) =>
    setAvailability(a => a.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const updateBookingStatus = async (bookingId: string, status: string) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${BACKEND}/api/teacher/bookings/${bookingId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`Booking marked as ${status}`);
      loadDashboard();
    } else {
      toast.error("Failed to update booking status");
    }
  };

  const bookings = dashData?.bookings ?? [];
  const filteredBookings = bookingFilter === "all" ? bookings : bookings.filter((b: any) => b.status === bookingFilter);
  const reviews = dashData?.reviews ?? [];
  const notifications = dashData?.notifications ?? [];
  const avgRating = reviews.length > 0 ? (reviews.reduce((s: number, r: any) => s + r.stars, 0) / reviews.length) : null;
  const totalEarningsCents = bookings
    .filter((b: any) => b.status === "completed" || b.status === "confirmed")
    .reduce((sum: number, b: any) => sum + (b.price_cents ?? 4000), 0);

  const upcomingBooking = bookings.find((b: any) => b.status === "confirmed" && new Date(b.scheduled_at) > new Date());

  const NAV_ITEMS = [
    { key: "overview", label: "Overview", icon: Clock },
    { key: "calendar", label: "My Calendar & Bookings", icon: Calendar, badge: bookings.filter((b: any) => b.status === "pending").length || undefined },
    { key: "availability", label: "Set Availability", icon: Sliders },
    { key: "profile", label: "Profile & Subjects", icon: User },
    { key: "reviews", label: "Student Reviews", icon: Star, badge: reviews.length || undefined },
    { key: "earnings", label: "Earnings & Payouts", icon: DollarSign },
  ] as const;

  return (
    <div className="min-h-screen bg-surface flex">
      {/* ── Left Sidebar Navigation (Mimicking EduBook reference) ── */}
      <aside className="w-64 bg-card border-r border-border flex flex-col fixed inset-y-0 left-0 z-30">
        {/* Brand Header */}
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-primary-foreground shadow-sm">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <Link to="/" className="font-bold text-base text-ink tracking-tight hover:text-brand transition-colors">
              Quick Tutor
            </Link>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">Teacher Portal</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-brand text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-ink"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? "bg-white text-brand" : "bg-brand/10 text-brand"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="my-4 border-t border-border" />

          {/* Quick Links */}
          <Link
            to="/messages"
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-ink transition-all"
          >
            <MessageSquare className="size-4 text-muted-foreground" />
            <span>Messages</span>
          </Link>

          {user?.id && (
            <Link
              to="/teacher/$id"
              params={{ id: user.id }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-ink transition-all"
            >
              <ExternalLink className="size-4 text-muted-foreground" />
              <span>View Public Profile</span>
            </Link>
          )}
        </nav>

        {/* Footer / Sign out */}
        <div className="p-4 border-t border-border">
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            <LogOut className="size-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 ml-64 min-h-screen p-8 max-w-6xl">
        {/* Header bar */}
        <header className="flex items-center justify-between mb-8 pb-4 border-b border-border/80">
          <div>
            <h1 className="font-serif text-3xl font-bold text-ink">
              {tab === "overview" && "Dashboard Overview"}
              {tab === "calendar" && "My Calendar & Sessions"}
              {tab === "availability" && "Weekly Availability Schedule"}
              {tab === "profile" && "Teacher Profile & Specialties"}
              {tab === "reviews" && "Student Ratings & Reviews"}
              {tab === "earnings" && "Earnings & Mobile Money"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Welcome back, {user?.email?.split("@")[0] ?? "Teacher"}. Here is what’s happening with your students today.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {user?.id && (
              <Link
                to="/teacher/$id"
                params={{ id: user.id }}
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary text-ink transition-colors"
              >
                <ExternalLink className="size-3.5 text-brand" />
                Live Page
              </Link>
            )}
            <div className="size-9 rounded-full bg-brand-soft text-brand border border-brand/20 flex items-center justify-center font-bold text-xs">
              {user?.email?.[0]?.toUpperCase() ?? "T"}
            </div>
          </div>
        </header>

        {/* ── Stat Cards Grid ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[
            { label: "Total Bookings", value: bookings.length, icon: Calendar, color: "text-brand" },
            { label: "Confirmed Sessions", value: bookings.filter((b: any) => b.status === "confirmed").length, icon: CheckCircle, color: "text-green-600" },
            { label: "Avg. Rating", value: avgRating ? `${avgRating.toFixed(1)} ★` : "New (5.0 ★)", icon: Star, color: "text-amber-500" },
            { label: "Gross Revenue", value: `GH₵${(totalEarningsCents / 100).toFixed(0)}`, icon: DollarSign, color: "text-blue-600" },
          ].map((s, idx) => {
            const Icon = s.icon;
            return (
              <div key={idx} className="rounded-2xl bg-card p-5 border border-border/80 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
                  <Icon className={`size-4 ${s.color}`} />
                </div>
                <p className="mt-2 font-serif text-3xl font-bold text-ink">{s.value}</p>
              </div>
            );
          })}
        </div>

        {/* ── TAB 1: OVERVIEW ── */}
        {tab === "overview" && (
          <div className="space-y-8 fade-in">
            {/* Next session hero */}
            {upcomingBooking ? (
              <div className="rounded-3xl bg-brand p-8 text-primary-foreground shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 -mt-16 -mr-16 size-64 rounded-full bg-white/10 blur-3xl transition-transform duration-700 group-hover:scale-150" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
                      Next Confirmed Lesson
                    </span>
                    <h3 className="font-serif text-4xl mt-3">{upcomingBooking.profiles?.full_name ?? "Student"}</h3>
                    <p className="text-sm opacity-90 mt-1 flex items-center gap-1.5"><Clock className="size-4" /> {formatDateTime(upcomingBooking.scheduled_at)}</p>
                  </div>
                  <Link
                    to="/room/$id"
                    params={{ id: upcomingBooking.id }}
                    className="inline-flex items-center justify-center gap-2 h-11 px-8 rounded-full bg-white text-brand font-bold text-sm shadow-md hover:bg-white/90 transition-all hover:scale-105"
                  >
                    <Video className="size-4" />
                    Enter Classroom Room
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">No upcoming confirmed sessions right now.</p>
                <button onClick={() => setTab("availability")} className="mt-3 text-xs font-semibold text-brand hover:underline">
                  Update your weekly availability to attract more students →
                </button>
              </div>
            )}

            {/* Pending Requests & Recent Bookings */}
            <div className="rounded-2xl bg-card border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-xl font-bold text-ink">Recent Student Bookings</h3>
                <button onClick={() => setTab("calendar")} className="text-xs font-semibold text-brand hover:underline">
                  View All ({bookings.length})
                </button>
              </div>

              {bookings.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No bookings recorded yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {bookings.slice(0, 5).map((b: any) => (
                    <div key={b.id} className="py-4 flex flex-wrap items-center justify-between gap-3 group hover:bg-secondary/20 -mx-4 px-4 rounded-xl transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-ink">{b.profiles?.full_name ?? "Student"}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(b.scheduled_at)} · GH₵{(b.price_cents / 100).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          b.status === "confirmed" ? "bg-green-100 text-green-700" :
                          b.status === "pending" ? "bg-amber-100 text-amber-700" :
                          b.status === "completed" ? "bg-blue-100 text-blue-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {b.status}
                        </span>

                        {b.status === "pending" && (
                          <button
                            onClick={() => updateBookingStatus(b.id, "confirmed")}
                            className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors"
                          >
                            Accept
                          </button>
                        )}
                        {b.status === "confirmed" && (
                          <Link
                            to="/room/$id"
                            params={{ id: b.id }}
                            className="px-3 py-1 bg-brand text-primary-foreground rounded-lg text-xs font-semibold hover:bg-brand/90 transition-colors"
                          >
                            Join Room
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: CALENDAR & BOOKINGS ── */}
        {tab === "calendar" && (
          <div className="space-y-6 fade-in">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "pending", "confirmed", "completed", "cancelled"] as const).map(k => (
                <button
                  key={k}
                  onClick={() => setBookingFilter(k)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                    bookingFilter === k
                      ? "bg-ink text-primary-foreground shadow-sm"
                      : "bg-card border border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {k} {k === "all" ? `(${bookings.length})` : `(${bookings.filter((b: any) => b.status === k).length})`}
                </button>
              ))}
            </div>

            {/* Bookings List */}
            <div className="rounded-2xl bg-card border border-border p-6 shadow-sm">
              {filteredBookings.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No bookings found for this filter.</p>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map((b: any) => (
                    <div key={b.id} className="p-5 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-4 hover:shadow-md hover:border-brand/30 transition-all duration-300">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-bold text-ink">{b.profiles?.full_name ?? "Student"}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            b.status === "confirmed" ? "bg-green-100 text-green-700" :
                            b.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                            b.status === "completed" ? "bg-blue-100 text-blue-700" :
                            "bg-red-100 text-red-700"
                          }`}>{b.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          ⏰ {formatDateTime(b.scheduled_at)} · Fee: <strong className="text-ink">GH₵{(b.price_cents / 100).toFixed(2)}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {b.status === "pending" && (
                          <>
                            <button
                              onClick={() => updateBookingStatus(b.id, "confirmed")}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700"
                            >
                              Confirm Booking
                            </button>
                            <button
                              onClick={() => updateBookingStatus(b.id, "cancelled")}
                              className="px-3 py-2 bg-card border border-border text-destructive rounded-lg text-xs font-semibold hover:bg-destructive/10"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {b.status === "confirmed" && (
                          <>
                            <Link
                              to="/room/$id"
                              params={{ id: b.id }}
                              className="px-4 py-2 bg-brand text-primary-foreground rounded-lg text-xs font-semibold hover:bg-brand/90"
                            >
                              Enter Lesson Room
                            </Link>
                            <button
                              onClick={() => updateBookingStatus(b.id, "completed")}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                            >
                              Mark Completed
                            </button>
                            <button
                              onClick={() => updateBookingStatus(b.id, "cancelled")}
                              className="px-3 py-2 border border-border text-xs text-destructive rounded-lg hover:bg-destructive/10"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: AVAILABILITY ── */}
        {tab === "availability" && (
          <div className="rounded-2xl bg-card border border-border p-6 shadow-sm fade-in space-y-6">
            <div>
              <h3 className="font-serif text-xl font-bold text-ink">Weekly Teaching Hours</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Students will be able to book 60-minute slots during your defined available time windows.
              </p>
            </div>

            <div className="space-y-3">
              {availability.map((s, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl bg-secondary/40 border border-border">
                  <select
                    value={s.day_of_week}
                    onChange={e => updateSlot(idx, "day_of_week", Number(e.target.value))}
                    className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    {DAYS.map((d, di) => (
                      <option key={d} value={di}>{d}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>From</span>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={s.start_hour}
                      onChange={e => updateSlot(idx, "start_hour", Number(e.target.value))}
                      className="h-9 w-16 rounded-lg border border-input bg-card px-2 text-center text-xs font-semibold"
                    />
                    <span>:00 to</span>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={s.end_hour}
                      onChange={e => updateSlot(idx, "end_hour", Number(e.target.value))}
                      className="h-9 w-16 rounded-lg border border-input bg-card px-2 text-center text-xs font-semibold"
                    />
                    <span>:00 (GMT)</span>
                  </div>

                  <button
                    onClick={() => removeSlot(idx)}
                    className="ml-auto text-xs text-destructive hover:underline font-semibold"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
              <button
                onClick={addSlot}
                className="h-10 px-4 rounded-xl border border-border bg-card text-xs font-semibold text-ink hover:bg-secondary transition-colors"
              >
                + Add Time Slot
              </button>
              <button
                onClick={saveAvailability}
                disabled={saving}
                className="h-10 px-6 rounded-xl bg-brand text-primary-foreground text-xs font-semibold shadow-sm hover:bg-brand/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save Availability Schedule"}
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 4: PROFILE & SUBJECTS ── */}
        {tab === "profile" && (
          <div className="rounded-2xl bg-card border border-border p-6 shadow-sm fade-in space-y-6">
            <h3 className="font-serif text-xl font-bold text-ink">Teaching Profile Details</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Headline</label>
                <input
                  type="text"
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  placeholder="e.g. 10+ yrs teaching WASSCE Elective Maths & Physics"
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3 text-xs focus:ring-1 focus:ring-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hourly Rate (GH₵)</label>
                <input
                  type="number"
                  value={rate}
                  onChange={e => setRate(Number(e.target.value))}
                  placeholder="40"
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3 text-xs focus:ring-1 focus:ring-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Years of Experience</label>
                <input
                  type="number"
                  value={years}
                  onChange={e => setYears(Number(e.target.value))}
                  placeholder="5"
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3 text-xs focus:ring-1 focus:ring-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location / Region</label>
                <select
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3 text-xs focus:ring-1 focus:ring-brand focus:outline-none"
                >
                  <option value="">Select Region</option>
                  {GH_REGIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">About / Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={4}
                placeholder="Describe your teaching style, past WAEC student results, and how you conduct lessons..."
                className="mt-1 w-full rounded-lg border border-input bg-card p-3 text-xs focus:ring-1 focus:ring-brand focus:outline-none"
              />
            </div>

            {/* Exam tracks */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Exam Tracks Tutored</label>
              <div className="flex flex-wrap gap-2">
                {EXAM_OPTIONS.map(opt => {
                  const isSel = examTypes.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleExam(opt.value)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        isSel
                          ? "bg-brand text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {isSel ? "✓ " : ""}{opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="h-10 px-6 rounded-xl bg-brand text-primary-foreground text-xs font-semibold shadow-sm hover:bg-brand/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save Profile Details"}
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 5: REVIEWS ── */}
        {tab === "reviews" && (
          <div className="rounded-2xl bg-card border border-border p-6 shadow-sm fade-in space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl font-bold text-ink">Student Reviews</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verified reviews left by students after completing live lessons with you.
                </p>
              </div>
              {avgRating && (
                <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                  <span className="font-serif text-2xl font-bold text-amber-700">{avgRating.toFixed(1)}</span>
                  <div className="text-amber-500 text-sm font-bold">{"★".repeat(Math.round(avgRating))}</div>
                </div>
              )}
            </div>

            {reviews.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No reviews yet. Complete your first session to receive reviews!</p>
            ) : (
              <div className="divide-y divide-border">
                {reviews.map((r: any, idx: number) => (
                  <div key={idx} className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="text-amber-500 text-sm">{"★".repeat(r.stars)}</div>
                      <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    {r.comment && <p className="mt-2 text-xs text-ink italic">"{r.comment}"</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 6: EARNINGS ── */}
        {tab === "earnings" && (
          <div className="rounded-2xl bg-card border border-border p-6 shadow-sm fade-in space-y-6">
            <div>
              <h3 className="font-serif text-xl font-bold text-ink">Earnings &amp; Payout Overview</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                We remit payments directly to your Mobile Money (MTN MoMo, Telecel Cash, AirtelTigo) or bank account.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gross Booking Volume</p>
                <p className="mt-2 font-serif text-2xl font-bold text-ink">GH₵{(totalEarningsCents / 100).toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Platform Commission (15%)</p>
                <p className="mt-2 font-serif text-2xl font-bold text-muted-foreground">GH₵{((totalEarningsCents * 0.15) / 100).toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-green-800">Your Net Payout (85%)</p>
                <p className="mt-2 font-serif text-2xl font-bold text-green-700">GH₵{((totalEarningsCents * 0.85) / 100).toFixed(2)}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-brand-soft border border-brand/20">
              <h4 className="font-bold text-xs text-brand uppercase tracking-wider">Mobile Money Payout Setup</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Payouts are settled automatically after each completed lesson. Ensure your profile phone number matches your active MoMo wallet.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
