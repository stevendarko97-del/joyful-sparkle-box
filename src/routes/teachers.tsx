import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { BookingDialog } from "@/components/booking-dialog";

export const Route = createFileRoute("/teachers")({
  component: TeachersPage,
  head: () => ({ meta: [{ title: "Find a Tutor — Quick Tutor" }] }),
});

type ExamType = "BECE" | "WASSCE" | "NOV_DEC" | "SHS_REMEDIAL" | "JHS_REMEDIAL";

const EXAM_TYPES: { value: ExamType; label: string }[] = [
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

type Teacher = {
  user_id: string;
  headline: string;
  hourly_rate_cents: number;
  location: string;
  exam_types: ExamType[];
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  profiles: { full_name: string; avatar_url: string | null } | null;
  subjects: { name: string } | null;
  avg_stars?: number;
  review_count?: number;
};

function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [activeExam, setActiveExam] = useState<ExamType | null>(null);
  const [activeLocation, setActiveLocation] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<number>(200);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"rating_desc" | "reviews_desc" | "price_asc" | "price_desc" | "name_asc">("rating_desc");
  const [minStars, setMinStars] = useState<number>(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9;
  const [bookingTeacher, setBookingTeacher] = useState<Teacher | null>(null);

  useEffect(() => {
    supabase.from("subjects").select("id, name").order("name").then(({ data }) => setSubjects(data ?? []));
  }, []);

  useEffect(() => {
    let q = supabase.from("teacher_profiles").select(
      "user_id, headline, hourly_rate_cents, location, exam_types, verification_status, profiles:profiles!teacher_profiles_user_id_fkey(full_name, avatar_url), subjects:subjects!teacher_profiles_primary_subject_id_fkey(name)"
    ).eq("is_active", true);
    if (activeSubject) q = q.eq("primary_subject_id", activeSubject);
    if (activeExam) q = q.contains("exam_types", [activeExam]);
    if (activeLocation) q = q.eq("location", activeLocation);
    q.lte("hourly_rate_cents", maxPrice * 100)
      .then(async ({ data }) => {
        const rows = (data ?? []) as unknown as Teacher[];
        if (rows.length === 0) { setTeachers([]); return; }
        const ids = rows.map((r) => r.user_id);
        const { data: rt } = await supabase.from("ratings").select("teacher_id, stars").in("teacher_id", ids);
        const agg = new Map<string, { sum: number; n: number }>();
        (rt ?? []).forEach((r) => {
          const a = agg.get(r.teacher_id) ?? { sum: 0, n: 0 };
          a.sum += r.stars; a.n += 1; agg.set(r.teacher_id, a);
        });
        setTeachers(rows.map((r) => {
          const a = agg.get(r.user_id);
          return { ...r, avg_stars: a ? a.sum / a.n : undefined, review_count: a?.n ?? 0 };
        }));
      });
  }, [activeSubject, activeExam, activeLocation, maxPrice]);

  const filtered = useMemo(
    () => teachers.filter((t) =>
      !search
        || t.profiles?.full_name.toLowerCase().includes(search.toLowerCase())
        || t.headline.toLowerCase().includes(search.toLowerCase())
    ),
    [teachers, search]
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortBy === "rating_desc") {
        return (b.avg_stars ?? 0) - (a.avg_stars ?? 0) || (b.review_count ?? 0) - (a.review_count ?? 0);
      }
      if (sortBy === "reviews_desc") {
        return (b.review_count ?? 0) - (a.review_count ?? 0) || (b.avg_stars ?? 0) - (a.avg_stars ?? 0);
      }
      if (sortBy === "price_asc") return a.hourly_rate_cents - b.hourly_rate_cents;
      if (sortBy === "price_desc") return b.hourly_rate_cents - a.hourly_rate_cents;
      return (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? "");
    });
    return arr;
  }, [filtered, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [activeSubject, activeExam, activeLocation, maxPrice, search, sortBy]);

  const clearAll = () => {
    setActiveSubject(null); setActiveExam(null); setActiveLocation(""); setMaxPrice(200); setSearch("");
  };
  const hasFilters = activeSubject || activeExam || activeLocation || maxPrice < 200 || search;

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />
      <section className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="font-serif text-5xl leading-tight">Find your tutor</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {sorted.length} tutor{sorted.length === 1 ? "" : "s"} available
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-9 rounded-lg border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="name_asc">Name: A–Z</option>
            </select>
          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-card p-5 ring-1 ring-black/5">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Search</label>
              <input
                type="text"
                placeholder="Name or specialty…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Exam</label>
              <select
                value={activeExam ?? ""}
                onChange={(e) => setActiveExam((e.target.value || null) as ExamType | null)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="">Any exam</option>
                {EXAM_TYPES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Location</label>
              <select
                value={activeLocation}
                onChange={(e) => setActiveLocation(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="">Anywhere</option>
                {GH_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Max rate</span>
                <span className="font-semibold text-ink">GH₵{maxPrice}/hr</span>
              </label>
              <input
                type="range" min={20} max={200} step={5}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="h-10 w-full accent-brand"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Subject:</span>
            <button onClick={() => setActiveSubject(null)} className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${activeSubject === null ? "bg-ink text-primary-foreground" : "border border-border bg-surface hover:bg-secondary"}`}>
              All
            </button>
            {subjects.map((s) => (
              <button key={s.id} onClick={() => setActiveSubject(s.id)} className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${activeSubject === s.id ? "bg-ink text-primary-foreground" : "border border-border bg-surface hover:bg-secondary"}`}>
                {s.name}
              </button>
            ))}
            {hasFilters && (
              <button onClick={clearAll} className="ml-auto h-8 rounded-full px-3 text-xs font-medium text-brand hover:underline">
                Clear all
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {paged.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              No tutors match those filters. Try widening your search.
            </p>
          )}
          {paged.map((t) => (
            <Link to="/teacher/$id" params={{ id: t.user_id }} key={t.user_id} className="group block rounded-2xl bg-card p-5 ring-1 ring-black/5 transition-colors hover:ring-brand/20">
              <div className="flex items-start gap-4">
                <div className="size-16 shrink-0 rounded-xl bg-secondary outline outline-1 -outline-offset-1 outline-black/5">
                  {t.profiles?.avatar_url && <img src={t.profiles.avatar_url} alt="" className="size-full rounded-xl object-cover" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-medium">{t.profiles?.full_name || "Tutor"}</h3>
                    {t.verification_status === "verified" && (
                      <span title="Verified tutor" className="inline-flex h-5 items-center gap-1 rounded-full bg-brand/10 px-2 text-[10px] font-semibold text-brand">
                        <svg viewBox="0 0 24 24" className="size-3" fill="currentColor"><path d="M12 2l2.4 2.6 3.5-.5.5 3.5L21 10l-2.6 2.4.5 3.5-3.5.5L12 19l-2.4-2.6-3.5.5-.5-3.5L3 10l2.6-2.4-.5-3.5 3.5-.5L12 2z"/><path d="M10.5 13.2l-2-2 1-1 1 1 3-3 1 1z" fill="var(--surface)"/></svg>
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.subjects?.name ?? "General"} • {t.location || "Location TBD"}
                  </p>
                  {t.review_count && t.review_count > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="text-accent-gold">★</span> {t.avg_stars?.toFixed(1)} <span className="text-muted-foreground/70">({t.review_count} review{t.review_count === 1 ? "" : "s"})</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground/60">No reviews yet</p>
                  )}
                  {t.exam_types?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.exam_types.map((e) => (
                        <span key={e} className="rounded-full bg-accent-gold/20 px-2 py-0.5 text-[10px] font-medium text-ink">
                          {EXAM_TYPES.find((x) => x.value === e)?.label ?? e}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-semibold">GH₵{(t.hourly_rate_cents / 100).toFixed(0)}<span className="font-normal text-muted-foreground">/hr</span></span>
                    <div className="flex items-center gap-2">
                      <span className="h-8 rounded-full bg-secondary px-3 text-xs font-medium leading-8 transition-colors group-hover:bg-secondary/70">View</span>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBookingTeacher(t); }}
                        className="h-8 rounded-full bg-ink px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-brand"
                      >
                        Book
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-9 rounded-full border border-border bg-surface px-4 text-xs font-medium disabled:opacity-40 hover:bg-secondary"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`h-9 min-w-9 rounded-full px-3 text-xs font-medium transition-colors ${n === currentPage ? "bg-ink text-primary-foreground" : "border border-border bg-surface hover:bg-secondary"}`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-9 rounded-full border border-border bg-surface px-4 text-xs font-medium disabled:opacity-40 hover:bg-secondary"
            >
              Next
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
      <BookingDialog
        open={!!bookingTeacher}
        onClose={() => setBookingTeacher(null)}
        teacher={bookingTeacher ? {
          user_id: bookingTeacher.user_id,
          full_name: bookingTeacher.profiles?.full_name || "Tutor",
          hourly_rate_cents: bookingTeacher.hourly_rate_cents,
        } : null}
      />
    </div>
  );
}