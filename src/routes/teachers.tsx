import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav, SiteFooter } from "@/components/site-nav";

export const Route = createFileRoute("/teachers")({
  component: TeachersPage,
  head: () => ({ meta: [{ title: "Find a Tutor — Quick Tutor" }] }),
});

type Teacher = {
  user_id: string;
  headline: string;
  hourly_rate_cents: number;
  profiles: { full_name: string; avatar_url: string | null } | null;
  subjects: { name: string } | null;
};

function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("subjects").select("id, name").order("name").then(({ data }) => setSubjects(data ?? []));
  }, []);

  useEffect(() => {
    let q = supabase.from("teacher_profiles").select(
      "user_id, headline, hourly_rate_cents, profiles:profiles!teacher_profiles_user_id_fkey(full_name, avatar_url), subjects:subjects!teacher_profiles_primary_subject_id_fkey(name)"
    ).eq("is_active", true);
    if (activeSubject) q = q.eq("primary_subject_id", activeSubject);
    q.then(({ data }) => setTeachers((data ?? []) as unknown as Teacher[]));
  }, [activeSubject]);

  const filtered = teachers.filter((t) =>
    !search || t.profiles?.full_name.toLowerCase().includes(search.toLowerCase()) || t.headline.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />
      <section className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="font-serif text-5xl leading-tight">Browse by specialty</h1>
        <p className="mt-2 text-sm text-muted-foreground">{teachers.length} teachers available</p>

        <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveSubject(null)} className={`h-9 rounded-full px-4 text-xs font-medium transition-colors ${activeSubject === null ? "bg-ink text-primary-foreground" : "border border-border bg-card hover:bg-secondary"}`}>
              All Subjects
            </button>
            {subjects.map((s) => (
              <button key={s.id} onClick={() => setActiveSubject(s.id)} className={`h-9 rounded-full px-4 text-xs font-medium transition-colors ${activeSubject === s.id ? "bg-ink text-primary-foreground" : "border border-border bg-card hover:bg-secondary"}`}>
                {s.name}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search teachers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-full border border-border bg-card px-4 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              No teachers yet. Sign up as a teacher to be the first!
            </p>
          )}
          {filtered.map((t) => (
            <Link to="/teacher/$id" params={{ id: t.user_id }} key={t.user_id} className="group block rounded-2xl bg-card p-5 ring-1 ring-black/5 transition-colors hover:ring-brand/20">
              <div className="flex items-start gap-4">
                <div className="size-16 shrink-0 rounded-xl bg-secondary outline outline-1 -outline-offset-1 outline-black/5">
                  {t.profiles?.avatar_url && <img src={t.profiles.avatar_url} alt="" className="size-full rounded-xl object-cover" />}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-medium">{t.profiles?.full_name || "Teacher"}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{t.subjects?.name ?? "General"} • {t.headline || "Tutor"}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-semibold">${(t.hourly_rate_cents / 100).toFixed(0)}<span className="font-normal text-muted-foreground">/hr</span></span>
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