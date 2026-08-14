import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import {
  ShieldCheck,
  FileText,
  Lock,
  CreditCard,
  UserCheck,
  AlertTriangle,
  Scale,
  Clock,
  CheckCircle2,
  Phone,
  HelpCircle,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/terms")({
  component: TermsAndPoliciesPage,
  head: () => ({
    meta: [
      { title: "Terms of Service & Platform Policies — QuickTutor Ghana" },
      { name: "description", content: "Official platform terms, escrow payment policies, tutor guidelines, cancellation terms, and privacy protection for QuickTutor Ghana." },
    ],
  }),
});

type PolicyTab = "terms" | "payments" | "tutors" | "privacy" | "disputes";

function TermsAndPoliciesPage() {
  const [activeTab, setActiveTab] = useState<PolicyTab>("terms");

  const TABS = [
    { id: "terms" as PolicyTab, label: "Terms of Service", icon: FileText },
    { id: "payments" as PolicyTab, label: "Payment & Escrow Policy", icon: CreditCard },
    { id: "tutors" as PolicyTab, label: "Tutor Code of Conduct", icon: UserCheck },
    { id: "disputes" as PolicyTab, label: "Cancellations & Refunds", icon: Scale },
    { id: "privacy" as PolicyTab, label: "Privacy & Data Protection", icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-surface text-ink flex flex-col justify-between">
      <SiteNav />

      <main className="flex-1 py-12 md:py-16">
        <div className="mx-auto max-w-5xl px-6">
          {/* Header Banner */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider mb-4">
              <ShieldCheck className="size-4" />
              Official Platform Policies
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-ink">
              Terms &amp; Conditions
            </h1>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Designed to protect students, empower certified Ghanaian educators, and guarantee transparent transactions across Ghana.
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground font-mono">
              Last updated: August 2026 · Compliant with the Laws of Ghana
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex overflow-x-auto gap-2 p-1.5 rounded-2xl bg-secondary/80 border border-border mb-10 no-scrollbar">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? "bg-card text-brand shadow-sm border border-border"
                      : "text-muted-foreground hover:text-ink hover:bg-card/50"
                  }`}
                >
                  <Icon className={`size-4 ${isActive ? "text-brand" : "text-muted-foreground"}`} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content Panels */}
          <div className="rounded-3xl bg-card border border-border p-6 sm:p-10 shadow-sm leading-relaxed space-y-8">
            {/* ── TAB 1: TERMS OF SERVICE ── */}
            {activeTab === "terms" && (
              <div className="space-y-6 fade-in">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <div className="size-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-ink">1. Platform Terms of Service</h2>
                    <p className="text-xs text-muted-foreground">General rules governing student and educator usage on QuickTutor.</p>
                  </div>
                </div>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-brand" /> 1.1 Acceptance of Terms
                  </h3>
                  <p className="text-sm text-muted-foreground pl-4">
                    By creating an account, booking a session, or teaching on QuickTutor Ghana, you agree to comply with and be legally bound by these Terms of Service. If you do not agree to these terms, you may not access or use our services.
                  </p>
                </section>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-brand" /> 1.2 Educational Scope (BECE, WASSCE &amp; Remedials)
                  </h3>
                  <p className="text-sm text-muted-foreground pl-4">
                    QuickTutor Ghana is an educational matching and live online tutoring marketplace dedicated to Ghanaian curricula (GES, WAEC, BECE, WASSCE, NOV/DEC) and foundational academic subjects. Tutors provide supplemental academic tutoring and guidance.
                  </p>
                </section>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-brand" /> 1.3 User Accounts &amp; Security
                  </h3>
                  <p className="text-sm text-muted-foreground pl-4">
                    Users must provide accurate, current, and complete registration information. You are responsible for safeguarding your password and account credentials. Any activity occurring under your account is your legal responsibility.
                  </p>
                </section>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-brand" /> 1.4 Student Code of Conduct
                  </h3>
                  <ul className="text-sm text-muted-foreground pl-8 list-disc space-y-1.5">
                    <li>Treat all tutors with dignity, respect, and academic professionalism.</li>
                    <li>Arrive in the live classroom on time for scheduled sessions.</li>
                    <li>Do not share, record, or distribute live classroom video feeds or tutor materials without explicit permission.</li>
                    <li>Refrain from abusive, harassing, or inappropriate conduct during live video sessions.</li>
                  </ul>
                </section>
              </div>
            )}

            {/* ── TAB 2: PAYMENT & ESCROW POLICY ── */}
            {activeTab === "payments" && (
              <div className="space-y-6 fade-in">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <div className="size-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <CreditCard className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-ink">2. Escrow Protection &amp; Payment Terms</h2>
                    <p className="text-xs text-muted-foreground">How student payments, admin escrow vaults, and tutor MoMo payouts work.</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <ShieldCheck className="size-4 text-emerald-600" />
                    100% Platform Escrow Protection Guarantee
                  </p>
                  <p className="pl-5 leading-relaxed">
                    Student payments NEVER go directly to the tutor at booking time. 100% of student funds are held safely in the QuickTutor Admin Vault until the lesson is successfully completed.
                  </p>
                </div>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-600" /> 2.1 Currency &amp; Mobile Money Processing
                  </h3>
                  <p className="text-sm text-muted-foreground pl-4">
                    All prices and bookings on QuickTutor are denominated in <strong>Ghanaian Cedis (GHS)</strong>. Payments are processed securely via Paystack, supporting <strong>MTN Mobile Money, Telecel Cash, AT Money, and Visa/Mastercard</strong>.
                  </p>
                </section>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-600" /> 2.2 Commission Breakdown &amp; Take-Home Pay
                  </h3>
                  <p className="text-sm text-muted-foreground pl-4">
                    To maintain video servers, WebRTC infrastructure, SMS notifications, and 24/7 student support, QuickTutor retains a <strong>15% platform fee</strong>. The tutor receives <strong>85% net take-home pay</strong> on every completed lesson.
                  </p>
                  <div className="mt-2 p-3 rounded-xl bg-secondary/70 border border-border text-xs text-ink space-y-1 font-mono">
                    <p>• Student Pays: <strong>GHS 100.00</strong></p>
                    <p>• Platform Fee (15%): <span className="text-destructive font-semibold">-GHS 15.00</span></p>
                    <p>• Tutor Net Take-Home (85%): <strong className="text-emerald-700 font-bold">GHS 85.00</strong></p>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-600" /> 2.3 Tutor Mobile Money Disbursement
                  </h3>
                  <p className="text-sm text-muted-foreground pl-4">
                    Upon lesson completion and dispute window clearance, the Admin releases the tutor's net earnings directly to their registered Mobile Money number. Tutors receive an instant SMS confirmation via Arkesel when funds are remitted.
                  </p>
                </section>
              </div>
            )}

            {/* ── TAB 3: TUTOR CODE OF CONDUCT ── */}
            {activeTab === "tutors" && (
              <div className="space-y-6 fade-in">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <div className="size-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <UserCheck className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-ink">3. Tutor Verification &amp; Code of Conduct</h2>
                    <p className="text-xs text-muted-foreground">Standards, credentials, and ethics expected from all verified educators.</p>
                  </div>
                </div>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-amber-500" /> 3.1 Verification &amp; Ghana Card Requirement
                  </h3>
                  <p className="text-sm text-muted-foreground pl-4">
                    Every tutor must submit a valid government-issued Ghana Card (or Passport) alongside academic degree/diploma certificates before their profile is certified with the "Verified Educator" badge on the discovery page.
                  </p>
                </section>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-amber-500" /> 3.2 Punctuality &amp; Lesson Attendance
                  </h3>
                  <p className="text-sm text-muted-foreground pl-4">
                    Tutors are expected to enter the classroom 2–3 minutes before the scheduled start time. If an emergency arises, tutors must notify the student and reschedule via the platform at least 2 hours in advance.
                  </p>
                </section>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-amber-500" /> 3.3 Strict Anti-Circumvention Policy
                  </h3>
                  <p className="text-sm text-muted-foreground pl-4">
                    Soliciting students for private off-platform payments or bypassing the escrow system is strictly prohibited. Violating this rule results in immediate account deactivation and forfeiture of pending unverified payouts.
                  </p>
                </section>
              </div>
            )}

            {/* ── TAB 4: CANCELLATIONS & REFUNDS ── */}
            {activeTab === "disputes" && (
              <div className="space-y-6 fade-in">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <div className="size-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Scale className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-ink">4. Cancellations, Rescheduling &amp; Refunds</h2>
                    <p className="text-xs text-muted-foreground">Clear rules for changing session times and resolving disputed lessons.</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
                    <p className="font-bold text-xs text-ink flex items-center gap-1.5">
                      <Clock className="size-4 text-brand" />
                      Free Rescheduling Policy
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Students can freely reschedule any confirmed booking up to 2 hours before the scheduled time directly from their Student Dashboard at zero additional fee.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
                    <p className="font-bold text-xs text-ink flex items-center gap-1.5">
                      <AlertTriangle className="size-4 text-amber-500" />
                      Tutor No-Show Guarantee
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      If a tutor fails to attend a confirmed lesson, the student receives a 100% full refund or credit to rebook another top-rated educator immediately.
                    </p>
                  </div>
                </div>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-blue-600" /> 4.1 Dispute Resolution Center
                  </h3>
                  <p className="text-sm text-muted-foreground pl-4">
                    Students or tutors experiencing issues (e.g. poor connectivity, incomplete sessions) can submit a ticket via our <Link to="/support" className="text-brand font-semibold hover:underline">Help &amp; Dispute Resolution Center</Link>. Admin staff review classroom logs and mediate fair resolutions within 24 hours.
                  </p>
                </section>
              </div>
            )}

            {/* ── TAB 5: PRIVACY & DATA PROTECTION ── */}
            {activeTab === "privacy" && (
              <div className="space-y-6 fade-in">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <div className="size-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                    <Lock className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-ink">5. Privacy &amp; Data Protection</h2>
                    <p className="text-xs text-muted-foreground">Compliance with Ghana's Data Protection Act, 2012 (Act 843).</p>
                  </div>
                </div>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-purple-600" /> 5.1 Data We Collect
                  </h3>
                  <p className="text-sm text-muted-foreground pl-4">
                    We collect personal details necessary to facilitate tutoring (Full Name, Ghanaian Phone Number, Email, Academic Subjects). For tutors, verification IDs are stored in encrypted vaults and reviewed solely by authorized administrators.
                  </p>
                </section>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-purple-600" /> 5.2 WebRTC Video Stream Confidentiality
                  </h3>
                  <p className="text-sm text-muted-foreground pl-4">
                    Live classroom video and audio streams are encrypted end-to-end between peer connections using WebRTC protocols. QuickTutor does not record or sell private classroom video streams.
                  </p>
                </section>

                <section className="space-y-3">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <span className="size-2 rounded-full bg-purple-600" /> 5.3 Automated SMS Notifications (Arkesel)
                  </h3>
                  <p className="text-sm text-muted-foreground pl-4">
                    By registering a phone number, users consent to receiving transactional SMS alerts (e.g. 30-min &amp; 5-min lesson reminders, booking confirmations, and payout alerts). We never sell your number to third-party advertisers.
                  </p>
                </section>
              </div>
            )}
          </div>

          {/* Contact / Help Box */}
          <div className="mt-10 rounded-3xl bg-secondary/80 border border-border p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div className="space-y-1">
              <h4 className="font-serif text-lg font-bold text-ink">Have a question regarding our policies?</h4>
              <p className="text-xs text-muted-foreground">Our support team is available 7 days a week to assist Ghanaian students and tutors.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/support"
                className="px-5 py-2.5 rounded-full bg-brand text-primary-foreground text-xs font-semibold hover:bg-brand/90 transition-colors shadow-sm"
              >
                Open Support Ticket
              </Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
