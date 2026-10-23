const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture({ native = true, status = 200, data, headers = { 'Content-type': 'application/json' }, fail = false, hang = false } = {}) {
  const calls = [];
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('apps/web/lib/api-url.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  vm.runInNewContext(source, {
    exports, Headers, Response, FormData, console: { info() {} },
    process: { env: { NODE_ENV: 'production', NEXT_PUBLIC_IOS_EMBEDDED: native ? '1' : '0' } },
    require: () => ({ Capacitor: { getPlatform: () => 'ios' }, CapacitorHttp: { request: async options => {
      calls.push(options); if (hang) return new Promise(() => {}); if (fail) throw Error('transport failed'); return { status, data, headers };
    } } }),
    fetch: async () => { calls.push('web'); return new Response('web'); }
  });
  return { ...exports, calls };
}

test('iOS login sends a JSON object and reads a Foundation-decoded response once', async () => {
  const data = { accessToken: 'test-token', user: { id: 'test-user' } };
  const f = fixture({ data });
  const response = await f.fetchApi('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@example.invalid', password: 'test-only' }) });
  assert.equal(response.ok, true);
  assert.deepEqual(await response.json(), data);
  assert.equal(f.calls[0].data.email, 'test@example.invalid');
  assert.equal(f.calls[0].url, 'https://api.vtaerp.com/auth/login');
});

test('iOS preserves both JSON text errors and decoded error objects', async () => {
  for (const data of [{ message: 'Email ou mot de passe incorrect' }, '{"message":"Email ou mot de passe incorrect"}']) {
    const f = fixture({ status: 401, data });
    const response = await f.fetchApi('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).message, 'Email ou mot de passe incorrect');
  }
});

test('native authorization headers and empty logout responses survive the adapter', async () => {
  const f = fixture({ status: 204 });
  const response = await f.fetchApi('/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer test-only' } });
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(f.calls[0].headers.authorization, 'Bearer test-only');
});

test('transport failure is not misreported as an invalid password and web is unchanged', async () => {
  await assert.rejects(fixture({ fail: true }).fetchApi('/auth/login'), /Connexion au serveur impossible/);
  const web = fixture({ native: false });
  assert.equal(await (await web.fetchApi('/auth/login')).text(), 'web');
  assert.deepEqual(web.calls, ['web']);
});

 test('iOS session verification returns promptly when its caller aborts a stalled native request', async () => {
  const f = fixture({ hang: true });
  const controller = new AbortController();
  const response = f.fetchApi('/auth/me', { signal: controller.signal });
  setImmediate(() => controller.abort());
  await assert.rejects(response, /Connexion au serveur impossible/);
  assert.equal(f.calls.length, 1);
});
