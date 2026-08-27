const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const expect = (name, condition) => { if (!condition) throw new Error(`ÉCHEC: ${name}`); checks.push(name); };

const schema = read("database/prisma/schema.prisma");
const migration = read("database/prisma/migrations/20260827090000_manufacturing_orders_v1/migration.sql");
const service = read("apps/api/src/manufacturing/manufacturing.service.ts");
const proformas = read("apps/api/src/sales/proformas.service.ts");
const quotes = read("apps/api/src/sales/quotes.service.ts");
const detail = read("apps/web/app/dashboard/sales/sales-document-detail-page.tsx");
const atelier = read("apps/web/app/dashboard/manufacturing/[id]/page.tsx");
const production = read("apps/web/app/dashboard/manufacturing/production/page.tsx");

expect("modèles Fabrication tenant-scoped", /model ManufacturingOrder[\s\S]*tenantId/.test(schema) && /model ManufacturingMaterial[\s\S]*requiredQuantity\s+Decimal/.test(schema));
expect("migration additive sans suppression", /CREATE TABLE "ManufacturingOrder"/.test(migration) && !/DROP TABLE|TRUNCATE|DELETE FROM/i.test(migration));
expect("commande Windows sans sortie stock anticipée", /if \(!\(await isWindowsManufacturingTenant\(tx, tenantId\)\)\)[\s\S]*deductStockForItems/.test(proformas));
expect("conversion devis Windows sans sortie anticipée", /if \(!\(await isWindowsManufacturingTenant\(tx, tenantId\)\)\)[\s\S]*deductStockForItems/.test(quotes));
expect("dépôt explicite pour Fabrication", /Sélectionnez le dépôt de cette commande/.test(proformas) && /Sélectionnez le dépôt de cette commande/.test(quotes));
expect("création idempotente par commande", service.includes("manufacturingOrder.findFirst({ where: { tenantId, proformaId }") && /proformaId\s+String\s+@unique/.test(schema));
expect("verrou transactionnel avant consommation", /FOR UPDATE/.test(service) && /quantity: \{ decrement: quantity \}/.test(service));
expect("refus stock insuffisant", /Stock insuffisant/.test(service) && /quantity: \{ gte: quantity \}/.test(service));
expect("mouvements liés à la fabrication", /manufacturingOrderId: order\.id/.test(service));
expect("commande raccordée à Fabrication", /Lancer en fabrication/.test(detail) && /Voir la fabrication/.test(detail));
expect("bon atelier imprimable sans finances", /Imprimer bon de fabrication/.test(atelier) && /Préparé par/.test(atelier) && /Fabricant/.test(atelier) && /className="print:hidden"><h2 className="font-bold">Résumé commande/.test(atelier));
expect("pagination Production conforme max 100", /limit=100/.test(production) && !/limit=500/.test(production));

console.log(`Fabrication V1 smoke: ${checks.length}/${checks.length} contrôles OK`);
