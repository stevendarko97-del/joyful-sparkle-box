import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import heroImage from "@/assets/hero-student.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Quick Tutor — WAEC, BECE & NOV/DEC prep with expert Ghanaian tutors" },
      { name: "description", content: "Book verified Ghanaian tutors for BECE, WASSCE and NOV/DEC private candidates. One-on-one live lessons in every WAEC subject." },
      { property: "og:title", content: "Quick Tutor — WAEC, BECE & NOV/DEC prep" },
      { property: "og:description", content: "One-on-one lessons with verified Ghanaian tutors for BECE, WASSCE and NOV/DEC candidates." },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-screen bg-surface text-ink selection:bg-brand/10">
      <SiteNav />

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-12 lg:py-24">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center">
          <div className="lg:w-3/5">
            <h1 className="text-balance font-serif text-5xl leading-none tracking-tight md:text-7xl lg:max-w-[20ch]">
              Master any subject with specialized mentors.
            </h1>
            <p className="mt-8 max-w-[56ch] text-pretty text-lg leading-relaxed text-muted-foreground lg:max-w-[48ch]">
              One-on-one video lessons designed for high schoolers. Connect with certified teachers and subject experts for focused exam prep and curriculum mastery.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/teachers" className="h-[44px] rounded-full bg-brand px-6 text-base font-medium leading-[44px] text-primary-foreground ring-1 ring-brand">
                Find Your Teacher
              </Link>
              <Link to="/auth" search={{ mode: "signup", role: "teacher" }} className="h-[44px] rounded-full border border-border bg-card px-6 text-base font-medium leading-[44px] transition-colors hover:bg-secondary">
                Become a Mentor
              </Link>
            </div>
          </div>
          <div className="lg:w-2/5">
            <img
              src={heroImage}
              alt="High school student studying with a laptop"
              width={1024}
              height={1024}
              className="aspect-square w-full rounded-xl object-cover outline outline-1 -outline-offset-1 outline-black/5"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-secondary py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="font-serif text-4xl leading-tight">A smarter way to study.</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              ["01", "Choose your expert", "Filter by subject, grade level, or specific topics like AP Calculus BC."],
              ["02", "Book a session", "Real-time scheduling that fits between school and extracurriculars."],
              ["03", "Learn live", "Built-in video classroom — no extra apps, just join and learn."],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-2xl bg-card p-8 ring-1 ring-black/5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand">{n}</span>
                <h3 className="mt-3 font-serif text-2xl leading-tight">{t}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
