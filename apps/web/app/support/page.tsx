import Link from "next/link";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <Link href="/" className="text-sm font-semibold text-brand-600">VTA Commerce</Link>
        <div className="mt-4 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">Assistance VTA Commerce</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Cette page explique comment demander de l&apos;aide pour l&apos;application VTA Commerce : connexion, impression,
            abonnement, sécurité, accès et suppression de données.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Comment demander de l&apos;aide</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Envoyez votre demande à{" "}
              <a className="font-semibold text-brand-600" href="mailto:support@vtaerp.com">support@vtaerp.com</a>.
              Indiquez le nom de votre entreprise, votre rôle, la page concernée et une description claire du problème
              (idéalement avec une capture d&apos;écran).
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Contact WhatsApp</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Le canal WhatsApp officiel de l&apos;assistance sera communiqué prochainement. En attendant, l&apos;email reste le
              moyen le plus rapide et le plus sûr pour être pris en charge.
            </p>
          </article>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Problème de connexion</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Vérifiez d&apos;abord votre connexion internet et que l&apos;email et le mot de passe sont corrects. Utilisez
              « Mot de passe oublié » sur la page de connexion pour le réinitialiser. Si le problème persiste, contactez
              l&apos;assistance en précisant le message d&apos;erreur affiché.
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Impression</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              L&apos;impression de tickets thermiques (58/80 mm) est disponible dès le plan Essentiel. L&apos;impression de
              rapports complets au format Letter/A4 demande le plan Professionnel ou supérieur. Vérifiez que votre
              imprimante est bien connectée à l&apos;appareil utilisé pour la caisse.
            </p>
          </article>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="text-lg font-semibold">Abonnement</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Pour changer de plan, suspendre ou réactiver un abonnement, rendez-vous dans les paramètres d&apos;abonnement de
            votre compte, ou contactez l&apos;assistance si vous n&apos;y avez plus accès. Voir la{" "}
            <Link href="/faq" className="font-semibold text-brand-600">foire aux questions</Link> pour le détail des plans.
          </p>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="text-lg font-semibold">Sécurité</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
            N&apos;envoyez jamais de mot de passe, de jeton, de clé API, de numéro de carte bancaire ou de capture contenant
            des données confidentielles. VTA peut demander une vérification d&apos;identité avant toute action sensible.
          </p>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="text-lg font-semibold">Types de demandes prises en charge</h2>
          <ul className="mt-3 grid gap-2 text-sm leading-7 text-slate-600 dark:text-slate-300 sm:grid-cols-2">
            <li>Connexion, mot de passe et accès utilisateur</li>
            <li>Abonnement, essai, suspension ou réactivation</li>
            <li>Facturation, reçus et informations administratives</li>
            <li>Import, export, impression ou fonctionnement mobile</li>
            <li>Demande de suppression de compte ou d&apos;entreprise</li>
            <li>Signalement d&apos;incident de sécurité</li>
          </ul>
        </div>

        <div className="mt-8 rounded-lg bg-slate-100 p-5 text-sm leading-7 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <p>
            Délai indicatif de réponse : les demandes courantes sont traitées dès que possible pendant les heures ouvrables.
            Les demandes sensibles, comme la suppression d&apos;une entreprise ou la réactivation d&apos;un compte suspendu, peuvent
            nécessiter des vérifications supplémentaires.
          </p>
        </div>

        <nav className="mt-8 flex flex-wrap gap-3 text-sm font-semibold" aria-label="Liens utiles">
          <Link href="/faq" className="text-brand-600">Questions fréquentes</Link>
          <Link href="/demarrer" className="text-brand-600">Comment démarrer</Link>
          <Link href="/privacy" className="text-brand-600">Politique de confidentialité</Link>
          <Link href="/terms" className="text-brand-600">Conditions d&apos;utilisation</Link>
          <Link href="/account-deletion" className="text-brand-600">Suppression de compte</Link>
        </nav>
      </section>
    </main>
  );
}
