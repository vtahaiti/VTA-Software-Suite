import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">VTA ERP</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">Pilotez votre commerce, vos magasins et vos ventes depuis une seule plateforme.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">VTA ERP est une plateforme SaaS multi-tenant pour produits, inventaire, POS, facturation, clients, achats, rapports et gestion multi-magasins.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-md bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">Commencer gratuitement</Link>
            <Link href="/login" className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-900">Se connecter</Link>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-3 sm:grid-cols-2">
            {['POS rapide','Stock temps reel','Multi-magasins','Factures','Clients CRM','Rapports'].map((item) => <div key={item} className="rounded-md bg-white p-4 text-sm font-semibold shadow-sm dark:bg-slate-950">{item}</div>)}
          </div>
        </div>
      </section>
    </main>
  );
}