import Link from "next/link";
const cards = [
  { title: "En cours", href: "/dashboard/sales/in-progress", text: "Brouillons POS, commandes en attente et paiements partiels." },
  { title: "Terminées", href: "/dashboard/sales/completed", text: "Ventes payées ou clôturées." },
  { title: "Annulées", href: "/dashboard/sales/cancelled", text: "Historique des ventes annulées." },
  { title: "Devis", href: "/dashboard/sales/quotes", text: "Preparer un prix client sans impacter le stock." },
  { title: "Commandes & Acomptes", href: "/dashboard/sales/proformas", text: "Commandes confirmees, acomptes et soldes." },
  { title: "Factures", href: "/dashboard/sales/invoices", text: "Factures directes et annulations." },
  { title: "Retours", href: "/dashboard/sales/returns", text: "Retour produit et remise en stock." }
];
export default function SalesPage() { return <div className="space-y-5"><div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-medium text-brand-600">Devis & Commandes</p><h1 className="text-2xl font-bold text-slate-950 dark:text-white">Ventes</h1><p className="mt-1 text-sm text-slate-500">Devis, commandes, acomptes, factures et retours compatibles clients, produits, inventaire et POS.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map((card)=><Link key={card.href} href={card.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">{card.title}</h2><p className="mt-2 text-sm text-slate-500">{card.text}</p></Link>)}</div></div>; }
