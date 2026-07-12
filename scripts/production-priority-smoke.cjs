const fs = require("fs");
const path = require("path");

const root = process.cwd();
const failures = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) failures.push(`${label}: motif absent -> ${needle}`);
}

function assertNotIncludes(source, needle, label) {
  if (source.includes(needle)) failures.push(`${label}: motif interdit -> ${needle}`);
}

const shell = read("apps/web/components/protected-shell.tsx");
assertIncludes(shell, "w-[min(86vw,320px)]", "Menu mobile: largeur contrôlée");
assertIncludes(shell, "h-[100dvh]", "Menu mobile: hauteur dynamique");
assertIncludes(shell, "left-[min(86vw,320px)]", "Menu mobile: overlay limité hors tiroir");
assertIncludes(shell, "document.body.style.overflow = \"hidden\"", "Menu mobile: blocage du scroll pendant ouverture");
assertIncludes(shell, "document.body.style.pointerEvents = \"\"", "Menu mobile: restauration pointer-events");
assertIncludes(shell, "setIsMobileMenuOpen(false)", "Menu mobile: fermeture après navigation");
assertIncludes(shell, "forceExpanded", "Menu mobile: sidebar lisible dans le tiroir");

const sidebar = read("apps/web/components/sidebar.tsx");
assertIncludes(sidebar, "forceExpanded", "Sidebar: mode tiroir mobile explicite");
assertIncludes(sidebar, "max-h-[100dvh]", "Sidebar: scroll interne limité");
assertIncludes(sidebar, "overflow-y-auto", "Sidebar: navigation interne scrollable");
assertIncludes(sidebar, "setOpenGroupId(activeGroupId)", "Sidebar: réinitialisation du groupe actif sur route");
assertIncludes(sidebar, "event.stopPropagation()", "Sidebar: lien enfant non intercepté par parent");
assertIncludes(sidebar, "vta:branding-updated", "Sidebar: branding actualisé après sauvegarde");

const companyService = read("apps/api/src/settings/company-profile.service.ts");
assertIncludes(companyService, "await this.prisma.$transaction", "Sauvegarde entreprise: transaction");
assertIncludes(companyService, "return this.find(tenantId)", "Sauvegarde entreprise: réponse relue après commit");
assertNotIncludes(companyService, "return this.find(tenantId);\n    });", "Sauvegarde entreprise: ancienne lecture dans transaction");
assertIncludes(companyService, "value === undefined ? fallback : value", "Sauvegarde entreprise: champs partiels préservés");

const companyPage = read("apps/web/app/dashboard/settings/company/page.tsx");
assertIncludes(companyPage, "await response.json()", "Page entreprise: lecture de la réponse API");
assertIncludes(companyPage, "setForm(updated)", "Page entreprise: état local remplacé par la réponse");
assertIncludes(companyPage, "vta:branding-updated", "Page entreprise: invalidation du branding UI");
assertIncludes(companyPage, "Paramètres enregistrés.", "Page entreprise: succès après réponse API");

const onboardingService = read("apps/api/src/onboarding/onboarding.service.ts");
assertIncludes(onboardingService, "this.prisma.$transaction", "Création entreprise: transaction unique");
assertIncludes(onboardingService, "createTrialSubscription", "Création entreprise: souscription d'essai créée côté serveur");
assertIncludes(onboardingService, "PrismaClientKnownRequestError", "Création entreprise: erreurs Prisma contrôlées");
assertIncludes(onboardingService, "Une entreprise ou un compte utilise déjà ces informations", "Création entreprise: message doublon clair");

const onboardingPage = read("apps/web/app/onboarding/company/page.tsx");
assertIncludes(onboardingPage, "Session d'inscription introuvable ou expirée", "Création entreprise: token absent expliqué");
assertIncludes(onboardingPage, "Création de l'entreprise impossible", "Création entreprise: erreur fallback lisible");
assertIncludes(onboardingPage, "hasCheckedPendingToken", "Création entreprise: attente lecture token local");

if (failures.length) {
  console.error("Échecs production-priority-smoke:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("production-priority-smoke: OK");
