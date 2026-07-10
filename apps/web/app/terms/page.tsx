import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 dark:bg-slate-950">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link href="/" className="text-sm font-semibold text-brand-600">VTA Commerce</Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">Conditions d’utilisation provisoires</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Cette page est un emplacement provisoire. Les conditions juridiques officielles de VTA Commerce doivent être fournies et validées par l’entreprise avant publication définitive.
        </p>
      </section>
    </main>
  );
}
