const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const entitlements = read("apps/api/src/subscriptions/subscription-entitlements.service.ts");
assert(entitlements.includes('eventType: "PLAN_CHANGE_REQUESTED"'), "Une demande de plan doit rester un evenement PENDING.");
assert(entitlements.includes('requestStatus: "PENDING"'), "La demande de plan doit etre creee en PENDING.");
assert(entitlements.includes("Une demande identique est déjà en attente"), "Les demandes identiques actives doivent etre bloquees.");
assert(entitlements.includes("Une demande de changement de plan est déjà en attente"), "Une seule demande active doit etre autorisee par tenant.");
assert(!entitlements.includes("status: SubscriptionStatus.ACTIVE") || entitlements.indexOf("requestPlanChange") < entitlements.indexOf("createMissingTrial"), "La demande tenant ne doit pas activer directement le plan.");

const platformController = read("apps/api/src/platform/platform.controller.ts");
assert(platformController.includes("@UseGuards(JwtAuthGuard, PlatformAdminGuard)"), "Les routes plateforme doivent etre protegees par le guard Super Admin.");
assert(platformController.includes('Post("subscription-requests/:requestId/approve")'), "Endpoint Super Admin d'approbation manquant.");
assert(platformController.includes('Post("subscription-requests/:requestId/reject")'), "Endpoint Super Admin de refus manquant.");
assert(platformController.includes('Get("notifications")') && platformController.includes('Post("notifications")'), "Endpoints Super Admin de notifications manquants.");
assert(!read("apps/api/src/subscriptions/subscriptions.controller.ts").includes("approvePlanChangeRequest"), "Une entreprise ne doit pas exposer de route d'approbation/refus.");

const platformService = read("apps/api/src/platform/platform.service.ts");
for (const token of [
  "approvePlanChangeRequest",
  "rejectPlanChangeRequest",
  "requestStatus !== \"PENDING\"",
  "PLAN_CHANGE_CONFIRMED",
  "PLAN_CHANGE_REFUSED",
  "PLATFORM_SUBSCRIPTION_REQUEST",
  "Plan approuvé",
  "Demande de plan refusée",
  "sendPlatformNotifications",
  "recipient === \"all-active\"",
  "tenantId_userId_dedupKey",
  "assertPlainNotification",
  "isSafeInternalLink",
  "notificationRecipients"
]) {
  assert(platformService.includes(token), `Contrat plateforme manquant: ${token}`);
}
assert(platformService.includes("this.prisma.$transaction(async (tx)") && platformService.includes("tx.tenantSubscription.upsert"), "L'approbation doit etre atomique dans une transaction.");
assert(platformService.includes("throw new ConflictException(\"Cette demande a déjà été traitée.\""), "Une demande traitee ne doit pas etre retraitable.");
assert(platformService.includes("if (!trimmedReason) throw new BadRequestException"), "Le refus doit exiger un motif.");
assert(platformService.includes("ownersOnly") && platformService.includes("roleFilter"), "Le ciblage proprietaires/roles doit etre explicite.");
assert(platformService.includes("TenantStatus.DELETED"), "Les tenants supprimes doivent etre exclus des actions.");
assert(platformService.includes("status: { in: [TenantStatus.ACTIVE, TenantStatus.TRIAL] }"), "L'envoi a tous doit exclure les tenants suspendus, expires, pauses ou supprimes.");
assert(platformService.includes("this.entitlements.invalidate(result.tenantId)"), "Les droits doivent etre invalides apres decision.");
assert(platformService.includes("updated.status") && platformService.includes("newPlanCode"), "L'audit doit conserver ancien et nouveau plan.");
assert(platformService.includes("planDecisionRecipients"), "Une decision de plan doit creer une notification meme si le role proprietaire historique differe.");
assert(platformService.includes("OWNER_ROLE_NAMES"), "Les variantes de role proprietaire doivent etre centralisees.");
assert(platformService.includes("NotificationType.ERROR") && platformService.includes("urgent"), "Le niveau urgent doit etre mappe sans nouvel enum.");
assert(platformService.includes("!link.includes(\"://\")") && platformService.includes("!link.toLowerCase().startsWith(\"javascript:\")"), "Les liens externes/javascript doivent etre refuses.");
assert(platformService.includes("/<[^>]+>/"), "Le HTML arbitraire doit etre refuse dans les notifications.");
for (const forbidden of ["sale.update", "stock.update", "customer.update", "prisma.sale.", "prisma.stock", "prisma.customer"]) {
  assert(!platformService.includes(forbidden), `Le lot ne doit pas modifier ventes/stocks/clients: ${forbidden}`);
}

const adminSubscriptions = read("apps/web/app/admin/subscriptions/page.tsx");
assert(adminSubscriptions.includes("Approuver") && adminSubscriptions.includes("Refuser"), "Les boutons Super Admin doivent etre visibles.");
assert(adminSubscriptions.includes("window.confirm") && adminSubscriptions.includes("window.prompt"), "L'approbation/refus doit demander confirmation/motif.");
assert(adminSubscriptions.includes("/platform/subscription-requests/"), "L'interface admin doit appeler les endpoints dedies.");

const adminNotifications = read("apps/web/app/admin/notifications/page.tsx");
assert(adminNotifications.includes("all-active"), "La page admin doit permettre l'envoi a tous les tenants actifs.");
assert(adminNotifications.includes("Plusieurs entreprises"), "La page admin doit permettre l'envoi multi-tenants.");
assert(adminNotifications.includes("Propriétaires uniquement"), "La page admin doit permettre le ciblage proprietaires.");
assert(adminNotifications.includes("Clé anti-doublon"), "La page admin doit exposer dedupKey.");
assert(adminNotifications.includes("link.startsWith(\"/dashboard\")"), "Les liens doivent rester internes.");
assert(adminNotifications.includes("window.confirm(`Envoyer cette notification à ${selectedCount}"), "L'envoi doit afficher le nombre de destinataires avant confirmation.");
assert(adminNotifications.includes('recipient === "all-active"'), "L'interface doit supporter le ciblage tous actifs sans l'utiliser automatiquement.");

const notificationsService = read("apps/api/src/notifications/notifications.service.ts");
assert(notificationsService.includes("tenantId: user.tenantId"), "La lecture des notifications doit etre isolee par tenant.");
assert(notificationsService.includes("markAllAsRead"), "Le marquage global lu doit rester disponible.");
assert(notificationsService.includes("tenantId_userId_dedupKey"), "La deduplication notification doit rester en base.");
assert(notificationsService.includes("status: NotificationStatus.READ") && notificationsService.includes("readAt: new Date()"), "La lecture doit uniquement marquer READ/readAt.");
assert(!notificationsService.includes("deleteMany") && !notificationsService.includes("delete({"), "Le service notifications ne doit pas supprimer immediatement les notifications.");

const notificationsPage = read("apps/web/app/dashboard/notifications/page.tsx");
assert(notificationsPage.includes('useState("")'), "Le centre de notifications doit afficher toutes les notifications par defaut.");
assert(notificationsPage.includes('{ value: "", label: "Toutes" }'), "Le filtre Toutes doit rester disponible.");
assert(notificationsPage.includes("/notifications/${item.id}/read"), "La lecture doit passer par l'endpoint read.");

console.log("Subscription notifications smoke OK");
