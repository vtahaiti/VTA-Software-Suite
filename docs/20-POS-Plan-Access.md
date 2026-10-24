# VTA POS — visibilité et droits des plans

Les quatre plans existants sont conservés. Les prix Apple localisés sont prioritaires; les montants USD ci-dessous restent les tarifs de référence mensuels par entreprise.

| Plan | Tarif USD | Utilisateurs actifs | Boutiques | Dépôts | Caisses |
|---|---:|---:|---:|---:|---:|
| Gratuit | 0 | 1 | 1 | 1 | 1 |
| Basique | 6,99 | 2 | 1 | 1 | 1 |
| Premium | 10,99 | 5 | 1 | 1 | 3 |
| Pro | 18,99 | 15 | 5 | 10 | 10 |

- Gratuit : caisse, catalogue/catégories, clients, historique, rapports essentiels et tickets thermiques.
- Basique : Gratuit + stock, ventes en attente, équipe dans la limite du plan et notifications internes.
- Premium : Basique + achats/fournisseurs, alertes de stock, rapports avancés, import/export, rôles/permissions, reçus email et impression de documents.
- Pro : toutes les fonctionnalités du catalogue, notamment transferts, audit/analyses avancés et plusieurs structures.
- Essai : premier mois offert, toutes les fonctionnalités dans les limites Pro; aucun paiement automatique. L’essai ne peut pas être racheté comme un produit Apple.

La source des fonctionnalités et plafonds reste `subscription-features.ts` côté API; la comparaison iOS affiche les fonctionnalités et limites renvoyées par cette API. Le rôle d’un membre reste une condition distincte : souscrire ne donne aucune nouvelle permission à ce membre.

## Changements

Une carte Mon abonnement est placée sur Accueil et Plus. Un accès compact est disponible sur les autres écrans hors vente. L’écran des plans affiche les quatre plafonds et la liste des fonctionnalités de chaque plan. Les fonctions indisponibles conduisent à un écran d’explication avec comparaison des plans, et les menus Plus les signalent par un cadenas.

Le shell iOS vérifie les droits avant de monter un écran payant, recharge après achat/restauration, retour au premier plan et retour du réseau. Les derniers droits sont mis en cache par entreprise uniquement pendant une session hors ligne encore valide (7 jours maximum); une période payante expirée ne débloque pas les fonctions. Le cache est nettoyé à la déconnexion et au changement d’entreprise. Une réponse API 401/403 n’est pas remplacée par un droit issu du cache.

Côté API, ajout des contrôles manquants sur stock/mouvements/ajustements, imports/exports directs et génériques, alertes, transferts, rôles, audit et autres routes POS correspondantes. Le tableau des rapports ne renvoie plus de données avancées au plan essentiel; des objets vides marqués `locked` gardent la forme attendue par les anciens clients. Les paiements multiples sont également contrôlés au niveau du service de vente, y compris les ventes hors ligne synchronisées.

Création/réactivation d’utilisateurs, boutiques, dépôts et caisses : comptage frais et écriture dans une même transaction Serializable, avec au plus trois tentatives en cas de conflit. La réactivation reprend une place; une modification déjà active n’en consomme pas une deuxième. Les zones système du restaurant conservent l’exclusion déjà prévue par la politique existante. Une baisse de plan ne supprime pas les données; si les ressources existantes dépassent le plafond, aucune nouvelle place ne peut être ajoutée.

## Validation

Types API/web vérifiés et 43 tests réussis, dont matrice Gratuit/Basique/Premium/Pro/Essai, expiration du cache, contrôle API même pour Owner, quotas et conflits concurrents. Vérification visuelle dans l’aperçu iOS connecté au vrai compte QA Basique. 

Image API vta-pos-api:3ac1e30 déployée sur QA puis ERP après sauvegarde. Refus HTTP 403 FEATURE_NOT_INCLUDED pour fournisseurs/achats/rôles/audit/transferts/alertes/exports/profits avec le compte QA Basique; accès produits, stock et rapports essentiels HTTP 200. Création supplémentaire de boutique/dépôt/caisse : HTTP 403 SUBSCRIPTION_LIMIT_REACHED. Test réel de deux créations simultanées pour la dernière place utilisateur : HTTP 201 et 403; compte synthétique créé puis désactivé après test. Les rapports avancés restent vides et marqués locked. Aucun test d’achat d’un autre plan n’est revendiqué.

Build 1.0 (17) signé, transféré et en cours de test externe/interne dans TestFlight. Build réservé au compte QA et au serveur Sandbox. Source/configuration iOS de production restaurées. La vérification visuelle porte sur l’aperçu connecté QA, pas sur l’écran physique du build 17. Les paiements production restent désactivés et l’échec de restauration StoreKit / 2 reste ouvert.
