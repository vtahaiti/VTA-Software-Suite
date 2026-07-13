import Link from "next/link";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <Link href="/" className="text-sm font-semibold text-brand-600">VTA Commerce</Link>
        <div className="mt-4 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">Assistance VTA Commerce</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Cette page explique comment contacter l&apos;assistance pour l&apos;application VTA Commerce, y compris les questions de
            compte, d&apos;abonnement, de s&eacute;curit&eacute;, d&apos;acc&egrave;s et de suppression de donn&eacute;es.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Contact principal</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Envoyez votre demande &agrave;
              <a className="font-semibold text-brand-600" href="mailto:support@vtaerp.com"> support@vtaerp.com</a>.
              Indiquez le nom de votre entreprise, votre r&ocirc;le, la page concern&eacute;e et une description claire du probl&egrave;me.
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">S&eacute;curit&eacute;</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              N&apos;envoyez jamais de mot de passe, de jeton, de cl&eacute; API, de num&eacute;ro de carte bancaire ou de capture contenant des
              donn&eacute;es confidentielles. VTA peut demander une v&eacute;rification d&apos;identit&eacute; avant toute action sensible.
            </p>
          </article>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="text-lg font-semibold">Types de demandes prises en charge</h2>
          <ul className="mt-3 grid gap-2 text-sm leading-7 text-slate-600 dark:text-slate-300 sm:grid-cols-2">
            <li>Connexion, mot de passe et acc&egrave;s utilisateur</li>
            <li>Abonnement, essai, suspension ou r&eacute;activation</li>
            <li>Facturation, re&ccedil;us et informations administratives</li>
            <li>Import, export, impression ou fonctionnement mobile</li>
            <li>Demande de suppression de compte ou d&apos;entreprise</li>
            <li>Signalement d&apos;incident de s&eacute;curit&eacute;</li>
          </ul>
        </div>

        <div className="mt-8 rounded-lg bg-slate-100 p-5 text-sm leading-7 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <p>
            D&eacute;lai indicatif de r&eacute;ponse : les demandes courantes sont trait&eacute;es d&egrave;s que possible pendant les heures ouvrables.
            Les demandes sensibles, comme la suppression d&apos;une entreprise ou la r&eacute;activation d&apos;un compte suspendu, peuvent
            n&eacute;cessiter des v&eacute;rifications suppl&eacute;mentaires.
          </p>
        </div>

        <nav className="mt-8 flex flex-wrap gap-3 text-sm font-semibold" aria-label="Liens utiles">
          <Link href="/privacy" className="text-brand-600">Politique de confidentialit&eacute;</Link>
          <Link href="/terms" className="text-brand-600">Conditions d&apos;utilisation</Link>
          <Link href="/account-deletion" className="text-brand-600">Suppression de compte</Link>
        </nav>
      </section>
    </main>
  );
}
