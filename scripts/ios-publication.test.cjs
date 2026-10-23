const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true } }).outputText;
  vm.runInNewContext(source, { exports, require: key => {
    if (!(key in mocks)) throw Error(`Unexpected dependency ${key}`);
    return mocks[key];
  }, ...globals });
  return exports;
}
const decorator = () => () => {};
function deletionFixture({ validPassword = true, failTransaction = false } = {}) {
  const calls = [];
  const models = ['userProfile','userRole','passwordResetToken','onboardingState','pendingRegistration','notification','emailLog','storeUser','securityLog'];
  const tx = Object.fromEntries(models.map(model => [model, { deleteMany: async arg => calls.push([model, arg]) }]));
  tx.user = { update: async arg => calls.push(['user', arg]) };
  tx.auditLog = { updateMany: async arg => calls.push(['auditLog', arg]) };
  const prisma = { user: { findUnique: async () => ({ id: 'u1', tenantId: 't1', email: 'private@example.test', password: 'hash' }) }, $transaction: async callback => {
    if (failTransaction) throw Error('DB unavailable');
    return callback(tx);
  } };
  const { ProfileService } = load('apps/api/src/profile/profile.service.ts', {
    '@nestjs/common': { Injectable: decorator, BadRequestException: Error, NotFoundException: Error },
    '@prisma/client': { Prisma: { DbNull: null } },
    crypto: require('node:crypto'), '../auth/auth.service': {}, '../prisma/prisma.service': {}, './dto/delete-account.dto': {}, './dto/change-password.dto': {},
    '../auth/password-hashing': { comparePassword: async () => validPassword, hashPassword: async () => 'random-unusable-hash' }
  });
  return { service: new ProfileService(prisma, { invalidateUserSessions: id => calls.push(['revoke', id]) }), calls };
}
test('Account deletion requires both password and explicit confirmation before mutations', async () => {
  for (const [password, confirmation] of [[false, 'SUPPRIMER'], [true, 'wrong']]) {
    const f = deletionFixture({ validPassword: password });
    await assert.rejects(f.service.deleteAccount('u1', { currentPassword: 'test', confirmation }));
    assert.equal(f.calls.length, 0);
  }
});
test('Deletion erases identity and personal data and revokes sessions, retaining shared business records', async () => {
  const f = deletionFixture();
  assert.equal((await f.service.deleteAccount('u1', { currentPassword: 'test', confirmation: 'SUPPRIMER' })).deleted, true);
  const update = f.calls.find(([model]) => model === 'user')[1];
  assert.equal(update.where.id, 'u1');
  assert.equal(update.data.isActive, false);
  assert.ok(!JSON.stringify(update.data).includes('private@example.test'));
  for (const [model, args] of f.calls.filter(([model]) => !['user','revoke'].includes(model))) {
    assert.ok(args.where.userId === 'u1' || (model === 'pendingRegistration' && args.where.email === 'private@example.test'));
  }
  assert.equal(f.calls.at(-1)[0], 'revoke');
});
test('Failed transaction is surfaced without reporting deletion success', async () => {
  const f = deletionFixture({ failTransaction: true });
  await assert.rejects(f.service.deleteAccount('u1', { currentPassword: 'test', confirmation: 'SUPPRIMER' }));
  assert.equal(f.calls.length, 0);
});
test('Offline session expires after seven days, rejects future timestamps, and is cleared at logout', () => {
  const values = new Map();
  const window = { localStorage: { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) }, dispatchEvent() {} };
  const api = load('apps/web/lib/auth.ts', { '@/lib/api-url': {} }, { window, CustomEvent: class {} });
  assert.equal(api.hasValidOfflineSession(), false);
  api.saveSession({ accessToken: 'a', refreshToken: 'r', user: { id: 'u', tenantId: 't' } });
  assert.equal(api.hasValidOfflineSession(), true);
  values.set('vta_offline_validated_at', String(Date.now() - 8 * 86400000));
  assert.equal(api.hasValidOfflineSession(), false);
  values.set('vta_offline_validated_at', String(Date.now() + 86400000));
  assert.equal(api.hasValidOfflineSession(), false);
  api.clearSession();
  assert.equal(values.has('vta_offline_validated_at'), false);
});
function authFixture({ blocked = false, validPassword = true, user = { id: 'u1', isActive: true, password: 'hash' }, production = true } = {}) {
  const calls = [];
  const { AuthService } = load('apps/api/src/auth/auth.service.ts', {
    '@nestjs/common': { Injectable: decorator, UnauthorizedException: Error, ForbiddenException: Error, Logger: class {} },
    '@nestjs/jwt': {}, '@prisma/client': { TenantStatus: { DELETED: 'DELETED' }, AuditAction: { LOGIN_FAILED: 'LOGIN_FAILED' } }, bcryptjs: { default: { hashSync: () => 'demo' } },
    crypto: require('node:crypto'), '../audit-logs/audit-logs.service': {}, '../email/email.service': {}, '../prisma/prisma.service': {}, '../security/security.service': {},
    '../subscriptions/internal-tenant-policy': {}, '../rbac/default-permissions': { defaultPermissions: [] },
    './dto/forgot-password.dto': {}, './dto/login.dto': {}, './dto/reset-password.dto': {},
    './password-hashing': { comparePassword: async () => validPassword }, './password-policy': {}
  }, { process: { env: { NODE_ENV: production ? 'production' : 'development' } } });
  const service = new AuthService({}, { user: { findFirst: async () => user } }, {
    isBlocked: async () => blocked, recordLoginFailure: async () => calls.push('failure')
  }, { create: async () => {} }, {});
  return { service, calls };
}
test('Deletion reauthentication works without a subscription session and grants no login session', async () => {
  const f = authFixture();
  assert.equal(await f.service.authorizeAccountDeletion('person@example.test', 'test'), 'u1');
  assert.equal(f.service.sessions.size, 0);
});
test('Deletion reauthentication applies lockouts and rejects invalid passwords', async () => {
  for (const options of [{ blocked: true }, { validPassword: false }, { user: null }]) {
    const f = authFixture(options);
    await assert.rejects(f.service.authorizeAccountDeletion('person@example.test', 'wrong'));
    assert.equal(f.service.sessions.size, 0);
  }
});
test('Production never issues a fallback demo session when the database user is missing', async () => {
  const f = authFixture({ user: null, validPassword: true });
  f.service.recordAuthAudit = async () => {};
  await assert.rejects(f.service.login({ email: 'admin@vta.ht', password: 'admin123' }), /Email ou mot de passe incorrect/);
  assert.equal(f.service.sessions.size, 0);
});
test('Expired access token is refreshed before retrying authenticated requests', async () => {
  let token = 'expired'; const sent = [];
  const { fetchWithAuth } = load('apps/web/lib/api-client.ts', {
    '@/lib/auth': { getAccessToken: () => token, refreshSession: async () => { token = 'fresh'; return { id: 'u1' }; } },
    '@/lib/api-url': { apiUrl: path => `https://api.example.test${path}` },
    '@/lib/tenant-access': { isTenantAccessBlockedResponse: async () => false }
  }, { Headers, process: { env: {} }, fetch: async (_, init) => { sent.push(init.headers.get('Authorization')); return { status: sent.length === 1 ? 401 : 200 }; } });
  assert.equal((await fetchWithAuth('/pos/sync-offline-sales', { method: 'POST' })).status, 200);
  assert.deepEqual(sent, ['Bearer expired', 'Bearer fresh']);
});
test('iOS logo FormData upload supplies the native bridge multipart hint without changing web uploads', async () => {
  for (const embedded of ['1', '0']) {
    let captured;
    const { fetchWithAuth } = load('apps/web/lib/api-client.ts', {
      '@/lib/auth': { getAccessToken: () => 'token' }, '@/lib/api-url': {},
      '@/lib/tenant-access': { isTenantAccessBlockedResponse: async () => false }
    }, { Headers, FormData, process: { env: { NEXT_PUBLIC_IOS_EMBEDDED: embedded } }, fetch: async (_, init) => { captured = init; return { status: 200 }; } });
    await fetchWithAuth('https://api.example.test/uploads/company-logo', { method: 'POST', body: new FormData() });
    assert.equal(captured.headers.get('Content-Type'), embedded === '1' ? 'multipart/form-data' : null);
  }
});
