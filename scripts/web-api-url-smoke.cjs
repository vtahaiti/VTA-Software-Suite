const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const webRoot = path.join(root, "apps", "web");
const helper = path.join(webRoot, "lib", "api-url.ts");
const settingsPage = path.join(webRoot, "app", "dashboard", "settings", "page.tsx");
const exactCleanMessage =
  "Connexion au serveur impossible. Vérifiez votre connexion puis réessayez.";

const failures = [];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "out"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|jsx|md|json)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

for (const file of walk(webRoot)) {
  const source = fs.readFileSync(file, "utf8");
  const relative = rel(file);

  if (source.includes("backend tourne sur")) {
    failures.push(`${relative}: contient encore "backend tourne sur"`);
  }

  if (source.includes("serveur local") && file !== helper) {
    failures.push(`${relative}: contient encore "serveur local" hors helper`);
  }

  if (source.includes("NEXT_PUBLIC_API_URL") && file !== helper && !relative.endsWith("Dockerfile")) {
    failures.push(`${relative}: lit NEXT_PUBLIC_API_URL hors helper central`);
  }

  if (source.includes("http://localhost:3001")) {
    failures.push(`${relative}: contient l'URL exacte http://localhost:3001`);
  }

  if (source.includes("localhost:3001")) {
    failures.push(`${relative}: mentionne encore localhost:3001`);
  }
}

const helperSource = fs.readFileSync(helper, "utf8");
for (const expected of [
  "const productionApiUrl = \"https://api.vtaerp.com\";",
  "export const apiBaseUrl = getApiBaseUrl();",
  "export function publicApiErrorMessage",
  "export async function fetchApi",
  exactCleanMessage
]) {
  if (!helperSource.includes(expected)) {
    failures.push(`apps/web/lib/api-url.ts: élément attendu absent: ${expected}`);
  }
}

if (!fs.existsSync(settingsPage)) {
  failures.push("apps/web/app/dashboard/settings/page.tsx: page paramètres principale absente");
} else {
  const settingsSource = fs.readFileSync(settingsPage, "utf8");
  for (const expected of [
    "Paramètres de l&apos;entreprise",
    "/dashboard/settings/company",
    "/dashboard/settings/business-modules",
    "/dashboard/settings/pos",
    "/dashboard/settings/invoicing",
    "/dashboard/settings/subscription",
    "/dashboard/settings/emails"
  ]) {
    if (!settingsSource.includes(expected)) {
      failures.push(`apps/web/app/dashboard/settings/page.tsx: lien ou texte attendu absent: ${expected}`);
    }
  }
}

for (const file of [
  "apps/web/app/login/login-form.tsx",
  "apps/web/app/signup/page.tsx",
  "apps/web/app/onboarding/company/page.tsx",
  "apps/web/app/forgot-password/page.tsx",
  "apps/web/app/reset-password/page.tsx",
  "apps/web/app/local-status/page.tsx"
]) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  if (!source.includes("publicApiErrorMessage") && !source.includes("apiUnavailableMessage")) {
    failures.push(`${file}: message réseau propre non raccordé`);
  }
}

if (failures.length) {
  console.error("web-api-url-smoke: échec");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("web-api-url-smoke: OK");
