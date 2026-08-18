import { useEffect, useState } from "react";
import { getBackendUrl } from "@/lib/config";

export type AppRole = "student" | "teacher" | "admin";
export type User = { id: string; email: string; role: AppRole };

export function useAuth() {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Developer override
    try {
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      if (import.meta.env.DEV && params?.get("asAdmin") === "1") {
        const fakeUser = { id: "dev-admin", email: "admin@local", role: "admin" } as User;
        setUser(fakeUser);
        setRoles(["admin"]);
        setLoading(false);
        return;
      }
    } catch (e) { }

    const fetchMe = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error("No token");
        
        const backendUrl = getBackendUrl();
        const res = await fetch(`${backendUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Unauthorized");
        const data = await res.json();
        setUser(data.user);
        setRoles([data.user.role]);
      } catch (err) {
        setUser(null);
        setRoles([]);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
    
    // Listen for storage events (if they login in another tab)
    const handleStorage = () => fetchMe();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const signOut = async () => {
    const backendUrl = getBackendUrl();
    await fetch(`${backendUrl}/api/auth/logout`, { method: "POST" });
    localStorage.removeItem('token');
    setUser(null);
    setRoles([]);
  };

  return {
    session, // provided for backward compatibility
    user,
    roles,
    loading,
    isAuthed: !!user,
    isStudent: roles.includes("student"),
    isTeacher: roles.includes("teacher"),
    isAdmin: roles.includes("admin"),
    signOut,
  };
}