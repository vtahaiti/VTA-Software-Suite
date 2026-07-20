"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { AuthUser, clearSession, clearTenantScopedCaches, getAccessToken, getCurrentUser, refreshSession, updateStoredUser } from "@/lib/auth";
import { canAccessHref } from "@/lib/role-access";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "https://api.vtaerp.com" : "http://localhost:3001"));

type ProtectedShellProps = {
  children: ReactNode | ((user: AuthUser) => ReactNode);
};

export function ProtectedShell({ children }: ProtectedShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [accessBlocked, setAccessBlocked] = useState(false);

  useEffect(() => {
    async function loadSession() {
      const currentUser = getCurrentUser();
      const currentToken = getAccessToken();
      let sessionUser: AuthUser | null = null;

      if (currentUser && currentToken) {
        const response = await fetch(`${apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${currentToken}` } }).catch(() => null);
        if (response?.ok) {
          const body = await response.json().catch(() => null) as { user?: AuthUser } | null;
          sessionUser = body?.user ?? currentUser;
          if (sessionUser.tenantId !== currentUser.tenantId) clearTenantScopedCaches("tenant-mismatch");
          updateStoredUser(sessionUser);
        } else if (response?.status === 403) {
          clearTenantScopedCaches("tenant-blocked");
          setAccessBlocked(true);
          setIsReady(true);
          return;
        }
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
    function onTenantBlocked() {
      clearTenantScopedCaches("tenant-blocked");
      setAccessBlocked(true);
      setIsReady(true);
    }
    window.addEventListener("vta:tenant-access-blocked", onTenantBlocked);
    return () => window.removeEventListener("vta:tenant-access-blocked", onTenantBlocked);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isReady || !user) return;
    if (!canAccessHref(user, pathname)) router.replace("/dashboard");
  }, [isReady, pathname, router, user]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflow || "";
    }
    return () => {
      document.body.style.overflow = previousOverflow || "";
      document.body.style.pointerEvents = "";
    };
  }, [isMobileMenuOpen]);

  if (accessBlocked) {
    return <TenantAccessBlocked />;
  }

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
        <div className="fixed inset-0 z-40 overflow-hidden lg:hidden" aria-modal="true" role="dialog">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-y-0 right-0 left-[min(86vw,320px)] bg-slate-950/45" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 z-40 h-[100dvh] w-[min(86vw,320px)] max-w-[320px] overflow-hidden shadow-2xl">
            <Sidebar className="w-full" forceExpanded onNavigate={() => setIsMobileMenuOpen(false)} />
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

function TenantAccessBlocked() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold text-amber-600">Compte en pause</p>
        <h1 className="mt-2 text-2xl font-bold">Votre accès est temporairement suspendu.</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Contactez l&apos;administrateur ou le support VTA Commerce pour réactiver l&apos;accès.</p>
        <button type="button" onClick={() => { clearSession(); window.location.href = "/login"; }} className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Retour à la connexion</button>
      </section>
    </main>
  );
}
