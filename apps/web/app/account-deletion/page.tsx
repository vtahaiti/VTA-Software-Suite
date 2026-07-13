import Link from "next/link";

export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <Link href="/" className="text-sm font-semibold text-brand-600">VTA Commerce</Link>
        <div className="mt-4 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">Suppression de compte et de donn&eacute;es</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Vous pouvez demander la suppression de votre compte VTA Commerce ou, si vous &ecirc;tes autoris&eacute;, la suppression de
            l&apos;entreprise associ&eacute;e. Cette proc&eacute;dure est con&ccedil;ue pour prot&eacute;ger les donn&eacute;es commerciales et emp&ecirc;cher
            toute suppression non autoris&eacute;e.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Comment faire la demande</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-600 dark:text-slate-300">
              <li>Envoyez un email &agrave; <a className="font-semibold text-brand-600" href="mailto:support@vtaerp.com">support@vtaerp.com</a>.</li>
              <li>Indiquez votre nom, l&apos;email du compte, le nom de l&apos;entreprise et votre r&ocirc;le.</li>
              <li>Pr&eacute;cisez si vous demandez la suppression d&apos;un utilisateur ou de toute l&apos;entreprise.</li>
              <li>Attendez la v&eacute;rification d&apos;identit&eacute; et d&apos;autorisation avant l&apos;ex&eacute;cution.</li>
            </ol>
          </article>

          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">D&eacute;lai de traitement</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Les demandes compl&egrave;tes sont g&eacute;n&eacute;ralement examin&eacute;es sous 30 jours. Une demande peut prendre plus de temps si
              elle exige une v&eacute;rification du propri&eacute;taire, une obligation l&eacute;gale, un litige, une facture ou une mesure de
              s&eacute;curit&eacute;.
            </p>
          </article>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Donn&eacute;es supprim&eacute;es</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Selon la port&eacute;e valid&eacute;e, la suppression peut retirer le profil utilisateur, les sessions, invitations, fichiers,
              param&egrave;tres, produits, clients, fournisseurs, achats, ventes, stocks, factures, notifications et autres donn&eacute;es
              li&eacute;es au tenant.
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Donn&eacute;es pouvant &ecirc;tre conserv&eacute;es</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              VTA Commerce peut conserver certains journaux de s&eacute;curit&eacute;, registres d&apos;abonnement, preuves de consentement,
              re&ccedil;us, traces d&apos;audit ou informations exig&eacute;es par la loi, uniquement pendant la dur&eacute;e n&eacute;cessaire.
            </p>
          </article>
        </div>

        <div className="mt-8 rounded-lg bg-amber-50 p-5 text-sm leading-7 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p>
            Une suppression d&apos;entreprise peut &ecirc;tre irr&eacute;versible. Si vous souhaitez d&apos;abord exporter vos donn&eacute;es,
            suspendre un utilisateur ou d&eacute;sactiver temporairement l&apos;acc&egrave;s, indiquez-le clairement dans votre demande.
          </p>
        </div>

        <nav className="mt-8 flex flex-wrap gap-3 text-sm font-semibold" aria-label="Liens utiles">
          <Link href="/privacy" className="text-brand-600">Politique de confidentialit&eacute;</Link>
          <Link href="/terms" className="text-brand-600">Conditions d&apos;utilisation</Link>
          <Link href="/support" className="text-brand-600">Assistance</Link>
        </nav>
      </section>
    </main>
  );
}
