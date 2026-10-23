# VTA POS — iOS, Bluetooth et ventes hors ligne

## État actuel

Projet : apps/web/ios/App/App.xcodeproj. Identifiant provisoire : com.vtaerp.pos.
Cible iOS 15+. Aucun certificat ni compte Apple n'a été modifié. Aucun déploiement effectué.

## Application embarquée

L'app iOS charge maintenant un export web local, généré par scripts/build-ios-web.cjs,
et ne dépend plus de server.url pour ouvrir les écrans du POS.
Le contrôleur iOS fournit un routeur pour les index.html de Next export ; le routeur SPA standard de Capacitor ne suffisait pas.
Au lancement, l'écran local ouvre le POS. Sans session enregistrée, une connexion initiale reste obligatoire.
Les routes ERP dynamiques de détail ne sont pas exportées : les liens ouvrent la version web lorsqu'Internet est disponible.
Les opérations serveur (création de comptes, configuration de caisse, achats, rapports actualisés) requièrent toujours Internet.

## Préparation et ventes offline

Après connexion et ouverture d'une caisse en ligne : le contexte, le catalogue du dépôt sélectionné,
les paramètres de taxes et les préférences d'impression sont préparés localement.
Le catalogue est paginé et téléchargé en entier pour ce dépôt. L'interface indique le nombre de produits prêts.

- Les données sont isolées par entreprise, utilisateur et dépôt.
- La vente et sa réservation de stock sont enregistrées dans une seule transaction IndexedDB.
- Une insuffisance ou un produit absent annule toute la transaction.
- La déconnexion ne supprime pas les ventes en attente ; reconnecter le même utilisateur permet de les retrouver.
- Les ventes restent sur l'appareil. Une désinstallation ou un effacement des données système peut les supprimer.
- Les tickets HTML locaux sont conservés et peuvent être réimprimés sans serveur.
- Le journal /offline affiche les ventes, conflits et erreurs ainsi que la commande de synchronisation.
- Sur le build iOS embarqué, une nouvelle vente est enregistrée localement avant sa synchronisation, même avec Internet.
- Le backend utilise un identifiant déterministe par entreprise/utilisateur/vente locale pour éviter de recréer une vente après une réponse perdue.
- La finalisation d'une vente déjà en attente sur le serveur nécessite Internet ; les nouvelles ventes locales restent disponibles.
- Les conflits multi-appareils, stock serveur ou caisse clôturée doivent être résolus ; ils ne sont pas effacés silencieusement.

Le backend doit être déployé avec les changements de synchronisation et l'origine CORS capacitor://localhost.
Ces modifications n'ont pas été appliquées au serveur de production.

## Bluetooth iOS

VtaBluetoothPrinterPlugin ajoute la recherche BLE, la sélection de l'imprimante,
la mémorisation du choix, la reconnexion, le rendu HTML en bitmap ESC/POS et l'envoi par blocs.
Les profils série BLE reconnus sont filtrés par caractéristique ; aucun pilote Bluetooth Classic SPP/MFi fabricant n'est intégré.
Une coupure pendant l'envoi produit une erreur sans réimpression automatique sur un second service.
Le résultat « sent » confirme l'envoi logiciel, pas la sortie physique du papier.

Modèle demandé : **2Connect POS80-01 V10**, papier 80 mm, profil de départ 576 points à 203 dpi.
Le fabricant documente ESC/POS pour la famille POS80-01 ; le document trouvé ne prouve pas le profil BLE de la variante V10.
La compatibilité exacte V10 reste donc **non confirmée** avant découverte des services BLE et ticket physique.
Si cette variante expose seulement SPP, ce pilote CoreBluetooth ne suffira pas.
AirPrint et partage PDF restent disponibles en complément.

Références :
- https://www.2connet.com/uploads/file/Data%20Sheet%202Connect%202C-POS80-01.pdf
- https://developer.apple.com/bluetooth/
- https://capacitorjs.com/docs/v6/ios
- https://capacitorjs.com/docs/v6/ios/privacy-manifest

## Vérifications

- Export Next de production : réussi, 108 pages statiques générées.
- TypeScript web et API : réussi après génération Prisma.
- 20 tests automatisés : plans, dates, runtime d'impression, transactions offline, séparation des données, réservations et idempotence de synchronisation.
- Test dans le navigateur intégré avec données factices et API simulée coupée : rechargement du POS,
  ajout d'un produit à 10 HTG avec 10 % de taxe, paiement local de 11 HTG, stock passant de 5 à 4,
  puis rechargement du journal avec la vente toujours présente et un bouton de réimpression.
- Ce test navigateur ne valide ni WKWebView sur iPhone ni le matériel Bluetooth.
- Syntaxe Swift et fichiers plist valides ; synchronisation Capacitor iOS réussie.

## Blocages et validations restantes

- Compilation native Xcode non validée : la résolution SPM échoue dans l'environnement avec sandbox-exec: sandbox_apply: Operation not permitted.
- Simulateur non disponible : CoreSimulatorService connection became invalid / Connection refused.
- Aucun binaire signé, installation sur iPhone, test radio BLE ou ticket physique validé.
- Tester sur iPhone la recherche 2Connect V10, son profil BLE, le rendu/coupe, une perte de connexion et la réimpression choisie par l'utilisateur.
- Tester la synchronisation contre une base de test réelle, dont une réponse perdue après commit.
- L'icône et le splash Capacitor sont encore génériques ; StoreKit n'est pas intégré.

## Commandes

Depuis la racine, installer les dépendances puis :

    npm run ios:sync --workspace=@vta/web
    npm run ios:open --workspace=@vta/web
    npm run test:ios-runtime
    npm run test:ios-offline
    npm run test:pos-plans

Les tests TypeScript directs de plans nécessitent Node 24+.

## Impression — suite de la validation

- Chaque vente locale conserve le papier utilisé ; les réimpressions 58 mm gardent 384 points au lieu de passer à 576.
- Les anciens tickets 58 mm sont reconnus via leur règle de page HTML si le champ de largeur est absent.
- Le ticket de calibration 2Connect 80 mm contient des accents français/créoles, des colonnes, le total, le reçu et la monnaie. Il ne crée aucune vente.
- La sélection d'imprimante et la recherche sont verrouillées pendant le test ; les erreurs de profil BLE et de connexion restent visibles.
- Les rappels différés sont associés à une impression ; les anciens rappels sont annulés à sa fin et ne pilotent pas l'impression suivante.
- Les écritures avec réponse attendent leur acquittement BLE ; les écritures sans réponse sont cadencées et respectent la capacité du périphérique.
- Le rendu vide ou invalide échoue explicitement au lieu d'envoyer un ticket vide avec une coupe.
- 24 tests JavaScript passent ; 7 vérifications du protocole ESC/POS sont compilées et exécutées en Swift sur Mac.
- Le nouvel export iOS passe. Ces résultats ne constituent toujours pas un test radio ou papier sur une 2Connect V10 physique.

Commande supplémentaire : `npm run test:ios-escpos` (macOS avec outils Swift).

## Logo du commerce sur les tickets

Les reçus serveur incluaient déjà le logo, mais les reçus locaux ne le contenaient pas.
Le logo PNG/JPEG/WebP est maintenant téléchargé, converti en données intégrées et conservé
avec l'identité du commerce dans la base locale isolée par entreprise/utilisateur.
Chaque ticket garde son propre logo dans son HTML pour les réimpressions historiques.
Un changement ou une suppression de logo ne réutilise pas une ancienne image différente.
Si le téléchargement n'a pas été préparé, le ticket conserve le nom et l'app signale l'absence du logo.

Sur iOS, ReceiptLogoDocument extrait les données du logo puis ReceiptLogoPageRenderer dessine
l'image dans l'en-tête de la première page, sans déformer son rapport largeur/hauteur.
Ce chemin est partagé par Bluetooth, AirPrint et le partage PDF. Le texte utilise toujours
le formateur de texte HTML ; on ne compte pas sur lui pour rendre les balises img.
Les images distantes sont intégrées avant l'appel natif. Les documents comportant plusieurs
images sont signalés comme non pris en charge par ce chemin de reçu et peuvent être ouverts sur le web.

Validation actuelle : 31 tests JavaScript passent, dont logo réel PNG, conservation offline,
isolation des entreprises, suppression/changement du logo et changement de session.
12 vérifications Swift du protocole et du décodage des documents de logo passent sur Mac.
L'export iOS et les vérifications de types passent. La sortie physique et le rendu UIKit sur
un iPhone restent à confirmer avec la 2Connect V10 ; ces tests ne prouvent pas le résultat papier.


Mise à jour du 23 octobre 2026 : les corrections de publication, la compilation et le lancement natifs, et la nouvelle interface bleue iOS sont détaillés dans [18-iOS-Release-Readiness.md](18-iOS-Release-Readiness.md). Les validations physiques et la soumission Apple restent distinctes des tests simulateur.
