import Link from "next/link";

const cards = [
  { title: "Devis en attente", href: "/dashboard/sales/quotes?status=DRAFT", text: "Preparer et suivre les propositions de prix sans toucher au stock." },
  { title: "Commandes en cours", href: "/dashboard/sales/proformas?status=CONFIRMED", text: "Suivre les commandes confirmees avant livraison ou cloture." },
  { title: "Acomptes recus", href: "/dashboard/sales/proformas?status=PARTIALLY_PAID", text: "Voir les commandes avec avances deja enregistrees." },
  { title: "Soldes a recevoir", href: "/dashboard/sales/proformas?status=PARTIALLY_PAID", text: "Retrouver les commandes non soldees." },
  { title: "Commandes pretes", href: "/dashboard/sales/proformas?status=READY", text: "Identifier ce qui est pret a livrer, installer ou remettre au client." },
  { title: "Commandes terminees", href: "/dashboard/sales/proformas?status=COMPLETED", text: "Voir les commandes cloturees." }
];

const posLinks = [
  { title: "Ventes en attente POS", href: "/dashboard/sales/in-progress", text: "Paniers et tickets suspendus au comptoir." },
  { title: "Historique des ventes POS", href: "/dashboard/sales/completed", text: "Ventes finalisees depuis la caisse." }
];

export default function SalesPage() {
  return <div className="space-y-5">
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-brand-600">Devis & Commandes</p>
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Commandes, acomptes et soldes</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
        Utilisez cette section pour preparer un devis, confirmer une commande, recevoir un acompte et suivre le solde restant.
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => <Link key={card.href} href={card.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">{card.title}</h2>
        <p className="mt-2 text-sm text-slate-500">{card.text}</p>
      </Link>)}
    </div>

    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <h2 className="text-base font-semibold">Regle V1</h2>
      <p className="mt-1">
        Un devis ne modifie pas le stock. Une commande peut recevoir un acompte et un solde, mais elle ne finalise pas une vente POS automatiquement.
      </p>
    </div>

    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
      <h2 className="text-base font-semibold text-slate-950 dark:text-white">A ne pas confondre avec le POS</h2>
      <p className="mt-1 text-sm text-slate-500">
        Ventes en attente concerne les paniers POS suspendus. Devis & Commandes concerne les devis, commandes, avances et soldes.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {posLinks.map((link) => <Link key={link.href} href={link.href} className="rounded-md border border-slate-200 bg-white p-4 text-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900">
          <span className="font-semibold">{link.title}</span>
          <span className="mt-1 block text-slate-500">{link.text}</span>
        </Link>)}
      </div>
    </div>

    <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
      <h2 className="text-base font-semibold text-slate-950 dark:text-white">Factures et retours</h2>
      <p className="mt-1">
        Factures = documents finalises issus d&apos;une vente ou d&apos;une commande. Retours produits reste un flux separe pour ne pas melanger les commandes et les corrections apres vente.
      </p>
    </div>
  </div>;
}
