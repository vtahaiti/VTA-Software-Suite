import Link from "next/link";

const steps = ["Logo entreprise", "Premier magasin", "Premier depot", "Premiere caisse", "Ajouter premiers produits", "Inviter employes", "Terminer"];

export default function OnboardingWelcomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 dark:bg-slate-950">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Bienvenue sur VTA ERP</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">Votre espace est pret.</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Nous avons cree votre entreprise, votre premier magasin, votre depot principal et votre caisse principale.</p>
        <div className="mt-8 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full w-full bg-brand-600" /></div>
        <div className="mt-6 grid gap-3">
          {steps.map((step, index) => <div key={step} className="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{index + 1}</span><span className="text-sm font-medium text-slate-800 dark:text-slate-100">{step}</span></div>)}
        </div>
        <Link href="/dashboard" className="mt-8 inline-flex rounded-md bg-brand-600 px-5 py-3 text-sm font-semibold text-white">Aller au tableau de bord</Link>
      </section>
    </main>
  );
}