import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { BookingDialog } from "@/components/booking-dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/teachers")({
  component: TeachersPage,
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : undefined }),
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

type Topic = { id: string; name: string; subject_id?: string; is_specialty?: boolean };

type Teacher = {
  user_id: string;
  headline: string;
  hourly_rate_cents: number;
  location: string;
  exam_types: ExamType[];
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  years_experience: number | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
  subjects: { name: string } | null;
  topics?: Topic[];
  avg_stars?: number;
  review_count?: number;
};

const BACKEND = (import.meta as any).env.VITE_BACKEND_URL || "http://localhost:4000";
const PAGE_SIZE = 9;

function TeachersPage() {
  const { user } = useAuth();
  const { q } = Route.useSearch();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [activeExam, setActiveExam] = useState<ExamType | null>(null);
  const [activeLocation, setActiveLocation] = useState("");
  const [maxPrice, setMaxPrice] = useState(200);
  const [search, setSearch] = useState(q ?? "");
  const [sortBy, setSortBy] = useState<"rating_desc" | "reviews_desc" | "price_asc" | "price_desc" | "name_asc">("rating_desc");
  const [minStars, setMinStars] = useState(0);
  const [minYears, setMinYears] = useState(0);
  const [page, setPage] = useState(1);
  const [bookingTeacher, setBookingTeacher] = useState<Teacher | null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [favOnly, setFavOnly] = useState(false);

  // Load subjects & topics
  useEffect(() => {
    fetch(`${BACKEND}/api/subjects`)
      .then(r => r.json())
      .then(d => setSubjects(d.subjects ?? []))
      .catch(() => {});

    fetch(`${BACKEND}/api/topics`)
      .then(r => r.json())
      .then(d => setAllTopics(d.topics ?? []))
      .catch(() => {});
  }, []);

  // Load teachers
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeSubject) params.set("subjectId", activeSubject);
    if (activeExam) params.set("examType", activeExam);
    if (activeLocation) params.set("location", activeLocation);
    if (maxPrice < 200) params.set("maxPrice", String(maxPrice));
    fetch(`${BACKEND}/api/teachers?${params}`)
      .then(r => r.json())
      .then(d => setTeachers(d.teachers ?? []))
      .catch(() => toast.error("Failed to load tutors"))
      .finally(() => setLoading(false));
  }, [activeSubject, activeExam, activeLocation, maxPrice]);

  // Load favorites
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${BACKEND}/api/student/favorites`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { favorites: [] })
      .then(d => setFavIds(new Set((d.favorites ?? []).map((f: any) => f.teacher_id))))
      .catch(() => {});
  }, [user]);

  const toggleFavorite = async (teacherId: string) => {
    if (!user) return;
    const token = localStorage.getItem("token");
    const isFav = favIds.has(teacherId);
    const newSet = new Set(favIds);
    if (isFav) { newSet.delete(teacherId); } else { newSet.add(teacherId); }
    setFavIds(newSet);
    try {
      await fetch(`${BACKEND}/api/student/favorites`, {
        method: isFav ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teacher_id: teacherId }),
      });
    } catch { /* revert */ setFavIds(favIds); }
  };

  // Available topics for active subject or top topics
  const relevantTopics = useMemo(() => {
    if (!activeSubject) return allTopics;
    return allTopics.filter(top => top.subject_id === activeSubject);
  }, [allTopics, activeSubject]);

  const filtered = useMemo(() => teachers.filter(t => {
    const s = search.toLowerCase().replace(/maths?/g, 'math');
    const subj = t.subjects?.name?.toLowerCase().replace(/maths?/g, 'math') || "";
    const matchSearch = !search || 
      t.profiles?.full_name?.toLowerCase().includes(s) || 
      t.headline?.toLowerCase().includes(s) ||
      subj.includes(s) ||
      t.exam_types?.some(e => e.toLowerCase().includes(s)) ||
      t.topics?.some(top => top.name.toLowerCase().includes(s));

    const matchTopic = !activeTopic || t.topics?.some(top => top.id === activeTopic || top.name.toLowerCase() === activeTopic.toLowerCase());
    const matchStars = minStars === 0 || (t.avg_stars ?? 0) >= minStars;
    const matchYears = (t.years_experience ?? 0) >= minYears;
    const matchFav = !favOnly || favIds.has(t.user_id);
    return matchSearch && matchTopic && matchStars && matchYears && matchFav;
  }), [teachers, search, activeTopic, minStars, minYears, favOnly, favIds]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortBy === "rating_desc") return (b.avg_stars ?? 0) - (a.avg_stars ?? 0) || (b.review_count ?? 0) - (a.review_count ?? 0);
      if (sortBy === "reviews_desc") return (b.review_count ?? 0) - (a.review_count ?? 0);
      if (sortBy === "price_asc") return a.hourly_rate_cents - b.hourly_rate_cents;
      if (sortBy === "price_desc") return b.hourly_rate_cents - a.hourly_rate_cents;
      return (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? "");
    });
    return arr;
  }, [filtered, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [activeSubject, activeTopic, activeExam, activeLocation, maxPrice, search, sortBy, minStars, minYears, favOnly]);

  const hasFilters = activeSubject || activeTopic || activeExam || activeLocation || maxPrice < 200 || search || minStars > 0 || minYears > 0 || favOnly;

  const clearAll = () => {
    setActiveSubject(null); setActiveTopic(null); setActiveExam(null); setActiveLocation(""); setMaxPrice(200);
    setSearch(""); setMinStars(0); setMinYears(0); setFavOnly(false);
  };

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
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="h-9 rounded-lg border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="rating_desc">Top rated</option>
              <option value="reviews_desc">Most reviewed</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="name_asc">Name: A–Z</option>
            </select>
          </div>
        </div>

        {/* Filter card */}
        <div className="mt-8 rounded-2xl bg-card p-5 ring-1 ring-black/5">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Search</label>
              <input
                type="text"
                placeholder="Name or specialty…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Exam</label>
              <select
                value={activeExam ?? ""}
                onChange={e => setActiveExam((e.target.value || null) as ExamType | null)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="">Any exam</option>
                {EXAM_TYPES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Location</label>
              <select
                value={activeLocation}
                onChange={e => setActiveLocation(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="">Anywhere</option>
                {GH_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
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
                onChange={e => setMaxPrice(Number(e.target.value))}
                className="h-10 w-full accent-brand"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Min rating:</span>
            {[0, 3, 4, 4.5].map(r => (
              <button
                key={r}
                onClick={() => setMinStars(r)}
                className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${minStars === r ? "bg-ink text-primary-foreground" : "border border-border bg-surface hover:bg-secondary"}`}
              >
                {r === 0 ? "Any" : <><span className="text-accent-gold">★</span> {r}+</>}
              </button>
            ))}
            <span className="mx-2 h-4 w-px bg-border" />
            <span className="text-xs font-medium text-muted-foreground">Experience:</span>
            <select
              value={minYears}
              onChange={e => setMinYears(Number(e.target.value))}
              className="h-8 rounded-full border border-border bg-surface px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value={0}>Any</option>
              <option value={1}>1+ yrs</option>
              <option value={3}>3+ yrs</option>
              <option value={5}>5+ yrs</option>
              <option value={10}>10+ yrs</option>
            </select>
            <button
              onClick={() => setFavOnly(v => !v)}
              className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${favOnly ? "bg-ink text-primary-foreground" : "border border-border bg-surface hover:bg-secondary"}`}
            >
              ♥ Favourites{favIds.size ? ` (${favIds.size})` : ""}
            </button>
            <span className="mx-2 h-4 w-px bg-border" />
            <span className="text-xs font-medium text-muted-foreground">Subject:</span>
            <button
              onClick={() => { setActiveSubject(null); setActiveTopic(null); }}
              className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${activeSubject === null ? "bg-ink text-primary-foreground" : "border border-border bg-surface hover:bg-secondary"}`}
            >
              All Subjects
            </button>
            {subjects.map(s => (
              <button
                key={s.id}
                onClick={() => { setActiveSubject(s.id); setActiveTopic(null); }}
                className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${activeSubject === s.id ? "bg-ink text-primary-foreground" : "border border-border bg-surface hover:bg-secondary"}`}
              >
                {s.name}
              </button>
            ))}
            {hasFilters && (
              <button onClick={clearAll} className="ml-auto h-8 rounded-full px-3 text-xs font-medium text-brand hover:underline">
                Clear all
              </button>
            )}
          </div>

          {/* Topics sub-filter row */}
          {relevantTopics.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1">Topics:</span>
              <button
                onClick={() => setActiveTopic(null)}
                className={`h-6 rounded-full px-2.5 text-[11px] font-medium transition-colors ${activeTopic === null ? "bg-brand text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-ink"}`}
              >
                All Topics
              </button>
              {relevantTopics.slice(0, 15).map(top => (
                <button
                  key={top.id}
                  onClick={() => setActiveTopic(activeTopic === top.id ? null : top.id)}
                  className={`h-6 rounded-full px-2.5 text-[11px] font-medium transition-colors ${activeTopic === top.id ? "bg-brand text-primary-foreground font-semibold" : "bg-secondary text-muted-foreground hover:text-ink"}`}
                >
                  {top.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Teacher grid */}
        {loading ? (
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="rounded-2xl bg-card p-5 ring-1 ring-black/5 animate-pulse">
                <div className="flex gap-4">
                  <div className="size-16 rounded-xl bg-secondary" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-secondary" />
                    <div className="h-3 w-24 rounded bg-secondary" />
                    <div className="h-3 w-20 rounded bg-secondary" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {paged.length === 0 && (
              <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
                No tutors match those filters. Try widening your search.
              </p>
            )}
            {paged.map(t => (
              <Link
                to="/teacher/$id"
                params={{ id: t.user_id }}
                key={t.user_id}
                className="group block rounded-2xl bg-card p-5 ring-1 ring-black/5 transition-all hover:ring-brand/20 teacher-card"
              >
                <div className="flex items-start gap-4">
                  <div className="size-16 shrink-0 rounded-xl bg-secondary outline outline-1 -outline-offset-1 outline-black/5 overflow-hidden">
                    {t.profiles?.avatar_url && (
                      <img src={t.profiles.avatar_url} alt="" className="size-full object-cover" />
                    )}
                    {!t.profiles?.avatar_url && (
                      <div className="size-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                        {(t.profiles?.full_name ?? "T")[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-medium">{t.profiles?.full_name || "Tutor"}</h3>
                      {t.verification_status === "verified" && (
                        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-brand/10 px-2 text-[10px] font-semibold text-brand">
                          <svg viewBox="0 0 24 24" className="size-3" fill="currentColor">
                            <path d="M12 2l2.4 2.6 3.5-.5.5 3.5L21 10l-2.6 2.4.5 3.5-3.5.5L12 19l-2.4-2.6-3.5.5-.5-3.5L3 10l2.6-2.4-.5-3.5 3.5-.5L12 2z"/>
                            <path d="M10.5 13.2l-2-2 1-1 1 1 3-3 1 1z" fill="var(--surface)"/>
                          </svg>
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {t.subjects?.name ?? "General"} • {t.location || "Location TBD"}
                    </p>
                    {(t.review_count ?? 0) > 0 ? (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          <span className="text-accent-gold">★</span> {t.avg_stars?.toFixed(1)}{" "}
                          <span className="text-muted-foreground/70">({t.review_count} review{t.review_count === 1 ? "" : "s"})</span>
                        </p>
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                          <svg viewBox="0 0 24 24" className="size-3" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                          Verified
                        </span>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground/60">No reviews yet</p>
                    )}

                    {/* Topics Covered & Specialties */}
                    {t.topics && t.topics.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.topics.slice(0, 3).map(top => (
                          <span
                            key={top.id}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              top.is_specialty
                                ? "bg-brand/10 text-brand ring-1 ring-brand/20 font-semibold"
                                : "bg-secondary text-ink/80"
                            }`}
                          >
                            {top.is_specialty && <span className="mr-0.5 text-accent-gold">★</span>}
                            {top.name}
                          </span>
                        ))}
                        {t.topics.length > 3 && (
                          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                            +{t.topics.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {t.exam_types?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.exam_types.map(e => (
                          <span key={e} className="rounded-full bg-accent-gold/20 px-2 py-0.5 text-[10px] font-medium text-ink">
                            {EXAM_TYPES.find(x => x.value === e)?.label ?? e}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        GH₵{(t.hourly_rate_cents / 100).toFixed(0)}<span className="font-normal text-muted-foreground">/hr</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(t.user_id); }}
                          className={`h-8 w-8 rounded-full border border-border flex items-center justify-center text-sm transition-colors ${favIds.has(t.user_id) ? "text-brand bg-brand/5" : "text-muted-foreground hover:text-brand"}`}
                          aria-label="Favourite"
                        >
                          {favIds.has(t.user_id) ? "♥" : "♡"}
                        </button>
                        <span className="h-8 rounded-full bg-secondary px-3 text-xs font-medium leading-8 transition-colors group-hover:bg-secondary/70">View</span>
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); setBookingTeacher(t); }}
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
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-9 rounded-full border border-border bg-surface px-4 text-xs font-medium disabled:opacity-40 hover:bg-secondary"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`h-9 min-w-9 rounded-full px-3 text-xs font-medium transition-colors ${n === currentPage ? "bg-ink text-primary-foreground" : "border border-border bg-surface hover:bg-secondary"}`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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