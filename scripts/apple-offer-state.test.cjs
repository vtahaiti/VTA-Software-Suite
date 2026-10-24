const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsFixture = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/web/lib/apple-offer-state.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsFixture });
const { appleOfferState } = exportsFixture;
const allowed = { busy: false, current: false, canManage: true, trialActive: false, appleManaged: false, configured: true, canPurchase: true, priceAvailable: true };

test('A price alone never enables a purchase: every access and storefront requirement must hold', () => {
  assert.equal(appleOfferState(allowed).disabled, false);
  for (const key of Object.keys(allowed)) {
    assert.equal(appleOfferState({ ...allowed, [key]: !allowed[key] }).disabled, true, key);
  }
});

test('Unavailable offers explain the blocking condition instead of displaying a disabled subscribe invitation', () => {
  for (const state of [{ configured: false }, { priceAvailable: false }, { trialActive: true }, { canManage: false }, { canPurchase: false }]) {
    const result = appleOfferState({ ...allowed, ...state });
    assert.equal(result.disabled, true);
    assert.notEqual(result.label, 'S’abonner avec Apple');
  }
  assert.match(appleOfferState({ ...allowed, priceAvailable: false }).label, /Offre Apple indisponible/);
});
