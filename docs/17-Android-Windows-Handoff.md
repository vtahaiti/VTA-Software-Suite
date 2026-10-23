# Reprendre VTA POS Android sur Windows

## Récupérer le travail

Dans un dépôt sans modifications locales non sauvegardées :

    git switch main
    git pull --ff-only origin main

Avec Node.js 24 LTS et Android Studio installés :

    npm ci
    npm run prisma:generate
    npm run test:ios-runtime
    npm run test:ios-offline
    npm run test:pos-plans
    npm run mobile:sync
    npm run mobile:open

Les noms des tests iOS désignent ici des tests JavaScript partagés ; ils peuvent fonctionner sous Windows.
`test:ios-escpos` utilise Swift/macOS et n'est pas requis sur Windows.
Les scripts mobile:sync/mobile:open ciblent Android. Les scripts ios:* restent séparés.

## Ce qui est partagé

Web, Android et iOS utilisent l'API VTA ERP, les mêmes comptes et les mêmes entreprises.
Le lot comprend les plans POS Gratuit/Basique/Premium et le premier mois d'essai,
la file de ventes locales isolée par entreprise/utilisateur, la réservation atomique de stock,
la synchronisation idempotente, les tickets locaux avec logo intégré et la conservation du papier d'origine.
Le serveur doit recevoir ses propres modifications avant d'utiliser la nouvelle synchronisation en production.
Aucun déploiement de production ni build Android n'a été effectué dans ce lot.

## Points Android à poursuivre

1. La configuration Android charge encore https://vtaerp.com. Les modifications locales web ne sont pas visibles dans l'app avant leur déploiement.
2. L'export embarqué sans server.url a été ajouté pour iOS seulement. Adapter et tester un bundle embarqué Android pour garantir l'ouverture du POS après un redémarrage sans Internet.
3. Vérifier le plugin VtaBluetoothPrinter Android, les autorisations, la liste des appareils, la reconnexion et les erreurs d'envoi. Le pilote CoreBluetooth Swift est réservé à iOS.
4. Vérifier les images du logo dans le moteur natif Android : l'intégration HTML et les données du logo sont partagées, mais le rendu Java/Kotlin n'a pas été validé.
5. Sur une vraie 2Connect POS80-01 V10 : imprimer le ticket de test 80 mm, logo, accents, montants et coupe ; tester une coupure Bluetooth puis une réimpression explicitement choisie.
6. Tester une vente sans Internet, la fermeture/réouverture de l'app, le journal local et la synchronisation contre une base de test réelle.
7. Déployer l'API et le web seulement après les vérifications habituelles de l'environnement de production.

## Vérifications déjà obtenues

43 tests JavaScript passent et l’export iOS/TypeScript passe.
12 vérifications Swift du protocole et des données de logo passent sur Mac.
La compilation et le lancement iOS Debug/Release ont été vérifiés sur simulateur; les tests physiques iPhone/imprimante restent à effectuer : voir 18-iOS-Release-Readiness.md.


## Comparaison et icône — 23 octobre 2026

- Même API, comptes, entreprises, plans et logique partagée de ventes/tickets.
- La nouvelle interface bleue et la navigation Accueil/Vendre/Stock/Plus sont activées par NEXT_PUBLIC_IOS_EMBEDDED uniquement. Android conserve donc l’interface web actuelle; ce n’est pas encore une parité visuelle.
- iOS embarque ses pages; Android conserve server.url=https://vtaerp.com. Le démarrage Android après fermeture complète sans Internet n’est pas garanti par la seule file IndexedDB.
- Android imprime en Bluetooth Classic SPP, iOS en BLE. La compatibilité physique d’une imprimante doit être validée pour chaque protocole.
- Les icônes de lancement Android (standard, rondes et adaptatives) utilisent maintenant la même source SVG VTA POS que l’icône iOS. Cinq densités sont générées par `node scripts/generate-android-branding.cjs`. Le nom affiché Android devient VTA POS; applicationId com.vtaerp.commerce est conservé.
- La génération des ressources ne publie rien sur Google Play ou App Store Connect. Recompiler et tester l’APK/AAB sous Windows. Aucun SDK Android/Android Studio n’a été trouvé dans cet environnement Mac aux emplacements usuels lors de cette vérification.

La commande Capacitor `sync android` a réussi pour ce lot d’icônes. Les dimensions des 15 PNG Android, le PNG iOS 1024×1024 sans canal alpha et les fichiers XML des icônes ont été vérifiés. Cette synchronisation ne constitue pas une compilation ni une installation d’APK/AAB.
