import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import heroImage from "@/assets/ghanaian-student-hero.png";

export const Route = createFileRoute("/")(({
  component: Index,
  head: () => ({
    meta: [
      { title: "Quick Tutor — BECE, WASSCE & NOV/DEC prep for JHS and SHS in Ghana" },
      { name: "description", content: "Book verified Ghanaian tutors for BECE, WASSCE and NOV/DEC private candidates. One-on-one live lessons in every WAEC subject." },
      { property: "og:title", content: "Quick Tutor — WAEC, BECE & NOV/DEC prep" },
      { property: "og:description", content: "One-on-one lessons with verified Ghanaian tutors for BECE, WASSCE and NOV/DEC candidates." },
    ],
  }),
}) as any);

function Index() {
  return (
    <div className="min-h-screen bg-surface text-ink selection:bg-brand/10">
      <SiteNav />

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-12 lg:py-24">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center">
          <div className="lg:w-3/5 fade-in">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
              JHS • SHS • Remedial &amp; NOV/DEC
            </p>
            <h1 className="mt-4 text-balance font-serif text-5xl leading-none tracking-tight md:text-7xl lg:max-w-[20ch]">
              Pass BECE and WASSCE with Ghana&apos;s best teachers.
            </h1>
            <p className="mt-8 max-w-[56ch] text-pretty text-lg leading-relaxed text-muted-foreground lg:max-w-[48ch]">
              One-on-one live lessons built on the GES curriculum. Book verified Ghanaian tutors for Core and Elective subjects, pay with Mobile Money, and learn from anywhere in the country.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/teachers" className="h-[44px] rounded-full bg-brand px-6 text-base font-medium leading-[44px] text-primary-foreground ring-1 ring-brand transition-transform hover:scale-[1.02]">
                Find a tutor
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup", role: "teacher" }}
                className="h-[44px] rounded-full border border-border bg-card px-6 text-base font-medium leading-[44px] transition-colors hover:bg-secondary"
              >
                Teach on Quick Tutor
              </Link>
            </div>
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-6">
              {[
                ["GH₵", "Pay with MoMo"],
                ["WAEC", "BECE • WASSCE • NOV/DEC"],
                ["1-on-1", "Live video lessons"],
              ].map(([k, v]) => (
                <div key={v}>
                  <dt className="font-serif text-2xl leading-none text-brand">{k}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:w-2/5 fade-in fade-in-delay-1">
            <div className="relative">
              <img
                src={heroImage}
                alt="Ghanaian student studying with a laptop"
                width={1024}
                height={1024}
                className="aspect-square w-full rounded-xl object-cover outline outline-1 -outline-offset-1 outline-black/5"
                onError={e => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  const placeholder = img.nextElementSibling as HTMLElement;
                  if (placeholder) placeholder.style.display = 'flex';
                }}
              />
              {/* Fallback when image fails */}
              <div className="aspect-square w-full rounded-xl bg-secondary items-center justify-center hidden" style={{display:'none'}}>
                <span className="text-7xl">📚</span>
              </div>
              {/* Live lesson pill */}
              <div className="absolute top-4 right-4 flex items-center gap-2 rounded-full bg-brand/90 px-3 py-1.5">
                <span className="size-2 rounded-full bg-white animate-pulse" />
                <span className="text-xs font-semibold text-white">Live Lessons Now</span>
              </div>
              {/* Floating stat card */}
              <div className="absolute -bottom-4 -left-4 rounded-2xl bg-white px-4 py-3 shadow-lift border border-border">
                <p className="text-sm font-bold text-ink">5,000+ Students</p>
                <p className="text-xs text-muted-foreground">Trusted across Ghana</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Exam tracks */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="font-serif text-4xl leading-tight">Built for the Ghanaian classroom.</h2>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {[
              ["JHS 1 – 3", "BECE", "English, Maths, Integrated Science, Social Studies, RME, Ghanaian Language, ICT."],
              ["SHS 1 – 3", "WASSCE", "Core subjects plus Electives in Science, Business, General Arts, Home Economics and Visual Arts."],
              ["Remedial", "NOV/DEC", "Private candidates resitting papers, with flexible evening and weekend lessons."],
            ].map(([level, exam, d]) => (
              <div key={exam} className="rounded-2xl bg-card p-8 ring-1 ring-black/5 hover-lift">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand">{level}</span>
                <h3 className="mt-3 font-serif text-2xl leading-tight">{exam}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-secondary py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="font-serif text-4xl leading-tight">From Accra to Tamale, in three steps.</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              ["01", "Choose your tutor", "Filter by WAEC subject, exam track and topics like Elective Maths or Integrated Science."],
              ["02", "Book and pay", "Pick a slot that fits around prep and vacation classes, then pay with MoMo or card in GH₵."],
              ["03", "Learn live", "Join the built-in classroom with whiteboard and screen sharing — no extra app needed."],
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

      {/* Why us */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">Why Quick Tutor</p>
              <h2 className="mt-4 font-serif text-4xl leading-tight">
                The smarter way to prepare for WAEC exams.
              </h2>
              <p className="mt-6 text-base leading-relaxed text-muted-foreground">
                We understand the pressure of BECE, WASSCE, and NOV/DEC. Our platform is designed specifically for the Ghanaian curriculum and exam system.
              </p>
              <div className="mt-8 space-y-5">
                {[
                  ["✅", "Verified Ghanaian Tutors", "All tutors are background-checked and hold relevant WAEC qualifications."],
                  ["🎯", "Exam-Focused Curriculum", "Sessions target exactly what WAEC examiners are looking for."],
                  ["💳", "Pay with Mobile Money", "MTN MoMo, AirtelTigo, and Vodafone Cash supported via Paystack."],
                  ["🌍", "All 16 Regions Covered", "Online and in-person sessions available across Ghana."],
                ].map(([icon, title, desc]) => (
                  <div key={title} className="flex gap-4">
                    <div className="size-10 shrink-0 flex items-center justify-center rounded-xl bg-brand-soft text-xl">{icon}</div>
                    <div>
                      <p className="font-semibold text-sm">{title}</p>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[
                { name: "Akosua Mensah", school: "KNUST Preparatory", stars: 5, text: "My WASSCE grade in Maths jumped from C6 to B3 after just 8 sessions. Quick Tutor is a lifesaver!" },
                { name: "Kwame Boateng", school: "Achimota School", stars: 5, text: "My BECE tutor explained things in a way that finally clicked. I passed with distinction!" },
                { name: "Ama Darko", school: "Wesley Girls' High School", stars: 5, text: "As a NOV/DEC candidate, I needed flexible hours. Quick Tutor made it so easy." },
              ].map((t, i) => (
                <div key={i} className="rounded-2xl bg-card p-5 ring-1 ring-black/5 hover-lift">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <span key={n} className="text-accent-gold">★</span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm italic leading-relaxed text-muted-foreground">"{t.text}"</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="size-8 rounded-full bg-brand flex items-center justify-center text-xs font-bold text-primary-foreground">
                      {t.name[0]}
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.school}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-soft/60">Get Started Today</p>
          <h2 className="mt-4 font-serif text-4xl leading-tight text-primary-foreground md:text-5xl">
            Ready to pass your exams with confidence?
          </h2>
          <p className="mt-6 text-lg text-primary-foreground/60">
            Join 5,000+ students already learning with Quick Tutor. Your first session is free.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/auth"
              search={{ mode: "signup", role: "student" }}
              className="h-[48px] rounded-full bg-brand px-8 text-base font-semibold leading-[48px] text-primary-foreground ring-1 ring-brand transition-transform hover:scale-[1.02] pulse-gold"
            >
              Start Learning Today
            </Link>
            <Link
              to="/teachers"
              className="h-[48px] rounded-full border border-white/20 px-8 text-base font-medium leading-[48px] text-primary-foreground/80 transition-colors hover:bg-white/10"
            >
              Browse All Tutors
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
