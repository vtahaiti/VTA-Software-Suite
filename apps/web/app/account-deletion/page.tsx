import Link from "next/link";

export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900 dark:bg-slate-950 dark:text-white">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link href="/" className="text-sm font-semibold text-brand-600">VTA Commerce</Link>
        <h1 className="mt-4 text-3xl font-bold">Suppression de compte</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Un utilisateur peut demander la suppression de son compte ou de son entreprise en contactant
          <a className="font-semibold text-brand-600" href="mailto:support@vtaerp.com"> support@vtaerp.com</a>.
          Pour prot&eacute;ger les donn&eacute;es commerciales, VTA Commerce v&eacute;rifie l&apos;identit&eacute;, le r&ocirc;le et l&apos;autorisation du demandeur
          avant toute suppression.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Une suppression d&apos;entreprise peut entra&icirc;ner la suppression irr&eacute;versible des utilisateurs, produits, ventes,
          achats, stocks, fichiers, param&egrave;tres et autres donn&eacute;es du tenant, selon la politique l&eacute;gale applicable.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Si vous souhaitez seulement d&eacute;sactiver un utilisateur, suspendre l&apos;acc&egrave;s ou exporter vos donn&eacute;es avant
          suppression, pr&eacute;cisez-le dans votre demande.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/privacy" className="text-brand-600">Politique de confidentialit&eacute;</Link>
          <Link href="/terms" className="text-brand-600">Conditions d&apos;utilisation</Link>
          <Link href="/support" className="text-brand-600">Assistance</Link>
        </div>
      </section>
    </main>
  );
}
