import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Bell, X, CalendarCheck, GraduationCap, MessageSquare, LogOut, LayoutDashboard, User, CreditCard, AlertCircle, CheckCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getBackendUrl } from "@/lib/config";
import { useState, useEffect, useRef } from "react";

type Notification = {
  id: string;
  title: string;
  message: string;
  type?: 'payment' | 'message' | 'support' | 'booking' | 'general';
  link?: string | null;
  is_read?: boolean;
  created_at: string;
};

export function SiteNav() {
  const { isAuthed, isAdmin, isTeacher, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const moreRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = () => {
    if (!isAuthed || !user) return;
    const backendUrl = getBackendUrl();
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${backendUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : { notifications: [] })
      .then(d => setNotifications(d.notifications ?? []))
      .catch(() => {});
  };

  // Load notifications and poll every 6 seconds
  useEffect(() => {
    fetchNotifications();
    if (!isAuthed) return;
    const interval = setInterval(fetchNotifications, 6000);
    return () => clearInterval(interval);
  }, [isAuthed, user]);

  const markAllRead = async () => {
    const backendUrl = getBackendUrl();
    const token = localStorage.getItem("token");
    if (!token) return;
    await fetch(`${backendUrl}/api/notifications/read-all`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` }
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleNotificationClick = async (n: Notification) => {
    const backendUrl = getBackendUrl();
    const token = localStorage.getItem("token");
    if (token && !n.is_read) {
      await fetch(`${backendUrl}/api/notifications/${n.id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
    }
    setNotifOpen(false);
    if (n.link) {
      navigate({ to: n.link as any });
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/90 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <GraduationCap className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-ink">Quick Tutor</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-brand -mt-1">Ghana Prep</span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <div className="hidden items-center gap-8 text-sm font-medium md:flex">
          <Link
            to="/teachers" search={{ q: undefined }}
            className="text-muted-foreground transition-colors hover:text-brand"
            activeProps={{ className: "text-brand font-semibold" }}
          >
            Find a Tutor
          </Link>
          <Link
            to="/how-it-works"
            className="text-muted-foreground transition-colors hover:text-brand"
            activeProps={{ className: "text-brand font-semibold" }}
          >
            How it Works
          </Link>
          <Link
            to="/educators"
            className="text-muted-foreground transition-colors hover:text-brand"
            activeProps={{ className: "text-brand font-semibold" }}
          >
            For Educators
          </Link>

          {isAuthed && (
            <Link
              to="/messages"
              className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-brand"
              activeProps={{ className: "text-brand font-semibold" }}
            >
              <MessageSquare className="size-4" />
              Messages
            </Link>
          )}

          <Link
            to="/support"
            className="text-muted-foreground transition-colors hover:text-brand"
            activeProps={{ className: "text-brand font-semibold" }}
          >
            Support &amp; Feedback
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              className="text-muted-foreground transition-colors hover:text-brand"
              activeProps={{ className: "text-brand font-semibold" }}
            >
              Admin
            </Link>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-3">
          {isAuthed ? (
            <>
              {/* Notification Bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(v => !v)}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card hover:bg-secondary transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="size-4 text-ink" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white animate-pulse">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-88 rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden fade-in">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-secondary/50">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">Notifications</p>
                        {unreadCount > 0 && (
                          <span className="rounded-full bg-brand/15 text-brand px-2 py-0.5 text-[10px] font-bold">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllRead}
                            className="text-[11px] font-medium text-brand hover:underline flex items-center gap-1"
                          >
                            <CheckCheck className="size-3" />
                            Mark read
                          </button>
                        )}
                        <button onClick={() => setNotifOpen(false)} className="text-muted-foreground hover:text-foreground">
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-border">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-8 text-center text-xs text-muted-foreground">No new notifications</p>
                      ) : (
                        notifications.map(n => {
                          const Icon = n.type === 'payment' ? CreditCard :
                                       n.type === 'message' ? MessageSquare :
                                       n.type === 'support' ? AlertCircle : CalendarCheck;
                          const iconBg = n.type === 'payment' ? 'bg-emerald-100 text-emerald-700' :
                                         n.type === 'message' ? 'bg-blue-100 text-blue-700' :
                                         n.type === 'support' ? 'bg-amber-100 text-amber-700' :
                                         'bg-purple-100 text-purple-700';

                          return (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`p-3.5 hover:bg-secondary/60 transition-colors cursor-pointer flex items-start gap-3 ${
                                !n.is_read ? 'bg-brand/5' : ''
                              }`}
                            >
                              <div className={`size-8 rounded-xl shrink-0 flex items-center justify-center ${iconBg}`}>
                                <Icon className="size-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p className={`text-xs truncate ${!n.is_read ? 'font-bold text-ink' : 'font-medium text-ink/80'}`}>
                                    {n.title}
                                  </p>
                                  {!n.is_read && <span className="size-2 rounded-full bg-brand shrink-0" />}
                                </div>
                                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                  {n.message}
                                </p>
                                <p className="mt-1 text-[9px] text-muted-foreground/70">
                                  {new Date(n.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Dashboard Link */}
              <Link
                to={isAdmin ? "/admin" : isTeacher ? "/dashboard/teacher" : "/dashboard/student"}
                className="hidden md:flex items-center gap-2 h-9 rounded-full bg-brand px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-brand/90 transition-all hover:scale-[1.02]"
              >
                <LayoutDashboard className="size-3.5" />
                <span>{isAdmin ? "Admin Portal" : "Dashboard"}</span>
              </Link>

              {/* User Menu / Sign Out */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(v => !v)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand font-bold text-xs border border-brand/20 hover:ring-2 hover:ring-brand/30 transition-all"
                  aria-label="User menu"
                >
                  {user?.email?.[0]?.toUpperCase() ?? "U"}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-card shadow-xl z-50 p-1.5 fade-in">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-xs font-semibold text-ink truncate">{user?.email}</p>
                      <p className="text-[10px] uppercase font-bold text-brand">{isAdmin ? "Admin" : isTeacher ? "Teacher" : "Student"}</p>
                    </div>
                    <Link
                      to={isAdmin ? "/admin" : isTeacher ? "/dashboard/teacher" : "/dashboard/student"}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-secondary transition-colors"
                    >
                      <LayoutDashboard className="size-3.5 text-muted-foreground" />
                      {isAdmin ? "Admin Portal" : "Dashboard"}
                    </Link>
                    <Link
                      to="/messages"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-secondary transition-colors"
                    >
                      <MessageSquare className="size-3.5 text-muted-foreground" />
                      Messages
                    </Link>
                    <button
                      onClick={async () => {
                        setUserMenuOpen(false);
                        await signOut();
                        navigate({ to: "/" });
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="size-3.5" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                search={{ mode: "login", role: "student" }}
                className="hidden md:block h-9 px-4 text-sm font-medium leading-9 text-ink hover:text-brand transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup", role: "student" }}
                className="hidden md:block h-9 rounded-full bg-brand px-5 text-xs font-semibold leading-9 text-primary-foreground shadow-sm ring-1 ring-brand hover:bg-brand/90 transition-all hover:scale-[1.02]"
              >
                Get Started Free
              </Link>
            </>
          )}

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(v => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border md:hidden text-ink"
            aria-label="Toggle menu"
          >
            <span className="text-lg">☰</span>
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-border bg-surface px-6 py-4 md:hidden fade-in space-y-3">
          <Link
            to="/teachers" search={{ q: undefined }}
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-ink hover:text-brand"
          >
            Find a Tutor
          </Link>
          <Link
            to="/how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-ink hover:text-brand"
          >
            How it Works
          </Link>
          <Link
            to="/educators"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-ink hover:text-brand"
          >
            For Educators
          </Link>
          {isAuthed && (
            <Link
              to="/messages"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-ink hover:text-brand"
            >
              Messages
            </Link>
          )}
          <Link
            to="/support"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-ink hover:text-brand"
          >
            Support &amp; Feedback
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-ink hover:text-brand"
            >
              Admin
            </Link>
          )}
          <div className="pt-4 mt-2 border-t border-border flex flex-col gap-3">
            {isAuthed ? (
              <Link
                to={isAdmin ? "/admin" : isTeacher ? "/dashboard/teacher" : "/dashboard/student"}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 h-10 rounded-full bg-brand px-4 text-sm font-semibold text-primary-foreground shadow-sm"
              >
                <LayoutDashboard className="size-4" />
                <span>{isAdmin ? "Admin Portal" : "Dashboard"}</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  search={{ mode: "login", role: "student" }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center h-10 rounded-full border border-border bg-card px-4 text-sm font-medium text-ink"
                >
                  Log In
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup", role: "student" }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center h-10 rounded-full bg-brand px-4 text-sm font-semibold text-primary-foreground shadow-sm"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-6 md:flex-row">
        <div className="flex items-center gap-10">
          <div className="text-center md:text-left">
            <p className="font-serif text-3xl font-bold text-brand leading-none">15k+</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lessons Delivered</p>
          </div>
          <div className="text-center md:text-left">
            <p className="font-serif text-3xl font-bold text-brand leading-none">98%</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Satisfaction</p>
          </div>
          <div className="text-center md:text-left">
            <p className="font-serif text-3xl font-bold text-brand leading-none">500+</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Verified Tutors</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-6 text-xs font-medium text-muted-foreground">
          <Link to="/how-it-works" className="hover:text-brand transition-colors">How it Works</Link>
          <Link to="/educators" className="hover:text-brand transition-colors">For Educators</Link>
          <Link to="/teachers" search={{ q: undefined }} className="hover:text-brand transition-colors">Find a Tutor</Link>
          <Link to="/support" className="hover:text-brand transition-colors font-semibold text-brand">Support &amp; Feedback</Link>
          <Link to="/terms" className="hover:text-brand transition-colors">Terms of Service</Link>
          <Link to="/terms" className="hover:text-brand transition-colors">Policies &amp; Escrow</Link>
          <Link to="/privacy" className="hover:text-brand transition-colors">Privacy Policy</Link>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 mt-8 pt-6 border-t border-border/50 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Quick Tutor. Built for the Ghanaian curriculum (BECE, WASSCE &amp; NOV/DEC).
      </div>
    </footer>
  );
}