import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TrendingUp, Wallet, Users, Calendar, BadgePercent, ArrowUpRight, ShieldCheck, MessageSquareText, Send, CheckCircle2, BarChart3, UserX, UserCheck, AlertTriangle } from "lucide-react";

type Ticket = {
  id: string;
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

import { getBackendUrl } from "@/lib/config";

const BACKEND = getBackendUrl();

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
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
  const [transactions, setTransactions] = useState<{
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
  }[]>([]);
  const [pendingVerif, setPendingVerif] = useState<{ user_id: string; id_document_url: string | null; qualification_document_url: string | null; profiles: { full_name: string } | null }[]>([]);
  const [usersList, setUsersList] = useState<{ id: string; full_name: string | null; email: string | null; role: string; suspended: boolean; created_at: string }[]>([]);
  const [payouts, setPayouts] = useState<{ teacher_id: string; full_name: string; phone: string | null; amount_owed_cents: number }[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Analytics state
  const [analytics, setAnalytics] = useState<{
    monthly: { month: string; revenueCents: number; bookings: number }[];
    userGrowth: { month: string; users: number }[];
    topSubjects: { name: string; count: number }[];
    bookingsByStatus: { status: string; count: number }[];
  } | null>(null);

  // SMS Live Dispatch State
  const [smsPhone, setSmsPhone] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [smsSending, setSmsSending] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth", search: { mode: "login", role: "student" } }); return; }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const token = localStorage.getItem("token");
    const authHeaders = { Authorization: `Bearer ${token}` };

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
      })
      .catch(console.error);

    fetch(`${BACKEND}/api/admin/bookings`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => {
        if (data?.bookings) setBookings(data.bookings);
      })
      .catch(console.error);

    fetch(`${BACKEND}/api/admin/transactions`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => {
        if (data?.transactions) setTransactions(data.transactions);
      })
      .catch(console.error);

    fetch(`${BACKEND}/api/admin/users`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => {
        if (data?.users) setUsersList(data.users);
      })
      .catch(console.error);

    loadPayouts();
    loadPending();
    loadTickets();

    fetch(`${BACKEND}/api/admin/analytics`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => { if (data && !data.error) setAnalytics(data); })
      .catch(console.error);
  }, [isAdmin]);

  const loadTickets = () => {
    const token = localStorage.getItem('token');
    fetch(`${BACKEND}/api/admin/tickets`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data?.tickets) setTickets(data.tickets);
      })
      .catch(console.error);
  };

  const loadPayouts = () => {
    const token = localStorage.getItem('token');
    fetch(`${BACKEND}/api/admin/payouts`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data?.payouts) setPayouts(data.payouts);
      })
      .catch(console.error);
  };

  const loadPending = () => {
    const token = localStorage.getItem('token');
    fetch(`${BACKEND}/api/admin/verifications`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data?.pending) setPendingVerif(data.pending);
      })
      .catch(console.error);
  };

  const openDoc = async (path: string) => {
    const { data } = await supabase.storage.from("verification-docs").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const decide = async (userId: string, approve: boolean) => {
    const notes = approve ? null : prompt("Reason for rejection (optional):") ?? null;
    const token = localStorage.getItem('token');
    const res = await fetch(`${BACKEND}/api/admin/verifications/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ approve, notes })
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed to update'); return; }
    toast.success(approve ? "Verified" : "Rejected");
    loadPending();
  };

  const markAsPaid = async (teacher_id: string, amount_cents: number) => {
    if (!confirm(`Mark GHS ${(amount_cents / 100).toFixed(2)} as paid?`)) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`${BACKEND}/api/admin/payouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ teacher_id, amount_cents })
    });
    if (res.ok) {
      toast.success("Payout marked as paid");
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
    const token = localStorage.getItem('token');
    const res = await fetch(`${BACKEND}/api/admin/tickets/${ticketId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status, resolution_notes: notes })
    });
    if (res.ok) {
      toast.success(`Ticket marked as ${status.replace('_', ' ')}`);
      loadTickets();
    } else {
      toast.error("Failed to update ticket status");
    }
  };

  const handleSuspendUser = async (userId: string, suspend: boolean) => {
    const action = suspend ? 'suspend' : 'unsuspend';
    const userName = usersList.find(u => u.id === userId)?.full_name || 'user';
    if (!confirm(`Are you sure you want to ${action} ${userName}? ${suspend ? 'They will not be able to log in.' : 'They will regain full access.'}`)) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`${BACKEND}/api/admin/users/${userId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

  if (loading) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-surface">
        <SiteNav />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-serif text-3xl">Admin only</h1>
          <p className="mt-2 text-sm text-muted-foreground">You need the admin role to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-brand">Management Portal</p>
            <h1 className="font-serif text-2xl sm:text-4xl font-bold mt-1 text-ink">Admin Dashboard</h1>
          </div>
          <div className="self-start sm:self-auto flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs font-semibold text-emerald-700">
            <BadgePercent className="size-4 text-emerald-600 shrink-0" />
            <span>Platform Commission Rate: <strong>{stats.commissionRate}%</strong></span>
          </div>
        </div>

        {/* ── Executive Financial & Operational Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
          {/* Card 1: Admin Net Profit */}
          <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-500/10 via-card to-card p-5 sm:p-6 border-2 border-emerald-500/30 shadow-md relative overflow-hidden group hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-mono">
                Admin Net Earnings
              </span>
              <div className="size-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
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
              <p className="text-[11px] text-muted-foreground">After tutor deductions</p>
            </div>
          </div>

          {/* Card 2: Gross Lesson Volume */}
          <div className="rounded-2xl sm:rounded-3xl bg-card p-5 sm:p-6 border border-border/80 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Gross Lesson Volume
              </span>
              <div className="size-9 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
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

          {/* Card 3: Tutor Payouts Share */}
          <div className="rounded-2xl sm:rounded-3xl bg-card p-5 sm:p-6 border border-border/80 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Tutor Share (85%)
              </span>
              <div className="size-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
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

          {/* Card 4: Community Users */}
          <div className="rounded-2xl sm:rounded-3xl bg-card p-5 sm:p-6 border border-border/80 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Platform Activity
              </span>
              <div className="size-9 rounded-2xl bg-secondary text-ink flex items-center justify-center">
                <Users className="size-4" />
              </div>
            </div>
            <p className="mt-3 font-serif text-2xl sm:text-3xl font-bold text-ink">
              {stats.users} <span className="text-base font-normal text-muted-foreground">Users</span>
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {stats.bookings} total bookings made
            </p>
          </div>
        </div>

        {/* ── Section: Analytics Charts ── */}
        {analytics && (
          <section className="mt-8 sm:mt-12">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="size-9 rounded-xl bg-brand/10 flex items-center justify-center">
                <BarChart3 className="size-5 text-brand" />
              </div>
              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">Platform Analytics</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Revenue, bookings & user growth over the last 6 months</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Revenue + Bookings bar chart */}
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

              {/* User Growth chart */}
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

              {/* Top Subjects chart */}
              {analytics.topSubjects.length > 0 && (
                <div className="rounded-2xl bg-card border border-border shadow-sm p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Top Subjects by Bookings</p>
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

              {/* Bookings by Status donut-style */}
              {analytics.bookingsByStatus.length > 0 && (
                <div className="rounded-2xl bg-card border border-border shadow-sm p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Bookings by Status</p>
                  <div className="grid grid-cols-2 gap-3">
                    {analytics.bookingsByStatus.map(b => (
                      <div key={b.status} className={`rounded-xl p-3 border ${
                        b.status === 'completed' ? 'bg-emerald-50 border-emerald-200' :
                        b.status === 'confirmed' ? 'bg-blue-50 border-blue-200' :
                        b.status === 'pending' ? 'bg-amber-50 border-amber-200' :
                        'bg-red-50 border-red-200'
                      }`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${
                          b.status === 'completed' ? 'text-emerald-700' :
                          b.status === 'confirmed' ? 'text-blue-700' :
                          b.status === 'pending' ? 'text-amber-700' :
                          'text-red-700'
                        }`}>{b.status}</p>
                        <p className="mt-1 text-2xl font-bold text-ink">{b.count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Section: Recent Bookings ── */}
        <section className="mt-8 sm:mt-12">
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">Recent Bookings</h2>
          <div className="mt-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="min-w-[500px] sm:min-w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Price</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink">{new Date(b.scheduled_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          b.status === "confirmed" ? "bg-green-100 text-green-700" :
                          b.status === "pending" ? "bg-amber-100 text-amber-700" :
                          b.status === "completed" ? "bg-blue-100 text-blue-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink">GHS {(b.price_cents / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                  {bookings.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">No bookings yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Section: Payment & Transaction Records ── */}
        <section className="mt-8 sm:mt-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">Payment &amp; Transaction Records</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Comprehensive audit log of all Paystack student transactions and session bookings.</p>
            </div>
            <span className="self-start sm:self-auto text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              {transactions.filter(t => t.status === 'succeeded').length} Succeeded
            </span>
          </div>

          <div className="mt-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="min-w-[620px] sm:min-w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Transaction Date</th>
                    <th className="px-4 py-3">Reference / ID</th>
                    <th className="px-4 py-3">Student &amp; Session</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{new Date(t.transaction_date || t.created_at).toLocaleDateString()}</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(t.transaction_date || t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-brand">{t.paystack_reference || 'dev-ref'}</p>
                        <p className="text-[10px] text-muted-foreground/70">ID: {t.id.slice(0, 8)}...</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink">{t.student_name || 'Student'}</p>
                        <p className="text-[11px] text-muted-foreground">Tutor: {t.teacher_name || 'Assigned Tutor'}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink">
                        {t.currency?.toUpperCase() || 'GHS'} {(t.amount_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          t.status === 'succeeded' ? 'bg-emerald-100 text-emerald-800' :
                          t.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No payment transactions recorded yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Section: Support & Dispute Tickets ── */}
        <section className="mt-8 sm:mt-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">Support &amp; Dispute Tickets</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Review problems and disputes reported by students and teachers.</p>
            </div>
            <span className="self-start sm:self-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
              {tickets.filter(t => t.status === 'open').length} Open
            </span>
          </div>

          <div className="mt-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="min-w-[700px] sm:min-w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Reporter</th>
                    <th className="px-4 py-3">Category &amp; Subject</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink">{t.reporter_name}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{t.reporter_role} {t.reporter_phone ? `· ${t.reporter_phone}` : ""}</p>
                        <p className="text-[10px] text-muted-foreground/70">{new Date(t.created_at).toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          {t.category.replace(/_/g, " ")}
                        </span>
                        <p className="font-medium text-xs text-ink">{t.subject}</p>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-muted-foreground line-clamp-3">{t.description}</p>
                        {t.resolution_notes && (
                          <p className="text-[11px] text-green-700 mt-1 font-medium bg-green-50 p-1.5 rounded-lg border border-green-200">
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
                        ) : "General"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          t.status === 'open' ? 'bg-red-100 text-red-700' :
                          t.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {t.status === 'open' && (
                            <Button size="sm" variant="outline" onClick={() => updateTicketStatus(t.id, 'in_progress')}>
                              Review
                            </Button>
                          )}
                          {t.status !== 'resolved' && (
                            <Button size="sm" onClick={() => updateTicketStatus(t.id, 'resolved')} className="bg-green-600 hover:bg-green-700 text-white">
                              Resolve
                            </Button>
                          )}
                          {t.status === 'resolved' && (
                            <span className="text-xs text-muted-foreground font-medium">✓ Closed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tickets.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        No support tickets submitted yet. All clear!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Section: Tutor Payouts ── */}
        <section className="mt-8 sm:mt-12">
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">Tutor Payouts</h2>
          <div className="mt-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="min-w-[520px] sm:min-w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Tutor</th>
                    <th className="px-4 py-3">MoMo Number</th>
                    <th className="px-4 py-3">Owed</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {payouts.map((p) => (
                    <tr key={p.teacher_id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-ink">{p.full_name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.phone || "Not set"}</td>
                      <td className="px-4 py-3 font-bold text-amber-700">GHS {(p.amount_owed_cents / 100).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" onClick={() => markAsPaid(p.teacher_id, p.amount_owed_cents)}>Mark as Paid</Button>
                      </td>
                    </tr>
                  ))}
                  {payouts.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">All tutors are paid up!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Section: Verification queue ── */}
        <section className="mt-8 sm:mt-12">
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">Verification Queue</h2>
          <div className="mt-4 space-y-3">
            {pendingVerif.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                No pending verifications right now.
              </div>
            )}
            {pendingVerif.map((p) => (
              <div key={p.user_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-card p-4 sm:p-5 border border-border shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-ink">{p.profiles?.full_name || "Tutor"}</span>
                  {p.id_document_url && (
                    <button onClick={() => openDoc(p.id_document_url!)} className="text-xs font-semibold text-brand hover:underline">
                      📄 View ID
                    </button>
                  )}
                  {p.qualification_document_url && (
                    <button onClick={() => openDoc(p.qualification_document_url!)} className="text-xs font-semibold text-brand hover:underline">
                      🎓 View Qualification
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button size="sm" variant="outline" onClick={() => decide(p.user_id, false)}>Reject</Button>
                  <Button size="sm" onClick={() => decide(p.user_id, true)}>Approve</Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section: Arkesel SMS Gateway ── */}
        <section className="mt-8 sm:mt-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <MessageSquareText className="size-5 text-brand shrink-0" />
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">Arkesel SMS Gateway</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Automated transactional SMS for Ghanaian phone numbers (Booking confirmations, lesson reminders, payout notices, and support resolutions).
              </p>
            </div>
            <div className="self-start sm:self-auto flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
              <CheckCircle2 className="size-3.5" />
              Gateway Connected
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl bg-card p-4 sm:p-6 border border-border shadow-sm">
              <h3 className="text-sm font-semibold text-ink">Send Test or Direct Broadcast SMS</h3>
              <form onSubmit={handleSendTestSms} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">Ghana Phone Number (e.g. 024XXXXXXX or +233XXXXXXXXX)</label>
                  <input
                    type="tel"
                    required
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                    placeholder="024 123 4567"
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">Message Content</label>
                  <textarea
                    required
                    rows={3}
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    placeholder="Type message to send via Arkesel Ghana SMS Gateway..."
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={smsSending} className="gap-2 w-full sm:w-auto">
                    <Send className="size-4" />
                    {smsSending ? "Sending SMS..." : "Dispatch Live SMS"}
                  </Button>
                </div>
              </form>
            </div>

            <div className="rounded-2xl bg-secondary/50 p-4 sm:p-6 border border-border shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">Automated SMS Triggers</h3>
                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-brand font-bold">✓</span>
                    <span><strong>Booking Created</strong>: Student &amp; tutor alerted instantly.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-brand font-bold">✓</span>
                    <span><strong>Paystack Payment</strong>: Instant confirmation &amp; room link.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-brand font-bold">✓</span>
                    <span><strong>Lesson Cancelled</strong>: Timely notification to reschedule.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-brand font-bold">✓</span>
                    <span><strong>MoMo Payout</strong>: Remittance alert with net earnings.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-brand font-bold">✓</span>
                    <span><strong>Support Resolved</strong>: Admin resolution notes delivered.</span>
                  </li>
                </ul>
              </div>
              <p className="mt-4 text-[11px] text-muted-foreground border-t border-border/60 pt-3">
                Sender ID registered with NCA as <strong>QuickTutor</strong>.
              </p>
            </div>
          </div>
        </section>

        {/* ── Section: Users Management ── */}
        <section className="mt-8 sm:mt-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">User Management</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Manage accounts — suspend users who violate platform policies.</p>
            </div>
            <div className="flex gap-2 self-start sm:self-auto">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                {usersList.filter(u => u.suspended).length} Suspended
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                {usersList.filter(u => !u.suspended).length} Active
              </span>
            </div>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="min-w-[680px] sm:min-w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {usersList.map((u) => (
                    <tr key={u.id} className={`hover:bg-secondary/40 transition-colors ${u.suspended ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink">{u.full_name || "Unknown"}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{u.id.slice(0, 8)}...</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{u.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          u.role === 'teacher' ? 'bg-brand/10 text-brand' :
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          'bg-secondary text-muted-foreground'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {u.suspended ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            <AlertTriangle className="size-3" /> Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="size-3" /> Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.role !== 'admin' && (
                          u.suspended ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              onClick={() => handleSuspendUser(u.id, false)}
                            >
                              <UserCheck className="size-3.5" />
                              Reinstate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
                              onClick={() => handleSuspendUser(u.id, true)}
                            >
                              <UserX className="size-3.5" />
                              Suspend
                            </Button>
                          )
                        )}
                        {u.role === 'admin' && (
                          <span className="text-xs text-muted-foreground font-medium">Admin — protected</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {usersList.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}