const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const capacitor = read("apps/web/capacitor.config.ts");
const shell = read("apps/web/components/protected-shell.tsx");
const nav = read("apps/web/components/native-mobile-nav.tsx");
const dashboard = read("apps/web/app/dashboard/page.tsx");
const pos = read("apps/web/app/dashboard/pos/page.tsx");
const inventory = read("apps/web/app/dashboard/inventory/page.tsx");
const manifest = read("apps/web/public/manifest.json");
const androidStrings = read("apps/web/android/app/src/main/res/values/strings.xml");
const androidManifest = read("apps/web/android/app/src/main/AndroidManifest.xml");
const mainActivity = read("apps/web/android/app/src/main/java/com/vtaerp/commerce/MainActivity.java");
const bluetoothPlugin = read("apps/web/android/app/src/main/java/com/vtaerp/commerce/VtaBluetoothPrinterPlugin.java");
const printSettings = read("apps/web/app/dashboard/settings/pos/page.tsx");
const iosInfo = read("apps/web/ios/App/App/Info.plist");
const iosProject = read("apps/web/ios/App/App.xcodeproj/project.pbxproj");
const iosPodfile = read("apps/web/ios/App/Podfile");
const iosPrivacy = read("apps/web/ios/App/App/PrivacyInfo.xcprivacy");
const iosDelegate = read("apps/web/ios/App/App/AppDelegate.swift");

assert(capacitor.includes('appId: "com.vtaerp.commerce"'), "L'appId Android existant doit rester stable");
assert(capacitor.includes('appName: "VTA POS"'), "Le nom natif doit être VTA POS");
assert(capacitor.includes('errorPath: "offline.html"'), "L'app native doit afficher un écran local propre si le serveur est inaccessible");
assert(manifest.includes('"name": "VTA POS"'), "Le manifeste installable doit utiliser VTA POS");
assert(androidStrings.includes(">VTA POS<"), "Le libellé Android doit utiliser VTA POS");
assert(iosInfo.includes("VTA POS"), "Le libellé iOS doit utiliser VTA POS");
assert(iosInfo.includes("UIDesignRequiresCompatibility") && iosInfo.includes("NSCameraUsageDescription"), "iOS doit préparer iPadOS 26 et l'usage caméra du scanner");
assert(iosPodfile.includes("platform :ios, '15.0'") && !iosProject.includes("IPHONEOS_DEPLOYMENT_TARGET = 13.0"), "La cible iOS minimale doit être iOS 15");
assert(iosProject.includes("PrivacyInfo.xcprivacy in Resources"), "Le manifeste de confidentialité doit être inclus dans le bundle iOS");
assert(iosPrivacy.includes("NSPrivacyAccessedAPICategoryFileTimestamp") && iosPrivacy.includes("C617.1") && iosPrivacy.includes("NSPrivacyAccessedAPICategoryUserDefaults") && iosPrivacy.includes("CA92.1"), "Le manifeste iOS doit déclarer les API à raison requise");
assert(iosDelegate.includes("@main") && !iosDelegate.includes("@UIApplicationMain"), "Le point d'entrée iOS doit utiliser la syntaxe Swift moderne");
assert(androidManifest.includes("android.permission.BLUETOOTH_CONNECT"), "Android récent doit demander la permission Bluetooth requise");
assert(mainActivity.includes("registerPlugin(VtaBluetoothPrinterPlugin.class)"), "Le plugin d'impression Bluetooth doit être enregistré");
assert(bluetoothPlugin.includes("sendBitmapOverBluetooth") && bluetoothPlugin.includes("GS v 0"), "L'impression directe doit envoyer un ticket raster ESC/POS");
assert(bluetoothPlugin.includes("Settings.ACTION_BLUETOOTH_SETTINGS") && bluetoothPlugin.includes("BLUETOOTH_DISABLED"), "Le plugin doit ouvrir les réglages Bluetooth et signaler un Bluetooth désactivé");
assert(printSettings.includes("Configurer Bluetooth") && printSettings.includes("Voir les appareils Bluetooth appairés") && printSettings.includes("Imprimer un ticket de test"), "La configuration Bluetooth doit être accessible à l'utilisateur");
assert(shell.includes("NativeMobileNav"), "La navigation mobile doit être montée dans le shell protégé");
for (const label of ["Accueil", "Caisse", "Stock", "Plus"]) assert(nav.includes(label), `Navigation mobile manquante: ${label}`);
assert(nav.includes("canAccessHref"), "La navigation mobile doit respecter le RBAC");
assert(nav.includes('/dashboard/settings/pos'), "Le raccourci Imprimantes doit ouvrir la page de configuration existante");
assert(dashboard.includes("MobilePosDashboard"), "Le tableau de bord mobile VTA POS doit être présent");
assert(dashboard.includes("profitReliable"), "Le bénéfice mobile doit respecter la fiabilité des coûts");
assert(pos.includes("vta-native-cart-bar"), "Le panier mobile doit rester accessible au-dessus de la navigation");
assert(inventory.includes("vta-native-only"), "L'inventaire doit posséder une vue mobile dédiée");
assert(inventory.includes('params.set("lowStock", "true")'), "Le filtre stock faible doit appeler le serveur");
assert(inventory.includes("inventorySearchRef.current?.focus()"), "Le bouton code-barres de l'inventaire doit activer réellement le champ de lecture");

console.log("VTA POS mobile smoke: OK");
