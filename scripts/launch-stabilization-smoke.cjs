const fs = require("fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`launch-stabilization-smoke: FAIL - ${message}`);
    process.exit(1);
  }
}

function assertIncludes(source, needle, message) {
  assert(source.includes(needle), message);
}

function assertNotIncludes(source, needle, message) {
  assert(!source.includes(needle), message);
}

const companyPage = read("apps/web/app/dashboard/settings/company/page.tsx");
const subscriptionPage = read("apps/web/app/dashboard/settings/subscription/page.tsx");
const purchasesPage = read("apps/web/app/dashboard/purchases/page.tsx");
const uploadsController = read("apps/api/src/uploads/uploads.controller.ts");
const uploadsService = read("apps/api/src/uploads/uploads.service.ts");
const settingsDto = read("apps/api/src/settings/dto/settings.dto.ts");

assertNotIncludes(companyPage, "readAsDataURL", "Le logo entreprise ne doit plus etre converti en Base64 cote client.");
assertIncludes(companyPage, "new FormData()", "Le logo entreprise doit etre envoye en multipart/form-data.");
assertIncludes(companyPage, "/uploads/company-logo", "La page entreprise doit appeler l'endpoint upload logo.");
assertIncludes(companyPage, "logoUrl: form.logoUrl?.startsWith(\"data:\") ? \"\" : form.logoUrl", "La sauvegarde entreprise doit neutraliser les data URLs.");

assertIncludes(uploadsController, "FileInterceptor(\"file\"", "L'API upload doit accepter un fichier multipart.");
assertIncludes(uploadsService, "MAX_IMAGE_SIZE_BYTES", "L'API upload doit appliquer une limite de taille explicite.");
assertIncludes(uploadsService, "ALLOWED_IMAGE_MIME_TYPES", "L'API upload doit verifier les types MIME.");
assertIncludes(settingsDto, "@Matches(/^(?!data:).*/i", "Le DTO settings doit refuser les logos en data URL.");

for (const corrupt of ["Ã", "Â", "ðŸ", "âš", "Non dÃ", "RÃ", "TÃ", "PÃ"]) {
  assertNotIncludes(subscriptionPage, corrupt, `Texte corrompu restant dans la page abonnement: ${corrupt}`);
}
assertIncludes(subscriptionPage, "const subscription = data?.subscription ?? null", "La page abonnement doit gerer une subscription absente.");
assertIncludes(subscriptionPage, "payments = subscription?.payments ?? []", "La page abonnement doit gerer les paiements absents.");

assertIncludes(purchasesPage, "purchasesToday", "La page achats doit lire purchasesToday renvoye par l'API.");
assertIncludes(purchasesPage, "purchasesMonth", "La page achats doit lire purchasesMonth renvoye par l'API.");
assertIncludes(purchasesPage, "dashboardLoading", "La page achats doit afficher un chargement au lieu de faux zeros.");

console.log("launch-stabilization-smoke: OK");
