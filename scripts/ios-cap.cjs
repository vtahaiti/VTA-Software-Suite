const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const web = path.resolve(__dirname, "../apps/web");
const configPath = path.join(web, "capacitor.config.ts");
const original = fs.readFileSync(configPath);
try {
  fs.copyFileSync(path.join(web, "capacitor.ios.config.ts"), configPath);
  const result = spawnSync(process.execPath, [path.resolve(__dirname, "../node_modules/@capacitor/cli/bin/capacitor"), ...process.argv.slice(2)], { cwd: web, stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally { fs.writeFileSync(configPath, original); }
