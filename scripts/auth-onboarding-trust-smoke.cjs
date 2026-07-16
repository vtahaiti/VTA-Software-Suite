const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const passwordInput = read("apps/web/components/password-visibility-input.tsx");
assert(passwordInput.includes('type={visible ? "text" : "password"}'), "Le mot de passe doit etre masque par defaut et affichable sur demande.");
assert(passwordInput.includes('type="button"'), "Le bouton oeil ne doit jamais soumettre le formulaire.");
assert(passwordInput.includes("aria-label"), "Le bouton oeil doit etre accessible.");

for (const file of [
  "apps/web/app/login/login-form.tsx",
  "apps/web/app/signup/page.tsx",
  "apps/web/app/reset-password/page.tsx",
  "apps/web/app/dashboard/users/page.tsx"
]) {
  assert(read(file).includes("PasswordVisibilityInput"), `${file} doit utiliser le champ mot de passe avec affichage/masquage.`);
}

const templates = read("apps/api/src/email/email.templates.ts");
assert(templates.includes("companyWelcomeTemplate"), "Le template email de bienvenue entreprise doit exister.");
assert(templates.includes("Se connecter a VTA Commerce"), "Le template de bienvenue doit contenir un lien de connexion clair.");
assert(templates.includes("ne vous demandera jamais votre mot de passe par email"), "Le template de bienvenue ne doit jamais inclure ni demander le mot de passe.");

const emailService = read("apps/api/src/email/email.service.ts");
assert(emailService.includes("sendCompanyWelcomeEmail"), "Le service email doit exposer l'envoi de bienvenue apres creation entreprise.");
assert(emailService.includes('type: "COMPANY_WELCOME"'), "L'email de bienvenue doit etre journalise avec un type dedie.");

const onboardingModule = read("apps/api/src/onboarding/onboarding.module.ts");
assert(onboardingModule.includes("EmailModule"), "Onboarding doit importer EmailModule.");

const onboardingService = read("apps/api/src/onboarding/onboarding.service.ts");
assert(onboardingService.includes("sendCompanyWelcomeEmail"), "La creation d'entreprise doit declencher l'email de bienvenue.");
assert(onboardingService.includes(".catch(() => undefined)"), "L'echec email ne doit pas bloquer l'inscription.");
assert(onboardingService.includes("return session"), "La session doit rester emise meme si l'email echoue.");

const locations = read("apps/web/lib/haiti-locations.ts");
for (const department of ["Artibonite", "Centre", "Grand'Anse", "Nippes", "Nord", "Nord-Est", "Nord-Ouest", "Ouest", "Sud", "Sud-Est"]) {
  assert(locations.includes(`department: "${department}"`), `Departement manquant: ${department}`);
}
for (const city of ["Trou-du-Nord", "Terrier-Rouge", "Fort-Liberte", "Ouanaminthe", "Capotille", "Mont-Organise", "Caracol"]) {
  assert(locations.includes(city), `Commune Nord-Est manquante: ${city}`);
}

const onboardingPage = read("apps/web/app/onboarding/company/page.tsx");
assert(onboardingPage.includes("citiesForHaitiDepartment(form.department)"), "La liste des villes Haiti doit dependre du departement.");
assert(onboardingPage.includes('label="Departement"') || onboardingPage.includes('label="Département"'), "Le formulaire doit afficher le departement.");
assert(onboardingPage.includes('label="Commune / Ville"'), "Le formulaire doit afficher Commune / Ville.");
assert(onboardingPage.includes('"Autre"'), "Le formulaire doit permettre une commune autre.");
assert(onboardingPage.includes("withDepartmentInAddress"), "Sans migration, le departement doit etre conserve dans l'adresse.");

console.log("Auth/onboarding trust smoke OK");
