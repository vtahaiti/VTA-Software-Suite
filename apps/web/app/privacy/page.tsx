import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900 dark:bg-slate-950 dark:text-white">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link href="/" className="text-sm font-semibold text-brand-600">VTA Commerce</Link>
        <h1 className="mt-4 text-3xl font-bold">Politique de confidentialité</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          VTA Commerce traite les informations nécessaires à la gestion commerciale des entreprises utilisatrices :
          comptes utilisateurs, coordonnées professionnelles, produits, ventes, achats, stocks, paramètres et journaux
          de sécurité. Ces données sont utilisées uniquement pour fournir le service, sécuriser les accès, assurer le
          support et respecter les obligations légales applicables.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Les données de chaque entreprise sont isolées par tenant. VTA Commerce ne vend pas les données clients. Les
          accès administratifs sont limités aux opérations de support, de sécurité, d&apos;abonnement et de maintenance.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Pour toute demande relative à vos données, à une exportation ou à une suppression de compte, contactez{" "}
          <a className="font-semibold text-brand-600" href="mailto:support@vtaerp.com">support@vtaerp.com</a>.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/faq" className="text-brand-600">Questions fréquentes</Link>
          <Link href="/terms" className="text-brand-600">Conditions d&apos;utilisation</Link>
          <Link href="/support" className="text-brand-600">Assistance</Link>
          <Link href="/account-deletion" className="text-brand-600">Suppression de compte</Link>
        </div>
      </section>
    </main>
  );
}
