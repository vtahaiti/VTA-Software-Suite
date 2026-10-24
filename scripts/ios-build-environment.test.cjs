const test = require('node:test');
const assert = require('node:assert/strict');
const { iosBuildEnvironment } = require('./ios-build-environment.cjs');

test('normal builds retain the live API and existing web storage origin', () => {
  const build = iosBuildEnvironment({});
  assert.equal(build.apiUrl, 'https://api.vtaerp.com');
  assert.equal(build.hostname, 'localhost');
  assert.equal(build.displayName, 'VTA POS');
});

test('Sandbox uses a separate HTTPS backend and web storage origin', () => {
  const live = iosBuildEnvironment({});
  const sandbox = iosBuildEnvironment({ VTA_IOS_ENVIRONMENT: 'sandbox' });
  assert.notEqual(sandbox.apiUrl, live.apiUrl);
  assert.notEqual(sandbox.hostname, live.hostname);
  assert.equal(new URL(sandbox.apiUrl).protocol, 'https:');
  assert.equal(sandbox.hostname, 'sandbox.localhost');
  assert.equal(sandbox.displayName, 'VTA POS Test');
});

test('unknown targets cannot silently redirect native business data', () => {
  for (const value of ['', 'qa', 'https://example.com', '__proto__', 'constructor']) {
    assert.throws(() => iosBuildEnvironment({ VTA_IOS_ENVIRONMENT: value }));
  }
});
