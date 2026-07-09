export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Mode hors ligne</p>
        <h1 className="mt-3 text-2xl font-bold">Connexion indisponible</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Le POS peut continuer avec les produits deja charges. Les ventes seront enregistrees localement puis synchronisees quand l API revient.</p>
        <a href="/dashboard/pos" className="mt-5 inline-flex rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Retour au POS</a>
      </section>
    </main>
  );
}
