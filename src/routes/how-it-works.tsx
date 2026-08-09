import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import learningImage from "@/assets/ghanaian-students-learning.png";


export const Route = createFileRoute("/how-it-works")({
  component: HowItWorks,
  head: () => ({
    meta: [
      { title: "How It Works — Quick Tutor" },
      { name: "description", content: "How Quick Tutor works for students and educators — booking, joining lessons, and onboarding for teachers." },
    ],
  }),
});

function HowItWorks() {
  return (
    <div className="min-h-screen bg-surface text-ink selection:bg-brand/10">
      <SiteNav />

      <section className="mx-auto max-w-7xl px-6 py-12 lg:py-24">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center">
          <div className="lg:w-3/5">
            <h1 className="text-balance font-serif text-4xl leading-none tracking-tight md:text-6xl lg:max-w-[40ch]">
              How Quick Tutor Works
            </h1>
            <p className="mt-6 max-w-[56ch] text-pretty text-lg leading-relaxed text-muted-foreground">
              Book verified Ghanaian tutors for focused, one-on-one lessons. Below is a quick walkthrough for students and a short section for educators — jump to the educator resources if you're teaching with us.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/teachers" className="h-[44px] rounded-full bg-brand px-6 text-base font-medium leading-[44px] text-primary-foreground ring-1 ring-brand">
                Find a Teacher
              </Link>
              <a href="#educators" className="h-[44px] rounded-full border border-border bg-card px-6 text-base font-medium leading-[44px] hover:bg-secondary">
                For Educators
              </a>
            </div>
          </div>
          <div className="lg:w-2/5">
            <img src={learningImage} alt="Students learning" className="aspect-square w-full rounded-xl object-cover outline outline-1 -outline-offset-1 outline-black/5" />
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="font-serif text-3xl">Student flow — in 3 steps</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              ["01", "Search & Filter", "Find tutors by subject, grade and availability."],
              ["02", "Book a Session", "Select a time, confirm details and optionally add notes for your tutor."],
              ["03", "Join & Learn", "Join the built-in video room and access materials and the recording."],
            ].map(([n, t, d]) => (
              <div key={n as string} className="rounded-2xl bg-card p-8 ring-1 ring-black/5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand">{n}</span>
                <h3 className="mt-3 font-serif text-2xl leading-tight">{t}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="font-serif text-3xl">Key features</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            ["Booking & Scheduling", "Real-time availability, reschedule and cancel flows."],
            ["Built-in Classroom", "Video, chat, materials and optional recordings in one place."],
            ["Reviews & Support", "Leave feedback and get help from our support team."],
          ].map(([t, d]) => (
            <div key={t as string} className="rounded-lg border border-border bg-card p-6">
              <h4 className="font-semibold">{t}</h4>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="educators" className="border-t border-border bg-muted/5 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="font-serif text-3xl">For Educators</h2>
          <p className="mt-4 text-muted-foreground">
            Teach with Quick Tutor — set your availability, publish your profile, accept bookings, and run lessons in our integrated room. Below are the essentials to get started.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-6">
              <h4 className="font-semibold">Onboarding</h4>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                <li>Create a profile with credentials and subjects.</li>
                <li>Sync calendar and set availability.</li>
                <li>Publish lessons and pricing (payments can be added later).</li>
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h4 className="font-semibold">Teaching tools</h4>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                <li>Built-in video room with chat and materials.</li>
                <li>Lesson recording, attachments and whiteboard (future).</li>
                <li>Basic analytics: lessons taught and student ratings.</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <Link to="/auth" search={{ mode: "signup", role: "teacher" }} className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-medium text-primary-foreground">
              Become a Mentor
            </Link>
            <Link to="/educators" className="inline-flex items-center justify-center rounded-full border border-border bg-card px-6 py-3 text-sm font-medium">
              Educator Resources
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
