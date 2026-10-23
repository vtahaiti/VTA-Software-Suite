const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const web = path.resolve(__dirname, "../apps/web");
const configPath = path.join(web, "capacitor.config.ts");
const packageSwiftPath = path.join(web, "ios/App/CapApp-SPM/Package.swift");
const original = fs.readFileSync(configPath);

function normalizeSwiftPackagePaths() {
  if (process.platform !== "win32" || !fs.existsSync(packageSwiftPath)) return;

  const source = fs.readFileSync(packageSwiftPath, "utf8");
  const normalized = source.replace(/path: "([^"]+)"/g, (_match, packagePath) =>
    `path: "${packagePath.replaceAll("\\", "/")}"`,
  );

  if (normalized !== source) fs.writeFileSync(packageSwiftPath, normalized);
}

try {
  fs.copyFileSync(path.join(web, "capacitor.ios.config.ts"), configPath);
  const result = spawnSync(
    process.execPath,
    [path.resolve(__dirname, "../node_modules/@capacitor/cli/bin/capacitor"), ...process.argv.slice(2)],
    { cwd: web, stdio: "inherit" },
  );
  process.exitCode = result.status ?? 1;
} finally {
  normalizeSwiftPackagePaths();
  fs.writeFileSync(configPath, original);
}
