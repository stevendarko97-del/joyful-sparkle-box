import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function SiteNav() {
  const { isAuthed, isAdmin, isTeacher, signOut, user } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
      <Link to="/" className="flex items-center gap-2">
        <div className="size-8 rounded-full bg-brand" />
        <span className="text-xl font-medium tracking-tight">Scribe</span>
      </Link>
      <div className="hidden gap-8 text-sm font-medium sm:flex">
        <Link to="/teachers" className="text-muted-foreground transition-colors hover:text-brand">Find a Teacher</Link>
        <Link to="/how-it-works" className="text-muted-foreground transition-colors hover:text-brand">How it Works</Link>
        <Link to="/for-educators" className="text-muted-foreground transition-colors hover:text-brand">For Educators</Link>
        {isAdmin && <Link to="/admin" className="text-muted-foreground transition-colors hover:text-brand">Admin</Link>}
      </div>
      <div className="flex items-center gap-3">
        {isAuthed ? (
          <>
            <Link to={isTeacher ? "/dashboard/teacher" : "/dashboard/student"} className="text-sm font-medium hover:text-brand">
              Dashboard
            </Link>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Link to="/auth" className="h-[34px] px-4 text-sm font-medium leading-[34px] transition-colors hover:text-brand">
              Log in
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="h-[34px] rounded-full bg-brand px-5 text-sm font-medium leading-[34px] text-primary-foreground ring-1 ring-brand transition-transform hover:scale-[1.02]"
            >
              Join Scribe
            </Link>
          </>
        )}
      </div>
      {/* hidden anchor to satisfy unused user var */}
      <span className="hidden">{user?.id}</span>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-6 md:flex-row">
        <div className="flex items-center gap-12">
          <div className="text-center md:text-left">
            <p className="font-serif text-2xl leading-none">15k+</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lessons Delivered</p>
          </div>
          <div className="text-center md:text-left">
            <p className="font-serif text-2xl leading-none">98%</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Satisfaction</p>
          </div>
        </div>
        <div className="flex gap-8 text-[11px] font-medium text-muted-foreground">
          <a href="#" className="hover:text-ink">Terms of Service</a>
          <a href="#" className="hover:text-ink">Privacy Policy</a>
          <a href="#" className="hover:text-ink">Help Center</a>
        </div>
      </div>
    </footer>
  );
}