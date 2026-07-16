const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");

const root = path.resolve(__dirname, "..");
const controller = fs.readFileSync(path.join(root, "apps/api/src/users/users.controller.ts"), "utf8");
const service = fs.readFileSync(path.join(root, "apps/api/src/users/users.service.ts"), "utf8");
const dto = fs.readFileSync(path.join(root, "apps/api/src/users/dto/reset-user-password.dto.ts"), "utf8");
const page = fs.readFileSync(path.join(root, "apps/web/app/dashboard/users/page.tsx"), "utf8");

assert(controller.includes('@Patch(":id/disable")'), "endpoint disable manquant");
assert(controller.includes('@Patch(":id/reactivate")'), "endpoint reactivate manquant");
assert(controller.includes('@Patch(":id/password")'), "endpoint password manquant");
assert(controller.includes('@Permissions("users.update")'), "permission update requise pour reset password manquante");
assert(!controller.includes('@Permissions("users.reset_password", "users.update")'), "reset password ne doit pas exiger une permission absente des sessions existantes");
assert(controller.includes("dto.temporaryPassword ?? dto.newPassword ?? dto.password"), "endpoint password doit accepter les noms de champ compatibles");

assert(service.includes("where: { id: userId, tenantId }"), "recherche utilisateur doit etre limitee au tenant");
assert(service.includes("assertNotPlatformUser"), "protection administrateur plateforme manquante");
assert(service.includes("hashPassword(temporaryPassword)"), "nouveau mot de passe doit etre hashe");
assert(service.includes("Le nouveau mot de passe est obligatoire."), "mot de passe absent doit etre refuse clairement");
assert(service.includes("passwordResetToken.updateMany"), "reset tokens non invalides");
assert(service.includes("invalidateUserSessions(user.id)"), "sessions runtime non invalidees");
assert(!service.includes("temporaryPassword)") || service.includes("hashPassword(temporaryPassword)"), "mot de passe en clair suspect");

assert(dto.includes("@MinLength(8)"), "mot de passe temporaire doit avoir une longueur minimale");
assert(dto.includes("@MaxLength(120)"), "mot de passe temporaire doit avoir une longueur maximale");
for (const field of ["temporaryPassword", "newPassword", "password"]) {
  assert(dto.includes(`${field}?: string`), `champ DTO compatible manquant: ${field}`);
}

assert(page.includes("/reactivate"), "UI reactivate manquante");
assert(page.includes("/password"), "UI changement mot de passe manquante");
assert(page.includes("window.confirm"), "confirmation changement mot de passe manquante");
assert(page.includes("PasswordVisibilityInput"), "afficher/masquer mot de passe manquant");
assert(page.includes("Reactiver"), "bouton reactiver manquant");

async function runCompiledServiceSmoke() {
  const servicePath = path.join(root, "apps/api/dist/users/users.service.js");
  if (!fs.existsSync(servicePath)) return;

  const { UsersService } = require(servicePath);
  const tenantId = "tenant_users_smoke_a";
  const otherTenantId = "tenant_users_smoke_b";
  const userId = "usr_users_smoke";
  const oldPassword = "InitialPass123!";
  const newPassword = "UpdatedPass456!";
  const user = {
    id: userId,
    tenantId,
    password: await bcrypt.hash(oldPassword, 12),
    roles: [{ role: { name: "CAISSIER" } }]
  };
  let resetTokensInvalidated = 0;
  let sessionsInvalidated = 0;

  const prisma = {
    user: {
      findFirst: async ({ where }) => (where.id === userId && where.tenantId === tenantId ? user : null),
      update: async ({ where, data }) => {
        assert.strictEqual(where.id, userId, "mise a jour limitee au bon utilisateur");
        user.password = data.password;
        return user;
      }
    },
    passwordResetToken: {
      updateMany: async ({ where, data }) => {
        assert.strictEqual(where.userId, userId, "reset tokens limites au bon utilisateur");
        assert(data.usedAt instanceof Date, "reset tokens marques comme utilises");
        resetTokensInvalidated += 1;
        return { count: 1 };
      }
    },
    $transaction: async (callback) => callback(prisma)
  };
  const authService = { invalidateUserSessions: (id) => { assert.strictEqual(id, userId); sessionsInvalidated += 1; } };
  const usersService = new UsersService(prisma, authService);

  await usersService.resetPassword(tenantId, userId, newPassword);
  assert.strictEqual(await bcrypt.compare(oldPassword, user.password), false, "ancien mot de passe encore valide");
  assert.strictEqual(await bcrypt.compare(newPassword, user.password), true, "nouveau mot de passe refuse");
  assert.strictEqual(resetTokensInvalidated, 1, "reset tokens non invalides");
  assert.strictEqual(sessionsInvalidated, 1, "sessions non invalidees");
  await assert.rejects(() => usersService.resetPassword(otherTenantId, userId, "OtherPass789!"), /Utilisateur introuvable/);
}

runCompiledServiceSmoke()
  .then(() => console.log("users-management smoke: ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
