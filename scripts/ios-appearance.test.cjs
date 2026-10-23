const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const postcss = require('postcss');
const tailwind = require('tailwindcss');

async function utilities(ios) {
  const exports = {};
  const source = fs.readFileSync('apps/web/tailwind.config.ts', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, process: { env: { NEXT_PUBLIC_IOS_EMBEDDED: ios ? '1' : undefined } }
  });
  const result = await postcss([tailwind({
    ...exports.default,
    content: [{ raw: '<label class="text-slate-700 dark:text-slate-200"><input class="bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-50 border-slate-300 dark:border-slate-700"><select class="bg-white dark:bg-slate-950"></select></label>' }],
    corePlugins: { preflight: false }
  })]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

test('iOS form utilities stay light when the system requests dark appearance', async () => {
  const css = await utilities(true);
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /data-vta-appearance/);
  // Every dark utility requires an explicit dark appearance ancestor; the
  // iOS layout never sets this attribute. Both field backgrounds and text
  // are gated together, rather than overriding only the input background.
  const root = postcss.parse(css);
  let darkRules = 0;
  root.walkRules(rule => {
    if (!rule.selector.includes('.dark\\:')) return;
    darkRules++;
    assert.match(rule.selector, /data-vta-appearance="dark"/);
  });
  assert.ok(darkRules >= 4);
  assert.match(fs.readFileSync('apps/web/app/globals.css','utf8'), /html\[data-capacitor-platform="ios"\]\s*\{\s*color-scheme:\s*only light/);
  assert.match(fs.readFileSync('apps/web/ios/App/App/Info.plist','utf8'), /<key>UIUserInterfaceStyle<\/key>\s*<string>Light<\/string>/);
});

test('Web and Android keep their existing system dark-mode utilities', async () => {
  assert.match(await utilities(false), /@media\s*\(prefers-color-scheme:\s*dark\)/);
});
