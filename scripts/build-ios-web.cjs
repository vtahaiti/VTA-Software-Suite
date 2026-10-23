const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const web = path.join(root, 'apps/web');
const target = path.join(root, 'apps/ios-export');
fs.mkdirSync(target, { recursive: true });
// Build an embedded client bundle; Next's server-only API and dynamic ERP detail
// routes are not part of the mobile POS bundle.
for (const name of ['app', 'components', 'lib', 'public']) {
  fs.rmSync(path.join(target, name), { recursive: true, force: true });
  fs.cpSync(path.join(web, name), path.join(target, name), {
    recursive: true,
    filter: source => !path.basename(source).startsWith('[') && source !== path.join(web, 'app/api')
  });
}
fs.writeFileSync(path.join(target, 'app/page.tsx'), `"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function MobileStart() { const router = useRouter(); useEffect(() => { router.replace('/dashboard/pos'); }, [router]); return <main>Ouverture de VTA POS…</main>; }
`);
const routes = [];
function walk(directory, segments = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(path.join(directory, entry.name), [...segments, entry.name]);
    else if (entry.name === 'page.tsx') routes.push('/' + segments.filter(part => !part.startsWith('(')).join('/'));
  }
}
walk(path.join(target, 'app'));
fs.writeFileSync(path.join(target, 'lib/ios-embedded-routes.ts'), 'export const iosEmbeddedRoutes: string[] = ' + JSON.stringify(routes) + ';\n');
for (const name of ['next-env.d.ts' , 'tailwind.config.ts', 'postcss.config.mjs']) fs.copyFileSync(path.join(web, name), path.join(target, name));
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: 'vta-ios-export', private: true }));
const tsconfig = JSON.parse(fs.readFileSync(path.join(web, 'tsconfig.json')));
fs.writeFileSync(path.join(target, 'tsconfig.json'), JSON.stringify(tsconfig));
fs.writeFileSync(path.join(target, 'next.config.mjs'), `export default { output: 'export', trailingSlash: true, images: { unoptimized: true }, transpilePackages: ['@vta/ui'], eslint: { ignoreDuringBuilds: true } };\n`);
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'build'], {
  cwd: target, stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_API_URL: 'https://api.vtaerp.com', NEXT_PUBLIC_IOS_EMBEDDED: '1', NEXT_TELEMETRY_DISABLED: '1' }
});
if (result.status !== 0) process.exit(result.status ?? 1);
fs.rmSync(path.join(web, 'ios-bundle'), { recursive: true, force: true });
fs.cpSync(path.join(target, 'out'), path.join(web, 'ios-bundle'), { recursive: true });
console.log('Embedded iOS bundle ready in apps/web/ios-bundle');
