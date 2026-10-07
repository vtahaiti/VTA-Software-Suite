const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (file) => fs.readFileSync(file, "utf8");
const main = read("apps/api/src/main.ts");
const auth = read("apps/api/src/auth/auth.service.ts");
const uploads = read("apps/api/src/uploads/uploads.service.ts");
const print = read("apps/api/src/print/invoice-print.service.ts");
const nextConfig = read("apps/web/next.config.mjs");

assert(main.includes("assertProductionSecrets()"), "API production must reject missing JWT secrets.");
assert(!main.includes('["http://localhost:3000",'), "Production CORS must not always include localhost.");
assert(!auth.includes('?? "change-me"') && !auth.includes('?? "change-me-refresh"'), "JWT secrets must not use public fallbacks.");
assert(uploads.includes("detectedImageType") && uploads.includes("detected.extension !== declaredExtension"), "Uploads must validate image signatures.");
assert(print.includes("localLogoDataUri") && print.includes("data:${mime};base64"), "Local logos must be embedded in printable HTML.");
for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]) {
  assert(nextConfig.includes(header), `Missing security header: ${header}`);
}

console.log("Security hardening smoke OK");
