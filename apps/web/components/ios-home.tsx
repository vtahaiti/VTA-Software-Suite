"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { BarChart3, ShoppingCart, Package, Users, ReceiptText, ChevronRight, AlertTriangle } from "lucide-react";

type HomeSummary = {
  kpis: { revenueToday: number; salesToday: number; lowStock: number; outOfStock: number };
  recentActivity: Array<{ type: string; label: string; amount: number; createdAt: string }>;
};
const shortcuts = [
  { label: "Nouvelle vente", href: "/dashboard/pos", icon: ShoppingCart },
  { label: "Produits", href: "/dashboard/products", icon: Package },
  { label: "Clients", href: "/dashboard/customers", icon: Users },
  { label: "Rapports", href: "/dashboard/reports", icon: BarChart3 }
];
const money = (value: number) => Number.isFinite(value) ? `${new Intl.NumberFormat("fr-HT", { maximumFractionDigits: 2 }).format(value)} HTG` : "— HTG";
type RecentSale = { id: string; total: number | string; createdAt: string; receipt?: { number: string } | null };

export function IosHome({ name, summary, loading, error }: { name: string; summary: HomeSummary; loading: boolean; error: string }) {
  const available = !loading && !error;
  const value = (amount: number) => available && Number.isFinite(amount) ? amount : "—";
  const [sales, setSales] = useState<RecentSale[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState(false);
  useEffect(() => {
    let active = true;
    void fetchWithAuth("/sales?status=COMPLETED&limit=4&page=1&excludeTestData=true").then(async response => {
      if (!response.ok) throw new Error("Sales unavailable");
      const data = await response.json();
      if (active) setSales(data.items ?? []);
    }).catch(() => { if (active) setSalesError(true); }).finally(() => { if (active) setSalesLoading(false); });
    return () => { active = false; };
  }, []);
  return <div className="ios-home">
    <div className="ios-page-intro"><h1>Bonjour, {name.split(" ")[0] || "à vous"}</h1><p>Voici un aperçu de votre activité.</p></div>
    {error && <div role="alert" className="ios-notice"><AlertTriangle size={18} /><span>{error}</span><button onClick={() => window.location.reload()}>Réessayer</button></div>}
    <section className="ios-revenue" aria-busy={loading} aria-label="Ventes du jour"><BarChart3 size={26} /><div><p>Ventes du jour</p><strong>{available ? money(summary.kpis.revenueToday) : "— HTG"}</strong></div></section>
    <div className="ios-home-metrics"><Link href="/dashboard/sales/completed"><ShoppingCart size={22} /><div><strong>{value(summary.kpis.salesToday)}</strong><span>ventes aujourd’hui</span></div><ChevronRight size={16} /></Link><Link href="/dashboard/inventory"><Package size={22} /><div><strong>{value(summary.kpis.lowStock)}</strong><span>stock faible</span></div><ChevronRight size={16} /></Link></div>
    <nav className="ios-home-shortcuts" aria-label="Actions rapides">{shortcuts.map(({ label, href, icon: Icon }) => <Link key={href} href={href}><span><Icon size={23} /></span>{label}</Link>)}</nav>
    {available && summary.kpis.outOfStock > 0 && <Link className="ios-stock-alert" href="/dashboard/inventory"><AlertTriangle size={18} />{summary.kpis.outOfStock} produit(s) en rupture<ChevronRight size={16} /></Link>}
    <section className="ios-activity"><div className="ios-section-title"><h2>Dernières ventes</h2><Link href="/dashboard/sales/completed">Voir tout <ChevronRight size={14} /></Link></div>
      {salesLoading ? <p className="ios-empty">Chargement des ventes…</p> : salesError ? <p className="ios-empty">Les ventes sont indisponibles pour le moment.</p> : !sales.length ? <p className="ios-empty">Aucune vente récente.</p> : <div className="ios-activity-list">{sales.slice(0, 4).map(item => <div key={item.id}><span className="ios-activity-icon"><ReceiptText size={19} /></span><div><strong>{item.receipt?.number ?? "Vente"}</strong><span>{new Date(item.createdAt).toLocaleString("fr-HT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div><b>{money(Number(item.total))}</b></div>)}</div>}
    </section>
  </div>;
}
