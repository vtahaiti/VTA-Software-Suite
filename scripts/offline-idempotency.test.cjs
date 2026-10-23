const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../apps/api/src/sales/sales.service.ts'), 'utf8');
const exportsForService = {};
const code = ts.transpileModule(source, { compilerOptions: { experimentalDecorators: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
vm.runInNewContext(code, { exports: exportsForService, require: name => {
  if (name === 'node:crypto') return require(name);
  if (name === '@nestjs/common') return { Injectable: () => value => value, BadRequestException: Error, ForbiddenException: Error, NotFoundException: Error };
  return {};
}});
const { SalesService } = exportsForService;
test('An offline retry returns the committed sale instead of creating another sale', async () => {
  const saved = new Map(); let creates = 0;
  const service = new SalesService({ sale: { findFirst: async ({ where }) => saved.get(where.id) } }, {});
  service.create = async (tenant, dto, user, payer, id) => { creates++; saved.set(id, { id }); return { id }; };
  service.findOne = async (tenant, id) => saved.get(id);
  const first = await service.createOffline('tenant', 'user', 'local-1', {});
  const retry = await service.createOffline('tenant', 'user', 'local-1', {});
  assert.equal(first.id, retry.id); assert.equal(creates, 1);
  const otherTenant = await service.createOffline('other', 'user', 'local-1', {});
  assert.notEqual(first.id, otherTenant.id);
});
test('A concurrent unique-key failure returns the sale committed by the other request', async () => {
  let saved;
  const service = new SalesService({ sale: { findFirst: async () => saved } }, {});
  service.create = async (tenant, dto, user, payer, id) => { saved = { id }; throw new Error('unique violation'); };
  service.findOne = async () => saved;
  assert.ok((await service.createOffline('tenant', 'user', 'local-1', {})).id);
});
test('A failed transaction is not acknowledged as synchronized', async () => {
  const service = new SalesService({ sale: { findFirst: async () => null } }, {});
  service.create = async () => { throw new Error('Stock insuffisant'); };
  await assert.rejects(service.createOffline('tenant', 'user', 'local-1', {}), /Stock insuffisant/);
});
