const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const apiHelper = fs.readFileSync(path.join(root, "apps/api/src/common/business-timezone.ts"), "utf8");
const webHelper = fs.readFileSync(path.join(root, "apps/web/lib/business-timezone.ts"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "apps/api/src/dashboard/dashboard.service.ts"), "utf8");
const printService = fs.readFileSync(path.join(root, "apps/api/src/print/invoice-print.service.ts"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(apiHelper.includes('DEFAULT_BUSINESS_TIME_ZONE = "America/Port-au-Prince"'), "API timezone helper must default to Haiti.");
assert(webHelper.includes('DEFAULT_BUSINESS_TIME_ZONE = "America/Port-au-Prince"'), "Web timezone helper must default to Haiti.");
assert(dashboard.includes("businessDayRange") && dashboard.includes("businessMonthRange"), "Dashboard today/month ranges must use business timezone.");
assert(dashboard.includes("businessDateKey"), "Dashboard trend grouping must use business timezone date keys.");
assert(printService.includes("formatBusinessDateTime"), "Printed receipts/invoices must use business timezone formatting.");

function dateKey(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const closeToParisMidnight = new Date("2026-07-17T02:20:00.000Z");
assert(dateKey(closeToParisMidnight, "America/Port-au-Prince") === "2026-07-16", "A UTC date near Paris midnight must remain the previous day in Haiti.");
assert(dateKey(closeToParisMidnight, "Europe/Paris") === "2026-07-17", "Smoke fixture should be tomorrow in Paris.");

console.log("business-timezone-smoke: ok");
