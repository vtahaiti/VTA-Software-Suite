const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
const transpile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText;
function pure(file,requireFn=require){const exports={};vm.runInNewContext(transpile(file),{exports,require:requireFn,Date,Map,Set,Number});return exports;}
const features=pure('apps/api/src/subscriptions/subscription-features.ts'),products=pure('apps/api/src/subscriptions/apple-products.ts');
const SubscriptionStatus=Object.fromEntries(['ACTIVE','TRIALING','EXPIRED','PAST_DUE','SUSPENDED','CANCELLED','CANCELED'].map(k=>[k,k])),TenantStatus=Object.fromEntries(['ACTIVE','TRIAL','EXPIRED','SUSPENDED','PAUSED','DELETED'].map(k=>[k,k]));
const SubscriptionPlan={FREE:'FREE',EXPERT:'EXPERT',STANDARD:'STANDARD',ESSENTIAL:'ESSENTIAL'};
test('Four business plans have the agreed USD prices and increasing capabilities',()=>{
 for(const [code,price] of [['POS_FREE',0],['POS_BASIC',6.99],['POS_PREMIUM',10.99],['POS_PRO',18.99]]){const plan=features.defaultPlans.find(p=>p.code===code);assert.equal(plan.monthlyPrice,price);assert.equal(plan.currency,'USD');}
 for(const key of features.planFeatureMatrix.POS_BASIC)assert.ok(features.planFeatureMatrix.POS_PREMIUM.includes(key));
 for(const key of features.planFeatureMatrix.POS_PREMIUM)assert.ok(features.planFeatureMatrix.POS_PRO.includes(key));
 assert.ok(features.planFeatureMatrix.POS_FREE.includes('THERMAL_PRINTING'));assert.equal(features.planLimitMatrix.POS_FREE.users,1);assert.equal(features.planLimitMatrix.POS_PRO.stores,5);
});
function entitlements(){return pure('apps/api/src/subscriptions/subscription-entitlements.service.ts',key=>{
 if(key==='@nestjs/common')return{Injectable:()=>c=>c,BadRequestException:Error,ForbiddenException:Error};
 if(key==='@prisma/client')return{SubscriptionPlan,SubscriptionStatus,TenantStatus};
 if(key==='./subscription-features')return features;
 if(key==='./subscription-period')return pure('apps/api/src/subscriptions/subscription-period.ts');
 if(key==='./internal-tenant-policy')return{isVtaEnterpriseTenant:()=>false};
 if(key.includes('restaurant-warehouse-policy'))return{};
 throw Error(key);
}).SubscriptionEntitlementsService;}
function subscription(overrides={}){return{id:'subscription',tenantId:'tenant',planId:'trial',plan:'FREE',status:'TRIALING',price:0,currency:'HTG',currentPeriodEnd:new Date(Date.now()-1000),trialEndsAt:new Date(Date.now()-1000),planRecord:{code:'TRIAL',features:[]},payments:[],...overrides};}
test('A finished trial changes atomically to permanent free without deleting business data or charging',async()=>{
 const calls=[],current=subscription();let saved;
 const tx={plan:{findUniqueOrThrow:async()=>({id:'free'})},tenantSubscription:{updateMany:async a=>{calls.push(a);saved=a.data;return{count:1};},findUniqueOrThrow:async()=>subscription({...saved,planRecord:{code:'POS_FREE',features:[]}})},tenant:{updateMany:async a=>calls.push(a)},subscriptionEvent:{create:async a=>calls.push(a)}};
 const Service=entitlements(),service=new Service({$transaction:async callback=>callback(tx)});
 const result=await service.recalculateStatus(current);assert.equal(result.status,'ACTIVE');assert.equal(saved.currentPeriodEnd,null);assert.equal(saved.endsAt,null);assert.equal(saved.price,0);assert.equal(calls[0].where.planId,'trial');assert.equal(calls[2].data.eventType,'TRIAL_COMPLETED_FREE_STARTED');
 assert.equal(service.buildEntitlements(result).isActive,true);assert.equal(service.buildEntitlements(result).currentPeriodEnd,null);
});
test('Active paid plans, suspended subscriptions and unexpired trials are not converted to free',async()=>{
 const Service=entitlements(),service=new Service({$transaction:()=>{throw Error('Unexpected write');}});
 for(const current of [subscription({planRecord:{code:'POS_PREMIUM'},status:'ACTIVE'}),subscription({status:'SUSPENDED'}),subscription({currentPeriodEnd:new Date(Date.now()+100000)})])assert.equal(await service.recalculateStatus(current),current);
});
test('Concurrent paid activation is not overwritten when a trial settles; free ignores old trial dates',async()=>{
 const Service=entitlements(),paid=subscription({planRecord:{code:'POS_PREMIUM',features:[]},status:'ACTIVE'});
 const service=new Service({$transaction:async cb=>cb({plan:{findUniqueOrThrow:async()=>({id:'free'})},tenantSubscription:{updateMany:async()=>({count:0}),findUniqueOrThrow:async()=>paid},tenant:{updateMany:()=>{throw Error('Wrong downgrade');}}})});
 assert.equal(await service.recalculateStatus(subscription()),paid);
 const free=service.buildEntitlements(subscription({planRecord:{code:'POS_FREE',features:[]},status:'ACTIVE'}));assert.equal(free.isActive,true);assert.equal(free.daysRemaining,null);
});
const owner={id:'owner',tenantId:'tenant',role:'OWNER'},token=products.appleAccountToken('tenant');
function apple({transaction={},status=1,existing=null,configured=true,signatureFails=false,trial=false}={}){
 const calls=[],decoded={originalTransactionId:'original',transactionId:'transaction',productId:'com.vtaerp.pos.premium.monthly',appAccountToken:token,type:'Auto-Renewable Subscription',signedDate:Date.now(),purchaseDate:Date.now()-1000,expiresDate:Date.now()+3600000,...transaction};
 const env={APPLE_IAP_ENABLED:String(configured),APPLE_IAP_KEY_PATH:'key',APPLE_IAP_KEY_ID:'id',APPLE_IAP_ISSUER_ID:'issuer',APPLE_IAP_ROOT_CA_PATH:'cert',APPLE_IAP_ENVIRONMENT:'Sandbox'};
 const tx={tenant:{findUniqueOrThrow:async()=>({status:'ACTIVE'}),update:async a=>calls.push({tenant:a})},appleSubscriptionPurchase:{findUnique:async()=>existing,upsert:async a=>calls.push({purchase:a})},plan:{findUniqueOrThrow:async a=>({id:a.where.code,monthlyPrice:10.99,currency:'USD'})},tenantSubscription:{findUniqueOrThrow:async()=>({id:'subscription',paymentStatus:existing?'APPLE':'TRIAL',planId:existing?'POS_PREMIUM':'TRIAL'}),update:async a=>calls.push({subscription:a})},subscriptionEvent:{create:async a=>calls.push({event:a})}};
 const prisma={$transaction:async callback=>callback(tx),appleSubscriptionPurchase:{findUnique:async()=>existing,findFirst:async()=>null}};
 const verifier={verifyAndDecodeTransaction:async()=>{if(signatureFails)throw Error('Bad JWS');return decoded;},verifyAndDecodeRenewalInfo:async()=>({gracePeriodExpiresDate:Date.now()+500000}),verifyAndDecodeNotification:async()=>({data:{signedTransactionInfo:'signed'}})};
 const library={Environment:{PRODUCTION:'Production',SANDBOX:'Sandbox'},Status:{ACTIVE:1,BILLING_GRACE_PERIOD:4},Type:{AUTO_RENEWABLE_SUBSCRIPTION:'Auto-Renewable Subscription'},SignedDataVerifier:class{constructor(){return verifier;}},AppStoreServerAPIClient:class{async getAllSubscriptionStatuses(){calls.push({appleLookup:true});return{data:[{lastTransactions:[{originalTransactionId:'original',status,signedTransactionInfo:'latest',signedRenewalInfo:'renewal'}]}]};}}};
 const exports={};vm.runInNewContext(transpile('apps/api/src/subscriptions/apple-subscriptions.service.ts'),{exports,Date,process:{env},require:key=>{
 if(key==='@nestjs/common')return{Injectable:()=>c=>c,BadRequestException:Error,ForbiddenException:Error,ServiceUnavailableException:Error};
 if(key==='@prisma/client')return{SubscriptionPlan,SubscriptionStatus,TenantStatus,Prisma:{TransactionIsolationLevel:{Serializable:'Serializable'}}};
 if(key==='@apple/app-store-server-library')return library;
 if(key==='fs')return{readFileSync:()=>Buffer.from('fixture')};
 if(key==='./apple-products')return products;
 throw Error(key);
 }});
 const ent={ensureCatalogOnce:async()=>{},invalidate:()=>{},getEntitlements:async()=>({planCode:trial?'TRIAL':'POS_FREE',isActive:true})};
 return{service:new exports.AppleSubscriptionsService(prisma,ent),calls,decoded};
}
test('Apple business tokens are stable UUIDs, distinct across businesses, with three fixed product IDs',()=>{
 assert.match(token,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);assert.equal(token,products.appleAccountToken('tenant'));assert.notEqual(token,products.appleAccountToken('other'));assert.equal(Object.keys(products.appleProducts).length,3);
});
test('Apple purchase catalogue cannot charge during the free month or before server configuration',async()=>{
 assert.equal((await apple({trial:true}).service.catalog(owner)).canPurchase,false);assert.equal((await apple({configured:false}).service.catalog(owner)).configured,false);
 assert.equal((await apple().service.catalog({...owner,role:'CASHIER'})).canPurchase,false);
});
test('Apple verification rejects invalid signatures, another business, unknown products and non-owners without activation',async()=>{
 for(const options of [{signatureFails:true},{transaction:{appAccountToken:products.appleAccountToken('other')}},{transaction:{productId:'evil'}}]){const fixture=apple(options);await assert.rejects(fixture.service.verify(owner,'signed'));assert.ok(!fixture.calls.some(c=>c.subscription));}
 await assert.rejects(apple().service.verify({...owner,role:'CASHIER'},'signed'),/propriétaire/);
});
test('A verified purchase fetches current Apple status before atomically activating the matching business',async()=>{
 const b=apple();await b.service.verify(owner,'signed');assert.ok(b.calls[0].appleLookup);const saved=b.calls.find(c=>c.subscription).subscription;assert.equal(saved.where.tenantId,'tenant');assert.equal(saved.data.planId,'POS_PREMIUM');assert.equal(saved.data.paymentStatus,'APPLE');assert.ok(b.calls.find(c=>c.purchase));
});
test('Refund and expired Apple state return existing Apple subscribers to free; an old receipt cannot resurrect paid access',async()=>{
 for(const status of [2,3,5]){const b=apple({status,existing:{tenantId:'tenant',environment:'Sandbox',signedAt:new Date(0),transactionId:'old'}});await b.service.verify(owner,'old-signed-receipt');assert.equal(b.calls.find(c=>c.subscription).subscription.data.planId,'POS_FREE');assert.equal(b.calls.find(c=>c.subscription).subscription.data.currentPeriodEnd,null);}
});
test('Billing grace period preserves access until the verified grace end',async()=>{
 const b=apple({status:4,transaction:{expiresDate:Date.now()-1000}});await b.service.verify(owner,'signed');assert.equal(b.calls.find(c=>c.subscription).subscription.data.planId,'POS_PREMIUM');
});
test('Out-of-order Apple state and cross-business ownership never overwrite a subscription',async()=>{
 const b=apple({existing:{tenantId:'tenant',environment:'Sandbox',signedAt:new Date(Date.now()+500000)}});await b.service.verify(owner,'signed');assert.ok(!b.calls.some(c=>c.subscription));
 await assert.rejects(apple({existing:{tenantId:'other',environment:'Sandbox'}}).service.verify(owner,'signed'),/autre entreprise/);
});
test('Unknown signed notifications acknowledge without claiming an account; configured-off refuses verification',async()=>{
 const b=apple();await b.service.notification('signed');assert.equal(b.calls.length,0);await assert.rejects(apple({configured:false}).service.verify(owner,'signed'),/pas encore disponibles/);
});
test('Client finishes an Apple transaction only after the API confirms it and retains failed purchases for retry',async()=>{
 const requests=[],finishes=[],exports={},plugin={finish:async value=>finishes.push(value)};let ok=false;
 vm.runInNewContext(transpile('apps/web/lib/apple-subscriptions.ts'),{exports,require:key=>key==='@capacitor/core'?{registerPlugin:()=>plugin}:key==='./api-url'?{apiBaseUrl:'https://fixture.invalid'}:{fetchWithAuth:async(url,init)=>{requests.push({url,init});return{ok,json:async()=>({message:'Offline'})};}}});
 const tx={appAccountToken:token,transactionId:'tx',signedTransaction:'signed'};await assert.rejects(exports.confirmAppleTransaction(tx,token));assert.equal(finishes.length,0);
 ok=true;await exports.confirmAppleTransaction(tx,token);assert.equal(finishes[0].transactionId,'tx');assert.ok(requests[0].url.endsWith('/subscription/apple/verify'));
 await assert.rejects(exports.confirmAppleTransaction({...tx,appAccountToken:'other'},token));assert.equal(finishes.length,1);
});
function loginStatus(prisma,subscriptions){
 const file='apps/api/src/auth/auth.service.ts',source=fs.readFileSync(file,'utf8'),parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),klass=parsed.statements.find(ts.isClassDeclaration),method=klass.members.find(m=>m.name?.getText(parsed)==='assertTenantStatus');
 const exports={};vm.runInNewContext(ts.transpileModule('export class LoginFixture { constructor(private prisma:any,private subscriptions:any){} '+method.getText(parsed)+'}',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,Date,TenantStatus,ForbiddenException:class extends Error { constructor(value){super(typeof value === "string" ? value : value.message);} },UnauthorizedException:Error,isVtaEnterpriseTenant:()=>false});
 return new exports.LoginFixture(prisma,subscriptions);
}
test('Login settles a completed trial before allowing the resulting permanent free business',async()=>{
 let settled=false;const service=loginStatus({tenant:{findUnique:async()=>settled?{status:'ACTIVE',subscription:{status:'ACTIVE',planRecord:{code:'POS_FREE'},trialEndsAt:new Date(0)}}:{status:'TRIAL',subscription:{status:'TRIALING'}}}},{getSubscription:async()=>{settled=true;}});
 await service.assertTenantStatus('tenant');assert.equal(settled,true);
});
test('Login never performs billing queries for normal active accounts or reactivates a suspended business',async()=>{
 const subscriptions={getSubscription:()=>{throw Error('Unexpected billing write');}};
 await loginStatus({tenant:{findUnique:async()=>({status:'ACTIVE',subscription:{status:'ACTIVE',planRecord:{code:'POS_FREE'},trialEndsAt:new Date(0)}})}},subscriptions).assertTenantStatus('tenant');
 await assert.rejects(loginStatus({tenant:{findUnique:async()=>({status:'SUSPENDED'})}},subscriptions).assertTenantStatus('tenant'),/suspendu/);
});
test('An expired paid tenant is not silently reactivated by the trial recovery path',async()=>{
 await assert.rejects(loginStatus({tenant:{findUnique:async()=>({status:'EXPIRED',subscription:{status:'EXPIRED',planRecord:{code:'EXPERT'}}})}},{getSubscription:async()=>{}}).assertTenantStatus('tenant'),/expiré/);
});

test('The official Apple verifier rejects fabricated signed transactions',async()=>{
 const {SignedDataVerifier,Environment}=require('@apple/app-store-server-library');
 const verifier=new SignedDataVerifier([],false,Environment.PRODUCTION,'com.vtaerp.pos',6826297355);
 await assert.rejects(verifier.verifyAndDecodeTransaction('fabricated.payload.signature'));
});
