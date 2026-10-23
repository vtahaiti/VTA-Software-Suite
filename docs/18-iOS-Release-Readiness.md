# VTA POS — corrections de préparation iOS

Date de vérification : 23 octobre 2026.

## Comportement livré

- L’app démarre sur le POS d’accueil, avec connexion et inscription accessibles. Le catalogue et l’encaissement restent réservés à l’entreprise authentifiée. Un utilisateur déjà connecté rejoint sa caisse; connexion et création d’entreprise redirigent vers le POS sur iOS.
- Le POS iOS suit la référence visuelle fournie : bleu/blanc, grille de produits avec images et bouton +, catégories horizontales, sélection de boutique, panier fixe et bouton Encaisser, navigation Accueil/Vendre/Stock/Plus. Les options clients, tickets et synchronisation restent accessibles. Aucun produit de démonstration n’est livré dans l’application.
- Le cycle de vie UIScene remplace le modèle UIApplication ancien qui empêchait le lancement avec le SDK iOS 27. Les liens locaux capacitor:// restent navigables.
- Le transport HTTP natif Capacitor est activé uniquement dans la configuration iOS. Les envois multipart de logo sont adaptés au pont Capacitor 6. Les demandes de synchronisation renouvellent les jetons expirés avant de réessayer.
- Le compte personnel peut être supprimé dans le profil ou sur /account-deletion, avec mot de passe et confirmation explicite. La réauthentification pour suppression fonctionne sans session d’abonnement et applique les blocages d’authentification. Elle n’accorde aucun accès commercial.
- La suppression anonymise irréversiblement l’identité, remplace le mot de passe par une valeur aléatoire, retire profil/rôles/jetons/notifications et révoque les sessions. Les documents partagés de l’entreprise sont conservés avec des références anonymisées. Les ventes locales en attente déclenchent un avertissement avec choix explicite avant abandon. Aucun compte réel n’a été supprimé pendant les tests.
- Le mode iOS est un compagnon gratuit : il affiche les droits du compte existant sans demande d’achat ni renouvellement. Les plans Gratuit, 6 USD et 10 USD/mois/entreprise et le premier mois d’essai complet restent inchangés côté serveur/web/Android. Aucun StoreKit n’est prétendu implémenté; l’éligibilité finale au modèle compagnon relève d’App Review (3.1.3(f)).
- Le mode hors ligne est limité à sept jours depuis une validation en ligne réussie. Cette limite locale n’est pas une attestation cryptographique; les autorisations du serveur restent nécessaires à la synchronisation. Les ventes en attente sont conservées lors d’une déconnexion.
- Icône et écrans de lancement VTA POS remplacent les éléments Capacitor génériques. Leur source vectorielle est reproductible avec scripts/generate-ios-branding.cjs.
- Le compte de démonstration de secours n’est plus autorisé en production; son usage local exige AUTH_DEMO_ENABLED=true.

## Vérification reproductible

```sh
node --test scripts/ios-runtime.test.cjs scripts/ios-offline.test.cjs scripts/receipt-logo.test.cjs scripts/offline-idempotency.test.cjs scripts/pos-plans.test.cjs scripts/ios-publication.test.cjs scripts/ios-ui.test.cjs
node scripts/test-ios-escpos.cjs
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
npm run ios:sync --workspace=@vta/web
npm run ios:open --workspace=@vta/web
```

43 tests JavaScript passent. Les 12 vérifications Swift hôte passent. Le bundle iOS exporte 109 routes. La compilation native Debug puis Release et le lancement ont été vérifiés dans Xcode sur un iPhone 18 Pro simulé sous iOS 27.0. Les liens connexion/inscription fonctionnent après correction des liens capacitor://. Un test local du POS avec données fictives a confirmé trois articles et un total de 875 HTG. Les captures de cette fixture portent la mention données de test.

Les tests de suppression exécutent la logique de service avec transactions simulées; ils ne remplacent pas un test d’intégration PostgreSQL sur un tenant jetable. Les tests Swift hôte couvrent le protocole et la préparation du logo, sans périphérique BLE.

## Conditions encore nécessaires avant soumission

1. Déployer l’API et le web depuis le commit de corrections. Le 23 octobre, le serveur vivant ne renvoyait toujours pas Access-Control-Allow-Origin pour capacitor://localhost. Le transport natif iOS traite ce cas, mais les nouveaux endpoints de suppression doivent absolument être déployés (POST /profile/delete-account renvoyait encore 404 lors du contrôle). Aucun déploiement Coolify n’a été exécuté depuis cette session.
2. Choisir l’équipe Apple propriétaire de VTA POS, confirmer com.vtaerp.pos, créer une archive Release signée, puis valider dans App Store Connect. Ne pas reprendre l’équipe d’une autre application sans validation du propriétaire.
3. Tester sur un iPhone physique : connexion, retour après interruption, ventes hors ligne puis synchronisation, partage PDF et impressions avec/sans logo. Pour la 2Connect POS80-01 V10, confirmer le profil BLE réel : le Bluetooth Classic SPP seul n’est pas utilisable par ce pilote CoreBluetooth.
4. Finaliser les captures App Store iPhone/iPad, le compte de revue dédié, les coordonnées de support et les déclarations de confidentialité. Ne pas utiliser les comptes de production ni un compte de démo privilégié de secours pour App Review.
5. Valider le parcours de suppression sur un compte de test jetable contre l’API déployée. Exporter ou transférer l’administration du commerce avant suppression d’un propriétaire.

Le résultat des compilations/simulations ne constitue pas une validation TestFlight, une signature Apple ou une preuve de compatibilité de l’imprimante physique.

Références : [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Capacitor HTTP](https://capacitorjs.com/docs/apis/http).
