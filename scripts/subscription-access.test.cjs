const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(path,resolve=require){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText,{exports,require:resolve,Date,Map,Set,Number});return exports;}
const policy=load('apps/web/lib/subscription-access.ts'),catalogue=load('apps/api/src/subscriptions/subscription-features.ts');
const value=code=>({tenantId:'business-a',planCode:code,planName:code,isActive:true,status:'ACTIVE',features:catalogue.planFeatureMatrix[code].map(key=>({key,enabled:true})),limits:catalogue.planLimitMatrix[code]});
test('Every mobile paid route follows the same feature matrix as the API for all four plans and trial',()=>{
 const routes={'/dashboard/inventory':'INVENTORY','/dashboard/purchases':'PURCHASES','/dashboard/suppliers/create':'SUPPLIERS','/dashboard/settings/roles':'ROLES_PERMISSIONS','/dashboard/inventory/transfers':'STOCK_TRANSFERS','/dashboard/reports/top-products':'ADVANCED_REPORTS','/dashboard/products/create':'PRODUCTS','/dashboard/audit':'ADVANCED_AUDIT'};
 for(const code of ['POS_FREE','POS_BASIC','POS_PREMIUM','POS_PRO','TRIAL'])for(const [route,key] of Object.entries(routes)){
  assert.equal(policy.requiredPlanFeature(route),key);
  assert.equal(policy.includesPlanFeature(value(code),key),catalogue.planFeatureMatrix[code].includes(key),`${code} ${route}`);
 }
});
test('Billing and profile remain accessible; path boundaries cannot confuse roles with role-like names',()=>{
 for(const path of ['/dashboard/settings/subscription','/dashboard/profile/password','/dashboard/settings/company'])assert.equal(policy.requiredPlanFeature(path),null);
 assert.equal(policy.requiredPlanFeature('/dashboard/inventory/transfers/?id=1'),'STOCK_TRANSFERS');
 assert.equal(policy.requiredPlanFeature('/dashboard/inventory-other'),null);
});
test('Cached expired paid/trial access never unlocks features and disabled features stay locked',()=>{
 for(const code of ['POS_BASIC','TRIAL'])assert.equal(policy.includesPlanFeature({...value(code),currentPeriodEnd:'2000-01-01'},'POS'),false);
 assert.equal(policy.includesPlanFeature({...value('POS_FREE'),currentPeriodEnd:'2000-01-01'},'POS'),true);
 assert.equal(policy.includesPlanFeature({...value('POS_PRO'),isActive:false},'POS'),false);
 assert.equal(policy.includesPlanFeature({...value('POS_PRO'),features:[{key:'POS',enabled:false}]},'POS'),false);
});
class Forbidden extends Error {constructor(body){super(body.message);this.body=body;}}
const Service=load('apps/api/src/subscriptions/subscription-entitlements.service.ts',key=>{
 if(key==='@nestjs/common')return{Injectable:()=>c=>c,ForbiddenException:Forbidden};
 if(key==='@prisma/client')return{Prisma:{TransactionIsolationLevel:{Serializable:'Serializable'}},SubscriptionStatus:{}};
 if(key==='./subscription-features')return catalogue;
 if(key==='./internal-tenant-policy')return{isVtaEnterpriseTenant:()=>false};
 return{};
}).SubscriptionEntitlementsService;
function fixture(limit=1,used=0){const tx={};let writes=0,invalidations=0;const service=new Service({$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'Serializable');return fn(tx);}});service.getEntitlements=async()=>({...value('POS_BASIC'),limits:{users:limit}});service.getUsage=async(id,db)=>{assert.equal(id,'business-a');assert.equal(db,tx);return{users:used};};service.invalidate=()=>invalidations++;return{service,tx,write:async db=>{assert.equal(db,tx);writes++;return'created';},counts:()=>({writes,invalidations})};}
test('Creation quota counts inside the write transaction and rejects at the exact boundary without writing',async()=>{
 const f=fixture(2,1);assert.equal(await f.service.withResourceLimit('business-a','users',f.write),'created');assert.equal(f.counts().invalidations,1);
 const full=fixture(2,2);await assert.rejects(full.service.withResourceLimit('business-a','users',full.write),e=>e.body.code==='SUBSCRIPTION_LIMIT_REACHED');assert.equal(full.counts().writes,0);
});
test('Reactivation must acquire a slot; editing an already active object consumes no extra slot',async()=>{
 const f=fixture(1,1);await assert.rejects(f.service.withResourceLimit('business-a','users',f.write,async()=>true),e=>e.body.limitKey==='users');
 assert.equal(await f.service.withResourceLimit('business-a','users',f.write,async()=>false),'created');
});
test('Serializable conflict retries recount the last slot and never overwrite concurrent creation',async()=>{
 const f=fixture(1,0);let attempts=0,used=0;
 f.service.getUsage=async()=>({users:used});
 f.service.prisma.$transaction=async fn=>{attempts++;if(attempts===1){await fn(f.tx);used=1;throw Object.assign(new Error('serialization'),{code:'P2034'});}return fn(f.tx);};
 await assert.rejects(f.service.withResourceLimit('business-a','users',f.write),e=>e.body.code==='SUBSCRIPTION_LIMIT_REACHED');assert.equal(attempts,2);
});
test('Inactive subscriptions fail before any write, retries are bounded, unrelated database errors propagate',async()=>{
 const f=fixture();f.service.getEntitlements=async()=>({...value('POS_FREE'),isActive:false});await assert.rejects(f.service.withResourceLimit('business-a','users',f.write),e=>e.body.code==='SUBSCRIPTION_INACTIVE');assert.equal(f.counts().writes,0);
 const g=fixture();let attempts=0;g.service.prisma.$transaction=async()=>{attempts++;throw Object.assign(new Error('conflict'),{code:'P2034'});};await assert.rejects(g.service.withResourceLimit('business-a','users',g.write));assert.equal(attempts,3);
});
test('The API guard blocks paid operations for lower plans even for an owner with role permissions',async()=>{
 const Guard=load('apps/api/src/subscriptions/subscription-feature.guard.ts',key=>key==='@nestjs/common'?{Injectable:()=>c=>c}:{}).SubscriptionFeatureGuard;
 for(const code of ['POS_FREE','POS_BASIC','POS_PREMIUM','POS_PRO','TRIAL'])for(const feature of ['INVENTORY','PURCHASES','ROLES_PERMISSIONS','IMPORT_EXPORT','STOCK_TRANSFERS','ADVANCED_AUDIT','MULTI_ACTIVITY']){
  let checked=false;
  const guard=new Guard({getAllAndOverride:()=>feature},{assertFeature:async(tenant,key)=>{checked=true;assert.equal(tenant,'business-a');if(!catalogue.planFeatureMatrix[code].includes(key))throw new Forbidden({code:'FEATURE_NOT_INCLUDED',message:'locked'});}});
  const context={getHandler:()=>null,getClass:()=>null,switchToHttp:()=>({getRequest:()=>({user:{tenantId:'business-a',role:'OWNER',roles:['OWNER'],permissions:['*']}})})};
  if(catalogue.planFeatureMatrix[code].includes(feature))assert.equal(await guard.canActivate(context),true);else await assert.rejects(guard.canActivate(context),e=>e.body.code==='FEATURE_NOT_INCLUDED');
  assert.equal(checked,true);
 }
});
