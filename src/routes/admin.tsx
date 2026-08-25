import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Wallet,
  Users,
  Calendar,
  BadgePercent,
  ShieldCheck,
  MessageSquareText,
  MessageSquare,
  Send,
  CheckCircle2,
  BarChart3,
  UserX,
  UserCheck,
  AlertTriangle,
  CreditCard,
  Search,
  Filter,
  RefreshCw,
  Clock,
  FileText,
  AlertCircle,
  ExternalLink,
  GraduationCap,
  Layers,
  ChevronRight,
} from "lucide-react";
import { getBackendUrl } from "@/lib/config";

const BACKEND = getBackendUrl();

export const Route = createFileRoute("/admin")({ component: AdminPage });

type AdminTab = "overview" | "verifications" | "users" | "transactions" | "payouts" | "support" | "sms";

type Ticket = {
  id: string;
  reporter_id?: string | null;
  reporter_name: string;
  reporter_role: string;
  reporter_phone: string | null;
  reporter_email: string;
  category: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved";
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  booking_scheduled_at: string | null;
  booking_price_cents: number | null;
};

type Transaction = {
  id: string;
  booking_id: string | null;
  student_id: string | null;
  student_name?: string | null;
  teacher_name?: string | null;
  amount_cents: number;
  status: string;
  currency: string;
  paystack_reference?: string | null;
  transaction_date: string;
  created_at: string;
};

type UserItem = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  location?: string | null;
  role: string;
  suspended: boolean;
  verification_status?: string | null;
  created_at: string;
};

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  // Active Tab selection
  const [tab, setTab] = useState<AdminTab>("overview");
  const [refreshing, setRefreshing] = useState(false);

  // Data States
  const [stats, setStats] = useState({
    users: 0,
    bookings: 0,
    grossRevenueCents: 0,
    adminEarningsCents: 0,
    tutorEarningsCents: 0,
    pendingPayoutsCents: 0,
    completedPayoutsCents: 0,
    commissionRate: 15,
  });

  const [bookings, setBookings] = useState<{ id: string; scheduled_at: string; status: string; price_cents: number }[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingVerif, setPendingVerif] = useState<{ user_id: string; id_document_url: string | null; qualification_document_url: string | null; profiles: { full_name: string } | null }[]>([]);
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [payouts, setPayouts] = useState<{ teacher_id: string; full_name: string; phone: string | null; amount_owed_cents: number }[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Analytics state
  const [analytics, setAnalytics] = useState<{
    monthly: { month: string; revenueCents: number; bookings: number }[];
    userGrowth: { month: string; users: number }[];
    topSubjects: { name: string; count: number }[];
    bookingsByStatus: { status: string; count: number }[];
  } | null>(null);

  // Search & Filter States
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "teacher" | "student" | "admin" | "suspended">("all");
  const [txSearch, setTxSearch] = useState("");
  const [txStatusFilter, setTxStatusFilter] = useState<"all" | "succeeded" | "pending" | "failed">("all");
  const [txSubTab, setTxSubTab] = useState<"paystack" | "bookings">("paystack");
  const [ticketFilter, setTicketFilter] = useState<"all" | "appeals" | "open" | "in_progress" | "resolved">("all");
  const [payoutSearch, setPayoutSearch] = useState("");

  // SMS Live Dispatch State
  const [smsPhone, setSmsPhone] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [smsSending, setSmsSending] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { mode: "login", role: "student" } });
      return;
    }
  }, [user, loading, navigate]);

  const loadAllData = async () => {
    if (!isAdmin) return;
    setRefreshing(true);
    const token = localStorage.getItem("token");
    const authHeaders = { Authorization: `Bearer ${token}` };

    try {
      await Promise.allSettled([
        fetch(`${BACKEND}/api/admin/stats`, { headers: authHeaders })
          .then(r => r.json())
          .then(data => {
            if (data && !data.error) {
              setStats({
                users: data.users || 0,
                bookings: data.bookings || 0,
                grossRevenueCents: data.grossRevenueCents || data.revenueCents || 0,
                adminEarningsCents: data.adminEarningsCents || 0,
                tutorEarningsCents: data.tutorEarningsCents || 0,
                pendingPayoutsCents: data.pendingPayoutsCents || 0,
                completedPayoutsCents: data.completedPayoutsCents || 0,
                commissionRate: data.commissionRate || 15,
              });
            }
          }),
        fetch(`${BACKEND}/api/admin/bookings`, { headers: authHeaders })
          .then(r => r.json())
          .then(data => { if (data?.bookings) setBookings(data.bookings); }),
        fetch(`${BACKEND}/api/admin/transactions`, { headers: authHeaders })
          .then(r => r.json())
          .then(data => { if (data?.transactions) setTransactions(data.transactions); }),
        fetch(`${BACKEND}/api/admin/users`, { headers: authHeaders })
          .then(r => r.json())
          .then(data => { if (data?.users) setUsersList(data.users); }),
        fetch(`${BACKEND}/api/admin/payouts`, { headers: authHeaders })
          .then(r => r.json())
          .then(data => { if (data?.payouts) setPayouts(data.payouts); }),
        fetch(`${BACKEND}/api/admin/verifications`, { headers: authHeaders })
          .then(r => r.json())
          .then(data => { if (data?.pending) setPendingVerif(data.pending); }),
        fetch(`${BACKEND}/api/admin/tickets`, { headers: authHeaders })
          .then(r => r.json())
          .then(data => { if (data?.tickets) setTickets(data.tickets); }),
        fetch(`${BACKEND}/api/admin/analytics`, { headers: authHeaders })
          .then(r => r.json())
          .then(data => { if (data && !data.error) setAnalytics(data); }),
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [isAdmin]);

  const loadTickets = () => {
    const token = localStorage.getItem("token");
    fetch(`${BACKEND}/api/admin/tickets`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data?.tickets) setTickets(data.tickets); })
      .catch(console.error);
  };

  const loadPayouts = () => {
    const token = localStorage.getItem("token");
    fetch(`${BACKEND}/api/admin/payouts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data?.payouts) setPayouts(data.payouts); })
      .catch(console.error);
  };

  const loadPending = () => {
    const token = localStorage.getItem("token");
    fetch(`${BACKEND}/api/admin/verifications`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data?.pending) setPendingVerif(data.pending); })
      .catch(console.error);
  };

  const openDoc = async (urlOrPath: string) => {
    if (!urlOrPath) return;
    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://") || urlOrPath.startsWith("data:")) {
      window.open(urlOrPath, "_blank");
      return;
    }
    try {
      const { data } = await supabase.storage.from("verification-docs").createSignedUrl(urlOrPath, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      } else {
        toast.error("Could not preview document");
      }
    } catch {
      window.open(urlOrPath, "_blank");
    }
  };

  const decide = async (userId: string, approve: boolean) => {
    let notes: string | null = null;
    if (!approve) {
      notes = prompt("Reason for rejection (optional):") || null;
    }
    const token = localStorage.getItem("token");
    const res = await fetch(`${BACKEND}/api/admin/verifications/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ approve, notes: notes || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to update verification status");
      return;
    }
    toast.success(approve ? "Tutor approved and is now live on Find a Tutor!" : "Verification rejected");
    loadPending();
    loadAllData();
  };

  const markAsPaid = async (teacher_id: string, amount_cents: number) => {
    if (!confirm(`Mark GHS ${(amount_cents / 100).toFixed(2)} as paid to this tutor?`)) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${BACKEND}/api/admin/payouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ teacher_id, amount_cents }),
    });
    if (res.ok) {
      toast.success("Payout marked as settled and SMS dispatched to tutor");
      loadPayouts();
    } else {
      toast.error("Failed to mark payout as paid");
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    let notes: string | null = null;
    if (status === "resolved") {
      notes = prompt("Enter resolution notes (optional):") ?? null;
    }
    const token = localStorage.getItem("token");
    const res = await fetch(`${BACKEND}/api/admin/tickets/${ticketId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, resolution_notes: notes }),
    });
    if (res.ok) {
      toast.success(`Ticket marked as ${status.replace("_", " ")}`);
      loadTickets();
    } else {
      toast.error("Failed to update ticket status");
    }
  };

  const handleSuspendUser = async (userId: string, suspend: boolean) => {
    const action = suspend ? "suspend" : "unsuspend";
    const userName = usersList.find(u => u.id === userId)?.full_name || "user";
    if (!confirm(`Are you sure you want to ${action} ${userName}? ${suspend ? "They will not be able to log in." : "They will regain full access."}`)) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${BACKEND}/api/admin/users/${userId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(data.message);
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, suspended: suspend } : u));
    } else {
      toast.error(data.error || `Failed to ${action} user`);
    }
  };

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsPhone.trim() || !smsMessage.trim()) {
      toast.error("Please enter both a recipient Ghana phone number and a message.");
      return;
    }
    setSmsSending(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND}/api/admin/sms/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: smsPhone, message: smsMessage }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "SMS delivery failed.");
      }
      toast.success(`SMS successfully dispatched to ${smsPhone}!`);
      setSmsMessage("");
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch SMS.");
    } finally {
      setSmsSending(false);
    }
  };

  // Filtered lists
  const filteredUsers = useMemo(() => {
    return usersList.filter(u => {
      const matchesSearch =
        !userSearch ||
        (u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.email?.toLowerCase().includes(userSearch.toLowerCase()));
      if (!matchesSearch) return false;
      if (userRoleFilter === "suspended") return u.suspended;
      if (userRoleFilter === "all") return true;
      return u.role === userRoleFilter;
    });
  }, [usersList, userSearch, userRoleFilter]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch =
        !txSearch ||
        (t.student_name?.toLowerCase().includes(txSearch.toLowerCase()) ||
          t.teacher_name?.toLowerCase().includes(txSearch.toLowerCase()) ||
          t.paystack_reference?.toLowerCase().includes(txSearch.toLowerCase()) ||
          t.id.toLowerCase().includes(txSearch.toLowerCase()));
      if (!matchesSearch) return false;
      if (txStatusFilter === "all") return true;
      return t.status === txStatusFilter;
    });
  }, [transactions, txSearch, txStatusFilter]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (ticketFilter === "all") return true;
      if (ticketFilter === "appeals") return t.category === "account_appeal";
      return t.status === ticketFilter;
    });
  }, [tickets, ticketFilter]);

  const filteredPayouts = useMemo(() => {
    return payouts.filter(p => {
      if (!payoutSearch) return true;
      return (
        p.full_name.toLowerCase().includes(payoutSearch.toLowerCase()) ||
        (p.phone && p.phone.includes(payoutSearch))
      );
    });
  }, [payouts, payoutSearch]);

  const openTicketsCount = tickets.filter(t => t.status === "open").length;
  const pendingVerifCount = pendingVerif.length;
  const pendingPayoutsCount = payouts.length;
  const suspendedUsersCount = usersList.filter(u => u.suspended).length;

  if (loading) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-surface">
        <SiteNav />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <div className="size-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="size-8" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-ink">Admin Access Only</h1>
          <p className="mt-2 text-sm text-muted-foreground">You must have administrator privileges to access this control portal.</p>
          <Button onClick={() => navigate({ to: "/" })} className="mt-6">
            Return to Homepage
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                <ShieldCheck className="size-3" /> Admin Superuser
              </span>
              <span className="text-xs text-muted-foreground font-mono">Logged in as {user?.email}</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold mt-1 text-ink">
              Management Portal
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Select an option below to manage revenue, verifications, users, payouts, and support.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={loadAllData}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-border bg-card text-xs font-semibold text-ink hover:bg-secondary transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin text-brand" : "text-muted-foreground"}`} />
              <span>{refreshing ? "Refreshing…" : "Sync Data"}</span>
            </button>
            <div className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-700">
              <BadgePercent className="size-4 text-emerald-600 shrink-0" />
              <span>Commission: <strong>{stats.commissionRate}%</strong></span>
            </div>
          </div>
        </div>

        {/* ── Tab Navigation Selector Bar ── */}
        <div className="mt-6 overflow-x-auto pb-2 scrollbar-none">
          <div className="flex items-center gap-2 p-1.5 bg-secondary/50 rounded-2xl border border-border w-max min-w-full sm:min-w-0">
            {[
              { id: "overview" as AdminTab, label: "Overview & Analytics", icon: BarChart3, badge: null },
              { id: "verifications" as AdminTab, label: "Tutor Verifications", icon: ShieldCheck, badge: pendingVerifCount, badgeColor: "bg-amber-500 text-white" },
              { id: "users" as AdminTab, label: "User Accounts", icon: Users, badge: suspendedUsersCount ? `${suspendedUsersCount} suspended` : null, badgeColor: "bg-red-100 text-red-700" },
              { id: "transactions" as AdminTab, label: "Transactions & Bookings", icon: CreditCard, badge: null },
              { id: "payouts" as AdminTab, label: "Tutor Payouts", icon: Wallet, badge: pendingPayoutsCount, badgeColor: "bg-amber-500 text-white" },
              { id: "support" as AdminTab, label: "Support & Disputes", icon: AlertCircle, badge: openTicketsCount, badgeColor: "bg-red-600 text-white" },
              { id: "sms" as AdminTab, label: "SMS Gateway", icon: MessageSquareText, badge: null },
            ].map(t => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    active
                      ? "bg-brand text-primary-foreground shadow-sm shadow-brand/20 font-bold"
                      : "text-muted-foreground hover:text-ink hover:bg-card/70"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{t.label}</span>
                  {t.badge !== null && t.badge !== 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${active ? "bg-white/20 text-white" : t.badgeColor}`}>
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Active Option View ── */}
        <div className="mt-6">
          {/* ======================================================== */}
          {/* TAB 1: OVERVIEW & ANALYTICS                             */}
          {/* ======================================================== */}
          {tab === "overview" && (
            <div className="space-y-8 fade-in">
              {/* Executive Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {/* Admin Net Profit */}
                <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 via-card to-card p-5 sm:p-6 border-2 border-emerald-500/30 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-mono">
                      Admin Net Profit
                    </span>
                    <div className="size-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                      <TrendingUp className="size-4" />
                    </div>
                  </div>
                  <p className="mt-3 font-serif text-2xl sm:text-3xl font-bold text-ink">
                    GHS {(stats.adminEarningsCents / 100).toFixed(2)}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                      15% Retained
                    </span>
                    <p className="text-[11px] text-muted-foreground">After tutor share</p>
                  </div>
                </div>

                {/* Gross Volume */}
                <div className="rounded-2xl bg-card p-5 sm:p-6 border border-border shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Gross Volume
                    </span>
                    <div className="size-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                      <Wallet className="size-4" />
                    </div>
                  </div>
                  <p className="mt-3 font-serif text-2xl sm:text-3xl font-bold text-ink">
                    GHS {(stats.grossRevenueCents / 100).toFixed(2)}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Total student payments processed
                  </p>
                </div>

                {/* Tutor Share */}
                <div className="rounded-2xl bg-card p-5 sm:p-6 border border-border shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Tutor Earnings (85%)
                    </span>
                    <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <ShieldCheck className="size-4" />
                    </div>
                  </div>
                  <p className="mt-3 font-serif text-2xl sm:text-3xl font-bold text-ink">
                    GHS {(stats.tutorEarningsCents / 100).toFixed(2)}
                  </p>
                  <p className="mt-2 text-[11px] text-amber-700 font-medium">
                    GHS {(stats.pendingPayoutsCents / 100).toFixed(2)} pending payout
                  </p>
                </div>

                {/* Total Users */}
                <div className="rounded-2xl bg-card p-5 sm:p-6 border border-border shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Community Users
                    </span>
                    <div className="size-8 rounded-xl bg-secondary text-ink flex items-center justify-center">
                      <Users className="size-4" />
                    </div>
                  </div>
                  <p className="mt-3 font-serif text-2xl sm:text-3xl font-bold text-ink">
                    {stats.users} <span className="text-sm font-normal text-muted-foreground">registered</span>
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {stats.bookings} total bookings made
                  </p>
                </div>
              </div>

              {/* Analytics Section */}
              {analytics && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="size-4 text-brand" />
                    <h2 className="font-serif text-lg sm:text-xl font-bold text-ink">Platform Performance Trends</h2>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                    {/* Monthly Revenue Chart */}
                    <div className="rounded-2xl bg-card border border-border shadow-sm p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Monthly Revenue (GHS)</p>
                      {analytics.monthly.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No completed bookings yet</p>
                      ) : (() => {
                        const maxRev = Math.max(...analytics.monthly.map(m => m.revenueCents), 1);
                        return (
                          <div className="space-y-2.5">
                            {analytics.monthly.map(m => (
                              <div key={m.month} className="flex items-center gap-3">
                                <span className="w-8 text-[11px] font-semibold text-muted-foreground shrink-0">{m.month}</span>
                                <div className="flex-1 bg-secondary rounded-full h-5 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                                    style={{ width: `${Math.max((m.revenueCents / maxRev) * 100, 4)}%` }}
                                  >
                                    <span className="text-[9px] text-white font-bold whitespace-nowrap">GHS {(m.revenueCents / 100).toFixed(0)}</span>
                                  </div>
                                </div>
                                <span className="text-[11px] text-muted-foreground w-10 text-right shrink-0">{m.bookings}b</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* User Growth Chart */}
                    <div className="rounded-2xl bg-card border border-border shadow-sm p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">New User Signups</p>
                      {analytics.userGrowth.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No signup data yet</p>
                      ) : (() => {
                        const maxUsers = Math.max(...analytics.userGrowth.map(u => u.users), 1);
                        return (
                          <div className="space-y-2.5">
                            {analytics.userGrowth.map(u => (
                              <div key={u.month} className="flex items-center gap-3">
                                <span className="w-8 text-[11px] font-semibold text-muted-foreground shrink-0">{u.month}</span>
                                <div className="flex-1 bg-secondary rounded-full h-5 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-brand to-brand/70 rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                                    style={{ width: `${Math.max((u.users / maxUsers) * 100, 4)}%` }}
                                  >
                                    <span className="text-[9px] text-white font-bold">{u.users}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Top Subjects */}
                    {analytics.topSubjects.length > 0 && (
                      <div className="rounded-2xl bg-card border border-border shadow-sm p-5">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Top Subjects by Demand</p>
                        {(() => {
                          const maxCount = Math.max(...analytics.topSubjects.map(s => s.count), 1);
                          return (
                            <div className="space-y-2.5">
                              {analytics.topSubjects.map((s, i) => (
                                <div key={s.name} className="flex items-center gap-3">
                                  <span className="w-5 text-[11px] font-bold text-muted-foreground shrink-0">#{i + 1}</span>
                                  <span className="w-36 text-[11px] font-medium text-ink truncate shrink-0">{s.name}</span>
                                  <div className="flex-1 bg-secondary rounded-full h-4 overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
                                      style={{ width: `${Math.max((s.count / maxCount) * 100, 4)}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] text-muted-foreground w-6 text-right shrink-0">{s.count}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Bookings by Status */}
                    {analytics.bookingsByStatus.length > 0 && (
                      <div className="rounded-2xl bg-card border border-border shadow-sm p-5">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Booking Status Distribution</p>
                        <div className="grid grid-cols-2 gap-3">
                          {analytics.bookingsByStatus.map(b => (
                            <div key={b.status} className={`rounded-xl p-3 border ${
                              b.status === "completed" ? "bg-emerald-50 border-emerald-200" :
                              b.status === "confirmed" ? "bg-blue-50 border-blue-200" :
                              b.status === "pending" ? "bg-amber-50 border-amber-200" :
                              "bg-red-50 border-red-200"
                            }`}>
                              <p className={`text-[10px] font-bold uppercase tracking-wider ${
                                b.status === "completed" ? "text-emerald-700" :
                                b.status === "confirmed" ? "text-blue-700" :
                                b.status === "pending" ? "text-amber-700" :
                                "text-red-700"
                              }`}>{b.status}</p>
                              <p className="mt-1 text-2xl font-bold text-ink">{b.count}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Activity Snapshot */}
              <div className="rounded-2xl bg-card border border-border shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-ink">Recent Bookings Quick View</h3>
                    <p className="text-xs text-muted-foreground">Latest sessions booked across the platform</p>
                  </div>
                  <button
                    onClick={() => setTab("transactions")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                  >
                    View All Bookings &amp; Transactions <ChevronRight className="size-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/60 text-left uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 rounded-l-lg">Scheduled Date</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5 text-right rounded-r-lg">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {bookings.slice(0, 5).map(b => (
                        <tr key={b.id} className="hover:bg-secondary/30">
                          <td className="px-3 py-2.5 font-medium text-ink">{new Date(b.scheduled_at).toLocaleString()}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              b.status === "confirmed" ? "bg-green-100 text-green-700" :
                              b.status === "pending" ? "bg-amber-100 text-amber-700" :
                              b.status === "completed" ? "bg-blue-100 text-blue-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-ink">GHS {(b.price_cents / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                      {bookings.length === 0 && (
                        <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">No bookings recorded yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: TUTOR VERIFICATIONS                              */}
          {/* ======================================================== */}
          {tab === "verifications" && (
            <div className="space-y-6 fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-amber-900">Certificate &amp; ID Verification Queue</h2>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Review uploaded credentials. Verified tutors appear in student searches; rejected tutors receive feedback notes.
                    </p>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-bold self-start sm:self-auto">
                  {pendingVerif.length} Pending Review
                </div>
              </div>

              {pendingVerif.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
                  <CheckCircle2 className="size-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-ink">All Clear!</h3>
                  <p className="text-xs text-muted-foreground mt-1">There are no pending tutor certificates or ID documents to review.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {pendingVerif.map((p) => (
                    <div key={p.user_id} className="rounded-2xl bg-card p-5 border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-ink">{p.profiles?.full_name || "Tutor"}</span>
                          <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">ID: {p.user_id.slice(0, 8)}...</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          {p.id_document_url ? (
                            <button
                              onClick={() => openDoc(p.id_document_url!)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-ink hover:bg-brand hover:text-primary-foreground transition-colors"
                            >
                              <FileText className="size-3.5" />
                              View ID Document
                              <ExternalLink className="size-3 opacity-60" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">No ID document attached</span>
                          )}

                          {p.qualification_document_url ? (
                            <button
                              onClick={() => openDoc(p.qualification_document_url!)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand/10 text-brand hover:bg-brand hover:text-primary-foreground transition-colors"
                            >
                              <GraduationCap className="size-3.5" />
                              View Teaching Certificate / Degree
                              <ExternalLink className="size-3 opacity-60" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">No certificate document attached</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => decide(p.user_id, false)}>
                          Reject Verification
                        </Button>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => decide(p.user_id, true)}>
                          Approve &amp; Go Live
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: USER MANAGEMENT                                  */}
          {/* ======================================================== */}
          {tab === "users" && (
            <div className="space-y-6 fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-bold text-ink">User Account Management</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Filter, inspect, suspend or reinstate student and tutor accounts.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                    {usersList.filter(u => !u.suspended).length} Active
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-semibold">
                    {usersList.filter(u => u.suspended).length} Suspended
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-secondary text-ink font-semibold">
                    {usersList.filter(u => u.role === "teacher").length} Tutors
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-secondary text-ink font-semibold">
                    {usersList.filter(u => u.role === "student").length} Students
                  </span>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Search users by name or email address..."
                    className="h-10 w-full pl-9 pr-4 rounded-xl border border-input bg-card text-xs font-medium focus:ring-1 focus:ring-brand focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5 p-1 bg-secondary rounded-xl border border-border">
                  {[
                    { id: "all", label: "All Users" },
                    { id: "teacher", label: "Tutors" },
                    { id: "student", label: "Students" },
                    { id: "admin", label: "Admins" },
                    { id: "suspended", label: "Suspended" },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setUserRoleFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        userRoleFilter === f.id ? "bg-card text-ink shadow-sm" : "text-muted-foreground hover:text-ink"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">User Name</th>
                      <th className="px-4 py-3">Email Address</th>
                      <th className="px-4 py-3">Phone Number</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Registered Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Moderation Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className={`hover:bg-secondary/30 transition-colors ${u.suspended ? "bg-red-50/40" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink">{u.full_name || "Unnamed User"}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">ID: {u.id.slice(0, 8)}...</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {u.email || "—"}
                          {u.location ? <p className="text-[10px] text-muted-foreground/70">📍 {u.location}</p> : null}
                        </td>
                        <td className="px-4 py-3">
                          {u.phone ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold text-ink">{u.phone}</span>
                              <button
                                type="button"
                                title="Send SMS message to this user"
                                onClick={() => {
                                  setSmsPhone(u.phone!);
                                  setTab("sms");
                                  toast.info(`Switched to SMS Gateway for ${u.full_name || u.phone}`);
                                }}
                                className="p-1 rounded-md text-brand hover:bg-brand/10 transition-colors inline-flex items-center gap-1 text-[11px] font-semibold"
                              >
                                <MessageSquare className="size-3" />
                                SMS
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No phone</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.role === "teacher" ? "bg-brand/10 text-brand" :
                            u.role === "admin" ? "bg-purple-100 text-purple-700" :
                            "bg-secondary text-muted-foreground"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-start">
                            {u.suspended ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                <AlertTriangle className="size-3" /> Suspended
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                <CheckCircle2 className="size-3" /> Active
                              </span>
                            )}
                            {u.role === "teacher" && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                u.verification_status === "verified"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}>
                                {u.verification_status === "verified" ? "✓ Verified Live" : "Unverified / Pending"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.role === "teacher" && u.verification_status !== "verified" && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-semibold"
                                onClick={() => decide(u.id, true)}
                              >
                                Approve &amp; Go Live
                              </Button>
                            )}
                            {u.role !== "admin" ? (
                              u.suspended ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-8 text-xs"
                                  onClick={() => handleSuspendUser(u.id, false)}
                                >
                                  <UserCheck className="size-3.5" />
                                  Reinstate
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50 h-8 text-xs"
                                  onClick={() => handleSuspendUser(u.id, true)}
                                >
                                  <UserX className="size-3.5" />
                                  Suspend
                                </Button>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground font-medium italic">Admin protected</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No users match your criteria</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: TRANSACTIONS & BOOKINGS                          */}
          {/* ======================================================== */}
          {tab === "transactions" && (
            <div className="space-y-6 fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-bold text-ink">Transactions &amp; Lesson Records</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Paystack payments audit trail and session scheduling records.</p>
                </div>
                <div className="flex items-center gap-1.5 p-1 bg-secondary rounded-xl border border-border self-start sm:self-auto">
                  <button
                    onClick={() => setTxSubTab("paystack")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      txSubTab === "paystack" ? "bg-card text-ink shadow-sm font-bold" : "text-muted-foreground hover:text-ink"
                    }`}
                  >
                    Paystack Transactions ({transactions.length})
                  </button>
                  <button
                    onClick={() => setTxSubTab("bookings")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      txSubTab === "bookings" ? "bg-card text-ink shadow-sm font-bold" : "text-muted-foreground hover:text-ink"
                    }`}
                  >
                    All Bookings ({bookings.length})
                  </button>
                </div>
              </div>

              {txSubTab === "paystack" ? (
                <div className="space-y-4">
                  {/* Search and filter */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={txSearch}
                        onChange={e => setTxSearch(e.target.value)}
                        placeholder="Search by student, tutor, or reference..."
                        className="h-10 w-full pl-9 pr-4 rounded-xl border border-input bg-card text-xs font-medium focus:ring-1 focus:ring-brand focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 p-1 bg-secondary rounded-xl border border-border">
                      {[
                        { id: "all", label: "All Status" },
                        { id: "succeeded", label: "Succeeded" },
                        { id: "pending", label: "Pending" },
                        { id: "failed", label: "Failed" },
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setTxStatusFilter(f.id as any)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            txStatusFilter === f.id ? "bg-card text-ink shadow-sm" : "text-muted-foreground hover:text-ink"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Transaction Date</th>
                          <th className="px-4 py-3">Paystack Reference</th>
                          <th className="px-4 py-3">Student &amp; Tutor</th>
                          <th className="px-4 py-3">Gross Amount</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredTransactions.map((t) => (
                          <tr key={t.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-ink">{new Date(t.transaction_date || t.created_at).toLocaleDateString()}</p>
                              <p className="text-[11px] text-muted-foreground">{new Date(t.transaction_date || t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-mono text-xs font-semibold text-brand">{t.paystack_reference || "dev-ref"}</p>
                              <p className="text-[10px] text-muted-foreground">ID: {t.id.slice(0, 8)}...</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-ink">{t.student_name || "Student"}</p>
                              <p className="text-[11px] text-muted-foreground">Tutor: {t.teacher_name || "Tutor"}</p>
                            </td>
                            <td className="px-4 py-3 font-bold text-ink">
                              {t.currency?.toUpperCase() || "GHS"} {(t.amount_cents / 100).toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                t.status === "succeeded" ? "bg-emerald-100 text-emerald-800" :
                                t.status === "pending" ? "bg-amber-100 text-amber-800" :
                                "bg-red-100 text-red-800"
                              }`}>
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filteredTransactions.length === 0 && (
                          <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No transactions found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Booking ID</th>
                        <th className="px-4 py-3">Scheduled Date &amp; Time</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Lesson Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {bookings.map((b) => (
                        <tr key={b.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.id}</td>
                          <td className="px-4 py-3 font-medium text-ink">{new Date(b.scheduled_at).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              b.status === "confirmed" ? "bg-green-100 text-green-700" :
                              b.status === "pending" ? "bg-amber-100 text-amber-700" :
                              b.status === "completed" ? "bg-blue-100 text-blue-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-ink">GHS {(b.price_cents / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                      {bookings.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No bookings recorded yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: TUTOR PAYOUTS                                    */}
          {/* ======================================================== */}
          {tab === "payouts" && (
            <div className="space-y-6 fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <div>
                  <h2 className="text-base font-bold text-amber-900">Tutor Earnings &amp; Mobile Money Payouts</h2>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Settlement queue for completed lessons. Tutors receive 85% net of their lesson rates directly to their registered Mobile Money number.
                  </p>
                </div>
                <div className="text-right self-start sm:self-auto">
                  <p className="text-[10px] uppercase font-bold text-amber-800">Total Pending Payout</p>
                  <p className="text-xl font-bold font-serif text-amber-950">GHS {(stats.pendingPayoutsCents / 100).toFixed(2)}</p>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={payoutSearch}
                  onChange={e => setPayoutSearch(e.target.value)}
                  placeholder="Search tutor by name or phone number..."
                  className="h-10 w-full pl-9 pr-4 rounded-xl border border-input bg-card text-xs font-medium focus:ring-1 focus:ring-brand focus:outline-none"
                />
              </div>

              {/* Payouts Table */}
              <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Tutor Name</th>
                      <th className="px-4 py-3">Registered Mobile Money Number</th>
                      <th className="px-4 py-3">Amount Owed (85%)</th>
                      <th className="px-4 py-3 text-right">Settlement Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPayouts.map((p) => (
                      <tr key={p.teacher_id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-ink">{p.full_name}</td>
                        <td className="px-4 py-3 font-mono text-xs">{p.phone || "No phone configured"}</td>
                        <td className="px-4 py-3 font-bold text-amber-700">GHS {(p.amount_owed_cents / 100).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" className="bg-brand text-primary-foreground" onClick={() => markAsPaid(p.teacher_id, p.amount_owed_cents)}>
                            Mark as Paid &amp; Notify SMS
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredPayouts.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">All completed lessons are settled! No pending payouts.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: SUPPORT & DISPUTES                               */}
          {/* ======================================================== */}
          {tab === "support" && (
            <div className="space-y-6 fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-bold text-ink">Support Tickets &amp; Dispute Resolution</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage user inquiries, technical reports, and session disputes.</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-secondary rounded-xl border border-border self-start sm:self-auto">
                  {[
                    { id: "all", label: "All Tickets" },
                    { id: "appeals", label: `🚨 Suspension Appeals (${tickets.filter(t => t.category === "account_appeal").length})` },
                    { id: "open", label: `Open (${tickets.filter(t => t.status === "open").length})` },
                    { id: "in_progress", label: "In Progress" },
                    { id: "resolved", label: "Resolved" },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setTicketFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        ticketFilter === f.id ? "bg-card text-ink shadow-sm font-bold" : "text-muted-foreground hover:text-ink"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tickets Table */}
              <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Reporter</th>
                      <th className="px-4 py-3">Category &amp; Subject</th>
                      <th className="px-4 py-3">Issue Description</th>
                      <th className="px-4 py-3">Linked Session</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink">{t.reporter_name}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {t.reporter_role?.replace(/_/g, " ")} {t.reporter_email ? `· ${t.reporter_email}` : ""}
                          </p>
                          {t.reporter_phone && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] font-semibold text-brand">📞 {t.reporter_phone}</span>
                              <button
                                type="button"
                                title="Send SMS message to this user"
                                onClick={() => {
                                  setSmsPhone(t.reporter_phone!);
                                  setTab("sms");
                                  toast.info(`Switched to SMS Gateway for ${t.reporter_name}`);
                                }}
                                className="p-0.5 rounded text-brand hover:bg-brand/10 inline-flex items-center text-[10px] font-bold"
                              >
                                <MessageSquare className="size-3 mr-0.5" /> SMS
                              </button>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground/70 mt-1">{new Date(t.created_at).toLocaleString()}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-1 ${
                            t.category === "account_appeal"
                              ? "bg-red-100 text-red-800 border border-red-300 font-extrabold"
                              : "bg-secondary text-muted-foreground"
                          }`}>
                            {t.category === "account_appeal" ? "🚨 Suspension Appeal" : t.category.replace(/_/g, " ")}
                          </span>
                          <p className="font-medium text-xs text-ink">{t.subject}</p>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-xs text-muted-foreground line-clamp-3">{t.description}</p>
                          {t.resolution_notes && (
                            <p className="text-[11px] text-emerald-800 mt-1 font-medium bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                              Resolution: {t.resolution_notes}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {t.booking_scheduled_at ? (
                            <>
                              <p>{new Date(t.booking_scheduled_at).toLocaleDateString()}</p>
                              {t.booking_price_cents ? <p className="font-bold text-ink">GHS {(t.booking_price_cents / 100).toFixed(2)}</p> : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground/60 italic">General</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            t.status === "open" ? "bg-red-100 text-red-700" :
                            t.status === "in_progress" ? "bg-amber-100 text-amber-700" :
                            "bg-emerald-100 text-emerald-700"
                          }`}>
                            {t.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {t.category === "account_appeal" && t.reporter_id && t.status !== "resolved" && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1"
                                onClick={async () => {
                                  await handleSuspendUser(t.reporter_id!, false);
                                  await updateTicketStatus(t.id, "resolved");
                                  loadAllData();
                                }}
                              >
                                <UserCheck className="size-3.5" />
                                Reinstate &amp; Unblock
                              </Button>
                            )}
                            {t.status === "open" && (
                              <Button size="sm" variant="outline" onClick={() => updateTicketStatus(t.id, "in_progress")}>
                                Mark Reviewing
                              </Button>
                            )}
                            {t.status !== "resolved" && t.category !== "account_appeal" && (
                              <Button size="sm" onClick={() => updateTicketStatus(t.id, "resolved")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                Resolve &amp; Send SMS
                              </Button>
                            )}
                            {t.status === "resolved" && (
                              <span className="text-xs text-muted-foreground font-medium">✓ Closed</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredTickets.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No tickets in this status category.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 7: SMS GATEWAY                                      */}
          {/* ======================================================== */}
          {tab === "sms" && (
            <div className="space-y-6 fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl bg-brand/10 border border-brand/20">
                <div>
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="size-5 text-brand shrink-0" />
                    <h2 className="font-serif text-lg font-bold text-ink">Arkesel Ghana SMS Gateway</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Direct transactional and broadcast SMS delivery with sender ID <strong>QuickTutor</strong>.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 self-start sm:self-auto border border-emerald-200">
                  <CheckCircle2 className="size-3.5" />
                  Gateway Live
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Send Direct SMS */}
                <div className="lg:col-span-2 rounded-2xl bg-card p-5 sm:p-6 border border-border shadow-sm">
                  <h3 className="text-sm font-bold text-ink">Dispatch Test or Broadcast SMS</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Send immediate SMS messages to any Ghanaian mobile network (MTN, Telecel, AT).</p>

                  <form onSubmit={handleSendTestSms} className="mt-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-ink">Ghana Phone Number (e.g. 024XXXXXXX or +233XXXXXXXXX)</label>
                      <input
                        type="tel"
                        required
                        value={smsPhone}
                        onChange={(e) => setSmsPhone(e.target.value)}
                        placeholder="024 123 4567"
                        className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs font-medium focus:ring-1 focus:ring-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-semibold text-ink">SMS Message Body</label>
                        <span className="text-[10px] text-muted-foreground">{smsMessage.length}/160 chars ({Math.ceil(smsMessage.length / 160) || 1} SMS)</span>
                      </div>
                      <textarea
                        required
                        rows={3}
                        value={smsMessage}
                        onChange={(e) => setSmsMessage(e.target.value)}
                        placeholder="Type message content to dispatch via Arkesel Ghana SMS Gateway..."
                        className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs font-medium focus:ring-1 focus:ring-brand focus:outline-none resize-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={smsSending} className="gap-2">
                        <Send className="size-3.5" />
                        {smsSending ? "Dispatching SMS..." : "Dispatch SMS Now"}
                      </Button>
                    </div>
                  </form>
                </div>

                {/* Automation Rules Overview */}
                <div className="rounded-2xl bg-card p-5 sm:p-6 border border-border shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-ink">Automated SMS Triggers</h3>
                    <ul className="mt-4 space-y-2.5 text-xs text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Booking Created</strong>: Student &amp; tutor alerted.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Paystack Payment</strong>: Instant confirmation &amp; receipt.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>30m &amp; 5m Reminders</strong>: Prior-lesson alerts.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Lesson Cancelled</strong>: Timely cancellation notice.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>MoMo Payout</strong>: Remittance notification to tutor.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Support Resolved</strong>: Admin resolution notes delivered.</span>
                      </li>
                    </ul>
                  </div>
                  <p className="mt-5 text-[11px] text-muted-foreground border-t border-border pt-3">
                    Sender ID registered with NCA: <strong>QuickTutor</strong>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}