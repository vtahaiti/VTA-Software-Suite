const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const controller = fs.readFileSync(path.join(root, "apps/api/src/users/users.controller.ts"), "utf8");
const service = fs.readFileSync(path.join(root, "apps/api/src/users/users.service.ts"), "utf8");
const dto = fs.readFileSync(path.join(root, "apps/api/src/users/dto/reset-user-password.dto.ts"), "utf8");
const page = fs.readFileSync(path.join(root, "apps/web/app/dashboard/users/page.tsx"), "utf8");

assert(controller.includes('@Patch(":id/disable")'), "endpoint disable manquant");
assert(controller.includes('@Patch(":id/reactivate")'), "endpoint reactivate manquant");
assert(controller.includes('@Patch(":id/password")'), "endpoint password manquant");
assert(controller.includes('@Permissions("users.reset_password", "users.update")'), "permission reset password manquante");

assert(service.includes("where: { id: userId, tenantId }"), "recherche utilisateur doit etre limitee au tenant");
assert(service.includes("assertNotPlatformUser"), "protection administrateur plateforme manquante");
assert(service.includes("hashPassword(temporaryPassword)"), "nouveau mot de passe doit etre hashe");
assert(service.includes("passwordResetToken.updateMany"), "reset tokens non invalides");
assert(service.includes("invalidateUserSessions(user.id)"), "sessions runtime non invalidees");
assert(!service.includes("temporaryPassword)") || service.includes("hashPassword(temporaryPassword)"), "mot de passe en clair suspect");

assert(dto.includes("@MinLength(8)"), "mot de passe temporaire doit avoir une longueur minimale");
assert(dto.includes("@MaxLength(120)"), "mot de passe temporaire doit avoir une longueur maximale");

assert(page.includes("/reactivate"), "UI reactivate manquante");
assert(page.includes("/password"), "UI changement mot de passe manquante");
assert(page.includes("window.confirm"), "confirmation changement mot de passe manquante");
assert(page.includes("showTemporaryPassword"), "afficher/masquer mot de passe manquant");
assert(page.includes("Reactiver"), "bouton reactiver manquant");

console.log("users-management smoke: ok");
