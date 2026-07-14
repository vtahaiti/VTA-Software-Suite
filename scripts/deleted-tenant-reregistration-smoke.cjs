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
const repairDeletedTenantUsers = read("scripts/repair-deleted-tenant-users.cjs");

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
    platformService.includes("deletedUserEmail") &&
    platformService.includes("usersAnonymized") &&
    platformService.includes("isActive: false") &&
    platformService.includes("passwordResetToken.updateMany") &&
    platformService.includes("pendingRegistration.deleteMany") &&
    platformService.includes("revokeTenantSessions"),
  "La suppression d'entreprise doit desactiver, anonymiser et revoquer les acces des utilisateurs du tenant supprime."
);

assert(
  authService.includes("revokeTenantSessions") && authService.includes("session.user.tenantId === tenantId"),
  "AuthService doit permettre de revoquer les sessions runtime d'un tenant supprime."
);

assert(
  onboardingService.includes("tx.tenant.create") &&
    onboardingService.includes("tx.user.create") &&
    onboardingService.includes("pending.email"),
  "La reinscription doit creer un nouveau tenant et un nouvel utilisateur, sans rattacher les anciennes donnees."
);

assert(
  repairDeletedTenantUsers.includes("--apply") &&
    repairDeletedTenantUsers.includes("ANONYMIZE_DELETED_TENANT_USERS") &&
    repairDeletedTenantUsers.includes("status::text = 'DELETED'") &&
    repairDeletedTenantUsers.includes("deletedUserEmail") &&
    repairDeletedTenantUsers.includes("PasswordResetToken") &&
    repairDeletedTenantUsers.includes("PendingRegistration") &&
    repairDeletedTenantUsers.includes("PLATFORM_DELETED_TENANT_REPAIR"),
  "L'outil de reparation doit etre un dry-run par defaut, cibler seulement les tenants supprimes et journaliser sans email brut."
);

console.log("Deleted tenant re-registration contract OK");
