import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ users: 0, bookings: 0, revenueCents: 0 });
  const [bookings, setBookings] = useState<{ id: string; scheduled_at: string; status: string; price_cents: number }[]>([]);
  const [transactions, setTransactions] = useState<{ id: string; amount_cents: number; status: string; currency: string; created_at: string }[]>([]);
  const [pendingVerif, setPendingVerif] = useState<{ user_id: string; id_document_url: string | null; qualification_document_url: string | null; profiles: { full_name: string } | null }[]>([]);
  const [usersList, setUsersList] = useState<{ id: string; full_name: string | null; created_at: string }[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth", search: { mode: "login", role: "student" } }); return; }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/stats').then(r => r.json()).then(data => {
      if (data && !data.error) setStats({ users: data.users || 0, bookings: data.bookings || 0, revenueCents: data.revenueCents || 0 });
    });
    fetch('/api/admin/bookings').then(r => r.json()).then(data => {
      if (data?.bookings) setBookings(data.bookings);
    });
    fetch('/api/admin/transactions').then(r => r.json()).then(data => {
      if (data?.transactions) setTransactions(data.transactions);
    });
    fetch('/api/admin/users').then(r => r.json()).then(data => {
      if (data?.users) setUsersList(data.users);
    });
    loadPending();
  }, [isAdmin]);

  const loadPending = () => {
    fetch('/api/admin/verifications').then(r => r.json()).then(data => {
      if (data?.pending) setPendingVerif(data.pending);
    });
  };

  const openDoc = async (path: string) => {
    const { data } = await supabase.storage.from("verification-docs").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const decide = async (userId: string, approve: boolean) => {
    const notes = approve ? null : prompt("Reason for rejection (optional):") ?? null;
    const res = await fetch(`/api/admin/verifications/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approve, notes })
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed to update'); return; }
    toast.success(approve ? "Verified" : "Rejected");
    loadPending();
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
      <div className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="font-serif text-4xl">Admin</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[["Total users", stats.users], ["Bookings", stats.bookings], ["Revenue", `$${(stats.revenueCents / 100).toFixed(0)}`]].map(([l, v]) => (
            <div key={l as string} className="rounded-2xl bg-card p-6 ring-1 ring-black/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{l}</p>
              <p className="mt-2 font-serif text-3xl">{v}</p>
            </div>
          ))}
        </div>

        <section className="mt-12">
          <h2 className="font-serif text-2xl">Recent bookings</h2>
          <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-black/5">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Price</th></tr></thead>
              <tbody className="bg-card">
                {bookings.map((b) => (
                  <tr key={b.id} className="border-t border-border"><td className="px-4 py-3">{new Date(b.scheduled_at).toLocaleString()}</td><td className="px-4 py-3">{b.status}</td><td className="px-4 py-3">${(b.price_cents / 100).toFixed(0)}</td></tr>
                ))}
                {bookings.length === 0 && <tr><td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">No bookings yet</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl">Transactions</h2>
          <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-black/5">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody className="bg-card">
                {transactions.map((t) => (
                  <tr key={t.id} className="border-t border-border"><td className="px-4 py-3">{new Date(t.created_at).toLocaleString()}</td><td className="px-4 py-3">{t.currency.toUpperCase()} ${(t.amount_cents / 100).toFixed(2)}</td><td className="px-4 py-3">{t.status}</td></tr>
                ))}
                {transactions.length === 0 && <tr><td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">No transactions yet (Stripe wiring next step)</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl">Verification queue</h2>
          <div className="mt-4 space-y-3">
            {pendingVerif.length === 0 && <p className="text-sm text-muted-foreground">No pending verifications.</p>}
            {pendingVerif.map((p) => (
              <div key={p.user_id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-black/5">
                <span className="text-sm font-medium">{p.profiles?.full_name || "Tutor"}</span>
                {p.id_document_url && <button onClick={() => openDoc(p.id_document_url!)} className="text-xs text-brand hover:underline">View ID</button>}
                {p.qualification_document_url && <button onClick={() => openDoc(p.qualification_document_url!)} className="text-xs text-brand hover:underline">View qualification</button>}
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => decide(p.user_id, false)}>Reject</Button>
                  <Button size="sm" onClick={() => decide(p.user_id, true)}>Approve</Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl">Recent Users</h2>
          <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-black/5">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">ID</th><th className="px-4 py-3">Joined</th></tr></thead>
              <tbody className="bg-card">
                {usersList.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3">{u.full_name || "Unknown"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {usersList.length === 0 && <tr><td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">No users found</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}