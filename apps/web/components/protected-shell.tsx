"use client";
import { networkTimeout } from "@/lib/network-timeout";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { iosBackHref, iosRouteNeedsId } from "@/lib/ios-route-map";
import { IosBackNavigation } from "@/components/ios-back-navigation";
import { IosBottomNav } from "@/components/ios-bottom-nav";
import { IosPageContent } from "@/components/ios-page-content";
import Link from "next/link";
import { ChevronLeft, Store } from "lucide-react";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { fetchApi } from "@/lib/api-url";
import { AuthUser, clearSession, clearTenantScopedCaches, getAccessToken, getCurrentUser, hasValidOfflineSession, refreshSession, updateStoredUser } from "@/lib/auth";
import { canAccessHref } from "@/lib/role-access";
import { CompanyBranding, getCompanyBranding } from "@/lib/company-branding";
import { getTenantBusinessConfiguration, TenantBusinessConfiguration } from "@/lib/business-profiles";
import { tenantPageTitle } from "@/lib/tenant-page-title";
import { isTenantAccessBlockedResponse } from "@/lib/tenant-access";

type ProtectedShellProps = {
  children: ReactNode | ((user: AuthUser) => ReactNode);
};

export function ProtectedShell({ children }: ProtectedShellProps) {
  const router = useRouter();
  const [screenBack, setScreenBack] = useState<(() => void) | null>(null);
  const setScreenBackAction = useCallback((action: (() => void) | null) => setScreenBack(() => action), []);
  const pathname = usePathname();
  const search = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [business, setBusiness] = useState<TenantBusinessConfiguration | null>(null);

  useEffect(() => {
    async function loadSession() {
      const currentUser = getCurrentUser();
      const currentToken = getAccessToken();
      let sessionUser: AuthUser | null = null;

      if (currentUser && currentToken) {
        const response = navigator.onLine ? await fetchApi("/auth/me", { signal: networkTimeout(5000), headers: { Authorization: `Bearer ${currentToken}` } }).catch(() => null) : null;
        if (!response && process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1" && hasValidOfflineSession()) {
          sessionUser = currentUser;
        } else if (response?.ok) {
          const body = await response.json().catch(() => null) as { user?: AuthUser } | null;
          sessionUser = body?.user ?? currentUser;
          if (sessionUser.tenantId !== currentUser.tenantId) clearTenantScopedCaches("tenant-mismatch");
          updateStoredUser(sessionUser);
        } else if (response && await isTenantAccessBlockedResponse(response)) {
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
        router.push(process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1" ? "/" : "/login");
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
    if (!user) return;
    let mounted = true;
    setBranding(null);
    setBusiness(null);
    async function loadTenantIdentity() {
      const token = getAccessToken();
      if (!token) return;
      const [nextBranding, nextBusiness] = await Promise.all([
        getCompanyBranding(token).catch(() => null),
        getTenantBusinessConfiguration().catch(() => null)
      ]);
      if (!mounted) return;
      setBranding(nextBranding);
      setBusiness(nextBusiness);
    }
    void loadTenantIdentity();
    window.addEventListener("vta:branding-updated", loadTenantIdentity);
    window.addEventListener("vta:business-profile-updated", loadTenantIdentity);
    return () => {
      mounted = false;
      window.removeEventListener("vta:branding-updated", loadTenantIdentity);
      window.removeEventListener("vta:business-profile-updated", loadTenantIdentity);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    document.title = tenantPageTitle(pathname, {
      companyName: branding?.companyName ?? user.tenant,
      businessProfileType: business?.businessProfileType
    });
  }, [branding?.companyName, business?.businessProfileType, pathname, user]);

  useEffect(() => {
    if (!isReady || !user) return;
    if (!canAccessHref(user, pathname === "/offline" || pathname === "/offline/" ? "/dashboard/pos" : pathname)) router.replace("/dashboard");
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

  if (process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1") return (
    <IosBackNavigation.Provider value={setScreenBackAction}><div className="ios-app-shell min-h-screen bg-[#f5f7fb] text-[#111b3c]">
      {pathname.replace(/\/$/, "") !== "/dashboard/pos" && <header className="ios-app-header"><div>{!["/dashboard", "/dashboard/inventory", "/dashboard/more"].includes(pathname.replace(/\/$/, "")) && (screenBack ? <button type="button" aria-label="Retour au profil" className="ios-back" onClick={screenBack}><ChevronLeft size={22} /></button> : <Link aria-label="Retour" className="ios-back" href={iosBackHref(pathname, search.toString())}><ChevronLeft size={22} /></Link>)}<Link href="/dashboard" className="ios-wordmark"><span>VTA</span> POS</Link></div><span className="ios-business-chip"><Store size={14} /><span>{branding?.companyName || user.tenant}</span></span></header>}
      <IosPageContent sale={pathname.replace(/\/$/, "") === "/dashboard/pos"}>{iosRouteNeedsId(pathname) && !search.get("id") ? <div className="ios-empty">Choisissez un élément depuis la liste.<Link href={iosBackHref(pathname)} className="block mt-3 underline">Retour à la liste</Link></div> : typeof children === "function" ? children(user) : children}</IosPageContent>
      <IosBottomNav />
    </div></IosBackNavigation.Provider>
  );

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
        <Header
          user={user}
          branding={branding}
          businessActivity={business?.primaryActivity ?? business?.profiles.find((profile) => profile.isPrimary)?.name}
          onMenuClick={() => setIsMobileMenuOpen((value) => !value)}
        />
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
        <a href="/account-deletion" className="mt-4 block text-sm underline">Supprimer mon compte</a>
        <button type="button" onClick={() => { clearSession(); window.location.href = "/login"; }} className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Retour à la connexion</button>
      </section>
    </main>
  );
}
