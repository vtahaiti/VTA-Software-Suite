const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function render(file, embedded, states = []) {
  let stateIndex = 0;
  const exports = {};
  const hooks = { useEffect() {}, useMemo: fn => fn(), useState: initial => [stateIndex < states.length ? states[stateIndex++] : initial, () => {}] };
  const mocks = {
    react: hooks, 'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    '@/components/ios-subscriptions': { IosSubscriptions: () => React.createElement('div',null,'Apple subscription screen') },
    '@/components/ios-page-heading': { IosPageHeading: ({title}) => React.createElement('h1',null,title) },
    '@/components/ios-bottom-nav': { IosBottomNav: () => null }, 'lucide-react': { ShoppingCart: () => null },
    '@/lib/auth': {}, '@/lib/api-client': {}, '@/lib/api-url': { apiBaseUrl: 'https://api.example.test' }
  };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: key => { if (!(key in mocks)) throw Error(key); return mocks[key]; }, process: { env: { NEXT_PUBLIC_IOS_EMBEDDED: embedded } }, Intl, Date });
  return renderToStaticMarkup(React.createElement(exports.default || exports.PosWelcome));
}
test('Guest POS shows the catalogue and basket with login and signup, without fabricated sales data', () => {
  const html = render('apps/web/components/pos-welcome.tsx', '1');
  assert.match(html, /href="\/login"/);
  assert.match(html, /href="\/signup"/);
  assert.match(html, /Vente en cours/);
  assert.match(html, /Connectez-vous pour encaisser/);
  assert.match(html, /disabled=""/);
});
test('iOS uses its native Apple subscription screen while web retains its plan request flow', () => {
  const plans = [{ code: 'POS_BASIC', name: 'Basique', monthlyPrice: 6, currency: 'USD', features: [] }, { code: 'POS_PREMIUM', name: 'Premium', monthlyPrice: 10, currency: 'USD', features: [] }];
  const data = { subscription: { planCode: 'POS_BASIC' }, entitlements: { active: true, featureDetails: [] } };
  const ios = render('apps/web/app/dashboard/settings/subscription/page.tsx', '1', [data, plans, false, '', '']);
  assert.match(ios, /Apple subscription screen/);
  assert.doesNotMatch(ios, /Demander Premium|>Renouveler<|Comparaison des plans|Télécharger le reçu/);
  const web = render('apps/web/app/dashboard/settings/subscription/page.tsx', '0', [data, plans, false, '', '']);
  assert.match(web, /Demander Premium/);
  assert.match(web, />Renouveler</);
});
test('Embedded capacitor links remain navigable while external documents and unsafe schemes are handled explicitly', async () => {
  let handler, purchaseIntent; const opened = [], pushed = [];
  class Element { closest() { return this.anchor; } }
  const document = { documentElement: { dataset: {} }, addEventListener: (_, callback) => { handler = callback; }, removeEventListener() {} };
  const mocks = {
    react: { useEffect: fn => fn() },
    'next/navigation': { useRouter: () => ({ push: value => pushed.push(value) }) },
    '@/lib/ios-route-map': { resolveIosHref: href => href },
    '@/lib/ios-document-actions': { installIosDocumentActions: () => () => {} },
    '@/lib/apple-subscriptions': { AppleSubscriptions: { addListener: async (event, callback) => { purchaseIntent = callback; return {remove(){}}; } } },
    '@/lib/ios-embedded-routes': { iosEmbeddedRoutes: ['/', '/login', '/signup'] },
    '@capacitor/core': { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } },
    '@capacitor/app': { App: { addListener: async () => ({ remove() {} }) } },
    '@capacitor/browser': { Browser: { open: options => opened.push(options.url) } }
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('apps/web/components/capacitor-runtime.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: key => mocks[key], document, Element, URL, navigator: { onLine: true }, window: { location: new URL('capacitor://localhost/'), alert() {} }, process: { env: { NEXT_PUBLIC_IOS_EMBEDDED: '1' } } });
  exports.CapacitorRuntime();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof handler, 'function');
  assert.equal(typeof purchaseIntent, 'function'); purchaseIntent();
  assert.deepEqual(pushed, ['/dashboard/settings/subscription']);
  function click(href) {
    let prevented = false;
    const target = new Element(); target.anchor = { hasAttribute: () => false, getAttribute: () => href };
    handler({ target, preventDefault: () => { prevented = true; } });
    return prevented;
  }
  assert.equal(click('/login'), false);
  assert.equal(click('/signup'), false);
  assert.equal(click('/dashboard/invoices/one'), true);
  assert.equal(opened.at(-1), 'https://vtaerp.com/dashboard/invoices/one');
  assert.equal(click('javascript:alert(1)'), true);
  assert.equal(opened.length, 1);
});
