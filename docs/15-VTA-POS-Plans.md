# Offre gratuite ajoutée

POS_FREE : 0 USD, sans expiration, un utilisateur, une boutique, un dépôt et une caisse.
Inclut POS, produits, catégories, clients, historique, rapports essentiels et tickets thermiques.
Le suivi d'inventaire, les ventes en attente et les utilisateurs supplémentaires commencent avec Basique.
Aucun quota de produits ou de ventes n'est ajouté.
Le plan gratuit passe pour l'instant par le même circuit de demande et de validation administrative, sans paiement requis.
Chaque nouvelle entreprise reçoit un premier mois calendaire gratuit avec toutes les fonctionnalités (Premium et Expert inclus). L'échéance est calculée en UTC, au même jour du mois suivant, ajustée au dernier jour si nécessaire. Aucun prélèvement ni conversion payante automatique. À l'expiration, le flux existant bloque l'essai ; le client peut demander Gratuit, Basique ou Premium. Le champ historique trialDays=30 reste indicatif pour compatibilité ; trialEndsAt fait foi.
L'activation gratuite efface l'ancienne échéance d'essai pour éviter une expiration résiduelle.

# VTA POS — plans mensuels

Deux offres par entreprise : POS_BASIC à 6 USD/mois et POS_PREMIUM à 10 USD/mois.
Les offres ERP ESSENTIAL, STANDARD et EXPERT restent au catalogue avec leurs tarifs HTG.
Une entreprise choisit un seul abonnement à la fois. Ces offres réutilisent le POS existant ; elles ne constituent pas une nouvelle application native autonome.

| Capacité | Basique | Premium |
|---|---|---|
| Utilisateurs, propriétaire inclus | 2 | 5 |
| Magasins / dépôts / caisses | 1 / 1 / 1 | 1 / 1 / 3 |
| Produits, catégories, stock, clients, ventes en attente et historique | Oui | Oui |
| Rapports essentiels et tickets thermiques | Oui | Oui |
| Achats, fournisseurs, alertes stock, rapports avancés, import/export | Non | Oui |
| Rôles avancés et reçus email | Non | Oui |

Aucun quota de produits ou de ventes n'est ajouté. Les permissions métier et contrôles de stock existants restent applicables.
Le changement de rôle requiert désormais ROLES_PERMISSIONS côté API, y compris pour les offres ERP.

## Activation

Le catalogue est synchronisé au démarrage de l'API par le mécanisme existant.
La page Abonnement affiche les tarifs, limites et fonctionnalités et permet une demande de plan.
L'administrateur valide la demande via le flux existant après vérification du paiement.
L'approbation d'un plan POS fixe la fin de période au même jour du mois suivant en UTC,
avec ajustement au dernier jour si nécessaire. Aucun prélèvement automatique n'est ajouté.
Après expiration, le bouton Renouveler permet de redemander le même plan POS.
Les correspondances historiques ESSENTIAL/STANDARD sont conservées, et planId porte l'offre POS exacte.

## Vérification et suites

Tests ciblés : `npm run test:pos-plans` (Node 24 avec prise en charge TypeScript) et `npm run test:subscriptions`.
Avant mise en production : installer les dépendances, générer Prisma, compiler API/web,
tester en base la demande, l'approbation, l'expiration et le renouvellement,
puis vérifier les écrans et les fonctions hors ligne sur téléphone.
La configuration Android conserve VTA Commerce et son URL existante. La configuration iOS utilise désormais un export embarqué ; voir docs/16-iOS-Validation.md.
L'intégration d'un fournisseur de paiement, la publication mobile et un parcours POS dédié restent à réaliser.

Deux tests existants échouent également sur le commit de départ b0fdb51 :
`web-print-subscription-smoke.cjs` (largeurs tickets) et
`subscription-notifications-smoke.cjs` (compteur de destinataires).
Ils ne sont pas corrigés dans ce changement de plans.
