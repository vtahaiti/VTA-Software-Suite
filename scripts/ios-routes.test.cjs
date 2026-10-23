const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),ts=require('typescript');
const {addDynamicPages,adaptClientNavigation}=require('./ios-export-routes.cjs');
const mappings=[];let target;
test('all twelve dynamic detail pages export without changing React dependency arrays or the web source',()=>{
 target=fs.mkdtempSync(path.join(os.tmpdir(),'vta-routes-'));mappings.push(...addDynamicPages('apps/web/app',target));assert.equal(mappings.length,12);
 const tenant=fs.readFileSync(path.join(target,'admin/tenants/detail/page.tsx'),'utf8');assert.match(tenant,/, \[id\]\)/);assert.match(tenant,/useIosRouteParams/);assert.equal((tenant.match(/"use client"/g)||[]).length,1);
 assert.match(fs.readFileSync(path.join(target,'admin/companies/detail/page.tsx'),'utf8'),/tenants\/detail/);
 adaptClientNavigation(target);
 for(const route of mappings)assert.ok(fs.existsSync(path.join(target,route.target,'page.tsx')));
 assert.match(fs.readFileSync('apps/web/app/dashboard/customers/[id]/page.tsx','utf8'),/useParams/);
});
test('detail navigation preserves encoded IDs, query and fragment; back retains the selected record',()=>{
 const exports={};const manifest={iosDynamicRoutes:mappings,iosEmbeddedRoutes:['/dashboard/customers','/dashboard/customers/detail','/dashboard/customers/detail/edit','/dashboard/more']};
 const code=ts.transpileModule(fs.readFileSync('apps/web/lib/ios-route-map.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{exports,URL,URLSearchParams,decodeURIComponent,encodeURIComponent,require:()=>manifest});
 assert.equal(exports.resolveIosHref('/dashboard/customers/a%20b/edit?tab=contact#phone'),'/dashboard/customers/detail/edit?tab=contact&id=a+b#phone');
 assert.equal(exports.iosBackHref('/dashboard/customers/detail/edit','id=a%20b'),'/dashboard/customers/detail?id=a%20b');
 assert.equal(exports.resolveIosHref('/dashboard/customers/%ZZ'),'/dashboard/customers/%ZZ');
 assert.equal(exports.resolveIosHref('https://example.com/a'),'https://example.com/a');
 assert.equal(exports.resolveIosHref('/dashboard/customers/detail?id=abc'),'/dashboard/customers/detail?id=abc');
 fs.rmSync(target,{recursive:true,force:true});
});
