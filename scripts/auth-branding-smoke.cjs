const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const authFiles = [
  "apps/web/app/login/page.tsx",
  "apps/web/app/login/layout.tsx",
  "apps/web/app/login/login-actions.tsx",
  "apps/web/app/signup/page.tsx",
  "apps/web/app/signup/layout.tsx",
  "apps/web/app/forgot-password/page.tsx",
  "apps/web/app/forgot-password/layout.tsx",
  "apps/web/app/reset-password/page.tsx",
  "apps/web/app/reset-password/layout.tsx",
  "apps/web/components/vta-business-mark.tsx"
];
const authSource = authFiles.map(read).join("\n");
const emailSource = [
  "apps/api/src/email/email.templates.ts",
  "apps/api/src/email/email.service.ts"
].map(read).join("\n");

assert(!authSource.includes("VTA Commerce"), "Les pages auth ne doivent plus afficher VTA Commerce.");
assert(!authSource.includes("/vta-commerce-logo.png"), "Login ne doit plus utiliser l'ancien logo raster.");
assert(authSource.includes("VtaBusinessMark"), "Les pages auth doivent utiliser le wordmark VTA Business.");
for (const title of [
  "Connexion | VTA Business",
  "Créer un compte | VTA Business",
  "Mot de passe oublié | VTA Business",
  "Réinitialiser le mot de passe | VTA Business"
]) {
  assert(authSource.includes(title), `Metadata auth absente: ${title}`);
}
assert(!emailSource.includes("VTA Commerce"), "Les emails transactionnels ne doivent plus afficher VTA Commerce.");
assert(emailSource.includes("VTA Business"), "Les emails transactionnels doivent afficher VTA Business.");
assert(emailSource.includes("une solution de VTA Enterprise") || emailSource.includes("Une solution de VTA Enterprise"), "Les emails doivent identifier VTA Enterprise clairement.");

console.log("Auth branding smoke OK");
