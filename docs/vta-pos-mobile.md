# VTA POS mobile

VTA POS réutilise le Web, l'API, les comptes, les tenants, le RBAC et le moteur POS de VTA Business. Il ne s'agit pas d'un second système.

Les icônes Android, iOS et Web utilisent le symbole VTA POS bleu avec les trois barres orange, jaune et verte. Elles peuvent être régénérées avec `scripts/generate-vta-pos-icons.ps1`.

## Android

- Identifiant conservé : `com.vtaerp.commerce` afin de préserver la continuité des mises à jour.
- Nom visible : `VTA POS`.
- Impression disponible : dialogue système/PDF et Bluetooth classique ESC/POS via l'imprimante déjà appairée dans Android.
- APK de test : `apps/web/android/app/build/outputs/apk/debug/app-debug.apk` après `gradlew assembleDebug`.
- Un APK debug sert uniquement aux essais. Une version Play Store exige la clé de signature de production et un AAB release signé.

## iPhone

Le projet Capacitor se trouve dans `apps/web/ios`.

1. Copier ou cloner le dépôt sur un Mac.
2. Installer Node.js, Xcode et CocoaPods.
3. Exécuter `npm install` à la racine.
4. Exécuter `npm run mobile:sync:ios`.
5. Ouvrir `apps/web/ios/App/App.xcworkspace` dans Xcode.
6. Choisir l'équipe Apple Developer, le bundle identifier et la signature.
7. Tester sur un vrai iPhone avant TestFlight.

Le projet iOS a été généré sur Windows, mais il n'a pas été compilé ni testé : Xcode/macOS sont obligatoires. Sur iPhone, utiliser AirPrint ou le partage PDF tant qu'aucun SDK fabricant/MFi/BLE précis n'a été validé pour l'imprimante.

## Commandes de validation

```powershell
npm run test:vta-pos-mobile
npm run build --workspace=@vta/web
npm run mobile:sync
cd apps/web/android
.\gradlew.bat assembleDebug
```

## Sécurité et données

- Les écrans mobiles utilisent les endpoints existants et les permissions serveur.
- Les données de démonstration de la maquette ne sont pas intégrées.
- Le mode hors ligne existant reste limité aux parcours explicitement pris en charge par `offline-db.ts` et `offline-sync.ts`.
- Ne jamais présenter une vente locale comme synchronisée avant confirmation de l'API.
