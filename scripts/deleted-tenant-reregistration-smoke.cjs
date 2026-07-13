const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const onboardingService = read("apps/api/src/onboarding/onboarding.service.ts");
const authService = read("apps/api/src/auth/auth.service.ts");
const platformService = read("apps/api/src/platform/platform.service.ts");

assert(
  onboardingService.includes("TenantStatus") &&
    onboardingService.includes("existingUsers") &&
    onboardingService.includes("user.tenant.status !== TenantStatus.DELETED"),
  "L'inscription doit autoriser un email uniquement conserve dans un tenant supprime."
);

assert(
  authService.includes("tenant: { status: { not: TenantStatus.DELETED } }"),
  "L'authentification ne doit pas selectionner un utilisateur rattache a un tenant supprime."
);

assert(
  platformService.includes("status: TenantStatus.DELETED") &&
    platformService.includes("users: { updateMany") &&
    platformService.includes("isActive: false"),
  "La suppression d'entreprise doit desactiver les utilisateurs du tenant supprime."
);

assert(
  onboardingService.includes("tx.tenant.create") &&
    onboardingService.includes("tx.user.create") &&
    onboardingService.includes("pending.email"),
  "La reinscription doit creer un nouveau tenant et un nouvel utilisateur, sans rattacher les anciennes donnees."
);

console.log("Deleted tenant re-registration contract OK");
