import Link from "next/link";

export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <Link href="/" className="text-sm font-semibold text-brand-600">VTA Commerce</Link>
        <div className="mt-4 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">Suppression de compte et de données</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Vous pouvez demander la suppression de votre compte VTA Commerce ou, si vous êtes autorisé, la suppression de
            l&apos;entreprise associée. Cette procédure est conçue pour protéger les données commerciales et empêcher
            toute suppression non autorisée.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Comment faire la demande</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-600 dark:text-slate-300">
              <li>Envoyez un email à <a className="font-semibold text-brand-600" href="mailto:support@vtaerp.com">support@vtaerp.com</a>.</li>
              <li>Indiquez votre nom, l&apos;email du compte, le nom de l&apos;entreprise et votre rôle.</li>
              <li>Précisez si vous demandez la suppression d&apos;un utilisateur ou de toute l&apos;entreprise.</li>
              <li>Attendez la vérification d&apos;identité et d&apos;autorisation avant l&apos;exécution.</li>
            </ol>
          </article>

          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Délai de traitement</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Les demandes complètes sont généralement examinées sous 30 jours. Une demande peut prendre plus de temps si
              elle exige une vérification du propriétaire, une obligation légale, un litige, une facture ou une mesure de
              sécurité.
            </p>
          </article>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Données supprimées</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Selon la portée validée, la suppression peut retirer le profil utilisateur, les sessions, invitations, fichiers,
              paramètres, produits, clients, fournisseurs, achats, ventes, stocks, factures, notifications et autres données
              liées au tenant.
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Données pouvant être conservées</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              VTA Commerce peut conserver certains journaux de sécurité, registres d&apos;abonnement, preuves de consentement,
              reçus, traces d&apos;audit ou informations exigées par la loi, uniquement pendant la durée nécessaire.
            </p>
          </article>
        </div>

        <div className="mt-8 rounded-lg bg-amber-50 p-5 text-sm leading-7 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p>
            Une suppression d&apos;entreprise peut être irréversible. Si vous souhaitez d&apos;abord exporter vos données,
            suspendre un utilisateur ou désactiver temporairement l&apos;accès, indiquez-le clairement dans votre demande.
          </p>
        </div>

        <nav className="mt-8 flex flex-wrap gap-3 text-sm font-semibold" aria-label="Liens utiles">
          <Link href="/faq" className="text-brand-600">Questions fréquentes</Link>
          <Link href="/privacy" className="text-brand-600">Politique de confidentialité</Link>
          <Link href="/terms" className="text-brand-600">Conditions d&apos;utilisation</Link>
          <Link href="/support" className="text-brand-600">Assistance</Link>
        </nav>
      </section>
    </main>
  );
}
