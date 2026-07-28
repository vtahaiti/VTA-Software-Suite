const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const page = fs.readFileSync(path.join(root, "apps/web/app/page.tsx"), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const activity of [
  "Market / Boutique",
  "Fashion / Parfumerie",
  "Quincaillerie",
  "Matériaux construction",
  "Restaurant / Bar / Fast-food",
  "Hôtel avec restaurant",
  "Fabrication fenêtres / portes",
  "Téléphones & électronique",
  "Services & réparation",
  "Beauté / Salon",
  "Transport / Location",
  "Pharmacie / Clinique",
  "Multi-activité",
  "Autre activité"
]) {
  assert(page.includes(activity), `Activité publique manquante: ${activity}`);
}

for (const capability of ["Caisse / POS", "Produits & services", "Stock", "Clients", "Paiements", "Utilisateurs", "Rapports"]) {
  assert(page.includes(capability), `Capacité principale manquante: ${capability}`);
}
assert(
  page.includes("Une plateforme flexible pour gérer votre entreprise, adaptée à votre activité."),
  "La promesse officielle doit être visible."
);
assert(
  page.includes("VTA Business vous accompagne dans la configuration selon votre fonctionnement réel."),
  "Le message d’accompagnement des métiers spécialisés doit être visible."
);

assert(page.includes("<svg") && page.includes('aria-label="Croissance VTA Business"'), "Le logo public doit être vectoriel et accessible.");
for (const color of ["#059669", "#F97316", "#2563EB"]) {
  assert(page.includes(color), `Couleur VTA manquante dans le logo: ${color}`);
}
assert(!page.toLowerCase().includes("bientôt"), 'La landing page ne doit pas afficher "bientôt".');
for (const forbiddenPromise of ["module complet", "gestion médicale complète", "gestion flotte complète", "hôtel complet", "conformité officielle"]) {
  assert(!page.toLowerCase().includes(forbiddenPromise), `Promesse publique excessive détectée: ${forbiddenPromise}`);
}
assert(page.includes('href="/login"'), "Le lien de connexion doit rester présent.");
assert(page.includes('href="/signup"'), "Le lien d'inscription doit rester présent.");

console.log("landing page smoke OK");
