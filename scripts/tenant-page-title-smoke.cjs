const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const titleHelper = read("apps/web/lib/tenant-page-title.ts");
const protectedShell = read("apps/web/components/protected-shell.tsx");
const header = read("apps/web/components/header.tsx");
const publicPage = read("apps/web/app/page.tsx");
const loginLayout = read("apps/web/app/login/layout.tsx");
const signupLayout = read("apps/web/app/signup/layout.tsx");
const adminLayout = read("apps/web/app/admin/layout.tsx");

for (const expected of [
  '`${companyName} | VTA Business`',
  '"Nouvelle commande"',
  '"Nouvelle vente"',
  '"Produits"',
  '"Stock"',
  '"Clients"',
  '"Rapports"',
  '"Paramètres"',
  '"Mon entreprise"'
]) {
  assert(titleHelper.includes(expected), `Règle de titre manquante: ${expected}`);
}

assert(protectedShell.includes("document.title = tenantPageTitle"), "Le shell doit actualiser le titre navigateur.");
assert(protectedShell.includes("branding?.companyName ?? user.tenant"), "Le nom doit rester lié au tenant de la session.");
assert(header.includes("{companyName}</h2>"), "Le nom de l'entreprise doit être le titre principal du header.");
assert(header.includes('businessActivity || "Espace entreprise"'), "Le profil d'activité doit apparaître sous le nom.");
assert(publicPage.includes('title: "VTA Business - Caisse, stock et gestion"'), "Le titre public VTA Business est incorrect.");
assert(loginLayout.includes('title: "Connexion | VTA Business"'), "Le titre login est incorrect.");
assert(signupLayout.includes('title: "Créer un compte | VTA Business"'), "Le titre signup est incorrect.");
assert(adminLayout.includes('title: "Admin | VTA Business"'), "Le titre admin est incorrect.");

console.log("tenant page title smoke OK");
