# VTA POS — corrections de préparation iOS

Date de vérification : 23 octobre 2026.

## Comportement livré

- L’app démarre sur le POS d’accueil, avec connexion et inscription accessibles. Le catalogue et l’encaissement restent réservés à l’entreprise authentifiée. Un utilisateur déjà connecté rejoint sa caisse; connexion et création d’entreprise redirigent vers le POS sur iOS.
- Le POS iOS suit la référence visuelle fournie : bleu/blanc, grille de produits avec images et bouton +, catégories horizontales, sélection de boutique, panier fixe et bouton Encaisser, navigation Accueil/Vendre/Stock/Plus. Les options clients, tickets et synchronisation restent accessibles. Aucun produit de démonstration n’est livré dans l’application.
- Le cycle de vie UIScene remplace le modèle UIApplication ancien qui empêchait le lancement avec le SDK iOS 27. Les liens locaux capacitor:// restent navigables.
- Le transport HTTP natif Capacitor est activé uniquement dans la configuration iOS. Les envois multipart de logo sont adaptés au pont Capacitor 6. Les demandes de synchronisation renouvellent les jetons expirés avant de réessayer.
- Le compte personnel peut être supprimé dans le profil ou sur /account-deletion, avec mot de passe et confirmation explicite. La réauthentification pour suppression fonctionne sans session d’abonnement et applique les blocages d’authentification. Elle n’accorde aucun accès commercial.
- La suppression anonymise irréversiblement l’identité, remplace le mot de passe par une valeur aléatoire, retire profil/rôles/jetons/notifications et révoque les sessions. Les documents partagés de l’entreprise sont conservés avec des références anonymisées. Les ventes locales en attente déclenchent un avertissement avec choix explicite avant abandon. Aucun compte réel n’a été supprimé pendant les tests.
- Les plans POS sont Gratuit, Basique 6,99 USD, Premium 10,99 USD et Pro 18,99 USD par mois et entreprise. Le premier mois complet reste offert sans prelevement; un essai termine passe automatiquement au plan Gratuit. Les offres ERP historiques restent distinctes.
- StoreKit 2 est integre au build 11 : prix localises Apple, achat lie au UUID du commerce, restauration, transactions inachevees, gestion/annulation et PurchaseIntent. Le serveur utilise la bibliotheque officielle Apple, verifie le JWS et consulte l'etat actuel Apple. Il traite les notifications V2, renouvellements, grace et remboursements. Les achats restent desactives tant que les cles, certificats et migration ne sont pas configures.
- Le groupe Apple 22508754 appartient au compte Shelton Metilis, equipe ZNWYGCAGBV. Trois produits mensuels sont crees : com.vtaerp.pos.basic.monthly (6826428950), com.vtaerp.pos.premium.monthly (6826428034), com.vtaerp.pos.pro.monthly (6826426767). Les prix de reference USD, descriptions francaises et 175 territoires sont enregistres. Le partage familial reste desactive et les achats multipostes sont desactives. Les produits restent a finaliser avant soumission; aucune transaction reelle ni soumission effectuee.
- La reprise d'inscription restitue le jeton et l'expiration d'origine seulement apres verification du mot de passe initial. Un autre mot de passe ne remplace pas les identifiants prepares; les echecs passent par le service de securite existant.
- Le mode hors ligne est limité à sept jours depuis une validation en ligne réussie. Cette limite locale n’est pas une attestation cryptographique; les autorisations du serveur restent nécessaires à la synchronisation. Les ventes en attente sont conservées lors d’une déconnexion.
- L'icone reste le carre bleu officiel aux trois barres orange/jaune/vert, sans texte. Ne pas lancer les anciens generateurs de branding qui remplaceraient cette icone.
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

1. API et web déployés en QA puis en production le 23 octobre. Le contrôle navigateur HTTPS de api.vtaerp.com/health/ready renvoie HTTP 200, PostgreSQL et 55 migrations. La migration Apple est terminée en production. La validation fonctionnelle des parcours reste nécessaire; le transport natif iOS est conservé.
2. Equipe confirmee par le proprietaire : Shelton Metilis, ZNWYGCAGBV, bundle com.vtaerp.pos. Build 11 compile et lance sur iPhone de Gerthley. Preparer une nouvelle archive et un transfert TestFlight apres configuration et tests Sandbox. Seul l'ancien build 1 est actuellement sur TestFlight.
3. Tester sur un iPhone physique : connexion, retour après interruption, ventes hors ligne puis synchronisation, partage PDF et impressions avec/sans logo. Pour la 2Connect POS80-01 V10, confirmer le profil BLE réel : le Bluetooth Classic SPP seul n’est pas utilisable par ce pilote CoreBluetooth.
4. Finaliser les captures App Store iPhone/iPad, le compte de revue dédié, les coordonnées de support et les déclarations de confidentialité. Ne pas utiliser les comptes de production ni un compte de démo privilégié de secours pour App Review.
5. Valider le parcours de suppression sur un compte de test jetable contre l’API déployée. Exporter ou transférer l’administration du commerce avant suppression d’un propriétaire.

6. Deployer d'abord en QA la migration 20261024010000_apple_subscriptions et l'API; renseigner les variables APPLE_IAP_* de .env.example. Coolify VTA ERP utilise des images issues d'un manifeste separe : un push applicatif ne les reconstruit pas automatiquement. QA déployée avec succès le 23 octobre à 23:48 UTC (manifest 8cb88c7), API 1811fb0 et web 15b9eef. /health/ready renvoie HTTP 200 avec 42 migrations; la migration Apple est terminée et sa table existe. Production déployée après sauvegarde PostgreSQL privée (~104 Mo), manifest 5a56ed2, mêmes images API/web vérifiées. Aucun volume ni donnée supprimé.
7. La clé In-App Purchase « VTA POS Server » est créée sur Shelton et conservée hors Git. Les secrets runtime et le certificat public Apple Root CA G3 sont enregistrés dans Coolify pour QA et production. Une vérification temporaire isolée contre Apple Sandbox réussit (historique des notifications accessible). Après autorisation explicite du propriétaire, chaque API possède un réseau bridge de sortie dédié (QA et ERP). Chaque réseau de sortie ne contient que son API; aucun port hôte ajouté. Les bases restent exclusivement sur leurs réseaux internal=true. Les deux API contactent Apple Sandbox avec succès. Le vrai domaine QA zdbbps30oh7g8h05dpvxcgdx.2.24.112.55.sslip.io possède un certificat HTTPS valide (une première lecture incorrecte du nom avait produit une erreur sur un autre nom; entrée temporaire retirée, aucun DNS supprimé). Le proxy QA conserve sa restriction IP. Configurer ensuite les notifications V2 et leur accès serveur Apple sans retirer la protection globale QA. Tester achat, restauration, changement de plan, renouvellement et remboursement en Sandbox sur un commerce jetable. Les tests de service utilisent Prisma et les reponses Apple simules. Aucune transaction Apple Sandbox ou production effectuee.
8. Apple refuse de desactiver l'achat simplifie avant qu'un binaire approuve contienne les API StoreKit requises. PurchaseIntent est ajoute au code; le reglage reste inchange en attendant l'approbation. Aucune promotion, offre externe ou code d'achat n'a ete active.

Le résultat des compilations/simulations ne constitue pas une validation TestFlight, une signature Apple ou une preuve de compatibilité de l’imprimante physique.

Références : [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Capacitor HTTP](https://capacitorjs.com/docs/apis/http).

## Vérification du lot abonnements

102 tests passent (services simulés et vérification de signature invalide avec la bibliothèque officielle Apple), compilation TypeScript API, validation Prisma, export/sync iOS et compilation native build 11 réussissent. Le build 11 est lancé sur l’iPhone physique de Gerthley; seul le build 1 reste téléversé sur TestFlight. Deux anciens contrôles par assertions textuelles (largeur ticket et texte notification admin) échouent aussi sur la base antérieure, sans régression introduite ici. Aucun achat Apple Sandbox/production réalisé.

Les images API/web sont construites sur le serveur; les anciens paramètres Nix PATH et Bash ont été retirés du manifeste QA pour utiliser Node Alpine. Une sauvegarde QA privée a été réalisée avant migration. La production utilise les nouvelles images vérifiées; APPLE_IAP_ENABLED=false est confirmé dans son environnement runtime. La même clé fonctionne en Sandbox depuis les deux API. Le test de l’API Apple Production renvoie 401 avant la première publication; le mainteneur Apple confirme que cet accès nécessite une version publiée. Ne pas confondre cette limite avec un échec réseau ou une validation de paiement réel.

Référence Apple pour la séparation Sandbox/Production et la première publication : https://github.com/apple/app-store-server-library-node/issues/209. TestFlight utilise Sandbox. Le build iOS courant pointe encore sur api.vtaerp.com; le parcours de paiement TestFlight doit être raccordé à un backend Sandbox approprié avant les tests réels.
