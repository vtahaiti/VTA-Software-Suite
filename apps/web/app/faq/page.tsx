import Link from "next/link";

type Question = { q: string; a: string; kreyol?: string };
type Section = { title: string; items: Question[] };

const sections: Section[] = [
  {
    title: "Internet et connexion",
    items: [
      {
        q: "Est-ce que j'ai besoin d'internet tout le temps ?",
        a: "Le point de vente (POS) continue de fonctionner même sans connexion : vos ventes sont mises en attente sur l'appareil, puis envoyées automatiquement dès que le réseau revient. Consulter les rapports, changer les paramètres ou ajouter de nouveaux produits demande une connexion active.",
        kreyol: "Ou ka kontinye vann menm si pa gen entènèt — vant yo anrejistre e yo voye otomatikman lè entènèt la retounen."
      },
      {
        q: "Quel type de connexion suffit ?",
        a: "Une connexion simple (WiFi ou données mobiles) suffit pour la majorité des usages. Aucune connexion très rapide n'est nécessaire."
      }
    ]
  },
  {
    title: "Paiement et abonnement",
    items: [
      {
        q: "Combien coûte VTA Business ?",
        a: "Trois plans existent : Essentiel (1 000 HTG/mois), Professionnel (2 000 HTG/mois) et Expert (4 000 HTG/mois). Chaque plan ajoute des fonctionnalités et des limites plus larges (utilisateurs, magasins, dépôts, caisses)."
      },
      {
        q: "Puis-je changer de plan plus tard ?",
        a: "Oui. Vous pouvez demander un changement de plan depuis les paramètres d'abonnement de votre compte à tout moment."
      },
      {
        q: "Que se passe-t-il si je ne paie pas à temps ?",
        a: "L'accès peut être suspendu jusqu'au règlement. Vos données ne sont pas supprimées automatiquement lors d'une suspension."
      }
    ]
  },
  {
    title: "Impression",
    items: [
      {
        q: "Est-ce que je peux imprimer mes tickets de vente ?",
        a: "Oui, l'impression de tickets thermiques (58 mm et 80 mm) est incluse dès le plan Essentiel. L'impression de rapports complets au format Letter/A4 est disponible à partir du plan Professionnel.",
        kreyol: "Ou ka enprime tikè vant ou yo depi nan premye plan an."
      }
    ]
  },
  {
    title: "Produits, services et stock",
    items: [
      {
        q: "Comment fonctionne le suivi du stock ?",
        a: "Chaque vente met à jour votre stock automatiquement. Vous recevez une alerte quand un produit passe sous son seuil minimum. Un produit peut aussi être marqué « non suivi en stock » si vous ne voulez pas le compter (par exemple un service)."
      },
      {
        q: "Est-ce que je peux gérer plusieurs entrepôts ou zones de stock ?",
        a: "Oui, selon votre plan. Le nombre de dépôts autorisés dépend du plan choisi (1 pour Essentiel, 2 pour Professionnel, 10 pour Expert)."
      }
    ]
  },
  {
    title: "Utilisateurs et équipe",
    items: [
      {
        q: "Combien de personnes peuvent utiliser le compte ?",
        a: "2 utilisateurs avec le plan Essentiel, 5 avec le Professionnel, 15 avec l'Expert. Chaque utilisateur a son propre accès, ce qui permet de savoir qui a fait quelle vente.",
        kreyol: "Chak moun ka gen kont pa yo — ou ka wè ki moun ki fè ki vant."
      },
      {
        q: "Est-ce que je peux limiter ce qu'un employé peut voir ou faire ?",
        a: "Oui, chaque utilisateur reçoit un rôle avec des droits précis (par exemple : caissier, gérant, propriétaire)."
      }
    ]
  },
  {
    title: "Sécurité",
    items: [
      {
        q: "Mes données sont-elles en sécurité ?",
        a: "Les données de chaque entreprise sont isolées des autres entreprises utilisatrices. Les accès sensibles sont journalisés, et les données ne sont jamais vendues à des tiers. Voir notre politique de confidentialité pour le détail complet.",
        kreyol: "Done ou yo sove otomatikman — yo pa ka pèdi tankou yon kaye."
      },
      {
        q: "Que se passe-t-il si je perds mon téléphone ?",
        a: "Vos données restent sur le serveur, pas seulement sur l'appareil. Contactez le support pour sécuriser le compte et changer votre mot de passe depuis un autre appareil."
      }
    ]
  },
  {
    title: "Support",
    items: [
      {
        q: "Comment obtenir de l'aide si j'ai un problème ?",
        a: "Écrivez à support@vtaerp.com en indiquant le nom de votre entreprise, votre rôle et une description claire du problème. Voir la page Assistance pour le détail des types de demandes prises en charge.",
        kreyol: "Nou la avèk ou — ekri nou, n ap reponn ou."
      },
      {
        q: "Je ne sais pas utiliser un système, est-ce grave ?",
        a: "Non. L'installation se fait avec un accompagnement, pas seulement une vidéo. Le guide « Comment démarrer » explique les cinq premières étapes simplement."
      }
    ]
  }
];

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <Link href="/" className="text-sm font-semibold text-brand-600">VTA Commerce</Link>
        <div className="mt-4 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">Questions fréquentes</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Les réponses les plus utiles avant de démarrer avec VTA Business. Si vous ne trouvez pas votre réponse, contactez
            l&apos;assistance depuis la page dédiée.
          </p>
        </div>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{section.title}</h2>
              <div className="mt-3 space-y-4">
                {section.items.map((item) => (
                  <article key={item.q} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{item.q}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.a}</p>
                    {item.kreyol ? (
                      <p className="mt-2 text-sm italic leading-6 text-slate-500 dark:text-slate-400">{item.kreyol}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>

        <nav className="mt-8 flex flex-wrap gap-3 text-sm font-semibold" aria-label="Liens utiles">
          <Link href="/demarrer" className="text-brand-600">Comment démarrer</Link>
          <Link href="/support" className="text-brand-600">Assistance</Link>
          <Link href="/privacy" className="text-brand-600">Politique de confidentialité</Link>
          <Link href="/terms" className="text-brand-600">Conditions d&apos;utilisation</Link>
        </nav>
      </section>
    </main>
  );
}
