const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const navigationSource = fs.readFileSync(path.join(root, "apps/web/lib/navigation.tsx"), "utf8");
const sidebarSource = fs.readFileSync(path.join(root, "apps/web/components/sidebar.tsx"), "utf8");
const headerSource = fs.readFileSync(path.join(root, "apps/web/components/header.tsx"), "utf8");
const shellSource = fs.readFileSync(path.join(root, "apps/web/components/protected-shell.tsx"), "utf8");

const expectedRoutes = {
  "Nouvelle vente": "/dashboard/pos",
  "Ventes en attente": "/dashboard/sales/in-progress",
  "Historique des ventes": "/dashboard/sales/completed",
  Produits: "/dashboard/products",
  "Catégories": "/dashboard/products/categories",
  Achats: "/dashboard/purchases",
  Fournisseurs: "/dashboard/suppliers",
  Entreprise: "/dashboard/settings/company",
  POS: "/dashboard/settings/pos",
  Facturation: "/dashboard/settings/invoicing",
  Emails: "/dashboard/settings/emails"
};

const failures = [];

for (const [label, href] of Object.entries(expectedRoutes)) {
  const exactItem = new RegExp(`label:\\s*"${escapeRegExp(label)}"\\s*,\\s*href:\\s*"${escapeRegExp(href)}"`);
  if (!exactItem.test(navigationSource)) {
    failures.push(`Route attendue absente ou incorrecte: ${label} -> ${href}`);
  }
}

const hrefs = [...navigationSource.matchAll(/href:\s*"([^"]+)"/g)].map((match) => match[1]);
const salesChildren = ["/dashboard/pos", "/dashboard/sales/in-progress", "/dashboard/sales/completed"];
for (const href of salesChildren) {
  if (!hrefs.includes(href)) failures.push(`Href ventes manquant: ${href}`);
}

if (!sidebarSource.includes("event.stopPropagation()")) failures.push("Sidebar: stopPropagation est requis pour éviter l'interception par le parent.");
if (sidebarSource.includes("event.preventDefault()")) failures.push("Sidebar: les sous-liens doivent rester des liens natifs, sans preventDefault.");
if (sidebarSource.includes("router.push(")) failures.push("Sidebar: les sous-liens doivent utiliser leur href natif, pas router.push.");
if (!sidebarSource.includes("onClick={handleChildClick}")) failures.push("Sidebar: les sous-liens doivent isoler leur clic avec handleChildClick.");
if (!headerSource.includes("aria-label=\"Ouvrir le menu\"")) failures.push("Header: bouton hamburger mobile absent.");
if (!shellSource.includes("isMobileMenuOpen")) failures.push("Shell: état du menu mobile absent.");
if (!shellSource.includes("aria-label=\"Fermer le menu\"")) failures.push("Shell: overlay de fermeture mobile absent.");
if (!shellSource.includes("onNavigate={() => setIsMobileMenuOpen(false)}")) failures.push("Shell: le menu mobile doit se fermer après navigation.");

if (failures.length) {
  console.error("Navigation smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Navigation smoke OK");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
