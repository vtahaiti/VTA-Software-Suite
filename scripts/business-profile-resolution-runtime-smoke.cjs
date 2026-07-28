const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "apps/api/src/business-profiles/business-catalog.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const moduleUnderTest = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleUnderTest,
  exports: moduleUnderTest.exports,
  require,
  Set
});

const {
  findActivityTemplate,
  normalizeBusinessLabel,
  resolveBusinessProfileSlug
} = moduleUnderTest.exports;

assert.equal(normalizeBusinessLabel("  Épicerie / Market "), "epicerie / market");
assert.equal(resolveBusinessProfileSlug("health", "PHARMACIE"), "pharmacy");
assert.equal(resolveBusinessProfileSlug("construction", "Materiaux de construction"), "construction-materials");
assert.equal(resolveBusinessProfileSlug("fashion-beauty", "Parfumerie"), "fashion");
assert.equal(resolveBusinessProfileSlug("fashion-beauty", "Boutique mode"), "fashion");
assert.equal(resolveBusinessProfileSlug("fashion-beauty", "Chaussures"), "fashion");
assert.equal(findActivityTemplate("Activite inconnue"), undefined);
assert.equal(resolveBusinessProfileSlug("health", "Activite inconnue"), "pharmacy");
assert.equal(resolveBusinessProfileSlug("construction", ""), "construction-materials");

console.log("Business profile resolution runtime smoke OK");
