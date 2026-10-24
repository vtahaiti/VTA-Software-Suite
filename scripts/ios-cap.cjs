const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { iosBuildEnvironment } = require("./ios-build-environment.cjs");
const buildEnvironment = iosBuildEnvironment();
const web = path.resolve(__dirname, "../apps/web");
if (['sync', 'copy'].includes(process.argv[2])) {
  const embedded = JSON.parse(fs.readFileSync(path.join(web, 'ios-bundle/vta-build-environment.json'), 'utf8'));
  if (JSON.stringify(embedded) !== JSON.stringify(buildEnvironment)) throw new Error('iOS bundle environment differs from sync environment. Rebuild before syncing.');
}
const configPath = path.join(web, "capacitor.config.ts");
const original = fs.readFileSync(configPath);
try {
  const iosConfig = fs.readFileSync(path.join(web, "capacitor.ios.config.ts"), 'utf8')
    .replace('appName: "VTA POS"', `appName: ${JSON.stringify(buildEnvironment.displayName)}`)
    .replace('server: { cleartext: false }', `server: { cleartext: false, hostname: ${JSON.stringify(buildEnvironment.hostname)} }`);
  if (!iosConfig.includes(`hostname: ${JSON.stringify(buildEnvironment.hostname)}`) || !iosConfig.includes(`appName: ${JSON.stringify(buildEnvironment.displayName)}`)) {
    throw new Error('iOS configuration template changed; refusing an ambiguous build environment.');
  }
  fs.writeFileSync(configPath, iosConfig);
  const result = spawnSync(process.execPath, [path.resolve(__dirname, "../node_modules/@capacitor/cli/bin/capacitor"), ...process.argv.slice(2)], { cwd: web, stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally { fs.writeFileSync(configPath, original); }
