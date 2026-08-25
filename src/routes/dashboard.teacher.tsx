import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Clock,
  Calendar,
  User,
  Star,
  Banknote,
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
  BookOpen,
  AlertCircle,
  CreditCard,
  CheckCheck,
  X,
  CalendarCheck,
  Menu,
} from "lucide-react";
import { ReportDialog } from "@/components/report-dialog";

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

import { getBackendUrl } from "@/lib/config";

const BACKEND = getBackendUrl();

function formatDateTime(v: string) {
  return new Date(v).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function TeacherDashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"overview" | "calendar" | "availability" | "profile" | "reviews" | "earnings" | "support">("overview");
  const [dashData, setDashData] = useState<any>(null);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
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
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [reportModal, setReportModal] = useState<{ open: boolean; bookingId: string | null; label: string | null }>({
    open: false,
    bookingId: null,
    label: null,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const loadNotifications = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch (e) {}
  };

  const loadMyTickets = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND}/api/support/my-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyTickets(data.tickets ?? []);
      }
    } catch (e) {}
  };

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
      if (data.phone) setPhone(data.phone);
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
    if (user) {
      loadDashboard();
      loadMyTickets();
      loadNotifications();
      const interval = setInterval(() => {
        loadNotifications();
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const markAllRead = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    await fetch(`${BACKEND}/api/notifications/read-all`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` }
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleNotificationClick = async (n: any) => {
    const token = localStorage.getItem("token");
    if (token && !n.is_read) {
      await fetch(`${BACKEND}/api/notifications/${n.id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
    }
    setNotifOpen(false);
    if (n.link) {
      if (n.link === "/dashboard/teacher") setTab("earnings");
      else navigate({ to: n.link as any });
    }
  };

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
        phone,
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
    for (const slot of availability) {
      if (slot.start_hour >= slot.end_hour) {
        toast.error(`Invalid time range on ${DAYS[slot.day_of_week] || 'selected day'}: start hour must be earlier than end hour.`);
        return;
      }
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND}/api/teacher/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ availability }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Availability schedule saved!");
        loadDashboard();
      } else {
        toast.error(data.error || "Failed to save availability");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error saving availability");
    } finally {
      setSaving(false);
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
  const avgRating = reviews.length > 0 ? (reviews.reduce((s: number, r: any) => s + r.stars, 0) / reviews.length) : null;
  const totalEarningsCents = bookings
    .filter((b: any) => b.status === "completed")
    .reduce((sum: number, b: any) => sum + (b.price_cents ?? 4000), 0);
  const pendingPayoutCents = bookings
    .filter((b: any) => b.status === "completed" && !b.paid_out)
    .reduce((sum: number, b: any) => sum + (b.price_cents ?? 4000), 0);

  const upcomingBooking = bookings.find((b: any) => b.status === "confirmed" && new Date(b.scheduled_at) > new Date());

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const NAV_ITEMS = [
    { key: "overview", label: "Overview", icon: Clock },
    { key: "calendar", label: "My Calendar & Bookings", icon: Calendar, badge: bookings.filter((b: any) => b.status === "pending").length || undefined },
    { key: "availability", label: "Set Availability", icon: Sliders },
    { key: "profile", label: "Profile & Subjects", icon: User },
    { key: "earnings", label: "Earnings & Payouts", icon: Banknote },
    { key: "support", label: "Help & Support Tickets", icon: AlertCircle, badge: myTickets.filter((t: any) => t.status !== 'resolved').length || undefined },
  ] as const;

  return (
    <div className="min-h-screen bg-surface flex">
      {/* ── Left Sidebar Navigation (Desktop) ── */}
      <aside className="hidden lg:flex w-64 bg-card border-r border-border flex-col fixed inset-y-0 left-0 z-30">
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
                {'badge' in item && item.badge !== undefined && (
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

          <button
            onClick={() => setReportModal({ open: true, bookingId: null, label: null })}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all text-left"
          >
            <AlertCircle className="size-4 text-muted-foreground group-hover:text-destructive" />
            <span>Help & Support</span>
          </button>

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

      {/* ── Mobile Drawer Navigation (Slide-in) ── */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-card border-r border-border flex flex-col z-50 shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Mobile Drawer Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-primary-foreground shadow-sm">
                  <GraduationCap className="size-5" />
                </div>
                <div>
                  <Link to="/" className="font-bold text-base text-ink tracking-tight">Quick Tutor</Link>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">Teacher Portal</p>
                </div>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Mobile Nav Tabs */}
            <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = tab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setTab(item.key);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-brand text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-secondary hover:text-ink"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    {'badge' in item && item.badge !== undefined && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? "bg-white text-brand" : "bg-brand/10 text-brand"
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="my-3 border-t border-border" />

              <Link
                to="/messages"
                onClick={() => setMobileNavOpen(false)}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-ink transition-all"
              >
                <MessageSquare className="size-4 text-muted-foreground" />
                <span>Messages</span>
              </Link>

              <button
                onClick={() => {
                  setMobileNavOpen(false);
                  setReportModal({ open: true, bookingId: null, label: null });
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all text-left"
              >
                <AlertCircle className="size-4 text-muted-foreground" />
                <span>Help & Support</span>
              </button>

              {user?.id && (
                <Link
                  to="/teacher/$id"
                  params={{ id: user.id }}
                  onClick={() => setMobileNavOpen(false)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-ink transition-all"
                >
                  <ExternalLink className="size-4 text-muted-foreground" />
                  <span>View Public Profile</span>
                </Link>
              )}
            </nav>

            {/* Mobile Sign out */}
            <div className="p-4 border-t border-border">
              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
              >
                <LogOut className="size-4" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <main className="flex-1 ml-0 lg:ml-64 min-h-screen p-4 sm:p-6 lg:p-8 max-w-6xl w-full min-w-0">
        {/* Header bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-border/80">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden flex size-9 items-center justify-center rounded-xl border border-border bg-card text-ink hover:bg-secondary transition-colors"
                aria-label="Open navigation menu"
              >
                <Menu className="size-5" />
              </button>
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
                  {tab === "overview" && "Dashboard Overview"}
                  {tab === "calendar" && "My Calendar & Sessions"}
                  {tab === "availability" && "Weekly Availability Schedule"}
                  {tab === "profile" && "Teacher Profile & Specialties"}
                  {tab === "reviews" && "Student Ratings & Reviews"}
                  {tab === "earnings" && "Earnings & Mobile Money"}
                  {tab === "support" && "Help & Support Tickets"}
                </h1>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
                  Welcome back, {user?.email?.split("@")[0] ?? "Teacher"}.
                </p>
              </div>
            </div>

            {/* Mobile Actions: Notifications & Avatar */}
            <div className="flex items-center gap-2 sm:hidden">
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(v => !v)}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card hover:bg-secondary transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="size-4 text-ink" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white animate-pulse">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden fade-in">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-secondary/50">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">Notifications</p>
                        {unreadCount > 0 && (
                          <span className="rounded-full bg-brand/15 text-brand px-2 py-0.5 text-[10px] font-bold">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllRead}
                            className="text-[11px] font-medium text-brand hover:underline flex items-center gap-1"
                          >
                            <CheckCheck className="size-3" />
                            Mark read
                          </button>
                        )}
                        <button onClick={() => setNotifOpen(false)} className="text-muted-foreground hover:text-foreground">
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-border">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-8 text-center text-xs text-muted-foreground">No new notifications</p>
                      ) : (
                        notifications.map(n => {
                          const Icon = n.type === 'payment' ? CreditCard :
                                       n.type === 'message' ? MessageSquare :
                                       n.type === 'support' ? AlertCircle : CalendarCheck;
                          const iconBg = n.type === 'payment' ? 'bg-emerald-100 text-emerald-700' :
                                         n.type === 'message' ? 'bg-blue-100 text-blue-700' :
                                         n.type === 'support' ? 'bg-amber-100 text-amber-700' :
                                         'bg-purple-100 text-purple-700';

                          return (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`p-3.5 hover:bg-secondary/60 transition-colors cursor-pointer flex items-start gap-3 ${
                                !n.is_read ? 'bg-brand/5' : ''
                              }`}
                            >
                              <div className={`size-8 rounded-xl shrink-0 flex items-center justify-center ${iconBg}`}>
                                <Icon className="size-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p className={`text-xs truncate ${!n.is_read ? 'font-bold text-ink' : 'font-medium text-ink/80'}`}>
                                    {n.title}
                                  </p>
                                  {!n.is_read && <span className="size-2 rounded-full bg-brand shrink-0" />}
                                </div>
                                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                  {n.message}
                                </p>
                                <p className="mt-1 text-[9px] text-muted-foreground/70">
                                  {new Date(n.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="size-9 rounded-full bg-brand-soft text-brand border border-brand/20 flex items-center justify-center font-bold text-xs">
                {user?.email?.[0]?.toUpperCase() ?? "T"}
              </div>
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card hover:bg-secondary transition-colors"
                aria-label="Notifications"
              >
                <Bell className="size-4 text-ink" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-88 rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden fade-in">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-secondary/50">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">Notifications</p>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-brand/15 text-brand px-2 py-0.5 text-[10px] font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-[11px] font-medium text-brand hover:underline flex items-center gap-1"
                        >
                          <CheckCheck className="size-3" />
                          Mark read
                        </button>
                      )}
                      <button onClick={() => setNotifOpen(false)} className="text-muted-foreground hover:text-foreground">
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-border">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-xs text-muted-foreground">No new notifications</p>
                    ) : (
                      notifications.map(n => {
                        const Icon = n.type === 'payment' ? CreditCard :
                                     n.type === 'message' ? MessageSquare :
                                     n.type === 'support' ? AlertCircle : CalendarCheck;
                        const iconBg = n.type === 'payment' ? 'bg-emerald-100 text-emerald-700' :
                                       n.type === 'message' ? 'bg-blue-100 text-blue-700' :
                                       n.type === 'support' ? 'bg-amber-100 text-amber-700' :
                                       'bg-purple-100 text-purple-700';

                        return (
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`p-3.5 hover:bg-secondary/60 transition-colors cursor-pointer flex items-start gap-3 ${
                              !n.is_read ? 'bg-brand/5' : ''
                            }`}
                          >
                            <div className={`size-8 rounded-xl shrink-0 flex items-center justify-center ${iconBg}`}>
                              <Icon className="size-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <p className={`text-xs truncate ${!n.is_read ? 'font-bold text-ink' : 'font-medium text-ink/80'}`}>
                                  {n.title}
                                </p>
                                {!n.is_read && <span className="size-2 rounded-full bg-brand shrink-0" />}
                              </div>
                              <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                {n.message}
                              </p>
                              <p className="mt-1 text-[9px] text-muted-foreground/70">
                                {new Date(n.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {user?.id && (
              <Link
                to="/teacher/$id"
                params={{ id: user.id }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary text-ink transition-colors"
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

        {/* ── Mobile Horizontal Quick-Tab Bar ── */}
        <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-3 mb-6 -mx-4 px-4 scrollbar-none">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-brand text-primary-foreground shadow-sm"
                    : "bg-card border border-border text-muted-foreground hover:bg-secondary hover:text-ink"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{item.label}</span>
                {'badge' in item && item.badge !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                    isActive ? "bg-white text-brand" : "bg-brand/10 text-brand"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Verification Status Banner ── */}
        {dashData?.teacherProfile && dashData.teacherProfile.verification_status !== 'verified' && (
          <div className={`mb-6 rounded-2xl border-2 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4 ${
            dashData.teacherProfile.verification_status === 'rejected'
              ? 'bg-red-50 border-red-300'
              : 'bg-amber-50 border-amber-300'
          }`}>
            <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
              dashData.teacherProfile.verification_status === 'rejected'
                ? 'bg-red-100 text-red-600'
                : 'bg-amber-100 text-amber-600'
            }`}>
              {dashData.teacherProfile.verification_status === 'rejected'
                ? <XCircle className="size-5" />
                : <Clock className="size-5" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${
                dashData.teacherProfile.verification_status === 'rejected' ? 'text-red-800' : 'text-amber-800'
              }`}>
                {dashData.teacherProfile.verification_status === 'rejected'
                  ? '❌ Certificate Verification Rejected'
                  : '⏳ Certificate Pending Admin Verification'
                }
              </p>
              <p className={`mt-1 text-xs leading-relaxed ${
                dashData.teacherProfile.verification_status === 'rejected' ? 'text-red-700' : 'text-amber-700'
              }`}>
                {dashData.teacherProfile.verification_status === 'rejected'
                  ? 'Your certificate was not accepted. You are currently not visible to students. Please upload a valid teaching certificate or qualification document in your Profile tab, then contact support for re-review.'
                  : 'Your profile and certificate are under review by our admin team. You will not appear in student searches until your certificate is verified. This usually takes 1–2 business days.'
                }
              </p>
              {dashData.teacherProfile.verification_status === 'rejected' && (
                <button
                  onClick={() => setTab('profile')}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-red-700 hover:text-red-900 hover:underline"
                >
                  <Settings className="size-3.5" />
                  Update certificate in Profile →
                </button>
              )}
            </div>
            <div className={`self-start sm:self-center shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              dashData.teacherProfile.verification_status === 'rejected'
                ? 'bg-red-100 text-red-700 border-red-300'
                : 'bg-amber-100 text-amber-700 border-amber-300'
            }`}>
              {dashData.teacherProfile.verification_status === 'rejected' ? 'Rejected' : 'Pending Review'}
            </div>
          </div>
        )}
        {dashData?.teacherProfile?.verification_status === 'verified' && (
          <div className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5 flex items-center gap-3">
            <CheckCircle className="size-5 text-emerald-600 shrink-0" />
            <p className="text-xs font-semibold text-emerald-700">
              ✅ Certificate verified — your profile is live and visible to students.
            </p>
          </div>
        )}

        {/* ── Stat Cards Grid (Mobile 2-cols, Desktop 4-cols) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { label: "Total Bookings", value: bookings.length, sub: "All time sessions", icon: Calendar, color: "text-brand" },
            { label: "Confirmed Sessions", value: bookings.filter((b: any) => b.status === "confirmed").length, sub: "Upcoming lessons", icon: CheckCircle, color: "text-green-600" },
            { label: "Avg. Rating", value: avgRating ? `${avgRating.toFixed(1)} ★` : "New (5.0 ★)", sub: `${reviews.length} reviews`, icon: Star, color: "text-amber-500" },
            { label: "Net Take-Home", value: `GHS ${((totalEarningsCents * 0.85) / 100).toFixed(2)}`, sub: "85% after 15% fee", icon: Banknote, color: "text-emerald-600" },
          ].map((s, idx) => {
            const Icon = s.icon;
            return (
              <div key={idx} className="rounded-2xl bg-card p-4 sm:p-5 border border-border/80 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground line-clamp-1">{s.label}</p>
                  <Icon className={`size-4 shrink-0 ${s.color}`} />
                </div>
                <p className="mt-2 font-serif text-xl sm:text-2xl font-bold text-ink truncate">{s.value}</p>
                <p className="mt-1 text-[9px] sm:text-[10px] text-muted-foreground truncate">{s.sub}</p>
              </div>
            );
          })}
        </div>

        {/* ── TAB 1: OVERVIEW ── */}
        {tab === "overview" && (
          <div className="space-y-6 sm:space-y-8 fade-in">
            {/* Next session hero */}
            {upcomingBooking ? (
              <div className="rounded-2xl sm:rounded-3xl bg-brand p-5 sm:p-8 text-primary-foreground shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 -mt-16 -mr-16 size-64 rounded-full bg-white/10 blur-3xl transition-transform duration-700 group-hover:scale-150" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
                      Next Confirmed Lesson
                    </span>
                    <h3 className="font-serif text-2xl sm:text-4xl mt-3">{upcomingBooking.profiles?.full_name ?? "Student"}</h3>
                    <p className="text-xs sm:text-sm opacity-90 mt-1 flex items-center gap-1.5"><Clock className="size-4 shrink-0" /> {formatDateTime(upcomingBooking.scheduled_at)}</p>
                  </div>
                  {upcomingBooking.paystack_reference ? (
                    <Link
                      to="/room/$id"
                      params={{ id: upcomingBooking.room_id ?? upcomingBooking.id }}
                      className="inline-flex items-center justify-center gap-2 h-11 px-6 sm:px-8 rounded-full bg-white text-brand font-bold text-xs sm:text-sm shadow-md hover:bg-white/90 transition-all hover:scale-105"
                    >
                      <Video className="size-4" />
                      Enter Classroom Room
                    </Link>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2 h-11 px-5 sm:px-6 rounded-full bg-white/20 text-white/90 font-semibold text-xs sm:text-sm border border-white/30 text-center">
                      <Clock className="size-4 shrink-0" />
                      Awaiting Student Payment
                    </span>
                  )}
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
            <div className="rounded-2xl bg-card border border-border p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-ink">Recent Student Bookings</h3>
                <button onClick={() => setTab("calendar")} className="text-xs font-semibold text-brand hover:underline">
                  View All ({bookings.length})
                </button>
              </div>

              {bookings.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No bookings recorded yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {bookings.slice(0, 5).map((b: any) => (
                    <div key={b.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-secondary/20 -mx-2 sm:-mx-4 px-2 sm:px-4 rounded-xl transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-ink">{b.profiles?.full_name ?? "Student"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(b.scheduled_at)} · GH₵{(b.price_cents / 100).toFixed(2)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
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
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors"
                          >
                            Accept
                          </button>
                        )}
                        {b.status === "confirmed" && (
                          b.paystack_reference ? (
                            <Link
                              to="/room/$id"
                              params={{ id: b.room_id ?? b.id }}
                              className="px-3 py-1.5 bg-brand text-primary-foreground rounded-lg text-xs font-semibold hover:bg-brand/90 transition-colors"
                            >
                              Join Room
                            </Link>
                          ) : (
                            <span className="px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold flex items-center gap-1.5">
                              <Clock className="size-3 text-amber-500" />
                              Awaiting Payment
                            </span>
                          )
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
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
              {(["all", "pending", "confirmed", "completed", "cancelled"] as const).map(k => (
                <button
                  key={k}
                  onClick={() => setBookingFilter(k)}
                  className={`shrink-0 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-all ${
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
            <div className="rounded-2xl bg-card border border-border p-4 sm:p-6 shadow-sm">
              {filteredBookings.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No bookings found for this filter.</p>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map((b: any) => (
                    <div key={b.id} className="p-4 sm:p-5 rounded-2xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:shadow-md hover:border-brand/30 transition-all duration-300">
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
                          ⏰ {formatDateTime(b.scheduled_at)} · Student Paid: <strong className="text-ink">GHS {(b.price_cents / 100).toFixed(2)}</strong> · Fee (-15%): <span className="text-destructive font-medium">-GHS {((b.price_cents * 0.15) / 100).toFixed(2)}</span> · Your Net: <strong className="text-emerald-700">GHS {((b.price_cents * 0.85) / 100).toFixed(2)}</strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {b.status === "pending" && (
                          <>
                            <span className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1.5">
                              <Clock className="size-3.5 text-amber-600" />
                              Awaiting Student Payment
                            </span>
                            <button
                              onClick={() => updateBookingStatus(b.id, "cancelled")}
                              className="px-3 py-1.5 bg-card border border-border text-destructive rounded-lg text-xs font-semibold hover:bg-destructive/10 transition-colors"
                            >
                              Decline Slot
                            </button>
                          </>
                        )}
                        {b.status === "confirmed" && (
                          <>
                            {b.paystack_reference ? (
                              <Link
                                to="/room/$id"
                                params={{ id: b.room_id ?? b.id }}
                                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-brand text-primary-foreground rounded-lg text-xs font-semibold hover:bg-brand/90"
                              >
                                Enter Lesson Room
                              </Link>
                            ) : (
                              <span className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1.5">
                                <Clock className="size-3.5 text-amber-600" />
                                Awaiting Student Payment
                              </span>
                            )}
                            <button
                              onClick={() => updateBookingStatus(b.id, "completed")}
                              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                            >
                              Mark Completed
                            </button>
                            <button
                              onClick={() => updateBookingStatus(b.id, "cancelled")}
                              className="px-3 py-1.5 sm:px-4 sm:py-2 border border-border text-xs text-destructive rounded-lg hover:bg-destructive/10"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {b.student_id && (
                          <Link
                            to="/messages"
                            search={{ contactId: b.student_id }}
                            className="px-3 py-1.5 sm:px-3 sm:py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary flex items-center gap-1"
                          >
                            <MessageSquare className="size-3 text-brand" />
                            Message
                          </Link>
                        )}
                        <button
                          onClick={() => setReportModal({
                            open: true,
                            bookingId: b.id,
                            label: `${b.profiles?.full_name ?? "Student"} · ${formatDateTime(b.scheduled_at)}`,
                          })}
                          className="px-2.5 py-1.5 sm:px-2.5 sm:py-2 border border-border text-xs font-semibold rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center gap-1"
                          title="Report an issue with this session"
                        >
                          <AlertCircle className="size-3 text-destructive" />
                          Report
                        </button>
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
          <div className="rounded-2xl bg-card border border-border p-4 sm:p-6 shadow-sm fade-in space-y-5 sm:space-y-6">
            <div>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-ink">Weekly Teaching Hours</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Students will be able to book 60-minute slots during your defined available time windows.
              </p>
            </div>

            <div className="space-y-3">
              {availability.map((s, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/40 border border-border">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
                        className="h-9 w-14 sm:w-16 rounded-lg border border-input bg-card px-2 text-center text-xs font-semibold"
                      />
                      <span>:00 to</span>
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={s.end_hour}
                        onChange={e => updateSlot(idx, "end_hour", Number(e.target.value))}
                        className="h-9 w-14 sm:w-16 rounded-lg border border-input bg-card px-2 text-center text-xs font-semibold"
                      />
                      <span className="hidden sm:inline">:00 (GMT)</span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeSlot(idx)}
                    className="self-end sm:self-auto text-xs text-destructive hover:underline font-semibold"
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
          <div className="rounded-2xl bg-card border border-border p-4 sm:p-6 shadow-sm fade-in space-y-5 sm:space-y-6">
            <h3 className="font-serif text-lg sm:text-xl font-bold text-ink">Teaching Profile Details</h3>

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

        {/* ── TAB 6: EARNINGS ── */}
        {tab === "earnings" && (
          <div className="space-y-6 fade-in">
            <div className="rounded-2xl bg-card border border-border p-4 sm:p-6 shadow-sm space-y-5 sm:space-y-6">
              <div>
                <h3 className="font-serif text-lg sm:text-xl font-bold text-ink">Earnings &amp; Payout Overview</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Platform fee (15%) is automatically deducted, leaving 85% net take-home earnings remitted directly to your Mobile Money wallet.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/50 border border-border">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground line-clamp-1">Gross Volume</p>
                  <p className="mt-1.5 sm:mt-2 font-serif text-lg sm:text-2xl font-bold text-ink">GHS {(totalEarningsCents / 100).toFixed(2)}</p>
                </div>
                <div className="p-3.5 sm:p-4 rounded-xl bg-red-50/50 border border-red-200">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-destructive font-semibold line-clamp-1">Fee (-15%)</p>
                  <p className="mt-1.5 sm:mt-2 font-serif text-lg sm:text-2xl font-bold text-destructive">-GHS {((totalEarningsCents * 0.15) / 100).toFixed(2)}</p>
                </div>
                <div className="p-3.5 sm:p-4 rounded-xl bg-green-50 border border-green-200">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-green-800 font-semibold line-clamp-1">Net (85%)</p>
                  <p className="mt-1.5 sm:mt-2 font-serif text-lg sm:text-2xl font-bold text-green-700">GHS {((totalEarningsCents * 0.85) / 100).toFixed(2)}</p>
                </div>
                <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-800 font-semibold line-clamp-1">Pending Payout</p>
                  <p className="mt-1.5 sm:mt-2 font-serif text-lg sm:text-2xl font-bold text-amber-700">GHS {((pendingPayoutCents * 0.85) / 100).toFixed(2)}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-brand-soft border border-brand/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-brand uppercase tracking-wider">Mobile Money Payout Setup</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Payouts are settled automatically after each completed lesson (MTN MoMo, Telecel Cash, AirtelTigo).
                    </p>
                  </div>
                </div>
                <div className="mt-3.5 max-w-sm flex flex-col sm:flex-row gap-2">
                  <input
                    type="tel"
                    placeholder="e.g. 0241234567"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="h-10 w-full rounded-lg border border-brand/30 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="h-10 px-4 rounded-lg bg-brand text-primary-foreground text-xs font-semibold shadow-sm hover:bg-brand/90 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {saving ? "..." : "Save MoMo"}
                  </button>
                </div>
              </div>
            </div>

            {/* Completed Sessions Deduction Breakdown Table */}
            <div className="rounded-2xl bg-card border border-border p-4 sm:p-6 shadow-sm">
              <h4 className="font-serif text-base sm:text-lg font-bold text-ink mb-1">Completed Lessons &amp; Net Take-Home Log</h4>
              <p className="text-xs text-muted-foreground mb-4">Complete breakdown of gross student fees, 15% platform deduction, and your 85% payout per lesson.</p>

              {bookings.filter((b: any) => b.status === "completed").length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No completed sessions yet. Complete your first lesson to view the itemized earnings breakdown!
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full text-left text-xs min-w-[540px]">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-3 font-semibold">Date &amp; Time</th>
                        <th className="pb-3 font-semibold">Student</th>
                        <th className="pb-3 font-semibold">Gross Fee (100%)</th>
                        <th className="pb-3 font-semibold text-destructive">Platform Fee (-15%)</th>
                        <th className="pb-3 font-semibold text-emerald-700">Your Net Payout (85%)</th>
                        <th className="pb-3 font-semibold text-right">Settlement Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {bookings
                        .filter((b: any) => b.status === "completed")
                        .map((b: any) => {
                          const gross = b.price_cents / 100;
                          const fee = (b.price_cents * 0.15) / 100;
                          const net = (b.price_cents * 0.85) / 100;

                          return (
                            <tr key={b.id} className="hover:bg-secondary/30 transition-colors">
                              <td className="py-3 font-medium text-ink">{formatDateTime(b.scheduled_at)}</td>
                              <td className="py-3">{b.profiles?.full_name ?? "Student"}</td>
                              <td className="py-3 font-semibold">GHS {gross.toFixed(2)}</td>
                              <td className="py-3 text-destructive font-medium">-GHS {fee.toFixed(2)}</td>
                              <td className="py-3 font-bold text-emerald-700">GHS {net.toFixed(2)}</td>
                              <td className="py-3 text-right">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  b.paid_out ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                                }`}>
                                  {b.paid_out ? "✓ Paid to MoMo" : "⏳ Queued for Payout"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 7: SUPPORT & DISPUTE TICKETS ── */}
        {tab === "support" && (
          <div className="rounded-2xl bg-card border border-border p-4 sm:p-6 shadow-sm fade-in space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg sm:text-xl font-bold text-ink">My Support Reports &amp; Admin Responses</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Track help tickets submitted to QuickTutor Administration and view admin answers and dispute resolutions.
                </p>
              </div>
              <button
                onClick={() => setReportModal({ open: true, bookingId: null, label: null })}
                className="self-start sm:self-auto h-9 px-4 rounded-xl bg-brand text-primary-foreground text-xs font-semibold hover:bg-brand/90 transition-colors"
              >
                + New Support Ticket
              </button>
            </div>

            {myTickets.length === 0 ? (
              <div className="py-12 text-center">
                <AlertCircle className="size-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium text-ink">No support tickets filed</p>
                <p className="text-xs text-muted-foreground mt-1">If you have issues with payments, students, or sessions, click above to report directly to admin.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {myTickets.map((t) => (
                  <div key={t.id} className="py-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {t.category.replace(/_/g, " ")}
                        </span>
                        <h4 className="font-bold text-sm text-ink">{t.subject}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          t.status === 'open' ? 'bg-red-100 text-red-700' :
                          t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {t.status.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground bg-surface/60 p-3 rounded-xl border border-border/60">
                      <strong className="text-ink">Your Description:</strong> {t.description}
                    </p>

                    {t.resolution_notes ? (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 space-y-1">
                        <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                          <span>🛡️ Admin Resolution &amp; Response:</span>
                          {t.resolved_at && <span className="font-normal text-[10px] text-emerald-700">({new Date(t.resolved_at).toLocaleDateString()})</span>}
                        </p>
                        <p className="text-emerald-800 font-medium pl-5">{t.resolution_notes}</p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-700 italic pl-1 flex items-center gap-1">
                        <span>⏳ Status:</span> Admin is currently investigating your ticket. You will receive an alert once resolved.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Report Modal */}
      <ReportDialog
        open={reportModal.open}
        onClose={() => {
          setReportModal({ open: false, bookingId: null, label: null });
          loadMyTickets();
        }}
        bookingId={reportModal.bookingId}
        bookingLabel={reportModal.label}
      />
    </div>
  );
}
