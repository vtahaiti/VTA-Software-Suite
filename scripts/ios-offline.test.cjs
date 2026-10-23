const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { IDBFactory } = require('fake-indexeddb');
function moduleFor(file, mocks, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, ...globals, require: name => { if (!(name in mocks)) throw new Error(name); return mocks[name]; } });
  return exports;
}
function fixture() {
  let user = { tenantId: 'tenantA', id: 'cashier1' };
  const api = moduleFor('apps/web/lib/offline-db.ts', { '@/lib/auth': { getCurrentUser: () => user } }, { indexedDB: new IDBFactory() });
  return { api, setUser: value => { user = value; } };
}
const product = { id: 'p1', name: 'Café', sku: 'SKU1', salePrice: 10, availableStock: 5 };
const sale = (localId, quantity, warehouseId = 'w1') => ({ localId, status: 'PENDING', createdOfflineAt: new Date().toISOString(), payload: { warehouseId, items: [{ productId: 'p1', quantity }], payments: [{ method: 'CASH', amount: quantity * 10 }] }, total: quantity * 10 });
test('Stock reservation and sale are atomic; concurrent sales cannot oversell', async () => {
  const { api } = fixture();
  await api.saveOfflineProducts([product], 'w1');
  const outcomes = await Promise.allSettled([api.commitOfflineSale(sale('a', 4)), api.commitOfflineSale(sale('b', 4))]);
  assert.equal(outcomes.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal((await api.getOfflineProducts('w1'))[0].availableStock, 1);
  assert.equal((await api.getPendingOfflineSales()).length, 1);
});
test('A failed sale leaves no queue entry or partial stock changes', async () => {
  const { api } = fixture(); await api.saveOfflineProducts([product], 'w1');
  const invalid = sale('bad', 2); invalid.payload.items.push({ productId: 'missing', quantity: 1 });
  await assert.rejects(api.commitOfflineSale(invalid));
  assert.equal((await api.getOfflineProducts('w1'))[0].availableStock, 5);
  assert.equal((await api.getOfflineSales()).length, 0);
});
test('Offline data survives reopening and is isolated by tenant, user and warehouse', async () => {
  const { api, setUser } = fixture(); await api.saveOfflineProducts([product], 'w1');
  await api.saveOfflineProducts([{ ...product, availableStock: 9 }], 'w2');
  await api.commitOfflineSale(sale('a', 2));
  assert.equal((await api.getOfflineProducts('w2'))[0].availableStock, 9);
  assert.equal((await api.getPendingOfflineSales())[0].localId, 'a');
  setUser({ tenantId: 'tenantB', id: 'cashier1' }); assert.equal((await api.getOfflineSales()).length, 0);
  setUser({ tenantId: 'tenantA', id: 'cashier2' }); assert.equal((await api.getOfflineProducts()).length, 0);
  setUser({ tenantId: 'tenantA', id: 'cashier1' }); assert.equal((await api.getPendingOfflineSales()).length, 1);
  assert.equal((await api.getOfflineProducts('w1'))[0].availableStock, 3);
});
test('Refreshing server catalogue preserves unsynced stock reservations', async () => {
  const { api } = fixture(); await api.saveOfflineProducts([product], 'w1'); await api.commitOfflineSale(sale('a', 2));
  await api.saveOfflineProducts([product], 'w1'); assert.equal((await api.getOfflineProducts('w1'))[0].availableStock, 3);
  await api.updateOfflineSale('a', { status: 'SYNCED' });
  await api.saveOfflineProducts([{ ...product, availableStock: 3 }], 'w1'); assert.equal((await api.getOfflineProducts('w1'))[0].availableStock, 3);
});
test('Duplicate local IDs do not reserve stock twice', async () => {
  const { api } = fixture(); await api.saveOfflineProducts([product], 'w1'); await api.commitOfflineSale(sale('a', 2));
  await assert.rejects(api.commitOfflineSale(sale('a', 2)));
  assert.equal((await api.getOfflineProducts('w1'))[0].availableStock, 3);
});
test('Local receipts are self contained and escape product names', () => {
  const { buildOfflineReceipt } = moduleFor('apps/web/lib/offline-receipt.ts', { '@/lib/receipt-logo': moduleFor('apps/web/lib/receipt-logo.ts', {}) });
  const html = buildOfflineReceipt({ localId: 'a', company: 'Shop', width: '80', createdAt: 'today', items: [{ name: '<script>bad</script>', quantity: 2, unitPrice: 10, total: 20 }], subtotal: 20, discount: 0, tax: 0, total: 20, received: 25 });
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('Monnaie : 5.00')); assert.ok(!html.includes('src='));
});

test('Offline Add puts the selected product in the basket and increments existing quantities', () => {
  const { addOfflineProduct } = moduleFor('apps/web/lib/offline-cart.ts', {});
  const items = addOfflineProduct([], 'p1');
  assert.equal(items.length, 1); assert.equal(items[0].quantity, 1);
  const next = addOfflineProduct(items, 'p1', 2);
  assert.equal(next.length, 1); assert.equal(next[0].quantity, 3); assert.equal(items[0].quantity, 1);
});

test('Prepared business logos are isolated by tenant and restored for offline printing', async () => {
  const { api, setUser } = fixture();
  await api.saveOfflineReceiptBranding({ companyName: 'Shop A', logoSource: '/uploads/a.png', logoDataUrl: 'data:image/png;base64,AQID', logoUnavailable: false });
  assert.equal((await api.getOfflineReceiptBranding()).companyName, 'Shop A');
  setUser({ id: 'cashier1', tenantId: 'tenantB' });
  assert.equal(await api.getOfflineReceiptBranding(), null);
  setUser({ id: 'cashier1', tenantId: 'tenantA' });
  assert.equal((await api.getOfflineReceiptBranding()).logoDataUrl, 'data:image/png;base64,AQID');
});
