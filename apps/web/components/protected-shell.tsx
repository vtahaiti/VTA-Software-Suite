"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { AuthUser, clearSession, getAccessToken, getCurrentUser, refreshSession } from "@/lib/auth";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ProtectedShellProps = {
  children: ReactNode | ((user: AuthUser) => ReactNode);
};

export function ProtectedShell({ children }: ProtectedShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadSession() {
      const currentUser = getCurrentUser();
      const currentToken = getAccessToken();
      let sessionUser: AuthUser | null = null;

      if (currentUser && currentToken) {
        const response = await fetch(`${apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${currentToken}` } }).catch(() => null);
        sessionUser = response?.ok ? currentUser : null;
      }

      if (!sessionUser) {
        sessionUser = await refreshSession();
      }

      if (!sessionUser) {
        clearSession();
        router.push("/login");
        return;
      }

      setUser(sessionUser);
      setIsReady(true);
    }

    loadSession();
  }, [router]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  if (!isReady || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        Chargement de la session...
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white lg:grid lg:grid-cols-[270px_1fr]">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-30 lg:hidden" aria-modal="true" role="dialog">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-slate-950/45" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 z-40 w-[min(18rem,calc(100vw-2rem))] shadow-2xl">
            <Sidebar className="w-full" onNavigate={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="min-w-0">
        <Header user={user} onMenuClick={() => setIsMobileMenuOpen((value) => !value)} />
        <main className="px-3 py-4 sm:px-4 sm:py-5 lg:px-10 lg:py-8">
          {typeof children === "function" ? children(user) : children}
        </main>
      </div>
    </div>
  );
}
