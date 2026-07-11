const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const checks = [
  {
    name: "Admin login uses platform endpoint",
    file: "apps/web/app/admin/login/page.tsx",
    mustInclude: ["platformLogin"],
    mustNotInclude: ["login({ email"]
  },
  {
    name: "Admin tokens are stored separately",
    file: "apps/web/lib/platform.ts",
    mustInclude: ["vta_platform_access_token", "vta_platform_refresh_token", "/auth/platform/login", "/auth/platform/me"],
    mustNotInclude: ["getAccessToken", "getCurrentUser"]
  },
  {
    name: "Admin shell validates server session before rendering",
    file: "apps/web/app/admin/admin-shell.tsx",
    mustInclude: ["verifyPlatformSession", "Verification de l&apos;acces plateforme"],
    mustNotInclude: ["isPlatformAdmin"]
  },
  {
    name: "API provides platform-only auth routes",
    file: "apps/api/src/auth/auth.controller.ts",
    mustInclude: ['@Post("platform/login")', '@Post("platform/refresh")', '@Get("platform/me")', '@Post("platform/logout")', "assertPlatformUser"]
  },
  {
    name: "Platform API guard requires platform audience",
    file: "apps/api/src/platform/guards/platform-admin.guard.ts",
    mustInclude: ["hasPlatformAudience", "hasTrustedIssuer", "Session plateforme requise"]
  },
  {
    name: "Auth service separates tenant and platform sessions",
    file: "apps/api/src/auth/auth.service.ts",
    mustInclude: ["loginPlatformAdmin", 'audience: "tenant" | "platform"', "refreshPlatform", "createSession(session.user, session.rememberMe, \"platform\")"],
    mustNotInclude: ["createSession(authUser, Boolean(loginDto.rememberMe));"]
  }
];

const failures = [];

for (const check of checks) {
  const content = read(check.file);
  for (const expected of check.mustInclude ?? []) {
    if (!content.includes(expected)) failures.push(`${check.name}: missing "${expected}" in ${check.file}`);
  }
  for (const forbidden of check.mustNotInclude ?? []) {
    if (content.includes(forbidden)) failures.push(`${check.name}: forbidden "${forbidden}" still present in ${check.file}`);
  }
}

if (failures.length) {
  console.error("Admin access-control smoke test failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Admin access-control smoke test passed.");
