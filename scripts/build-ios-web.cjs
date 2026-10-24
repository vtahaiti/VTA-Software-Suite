const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { addDynamicPages, adaptClientNavigation } = require('./ios-export-routes.cjs');
const { iosBuildEnvironment } = require('./ios-build-environment.cjs');
const buildEnvironment = iosBuildEnvironment();
const root = path.resolve(__dirname, '..');
const web = path.join(root, 'apps/web');
const target = path.join(root, 'apps/ios-export');
fs.mkdirSync(target, { recursive: true });
// API handlers stay server-side. Detail screens use static mobile routes with
// query IDs; the web application's dynamic routes are left unchanged.
for (const name of ['app', 'components', 'lib', 'public']) {
  fs.rmSync(path.join(target, name), { recursive: true, force: true });
  fs.cpSync(path.join(web, name), path.join(target, name), {
    recursive: true,
    filter: source => !path.basename(source).startsWith('[') && source !== path.join(web, 'app/api')
  });
}
const dynamicRoutes = addDynamicPages(path.join(web, 'app'), path.join(target, 'app'));
adaptClientNavigation(path.join(target, 'app'));
adaptClientNavigation(path.join(target, 'components'));
fs.writeFileSync(path.join(target, 'app/page.tsx'), `import { PosWelcome } from '@/components/pos-welcome';
export default function MobileStart() { return <PosWelcome />; }
`);
const routes = [];
function walk(directory, segments = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(path.join(directory, entry.name), [...segments, entry.name]);
    else if (entry.name === 'page.tsx') routes.push('/' + segments.filter(part => !part.startsWith('(')).join('/'));
  }
}
walk(path.join(target, 'app'));
fs.writeFileSync(path.join(target, 'lib/ios-embedded-routes.ts'), 'export const iosEmbeddedRoutes: string[] = ' + JSON.stringify(routes) + ';\nexport const iosDynamicRoutes: Array<{pattern:string;target:string}> = ' + JSON.stringify(dynamicRoutes) + ';\n');
for (const name of ['next-env.d.ts' , 'tailwind.config.ts', 'postcss.config.mjs']) fs.copyFileSync(path.join(web, name), path.join(target, name));
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: 'vta-ios-export', private: true }));
const tsconfig = JSON.parse(fs.readFileSync(path.join(web, 'tsconfig.json')));
fs.writeFileSync(path.join(target, 'tsconfig.json'), JSON.stringify(tsconfig));
fs.writeFileSync(path.join(target, 'next.config.mjs'), `export default { output: 'export', trailingSlash: true, images: { unoptimized: true }, transpilePackages: ['@vta/ui'], eslint: { ignoreDuringBuilds: true } };\n`);
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build'], {
  cwd: target, stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_API_URL: buildEnvironment.apiUrl, NEXT_PUBLIC_IOS_SANDBOX: buildEnvironment.name === 'sandbox' ? '1' : '0', NEXT_PUBLIC_IOS_EMBEDDED: '1', NEXT_TELEMETRY_DISABLED: '1' }
});
if (result.status !== 0) process.exit(result.status ?? 1);
fs.rmSync(path.join(web, 'ios-bundle'), { recursive: true, force: true });
fs.cpSync(path.join(target, 'out'), path.join(web, 'ios-bundle'), { recursive: true });
fs.writeFileSync(path.join(web, 'ios-bundle/vta-build-environment.json'), JSON.stringify(buildEnvironment));
console.log(`Embedded iOS bundle ready: ${buildEnvironment.displayName} (${buildEnvironment.apiUrl})`);
