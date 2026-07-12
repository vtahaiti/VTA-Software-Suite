const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname);
const repo = "C:/Users/gerth/Documents/GitHub/VTA-Software-Suite";

function read(relativePath) {
  return fs.readFileSync(path.join(repo, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const apiVersion = read("apps/api/src/version/version.controller.ts");
assert(apiVersion.includes('@Controller("version")'), "API /version controller missing");
assert(apiVersion.includes("commitSha"), "API version commitSha missing");

const webVersion = read("apps/web/app/api/version/route.ts");
assert(webVersion.includes("NextResponse.json"), "Web /api/version route missing");
assert(webVersion.includes("commitSha"), "Web version commitSha missing");

const importer = read("apps/api/src/import-export/import.service.ts");
assert(importer.includes("analyzeProducts"), "Product analyze endpoint service missing");
assert(importer.includes("detectDelimiter"), "CSV delimiter detection missing");
assert(importer.includes("XLSX.read"), "XLSX import support missing");
assert(importer.includes("productHeaderAliases"), "French product header aliases missing");
assert(importer.includes("duplicateStrategy"), "Duplicate strategy missing");

const exporter = read("apps/api/src/import-export/export.service.ts");
assert(exporter.includes("XLSX.write"), "Real XLSX export missing");
assert(exporter.includes("\\uFEFF"), "CSV BOM missing");
assert(exporter.includes("csvValue"), "CSV injection protection missing");
assert(exporter.includes("sales("), "Sales export missing");
assert(exporter.includes("purchases("), "Purchases export missing");

const notifications = read("apps/api/src/notifications/notifications.service.ts");
assert(notifications.includes("dedupKey"), "Notification dedupKey missing");
assert(notifications.includes("totalPages"), "Notification pagination missing");
assert(notifications.includes("isSafeLink"), "Notification safe link validation missing");
assert(notifications.includes("notifyImportResult"), "Import notification helper missing");

const schema = read("database/prisma/schema.prisma");
assert(schema.includes("dedupKey    String?"), "Notification dedupKey schema missing");
assert(schema.includes("@@unique([tenantId, userId, dedupKey])"), "Notification dedup unique missing");

console.log("Lot 2 smoke OK");
