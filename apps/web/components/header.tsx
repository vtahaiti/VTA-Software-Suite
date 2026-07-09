"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthUser, getAccessToken, logout } from "@/lib/auth";
import { CompanyBranding, getCompanyBranding } from "@/lib/company-branding";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type HeaderProps = { user: AuthUser | null };
type Notification = { id: string; title: string; message: string; type: string; status: string; module?: string; createdAt: string };

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);

  useEffect(() => { void loadNotifications(); void loadBranding(); }, []);

  async function loadBranding() {
    const token = getAccessToken();
    if (!token) return;
    setBranding(await getCompanyBranding(token).catch(() => null));
  }

  async function loadNotifications() {
    const token = getAccessToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const [countResponse, itemsResponse] = await Promise.all([
      fetch(`${apiUrl}/notifications/unread-count`, { headers }).catch(() => null),
      fetch(`${apiUrl}/notifications?status=unread`, { headers }).catch(() => null)
    ]);
    if (countResponse?.ok) setCount(((await countResponse.json()) as { count: number }).count);
    if (itemsResponse?.ok) setItems(((await itemsResponse.json()) as Notification[]).slice(0, 5));
  }

  async function markAsRead(id: string) {
    const token = getAccessToken();
    if (!token) return;
    await fetch(`${apiUrl}/notifications/${id}/read`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    await loadNotifications();
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const companyName = branding?.companyName ?? user?.tenant ?? "Mon entreprise";
  const userName = branding?.userName ?? user?.name ?? "Utilisateur";
  const companyInitials = branding?.companyInitials ?? (companyName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ME");
  const userInitials = branding?.userInitials ?? userName.charAt(0).toUpperCase();
  const primaryColor = branding?.primaryColor ?? "#2563eb";

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 sm:px-4 lg:px-8 lg:py-3">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={`Logo ${companyName}`} className="h-8 w-8 rounded-md object-cover shadow-sm sm:h-10 sm:w-10" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white shadow-sm sm:h-10 sm:w-10 sm:text-sm" style={{ backgroundColor: primaryColor }}>{companyInitials}</div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide sm:text-xs" style={{ color: primaryColor }}>{companyName}</p>
            <h2 className="truncate text-sm font-semibold text-slate-950 dark:text-white sm:text-lg">Bonjour {userName.split(" ")[0]}</h2>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <div className="relative">
            <button onClick={() => setIsOpen((value) => !value)} className="relative rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:px-3 sm:text-sm">
              <span className="sm:hidden">🔔</span>
              <span className="hidden sm:inline">Notifications</span>
              {count > 0 ? <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">{count}</span> : null}
            </button>
            {isOpen ? <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-5.5rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-slate-800"><p className="text-sm font-bold">Notifications</p><Link href="/dashboard/notifications" className="text-xs font-semibold text-brand-600">Voir tout</Link></div>
              {items.length ? items.map((item) => <button key={item.id} onClick={() => void markAsRead(item.id)} className="block w-full border-b border-slate-100 p-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950"><p className="text-sm font-semibold text-slate-950 dark:text-white">{item.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{item.message}</p></button>) : <div className="p-4 text-sm text-slate-500">Aucune notification non lue.</div>}
            </div> : null}
          </div>
          <Link href="/dashboard/profile" className="hidden items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex">
            {branding?.userPhotoUrl ? <img src={branding.userPhotoUrl} alt="Photo utilisateur" className="h-8 w-8 rounded-full object-cover" /> : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{userInitials}</div>}
            <div className="leading-tight"><p className="text-sm font-semibold text-slate-950 dark:text-white">{userName}</p><p className="text-xs text-slate-500 dark:text-slate-400">{branding?.role ?? user?.role ?? "Session"}</p></div>
          </Link>
          <button onClick={handleLogout} className="rounded-md bg-slate-950 px-2.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 sm:px-3 sm:text-sm"><span className="sm:hidden">Sortir</span><span className="hidden sm:inline">Deconnexion</span></button>
        </div>
      </div>
    </header>
  );
}

