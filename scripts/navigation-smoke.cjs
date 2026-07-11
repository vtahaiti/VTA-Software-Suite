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

for (const href of ["/dashboard/pos", "/dashboard/sales/in-progress", "/dashboard/sales/completed"]) {
  if (!navigationSource.includes(`href: "${href}"`)) failures.push(`Href ventes manquant: ${href}`);
}

if (!sidebarSource.includes("event.stopPropagation()")) failures.push("Sidebar: stopPropagation est requis pour éviter l'interception par le parent.");
if (sidebarSource.includes("event.preventDefault()")) failures.push("Sidebar: les sous-liens doivent rester des liens natifs, sans preventDefault.");
if (sidebarSource.includes("router.push(")) failures.push("Sidebar: les sous-liens doivent utiliser leur href natif, pas router.push.");
if (!sidebarSource.includes("onClick={handleChildClick}")) failures.push("Sidebar: les sous-liens doivent isoler leur clic avec handleChildClick.");
if (sidebarSource.includes("left-full")) failures.push("Sidebar: aucun sous-menu mobile ne doit être rendu hors tiroir avec left-full.");
if (!sidebarSource.includes("openGroupId")) failures.push("Sidebar: un seul groupe doit être ouvert à la fois via openGroupId.");
if (!sidebarSource.includes("setOpenGroupId(activeGroupId)")) failures.push("Sidebar: l'état du groupe ouvert doit être réinitialisé sur pathname.");
if (!headerSource.includes("aria-label=\"Ouvrir le menu\"")) failures.push("Header: bouton hamburger mobile absent.");
if (!headerSource.includes("z-50")) failures.push("Header: le hamburger doit rester au-dessus de l'overlay mobile.");
if (!shellSource.includes("isMobileMenuOpen")) failures.push("Shell: état du menu mobile absent.");
if (!shellSource.includes("aria-label=\"Fermer le menu\"")) failures.push("Shell: overlay de fermeture mobile absent.");
if (!shellSource.includes("setIsMobileMenuOpen(false);")) failures.push("Shell: le menu mobile doit se réinitialiser après chaque pathname.");
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
