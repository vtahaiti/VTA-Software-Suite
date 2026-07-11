const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const navigationSource = fs.readFileSync(path.join(root, "apps/web/lib/navigation.tsx"), "utf8");
const sidebarSource = fs.readFileSync(path.join(root, "apps/web/components/sidebar.tsx"), "utf8");

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

if (!sidebarSource.includes("router.push(href)")) failures.push("Sidebar: router.push(href) est requis pour les sous-liens.");
if (!sidebarSource.includes("event.preventDefault()")) failures.push("Sidebar: preventDefault est requis pour isoler le clic enfant.");
if (!sidebarSource.includes("event.stopPropagation()")) failures.push("Sidebar: stopPropagation est requis pour éviter l'interception par le parent.");
if (!sidebarSource.includes("onClick={(event) => navigateChild(event, child.href)}")) failures.push("Sidebar: les sous-liens doivent appeler navigateChild.");

if (failures.length) {
  console.error("Navigation smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Navigation smoke OK");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
