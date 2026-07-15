import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, SiteFooter } from "@/components/site-nav";

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
  profiles: { full_name: string; avatar_url: string | null } | null;
  subjects: { name: string } | null;
};

function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [activeExam, setActiveExam] = useState<ExamType | null>(null);
  const [activeLocation, setActiveLocation] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<number>(200);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("subjects").select("id, name").order("name").then(({ data }) => setSubjects(data ?? []));
  }, []);

  useEffect(() => {
    let q = supabase.from("teacher_profiles").select(
      "user_id, headline, hourly_rate_cents, location, exam_types, profiles:profiles!teacher_profiles_user_id_fkey(full_name, avatar_url), subjects:subjects!teacher_profiles_primary_subject_id_fkey(name)"
    ).eq("is_active", true);
    if (activeSubject) q = q.eq("primary_subject_id", activeSubject);
    if (activeExam) q = q.contains("exam_types", [activeExam]);
    if (activeLocation) q = q.eq("location", activeLocation);
    q.lte("hourly_rate_cents", maxPrice * 100)
      .then(({ data }) => setTeachers((data ?? []) as unknown as Teacher[]));
  }, [activeSubject, activeExam, activeLocation, maxPrice]);

  const filtered = useMemo(
    () => teachers.filter((t) =>
      !search
        || t.profiles?.full_name.toLowerCase().includes(search.toLowerCase())
        || t.headline.toLowerCase().includes(search.toLowerCase())
    ),
    [teachers, search]
  );

  const clearAll = () => {
    setActiveSubject(null); setActiveExam(null); setActiveLocation(""); setMaxPrice(200); setSearch("");
  };
  const hasFilters = activeSubject || activeExam || activeLocation || maxPrice < 200 || search;

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />
      <section className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="font-serif text-5xl leading-tight">Find your tutor</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {filtered.length} tutor{filtered.length === 1 ? "" : "s"} available
        </p>

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
          {filtered.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              No tutors match those filters. Try widening your search.
            </p>
          )}
          {filtered.map((t) => (
            <Link to="/teacher/$id" params={{ id: t.user_id }} key={t.user_id} className="group block rounded-2xl bg-card p-5 ring-1 ring-black/5 transition-colors hover:ring-brand/20">
              <div className="flex items-start gap-4">
                <div className="size-16 shrink-0 rounded-xl bg-secondary outline outline-1 -outline-offset-1 outline-black/5">
                  {t.profiles?.avatar_url && <img src={t.profiles.avatar_url} alt="" className="size-full rounded-xl object-cover" />}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-medium">{t.profiles?.full_name || "Tutor"}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.subjects?.name ?? "General"} • {t.location || "Location TBD"}
                  </p>
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
                    <span className="h-8 rounded-full bg-secondary px-4 text-xs font-medium leading-8 transition-colors group-hover:bg-brand group-hover:text-primary-foreground">View Profile</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}