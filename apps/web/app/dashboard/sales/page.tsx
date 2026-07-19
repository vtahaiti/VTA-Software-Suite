import Link from "next/link";

const cards = [
  { title: "Devis en attente", href: "/dashboard/sales/quotes?status=DRAFT", text: "Prix proposes au client, sans impact sur le stock." },
  { title: "Commandes en preparation", href: "/dashboard/sales/proformas?status=IN_PROGRESS", text: "Commandes confirmees a preparer avant remise ou livraison." },
  { title: "Balances a recevoir", href: "/dashboard/sales/proformas?status=PARTIALLY_PAID", text: "Commandes avec un reste a payer." },
  { title: "Commandes pretes", href: "/dashboard/sales/proformas?status=READY", text: "Commandes pretes pour remise, livraison ou installation." },
  { title: "Commandes terminees", href: "/dashboard/sales/proformas?status=COMPLETED", text: "Commandes cloturees dans le module." },
  { title: "Avances recues", href: "/dashboard/sales/proformas?status=PARTIALLY_PAID", text: "Paiements deja recus avant la balance finale." }
];

const flowSteps = [
  "1. Devis",
  "2. Commande",
  "3. Avance",
  "4. Balance",
  "5. Termine"
];

export default function SalesPage() {
  return <div className="space-y-5">
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-brand-600">Devis & Commandes</p>
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Devis, commandes, avances et balances</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
        Utilisez ce module pour les ventes non immediates : produit existant ou service personnalise, devis, commande, avance, balance, puis termine.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {flowSteps.map((step) => <span key={step} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-200">{step}</span>)}
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-2">
      <Link href="/dashboard/sales/quotes/create" className="rounded-lg bg-brand-600 p-5 text-white shadow-sm transition hover:bg-brand-700">
        <span className="text-sm font-semibold opacity-90">Devis client</span>
        <h2 className="mt-1 text-xl font-bold">Nouveau devis</h2>
        <p className="mt-2 text-sm opacity-90">Preparer un prix sans toucher au stock.</p>
      </Link>
      <Link href="/dashboard/sales/proformas/create" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900">
        <span className="text-sm font-semibold text-brand-600">Commandes & avances</span>
        <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Nouvelle commande</h2>
        <p className="mt-2 text-sm text-slate-500">Suivre Total, Avance, Balance et statut.</p>
      </Link>
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
        Un devis ne modifie pas le stock. Une commande peut recevoir une avance et la balance, mais elle ne finalise pas une vente POS automatiquement.
      </p>
    </div>

    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      <h2 className="text-base font-semibold text-slate-950 dark:text-white">Flux separe du POS</h2>
      <p className="mt-1">Ventes en attente = panier POS suspendu. Devis & Commandes = client qui commande, verse une avance, puis regle la balance.</p>
      <p className="mt-2">Les documents finalises et corrections apres vente restent separes pour garder cette V1 simple.</p>
    </div>
  </div>;
}
