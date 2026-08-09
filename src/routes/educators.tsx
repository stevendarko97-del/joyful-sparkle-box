import { createFileRoute } from "@tanstack/react-router";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/educators")({
  component: Educators,
  head: () => ({
    meta: [
      { title: "For Educators — Quick Tutor" },
      { name: "description", content: "Resources and onboarding for educators: create a profile, set availability, teach lessons, and grow your student base." },
    ],
  }),
});

function Educators() {
  return (
    <div className="min-h-screen bg-surface text-ink selection:bg-brand/10">
      <SiteNav />

      <main className="mx-auto max-w-7xl px-6 py-16">
        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand">Teach with Quick Tutor</p>
            <h1 className="mt-4 font-serif text-5xl leading-tight">A better teaching experience for Ghanaian educators.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Create your educator profile, set availability, accept students and run lessons with built-in classroom tools. We help you connect with learners while keeping onboarding, scheduling and student management simple.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/auth" search={{ mode: "signup", role: "teacher" }} className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm shadow-brand/10 transition hover:opacity-95">
                Start teaching
              </Link>
              <Link to="/teachers" className="inline-flex items-center justify-center rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-ink transition hover:bg-secondary">
                View teacher marketplace
              </Link>
            </div>
          </div>
          <div className="rounded-[2rem] bg-secondary p-8 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.35)]">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Why educators choose us</p>
            <div className="mt-6 space-y-4">
              {[
                ["Keep teaching simple", "Built-in video lessons, chat and materials so you stay focused on what matters."],
                ["Flexible schedule", "Set your availability, accept bookings and leave room for your own life."],
                ["Trusted students", "Connect with motivated learners and build a reliable teaching pipeline."],
              ].map(([title, description]) => (
                <div key={title} className="rounded-3xl bg-card p-5">
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-20">
          <div className="grid gap-8 lg:grid-cols-3">
            <Card title="1. Create your profile" description="Share your subjects, experience, qualifications and a friendly bio so students can find you." />
            <Card title="2. Set availability" description="Publish your schedule and let learners book time slots that fit around your teaching hours." />
            <Card title="3. Teach & grow" description="Run lessons in the classroom, collect reviews, and earn more as your reputation grows." />
          </div>
        </section>

        <section className="mt-20 rounded-[2rem] bg-secondary p-10 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand">Teaching tools</p>
              <h2 className="mt-4 font-serif text-3xl">Everything you need to run lessons without extra apps.</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Lesson rooms, teacher notes, student communication and basic analytics are built into the platform so you can focus on teaching instead of managing multiple tools.
              </p>
            </div>
            <div className="grid gap-4">
              <Feature title="Live video room" description="Classroom sessions happen inside the app with chat and shared materials." />
              <Feature title="Verification support" description="Submit your documents and let admin fast-track your profile once verified." />
              <Feature title="Student management" description="Track lessons, ratings and repeat students in one place." />
            </div>
          </div>
        </section>

        <section className="mt-20 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand">Onboarding made easy</p>
            <h2 className="mt-4 font-serif text-3xl">Launch your teaching profile in minutes.</h2>
            <ul className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
              <li className="rounded-3xl bg-card p-5">1. Sign up as an educator and add your teaching subjects.</li>
              <li className="rounded-3xl bg-card p-5">2. Choose available time slots, pricing and exam specialties.</li>
              <li className="rounded-3xl bg-card p-5">3. Review student requests, verify your credentials, and start teaching.</li>
            </ul>
          </div>
          <div className="rounded-3xl bg-card p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Built to support teachers</p>
            <div className="mt-5 space-y-4 text-sm text-muted-foreground">
              <p>Receive student bookings without manual scheduling.</p>
              <p>Keep your profile competitive with verification badges and reviews.</p>
              <p>Get admin help for documentation and verification questions.</p>
            </div>
          </div>
        </section>

        <section className="mt-20 rounded-[2rem] bg-card p-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand">Ready to teach?</p>
          <h2 className="mt-4 font-serif text-3xl">Join Quick Tutor and reach more students today.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/auth" search={{ mode: "signup", role: "teacher" }} className="inline-flex items-center justify-center rounded-full bg-brand px-8 py-4 text-sm font-semibold text-primary-foreground transition hover:opacity-95">
              Create educator account
            </Link>
            <Link to="/teachers" className="inline-flex items-center justify-center rounded-full border border-border bg-surface px-8 py-4 text-sm font-semibold text-ink transition hover:bg-secondary">
              Browse student demand
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Card({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[2rem] border border-border bg-white p-8 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.2)]">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
