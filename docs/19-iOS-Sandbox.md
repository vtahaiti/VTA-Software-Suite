# iOS — builds Sandbox et production

Les builds iOS normaux utilisent `https://api.vtaerp.com` et l’origine locale `capacitor://localhost`. Aucun endpoint arbitraire n’est accepté.

Pour compiler et synchroniser une version de test :

```sh
VTA_IOS_ENVIRONMENT=sandbox npm run ios:sync --workspace=@vta/web
```

Cette commande exporte le web avec l’API QA HTTPS, affiche une mention Sandbox sur l’accueil et configure le WebView sur `capacitor://sandbox.localhost`. Les sessions, IndexedDB et ventes hors ligne du WebView de production restent dans leur origine d’origine. Aucun stockage utilisateur n’est effacé. Le pont HTTP natif Capacitor reste actif.

Le fichier généré `ios-bundle/vta-build-environment.json` lie le bundle à son environnement. Une synchronisation/copie dont l’environnement diffère du bundle échoue avant modification de la configuration Capacitor. Une modification incompatible du modèle de configuration échoue également. Le fichier Android `capacitor.config.ts` est restauré même en cas d’échec de la commande Capacitor.

Pour revenir à la configuration normale :

```sh
npm run ios:sync --workspace=@vta/web
```

Pour une archive de test, utiliser une copie temporaire du fichier Info.plist avec `CFBundleDisplayName = VTA POS Test`, puis passer cette copie comme `INFOPLIST_FILE` lors de l’archive. Ne pas committer un nom de test dans le fichier Info.plist de production. Le build 12 a été archivé avec ce nom et vérifié dans le produit signé; le fichier source a ensuite été restauré.

## Vérification du 23 octobre 2026

- 114 tests passent : suites iOS existantes, abonnements et nouveau choix d’environnement.
- Refus d’une copie production sur le bundle Sandbox vérifié avant la bonne synchronisation Sandbox.
- Build web Sandbox puis sync iOS réussis; export/sync production rétablis ensuite.
- Archive 1.0 (12), arm64, bundle `com.vtaerp.pos`, équipe Shelton Metilis : créée dans Xcode, validation Apple réussie, transfert App Store Connect réussi.
- Archive contrôlée : nom VTA POS Test, hostname sandbox.localhost, métadonnées embarquées Sandbox et API QA correcte.
- Une entreprise synthétique dédiée a été créée uniquement dans la base QA (42 migrations vérifiées avant création). Ses identifiants aléatoires sont privés, hors Git. Connexion réelle HTTP 201, catalogue Apple HTTP 200 avec configured/canManage/canPurchase=true, trois produits attendus, fausse transaction rejetée HTTP 400.
- Aucun achat, remboursement ou restauration Apple réel/Sandbox réalisé. Aucune donnée d’entreprise de production modifiée par la fixture.

Le build TestFlight de test doit rester présenté comme Sandbox. Le prochain build de publication devra utiliser l’environnement production et un numéro supérieur à 12. La réception d’une archive par Apple ne remplace pas une validation de transaction StoreKit sur téléphone.

## TestFlight et notifications — validation complémentaire

- Identifiants du compte QA synthétique enregistrés dans les informations Apple Review avec autorisation explicite du propriétaire; aucun secret dans Git.
- Build 1.0 (12) soumis pour vérification externe. App Store Connect affiche ensuite « En cours de test » dans le groupe externe VTA POS — Test iPhone (4 testeurs), et le groupe interne (1 testeur).
- Notification TEST demandée via le SDK Apple officiel le 24 octobre 2026 à 01:17:48 UTC : livraison confirmée SUCCESS à 01:18:53 UTC.
- URL Sandbox enregistrée : https://api.vtaerp.com/subscription/apple/notifications?environment=sandbox . La règle proxy correspond uniquement à POST sur ce chemin et ce sélecteur; elle cible le serveur QA. Le traitement de production reste désactivé.
- Une notification Apple signée a également été acceptée HTTP 201; une fausse signature est rejetée HTTP 400. Cela ne valide pas encore un achat, une restauration ou un renouvellement StoreKit sur iPhone.

## Retour aux comptes réels — build 13

Le build 12 QA ne reconnaît pas les identifiants de production. À la demande du propriétaire, le build 13 est archivé avec l’API production, l’origine localhost et le nom VTA POS vérifiés dans l’archive signée. Le bundle production et la configuration native avaient été restaurés avant cette archive. Aucun compte ni mot de passe de production modifié. Les paiements de production restent désactivés jusqu’à validation appropriée.

## Accès QA sur le domaine API

Après des erreurs iPhone NSURLError -1005 intermittentes sur le domaine sslip.io, les nouveaux bundles Sandbox utilisent `https://api.vtaerp.com/pos-sandbox`. Le hostname local reste sandbox.localhost. La configuration normale reste https://api.vtaerp.com avec localhost.

Le fichier dynamique distinct `/data/coolify/proxy/dynamic/vta-pos-qa-api-alias.yaml` ajoute uniquement Host(api.vtaerp.com) et PathPrefix(/pos-sandbox/), avec suppression du préfixe vers le service QA existant, Cache-Control no-store et X-VTA-Environment Sandbox. Les routeurs existants, les bases et les ports restent inchangés; les contrôles JWT/entreprise du serveur QA restent obligatoires. Trois connexions successives via cet accès renvoient 201, les catalogues Apple 200 configured/canPurchase=true, les abonnements anonymes 401. La production reste prête avec 55 migrations et QA avec 42. Le contrôle iPhone de cet accès reste à confirmer.

Les boutons d’abonnement expliquent désormais leur état désactivé (propriétaire, essai, configuration, offre Apple absente), et les offres Apple peuvent être rechargées. Le journal natif rapporte uniquement le nombre de produits ou le domaine/code d’erreur, sans données de transaction ni secrets. Les 23 tests de droits d’achat, abonnements et UI passent.

Le build 15 est désormais en cours de test sur TestFlight (groupe externe 4 testeurs, groupe interne 1). Archive signée vérifiée : API QA sur /pos-sandbox, sandbox.localhost, nom VTA POS Test. La compilation/lancement du simulateur réussit et les écrans accueil/connexion sont contrôlés. Le parcours StoreKit reste non validé. La configuration source/générée normale a été restaurée après ces essais.

## Diagnostic de restauration — build 16 sur TestFlight

Le propriétaire confirme les offres Apple actives sur le build 15 et rapporte un achat Basique réussi. Le contrôle indépendant du compte QA retourne toutefois POS_FREE / MANUAL; la transaction et son activation serveur ne sont donc pas validées. Le compte de production utilisé ensuite ne correspond pas au compte synthétique QA.

La restauration sur téléphone retourne le message générique natif « La restauration Apple a échoué. Réessayez. ». Ce message provient du bloc AppStore.sync()/lecture des transactions, avant vérification API. La cause Apple exacte reste inconnue. Le correctif distingue StoreKitError.userCancelled et networkError, et fournit domaine/code pour les autres erreurs; aucun userInfo, identifiant Apple, reçu ou mot de passe n’est journalisé. Aucun droit payant n’est accordé sur la seule base d’un message utilisateur ou d’une erreur de synchronisation.

Compilation simulateur Xcode et 20 tests d’abonnements/droits d’achat réussis. Un nouveau test sur téléphone reste nécessaire; ce changement améliore le diagnostic et ne constitue pas une preuve de réparation de StoreKit.

Archive signée du build 16 contrôlée (VTA POS Test, API /pos-sandbox, sandbox.localhost), transfert Apple réussi et état « En cours de test » confirmé dans le groupe externe (4 testeurs). Groupe interne ajouté (1 testeur); notifications automatiques activées. Configuration production source/générée rétablie. Aucun achat/restauration serveur validé à cette étape.

## Build 17 — visibilité et application des plans

Le build 17 est en cours de test externe/interne, avec notifications automatiques. Archive arm64 signée Shelton, version, nom VTA POS Test, API /pos-sandbox et sandbox.localhost contrôlés. Export/sync normaux restaurés. La page Abonnement expose les fonctionnalités et quatre quotas par plan; Accueil/Plus présentent une carte dédiée et les autres écrans un accès compact.

Image API vta-pos-api:3ac1e30 déployée sur QA puis ERP après sauvegarde. Le vrai compte QA Basique peut lire produits/stock/rapports essentiels mais ne peut pas appeler fournisseurs, achats, rôles, audit, transferts, alertes ou exports avancés. Création de boutique/dépôt/caisse refusée au plafond; deux créations utilisateur simultanées pour la dernière place donnent 201 et 403. Compte synthétique supplémentaire désactivé après test. QA conserve 42 migrations; ERP 55.

Achat Sandbox Basique validé par Apple puis par l’API (POS_BASIC ACTIVE, APPLE). La restauration StoreKit / 2 n’est toujours pas validée; la mise en œuvre des quotas ne change pas ce statut.

## Build 18 — TestFlight actif

Le build 18 ajoute la lecture du plan pour les membres sans permission de gestion des paramètres. 44 tests passent. Archive signée, API /pos-sandbox, sandbox.localhost et nom VTA POS Test vérifiés, transfert Apple réussi. Export/sync source et généré normaux restaurés. API 6638b3e active QA/ERP; profils supplémentaires soumis à MULTI_ACTIVITY, refus Basique vérifié. Groupes interne (1) et externe (4) ajoutés; état externe « En cours de test » confirmé, notifications automatiques activées. Restauration StoreKit / 2 toujours ouverte.
