const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, mocks) {
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, window: {}, require: name => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency ${name}`);
    return mocks[name];
  }});
  return exports;
}

test('Native print is available only when the plugin is registered', async () => {
  for (const [native, registered, expected] of [[true, true, true], [true, false, false], [false, true, false]]) {
    const api = load('apps/web/lib/native-print.ts', {
      '@capacitor/core': { registerPlugin: () => ({}), Capacitor: { isNativePlatform: () => native, isPluginAvailable: () => registered } },
      '@/lib/native-bluetooth-print': {}
    });
    assert.equal(await api.isNativePrintAvailable(), expected);
  }
});

test('Cancelling the iOS print dialog is not reported as a successful print', async () => {
  const api = load('apps/web/lib/native-print.ts', {
    '@capacitor/core': { registerPlugin: () => ({ printHtml: async () => ({ status: 'cancelled' }) }) },
    '@/lib/native-bluetooth-print': { getDefaultBluetoothPrinter: async () => ({ configured: false }) }
  });
  assert.equal((await api.printReceiptSmart({ html: '<p>Ticket</p>' })).status, 'cancelled');
});

test('iOS without a BLE plugin does not call an unavailable printer', async () => {
  const api = load('apps/web/lib/native-bluetooth-print.ts', {
    '@capacitor/core': { registerPlugin: () => ({ isAvailable: () => { throw new Error('Android-only call'); } }), Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => false } }
  });
  assert.equal(await api.isBluetoothPrintSupported(), false);
});

test('iOS BLE plugin is offered when registered', async () => {
  const api = load('apps/web/lib/native-bluetooth-print.ts', {
    '@capacitor/core': { registerPlugin: () => ({ isAvailable: async () => ({ available: true }) }), Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true } }
  });
  assert.equal(await api.isBluetoothPrintSupported(), true);
});
test('A partial BLE failure does not silently print a second receipt', async () => {
  let fallbackCalls = 0;
  const api = load('apps/web/lib/native-print.ts', {
    '@capacitor/core': { registerPlugin: () => ({ printHtml: async () => { fallbackCalls++; } }) },
    '@/lib/native-bluetooth-print': { getDefaultBluetoothPrinter: async () => ({ configured: true }), printTicketOverBluetooth: async () => { throw new Error('Disconnected'); } }
  });
  await assert.rejects(api.printReceiptSmart({ html: '<p>Ticket</p>' }));
  assert.equal(fallbackCalls, 0);
});

test('A receipt retains its original 58 mm format when the printer default changes', () => {
  const { storedReceiptPrintOptions } = load('apps/web/lib/receipt-print-options.ts', {});
  assert.equal(storedReceiptPrintOptions({ receiptWidth: '58' }).widthDots, 384);
  assert.equal(storedReceiptPrintOptions({ receiptHtml: '@page{size:58mm auto}' }).widthDots, 384);
  assert.equal(storedReceiptPrintOptions({ receiptWidth: '80' }).widthDots, 576);
  assert.equal(storedReceiptPrintOptions({ receiptWidth: '72' }).widthDots, 576);
});
test('Printing 58 mm without an explicit dot width uses 384 dots and the selected printer', async () => {
  let call;
  const api = load('apps/web/lib/native-print.ts', {
    '@capacitor/core': { registerPlugin: () => ({}) },
    '@/lib/native-bluetooth-print': { getDefaultBluetoothPrinter: async () => ({ configured: true, address: 'selected-printer' }), printTicketOverBluetooth: async (...args) => { call = args; } }
  });
  await api.printReceiptSmart({ html: '<p>Ticket</p>', format: '58' });
  assert.equal(call[1], 384); assert.equal(call[2], 'selected-printer');
});
test('Calibration tickets contain accents, totals and no external resources', () => {
  const { buildBluetoothTestTicketHtml, bluetoothPrintError } = load('apps/web/lib/receipt-print-options.ts', {});
  const html = buildBluetoothTestTicketHtml('80');
  for (const text of ['Haïti', 'Kreyòl', '125,00', '75,00', 'AUCUNE VENTE']) assert.ok(html.includes(text));
  assert.ok(!html.includes('src='));
  assert.match(bluetoothPrintError({ message: 'Profil BLE ESC/POS non reconnu. Ce modèle peut nécessiter un autre pilote.' }), /Profil BLE/);
  assert.ok(!bluetoothPrintError({ message: 'Internal technical error' }).includes('Internal'));
});
test('Malformed ticket requests are rejected before calling the native printer', async () => {
  let calls = 0;
  const api = load('apps/web/lib/native-bluetooth-print.ts', { '@capacitor/core': { registerPlugin: () => ({ printTicket: async () => { calls++; } }) } });
  await assert.rejects(api.printTicketOverBluetooth(' ', 576));
  await assert.rejects(api.printTicketOverBluetooth('<p>Ticket</p>', 900));
  assert.equal(calls, 0);
});
