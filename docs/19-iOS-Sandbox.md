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
