import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  AlertCircle,
  HelpCircle,
  MessageSquare,
  CheckCircle,
  Clock,
  ShieldCheck,
  Send,
  Phone,
  Mail,
  FileQuestion,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BACKEND = (import.meta as any).env.VITE_BACKEND_URL || "http://localhost:4000";

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "Help & Support Center — Quick Tutor" },
      { name: "description", content: "Get help with lessons, payments, disputes, or submit feedback to the Quick Tutor support team." },
    ],
  }),
});

const CATEGORIES = [
  { value: "technical_issue", label: "Technical & Video/Audio Problem" },
  { value: "payment_dispute", label: "Payment or Payout / MoMo Dispute" },
  { value: "tutor_no_show", label: "Tutor No-Show (Tutor did not attend)" },
  { value: "student_no_show", label: "Student No-Show (Student did not attend)" },
  { value: "lesson_quality", label: "Lesson Quality or Incomplete Session" },
  { value: "feedback", label: "Platform Feedback & Feature Request" },
  { value: "other", label: "Other Inquiry / Help Request" },
];

const FAQS = [
  {
    q: "How does payment and tutor payout work?",
    a: "Students pay securely via Mobile Money (MTN MoMo, Telecel Cash, AirtelTigo) or Card. QuickTutor deducts a standard 15% platform commission to cover video infrastructure, and 85% is remitted directly to the tutor's Mobile Money wallet upon lesson completion.",
  },
  {
    q: "What happens if a tutor or student doesn't show up?",
    a: "If a party is more than 15 minutes late without communication, you can submit a 'No-Show' report on this support page. Admin will investigate and process an automatic refund or session credit.",
  },
  {
    q: "How do I enter my live video lesson?",
    a: "Go to your Student or Teacher Dashboard, click on your confirmed session, and press 'Enter Lesson Room'. Make sure your camera and microphone permissions are enabled.",
  },
  {
    q: "How fast does Admin respond to support tickets?",
    a: "Our Ghana-based administration team investigates and responds to disputes within 2 to 6 hours during active hours (7:00 AM – 10:00 PM GMT).",
  },
];

function SupportPage() {
  const { user, isAuthed } = useAuth();
  const [activeTab, setActiveTab] = useState<"submit" | "tickets" | "faq">("submit");
  const [category, setCategory] = useState("technical_issue");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const loadMyTickets = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoadingTickets(true);
    try {
      const res = await fetch(`${BACKEND}/api/support/my-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyTickets(data.tickets ?? []);
      }
    } catch (e) {}
    setLoadingTickets(false);
  };

  useEffect(() => {
    if (isAuthed) {
      loadMyTickets();
    }
  }, [isAuthed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error("Please provide a subject and detailed description");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please log in to submit a ticket so we can track your response");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND}/api/support/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          description: description.trim(),
        }),
      });

      const data = await res.json();
      setSubmitting(false);

      if (res.ok) {
        toast.success("Support ticket submitted! Admin will investigate and respond shortly.");
        setSubject("");
        setDescription("");
        loadMyTickets();
        setActiveTab("tickets");
      } else {
        toast.error(data?.error || "Failed to submit support request");
      }
    } catch (err) {
      setSubmitting(false);
      toast.error("Error submitting support request");
    }
  };

  return (
    <div className="min-h-screen bg-surface text-ink selection:bg-brand/10 flex flex-col justify-between">
      <div>
        <SiteNav />

        <main className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
          {/* Hero Banner */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 border border-brand/20 px-3.5 py-1 text-xs font-semibold text-brand mb-4">
              <ShieldCheck className="size-3.5" />
              QuickTutor Resolution &amp; Help Desk
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold text-ink tracking-tight">
              Help, Support &amp; Feedback
            </h1>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">
              Have a problem with a session, payment dispute, or feature feedback? Submit your ticket below and our team will resolve it quickly.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center justify-center gap-2 mb-8 border-b border-border/80 pb-4">
            <button
              onClick={() => setActiveTab("submit")}
              className={`px-5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === "submit"
                  ? "bg-brand text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-ink"
              }`}
            >
              Submit Ticket / Feedback
            </button>
            {isAuthed && (
              <button
                onClick={() => setActiveTab("tickets")}
                className={`relative px-5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                  activeTab === "tickets"
                    ? "bg-brand text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-ink"
                }`}
              >
                My Tickets &amp; Responses
                {myTickets.length > 0 && (
                  <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                    {myTickets.length}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setActiveTab("faq")}
              className={`px-5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === "faq"
                  ? "bg-brand text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-ink"
              }`}
            >
              Frequently Asked Questions
            </button>
          </div>

          {/* TAB 1: SUBMIT FORM */}
          {activeTab === "submit" && (
            <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] items-start">
              <div className="rounded-3xl bg-card border border-border p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
                    <Send className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold text-ink">Submit a Request</h3>
                    <p className="text-xs text-muted-foreground">Admin will review your problem and respond with resolution notes.</p>
                  </div>
                </div>

                {!isAuthed ? (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-center">
                    <AlertCircle className="size-8 text-amber-600 mx-auto mb-2" />
                    <h4 className="font-bold text-sm text-amber-900">Sign in to Submit Support Tickets</h4>
                    <p className="text-xs text-amber-800 mt-1 max-w-sm mx-auto">
                      Please sign in with your student or teacher account so we can link your issue to your account and send live responses.
                    </p>
                    <Link
                      to="/auth"
                      className="mt-4 inline-block px-6 py-2 rounded-full bg-brand text-primary-foreground text-xs font-semibold shadow-sm hover:bg-brand/90"
                    >
                      Sign In Now
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-ink block mb-1.5">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-xl border border-input bg-surface px-3.5 py-2.5 text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-ink block mb-1.5">Subject / Brief Summary</label>
                      <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. Video call disconnected during lesson with teacher"
                        className="w-full rounded-xl border border-input bg-surface px-3.5 py-2.5 text-xs text-ink placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-ink block mb-1.5">Detailed Description &amp; Feedback</label>
                      <textarea
                        required
                        rows={5}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Please include full details (date of lesson, names, payment reference, or what went wrong) so we can help you right away..."
                        className="w-full rounded-xl border border-input bg-surface p-3.5 text-xs text-ink placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full h-11 rounded-xl bg-brand text-primary-foreground font-semibold text-xs shadow-md hover:bg-brand/90"
                      >
                        {submitting ? "Submitting Request..." : "Send Ticket to QuickTutor Admin"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {/* Direct Support Channels */}
              <div className="space-y-6">
                <div className="rounded-3xl bg-secondary/70 border border-border p-6 shadow-sm space-y-4">
                  <h4 className="font-serif text-lg font-bold text-ink">Direct Support Channels</h4>
                  <p className="text-xs text-muted-foreground">Prefer direct assistance? Reach out to our Ghana support desk directly.</p>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
                      <div className="size-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Phone className="size-4" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground">Direct Hotline / WhatsApp</p>
                        <p className="text-xs font-bold text-ink">+233 (0) 24 123 4567</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
                      <div className="size-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <Mail className="size-4" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground">Email Support</p>
                        <p className="text-xs font-bold text-ink">support@quicktutor.gh</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
                      <div className="size-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Clock className="size-4" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground">Support Operating Hours</p>
                        <p className="text-xs font-bold text-ink">Mon – Sun: 7:00 AM – 10:00 PM GMT</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-emerald-950 text-white p-6 shadow-md relative overflow-hidden">
                  <Sparkles className="size-8 text-emerald-400 mb-2" />
                  <h4 className="font-serif text-lg font-bold">100% Satisfaction Guarantee</h4>
                  <p className="text-xs text-white/80 mt-1 leading-relaxed">
                    If you experience any technical or tutor issue during a lesson, admin will provide a full reschedule or refund.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MY TICKETS & ADMIN RESPONSES */}
          {activeTab === "tickets" && isAuthed && (
            <div className="rounded-3xl bg-card border border-border p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-xl font-bold text-ink">My Submitted Support Tickets</h3>
                  <p className="text-xs text-muted-foreground">Track ticket statuses and review admin responses and dispute resolutions.</p>
                </div>
                <button
                  onClick={() => setActiveTab("submit")}
                  className="px-4 py-2 rounded-xl bg-brand text-primary-foreground text-xs font-semibold hover:bg-brand/90"
                >
                  + New Ticket
                </button>
              </div>

              {loadingTickets ? (
                <p className="py-12 text-center text-xs text-muted-foreground">Loading your tickets...</p>
              ) : myTickets.length === 0 ? (
                <div className="py-12 text-center">
                  <FileQuestion className="size-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium text-ink">No support tickets found</p>
                  <p className="text-xs text-muted-foreground mt-1">You haven't submitted any dispute or support requests yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {myTickets.map((t) => (
                    <div key={t.id} className="py-5 space-y-3">
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

                      <p className="text-xs text-muted-foreground bg-surface/70 p-3.5 rounded-2xl border border-border/70">
                        <strong className="text-ink">Your Description:</strong> {t.description}
                      </p>

                      {t.resolution_notes ? (
                        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 space-y-1.5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                              <ShieldCheck className="size-4 text-emerald-700" />
                              <span>Admin Resolution &amp; Official Response:</span>
                            </p>
                            {t.resolved_at && (
                              <span className="text-[10px] text-emerald-700">Resolved on {new Date(t.resolved_at).toLocaleString()}</span>
                            )}
                          </div>
                          <p className="text-emerald-900 font-medium pl-5 leading-relaxed">{t.resolution_notes}</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-amber-50/70 border border-amber-200/60 p-3 text-xs text-amber-800 flex items-center gap-2">
                          <Clock className="size-4 text-amber-600 shrink-0" />
                          <span>Admin is actively investigating your request. You will be notified when resolved.</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FAQS */}
          {activeTab === "faq" && (
            <div className="rounded-3xl bg-card border border-border p-6 sm:p-8 shadow-sm space-y-4">
              <div>
                <h3 className="font-serif text-xl font-bold text-ink">Frequently Asked Questions</h3>
                <p className="text-xs text-muted-foreground">Find immediate answers to standard questions about lessons, payouts and disputes.</p>
              </div>

              <div className="space-y-3 pt-2">
                {FAQS.map((faq, idx) => (
                  <div key={idx} className="rounded-2xl border border-border overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                      className="w-full flex items-center justify-between p-4 text-left font-semibold text-xs text-ink hover:bg-secondary/50 transition-colors"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`size-4 text-muted-foreground transition-transform ${openFaq === idx ? "rotate-180" : ""}`} />
                    </button>
                    {openFaq === idx && (
                      <div className="p-4 pt-0 text-xs text-muted-foreground bg-secondary/20 leading-relaxed border-t border-border/40">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
