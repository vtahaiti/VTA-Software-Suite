const { test } = require("node:test");
const assert = require("node:assert/strict");
const { defaultPlans, planFeatureMatrix, planLimitMatrix } = require("../apps/api/src/subscriptions/subscription-features.ts");
const { nextMonthlyPeriodEnd } = require("../apps/api/src/subscriptions/subscription-period.ts");

test("POS prices are monthly USD and ERP prices remain intact", () => {
  for (const [code, price] of [["POS_FREE", 0], ["POS_BASIC", 6.99], ["POS_PREMIUM", 10.99], ["POS_PRO", 18.99]]) {
    const plan = defaultPlans.find(plan => plan.code === code);
    assert.equal(plan.monthlyPrice, price);
    assert.equal(plan.currency, "USD");
  }
  for (const [code, price] of [["ESSENTIAL", 1000], ["STANDARD", 2000], ["EXPERT", 4000]]) {
    const plan = defaultPlans.find(plan => plan.code === code);
    assert.equal(plan.monthlyPrice, price);
    assert.equal(plan.currency, "HTG");
  }
});

test("Premium includes all Basic features and paid stock/report capabilities", () => {
  const basic = planFeatureMatrix.POS_BASIC;
  const premium = planFeatureMatrix.POS_PREMIUM;
  for (const feature of basic) assert.ok(premium.includes(feature), feature);
  for (const feature of ["PURCHASES", "SUPPLIERS", "LOW_STOCK_ALERTS", "ADVANCED_REPORTS", "IMPORT_EXPORT", "ROLES_PERMISSIONS"]) {
    assert.ok(premium.includes(feature));
    assert.ok(!basic.includes(feature));
  }
  assert.deepEqual(planLimitMatrix.POS_BASIC, { users: 2, stores: 1, warehouses: 1, cashRegisters: 1 });
  assert.deepEqual(planLimitMatrix.POS_PREMIUM, { users: 5, stores: 1, warehouses: 1, cashRegisters: 3 });
});

test("Monthly renewal clamps short months and preserves UTC time and input", () => {
  for (const [start, end] of [
    ["2026-01-31T14:32:10.123Z", "2026-02-28T14:32:10.123Z"],
    ["2028-01-31T14:32:10.123Z", "2028-02-29T14:32:10.123Z"],
    ["2026-12-23T14:32:10.123Z", "2027-01-23T14:32:10.123Z"]
  ]) {
    const date = new Date(start);
    assert.equal(nextMonthlyPeriodEnd(date).toISOString(), end);
    assert.equal(date.toISOString(), start);
  }
});

 test("Free is permanent, limited to one operator and a subset of Basic", () => {
  const plan = defaultPlans.find(plan => plan.code === "POS_FREE");
  assert.equal(plan.trialDays, 0);
  assert.deepEqual(planLimitMatrix.POS_FREE, { users: 1, stores: 1, warehouses: 1, cashRegisters: 1 });
  for (const feature of planFeatureMatrix.POS_FREE) assert.ok(planFeatureMatrix.POS_BASIC.includes(feature));
  for (const feature of ["INVENTORY", "USERS", "PURCHASES", "ADVANCED_REPORTS"]) assert.ok(!planFeatureMatrix.POS_FREE.includes(feature));
});

test("First month trial includes every POS tier without a subscription charge", () => {
  const trial = defaultPlans.find(plan => plan.code === "TRIAL");
  assert.equal(trial.monthlyPrice, 0);
  for (const code of ["POS_FREE", "POS_BASIC", "POS_PREMIUM", "POS_PRO"]) {
    for (const feature of planFeatureMatrix[code]) assert.ok(planFeatureMatrix.TRIAL.includes(feature));
    for (const key of Object.keys(planLimitMatrix[code])) assert.ok(planLimitMatrix.TRIAL[key] >= planLimitMatrix[code][key]);
  }
});
