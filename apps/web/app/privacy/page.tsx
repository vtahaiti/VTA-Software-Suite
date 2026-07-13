import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900 dark:bg-slate-950 dark:text-white">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link href="/" className="text-sm font-semibold text-brand-600">VTA Commerce</Link>
        <h1 className="mt-4 text-3xl font-bold">Politique de confidentialit&eacute;</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          VTA Commerce traite les informations n&eacute;cessaires &agrave; la gestion commerciale des entreprises utilisatrices :
          comptes utilisateurs, coordonn&eacute;es professionnelles, produits, ventes, achats, stocks, param&egrave;tres et journaux
          de s&eacute;curit&eacute;. Ces donn&eacute;es sont utilis&eacute;es uniquement pour fournir le service, s&eacute;curiser les acc&egrave;s, assurer le
          support et respecter les obligations l&eacute;gales applicables.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Les donn&eacute;es de chaque entreprise sont isol&eacute;es par tenant. VTA Commerce ne vend pas les donn&eacute;es clients. Les
          acc&egrave;s administratifs sont limit&eacute;s aux op&eacute;rations de support, de s&eacute;curit&eacute;, d&apos;abonnement et de maintenance.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Pour toute demande relative &agrave; vos donn&eacute;es, &agrave; une exportation ou &agrave; une suppression de compte, contactez
          <a className="font-semibold text-brand-600" href="mailto:support@vtaerp.com"> support@vtaerp.com</a>.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/terms" className="text-brand-600">Conditions d&apos;utilisation</Link>
          <Link href="/support" className="text-brand-600">Assistance</Link>
          <Link href="/account-deletion" className="text-brand-600">Suppression de compte</Link>
        </div>
      </section>
    </main>
  );
}
