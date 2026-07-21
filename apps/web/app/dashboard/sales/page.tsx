import Link from "next/link";

const flowSteps = ["1. Devis", "2. Commande", "3. Avance", "4. Balance", "5. Livraison", "6. Terminé"];

const dashboardCards = [
  { title: "Devis en attente", href: "/dashboard/sales/quotes?status=DRAFT", text: "Prix préparés pour les clients." },
  { title: "Commandes en préparation", href: "/dashboard/sales/proformas?status=CONFIRMED", text: "Commandes confirmées à préparer." },
  { title: "Commandes prêtes", href: "/dashboard/sales/proformas?status=READY", text: "Commandes prêtes pour livraison ou remise." },
  { title: "Balances à recevoir", href: "/dashboard/sales/proformas?paymentStatus=PARTIALLY_PAID", text: "Commandes avec un reste à payer." },
  { title: "Avances reçues", href: "/dashboard/sales/proformas?paymentStatus=PARTIALLY_PAID", text: "Paiements reçus avant la balance finale." },
  { title: "Commandes terminées", href: "/dashboard/sales/proformas?status=COMPLETED", text: "Commandes clôturées." }
];

export default function SalesPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-brand-600">Devis & Commandes</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Devis, commandes, avances et balances</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Préparez un devis, transformez-le en commande, recevez une avance, puis suivez la balance jusqu&apos;à la livraison.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {flowSteps.map((step) => (
            <span key={step} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-200">{step}</span>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Link href="/dashboard/sales/quotes/create" className="rounded-lg bg-brand-600 p-5 text-white shadow-sm transition hover:bg-brand-700">
          <span className="text-sm font-semibold opacity-90">Devis client</span>
          <h2 className="mt-1 text-xl font-bold">Créer un devis</h2>
          <p className="mt-2 text-sm opacity-90">Produit du catalogue ou service personnalisé, sans toucher au stock.</p>
        </Link>
        <Link href="/dashboard/sales/proformas/create" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-sm font-semibold text-brand-600">Commandes & avances</span>
          <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Créer une commande</h2>
          <p className="mt-2 text-sm text-slate-500">Suivre Total, Avance, Balance, préparation et livraison.</p>
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboardCards.map((card) => (
          <Link key={card.href} href={card.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{card.text}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
        <h2 className="text-base font-semibold text-slate-950 dark:text-white">Flux séparé du POS</h2>
        <p className="mt-1">Ventes en attente = panier POS suspendu. Devis & Commandes = client qui demande un prix, confirme une commande, verse une avance, puis règle la balance.</p>
      </section>
    </div>
  );
}
