const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, URL, Uint8Array, btoa, ...globals, require: name => {
    if (!(name in mocks)) throw new Error(name); return mocks[name];
  }});
  return exports;
}
const logoApi = load('apps/web/lib/receipt-logo.ts');
const actualPng = fs.readFileSync(path.join(__dirname, '../apps/web/public/vta-commerce-logo.png'));
const embedded = 'data:image/png;base64,' + actualPng.toString('base64');
function fixture({ cached = null, fail = false, onFetch } = {}) {
  let user = { id: 'u1', tenantId: 't1' }; let saved;
  const api = load('apps/web/lib/receipt-branding.ts', {
    '@/lib/receipt-logo': logoApi,
    '@/lib/auth': { getCurrentUser: () => user },
    '@/lib/api-url': { apiBaseUrl: 'https://api.vta.test' },
    '@/lib/network-timeout': { networkTimeout: () => undefined },
    '@/lib/offline-db': { getOfflineReceiptBranding: async () => cached, saveOfflineReceiptBranding: async value => { saved = value; } }
  }, { fetch: async (url, init) => { if (onFetch) onFetch(url, init); if (fail) throw new Error('offline'); return new Response(actualPng, { headers: { 'Content-Type': 'image/png' } }); } });
  return { api, saved: () => saved, setUser: value => { user = value; } };
}
test('Offline receipt embeds the business logo without external image dependencies', () => {
  const { buildOfflineReceipt } = load('apps/web/lib/offline-receipt.ts', { '@/lib/receipt-logo': logoApi });
  const html = buildOfflineReceipt({ company: 'Boutik <A>', logoDataUrl: embedded, localId: 'local-a', width: '80', createdAt: 'today', items: [], subtotal: 0, discount: 0, tax: 0, total: 0, received: 0 });
  assert.ok(html.includes('src="data:image/png;base64,')); assert.ok(html.includes('Boutik &lt;A&gt;')); assert.ok(html.includes('object-fit:contain'));
  assert.ok(!html.includes('src="https:'));
});
test('A remote or malformed logo is never embedded as active HTML in an offline receipt', () => {
  const { buildOfflineReceipt } = load('apps/web/lib/offline-receipt.ts', { '@/lib/receipt-logo': logoApi });
  const input = { company: 'Shop', localId: 'a', width: '58', createdAt: 'now', items: [], subtotal: 0, discount: 0, tax: 0, total: 0, received: 0 };
  for (const logoDataUrl of ['https://example.test/logo.png', 'javascript:bad', 'data:image/png;base64,abc" onerror="bad']) assert.ok(!buildOfflineReceipt({ ...input, logoDataUrl }).includes('<img'));
});
test('Logo download embeds real PNG bytes and only sends bearer credentials to the API origin', async () => {
  const calls = [];
  const { api } = fixture({ onFetch: (url, init) => calls.push([url, init.headers]) });
  assert.equal(await api.embedReceiptLogo('https://api.vta.test/uploads/logo.png', 'secret'), embedded);
  assert.equal(calls[0][1].Authorization, 'Bearer secret');
  await api.embedReceiptLogo('https://public.example.test/logo.png', 'secret');
  assert.equal(calls[1][1].Authorization, undefined);
});
test('Previously prepared business logo remains usable offline', async () => {
  const cached = { companyName: 'Shop', logoSource: '/uploads/a.png', logoDataUrl: embedded, logoUnavailable: false };
  const { api, saved } = fixture({ cached, fail: true });
  const result = await api.prepareReceiptBranding({ companyName: 'Shop', logoUrl: cached.logoSource }, 'token');
  assert.equal(result.logoDataUrl, embedded); assert.equal(saved().logoUnavailable, false);
});
test('A removed or changed logo cannot reuse the previous image', async () => {
  const cached = { companyName: 'Shop', logoSource: '/uploads/a.png', logoDataUrl: embedded, logoUnavailable: false };
  const { api } = fixture({ cached, fail: true });
  const removed = await api.prepareReceiptBranding({ companyName: 'Shop', logoUrl: null }, 'token');
  assert.equal(removed.logoDataUrl, null); assert.equal(removed.logoUnavailable, false);
  const changed = await api.prepareReceiptBranding({ companyName: 'Shop', logoUrl: '/uploads/new.png' }, 'token');
  assert.equal(changed.logoDataUrl, null); assert.equal(changed.logoUnavailable, true);
});

test('An account switch during preparation does not save the previous business logo', async () => {
  let state;
  state = fixture({ onFetch: () => state.setUser({ id: 'u2', tenantId: 't2' }) });
  await assert.rejects(state.api.prepareReceiptBranding({ companyName: 'Old Shop', logoUrl: '/uploads/a.png' }, 'token'), /Session modifiée/);
  assert.equal(state.saved(), undefined);
});
