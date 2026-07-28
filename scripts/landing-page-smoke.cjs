const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const page = fs.readFileSync(path.join(root, "apps/web/app/page.tsx"), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const activity of [
  "Boutique / Market",
  "Quincaillerie",
  "Matériaux de construction",
  "Restaurant / Bar / Fast-food",
  "Hôtel avec restaurant",
  "Fabrication fenêtres / portes",
  "Imprimerie / studio",
  "Réparation téléphones",
  "Vente téléphones",
  "Pharmacie",
  "Clinique",
  "Services généraux",
  "Multi-activité"
]) {
  assert(page.includes(activity), `Activité publique manquante: ${activity}`);
}

assert(page.includes("<svg") && page.includes('aria-label="Croissance VTA Business"'), "Le logo public doit être vectoriel et accessible.");
for (const color of ["#059669", "#F97316", "#2563EB"]) {
  assert(page.includes(color), `Couleur VTA manquante dans le logo: ${color}`);
}
assert(!page.toLowerCase().includes("bientôt"), 'La landing page ne doit pas afficher "bientôt".');
assert(page.includes('href="/login"'), "Le lien de connexion doit rester présent.");
assert(page.includes('href="/signup"'), "Le lien d'inscription doit rester présent.");

console.log("landing page smoke OK");
