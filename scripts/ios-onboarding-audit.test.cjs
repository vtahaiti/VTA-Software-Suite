const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const options={module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true};
function transpile(file){return ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:options}).outputText;}
function storage(){const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),data};}
function progress(){const localStorage=storage(),exports={};vm.runInNewContext(transpile('apps/web/lib/onboarding-progress.ts'),{exports,localStorage,Date});return{...exports,storage:localStorage};}
test('Pending registration resumes on the same device and expired preparations cannot be reused',()=>{
 const p=progress();const serverExpiry=new Date(Date.now()+300000).toISOString();p.rememberPendingRegistration('qa-server','test@example.invalid','',serverExpiry);assert.equal(JSON.parse(p.storage.getItem('vta_pending_onboarding_details')).expiresAt,Date.parse(serverExpiry));p.rememberPendingRegistration('qa-token','test@example.invalid','0000');assert.equal(p.pendingRegistration().pendingToken,'qa-token');
 p.storage.setItem('vta_pending_onboarding_details',JSON.stringify({pendingToken:'qa-token',expiresAt:Date.now()-1}));assert.equal(p.pendingRegistration(),null);
});
test('Business drafts survive reloads, remain tied to the prepared account and never persist passwords or photo data',()=>{
 const p=progress();p.rememberCompanyDraft('qa-one',{companyName:'Boutique',city:'Jacmel',password:'NEVER STORE',confirmPassword:'NEVER STORE',logoUrl:'data:image/png;base64,AAA',secondaryActivities:['Livraison']});
 assert.equal(p.readCompanyDraft('qa-one').city,'Jacmel');assert.deepEqual(Object.keys(p.readCompanyDraft('qa-other')),[]);
 const raw=p.storage.getItem('vta_onboarding_company_draft');assert.doesNotMatch(raw,/password|NEVER STORE|data:image/);
 p.clearOnboardingProgress();assert.equal(p.storage.getItem('vta_onboarding_company_draft'),null);
});
test('Late catalogue loading preserves the chosen business activity and uses canonical catalogue labels',()=>{
 const p=progress();const selected=p.reconcileBusinessSelection([{key:'commerce',specialties:[{name:'Epicerie / Market',profileType:'commerce'},{name:'Boutique',profileType:'commerce'}]},{key:'restaurant-food',specialties:[{name:'Restaurant',profileType:'restaurant'},{name:'Bar',profileType:'restaurant'}]}],{businessSector:'restaurant-food',businessSpecialty:'Bar'});
 assert.equal(selected.businessSpecialty,'Bar');assert.equal(selected.businessProfileSlug,'restaurant');
 assert.equal(p.reconcileBusinessSelection([{key:'commerce',specialties:[{name:'Epicerie / Market',profileType:'commerce'}]}],{businessSector:'commerce',businessSpecialty:'Épicerie / Market'}).businessSpecialty,'Epicerie / Market');
});
function backend({expired=false,duplicate=false,mailFailure=false,transactionFailure=false,pendingByEmail=false,wrongPassword=false}={}){
 const calls=[],pureCache={};
 function pure(file){if(pureCache[file])return pureCache[file];const exports={};vm.runInNewContext(transpile(file),{exports,require});return pureCache[file]=exports;}
 const catalog=pure('apps/api/src/business-profiles/business-catalog.ts');
 const pending={id:'pending',token:'qa-pending-token',email:'test@example.invalid',firstName:'Test',lastName:'Audit',passwordHash:'qa-hash',expiresAt:new Date(Date.now()+(expired?-1000:86400000))};
 const tx=new Proxy({}, {get:(_,model)=>new Proxy({}, {get:(_,method)=>async args=>{calls.push({model,method,args});return{id:`qa-${model}`, ...args?.data, ...args?.create};}})});
 const prisma={user:{findMany:async()=>duplicate?[{id:'exists',tenant:{status:'ACTIVE'}}]:[]},pendingRegistration:{findUnique:async args=>args.where.token||pendingByEmail?pending:null,upsert:async args=>{calls.push({model:'pendingRegistration',method:'upsert',args});return pendingByEmail?pending:{...pending,...args.create};},updateMany:async args=>{calls.push({model:'pendingRegistration',method:'updateMany',args});return{count:1};}},tenant:{findUnique:async()=>null},$transaction:async callback=>{calls.push({transaction:true});if(transactionFailure)throw Error('Database unavailable');return callback(tx);}};
 const auth={issueSessionForUser:async id=>{calls.push({session:id});return{accessToken:'qa-access',refreshToken:'qa-refresh',user:{id,tenantId:'qa-tenant'}};}};
 const email={sendCompanyWelcomeEmail:async()=>{calls.push({welcome:true});if(mailFailure)throw Error('Mail unavailable');}};
 const subscriptions={ensureCatalogOnce:async()=>{},createTrialSubscription:async(_,tenant,user)=>{calls.push({trial:{tenant,user}});}};
 const exports={};vm.runInNewContext(transpile('apps/api/src/onboarding/onboarding.service.ts'),{exports,Date,Map,require:key=>{
 if(key==='@nestjs/common')return{Injectable:()=>target=>target,BadRequestException:Error,UnauthorizedException:Error};
 if(key==='@prisma/client')return{Prisma:{PrismaClientKnownRequestError:class extends Error{}},TenantStatus:{DELETED:'DELETED'}};
 if(key==='crypto')return{randomUUID:()=> 'qa-pending-token'};
 if(key.endsWith('/business-catalog'))return catalog;
 if(key.endsWith('/default-permissions'))return pure('apps/api/src/rbac/default-permissions.ts');
 if(key.endsWith('/password-hashing'))return{hashPassword:async()=> 'qa-hashed-password',comparePassword:async()=>!wrongPassword};
 if(key.endsWith('/password-policy'))return pure('apps/api/src/auth/password-policy.ts');
 if(key==='./restaurant-starter-catalog')return{createRestaurantStarterCatalog:async()=>{calls.push({restaurant:true});return{warehouse:{id:'qa-restaurant-warehouse'}};}};
 throw Error('Unexpected runtime dependency: '+key);
 }});
 return{service:new exports.OnboardingService(prisma,auth,email,{saveDataUrl:async()=>null},subscriptions,{isBlocked:async()=>false,recordLoginFailure:async()=>{}}),calls,catalog};
}
const account={firstName:' Test ',lastName:' Audit ',email:'TEST@example.invalid ',phone:'0000',password:'AuditOnly123!',confirmPassword:'AuditOnly123!',acceptedTerms:true};
test('Actual registration service normalizes the email, hashes the password and prepares a 24-hour account without creating a tenant yet',async()=>{
 const b=backend();const result=await b.service.register(account);assert.equal(result.email,'test@example.invalid');assert.equal(result.pendingToken,'qa-pending-token');
 const saved=b.calls.find(c=>c.model==='pendingRegistration').args.create;assert.equal(saved.passwordHash,'qa-hashed-password');assert.equal(saved.firstName,'Test');assert.ok(saved.expiresAt>Date.now()+23*3600000);assert.ok(!b.calls.some(c=>c.transaction));
});
test('Actual registration service rejects duplicate emails and missing acceptance before saving',async()=>{
 await assert.rejects(backend({duplicate:true}).service.register(account),/existe déjà/);
 const b=backend();await assert.rejects(b.service.register({...account,acceptedTerms:false}),/accepter/);assert.equal(b.calls.length,0);
});
test('Registration recovers the same pending token only with the original password, without overwriting or extending it',async()=>{
 const b=backend({pendingByEmail:true}); const result=await b.service.register(account);
 assert.equal(result.pendingToken,'qa-pending-token'); assert.equal(b.calls.length,0);
 await assert.rejects(backend({pendingByEmail:true,wrongPassword:true}).service.register(account),/mot de passe choisi/);
});
test('Expired pending accounts are replaced conditionally and simultaneous registration cannot overwrite a live password',async()=>{
 const expired=backend({pendingByEmail:true,expired:true}); await expired.service.register(account);
 const update=expired.calls.find(c=>c.method==='updateMany');assert.equal(update.args.where.token,'qa-pending-token');assert.ok(update.args.where.expiresAt.lte);assert.equal(update.args.data.acceptedTerms,true);
 const race=backend({wrongPassword:true});await assert.rejects(race.service.register(account),/mot de passe choisi/);assert.deepEqual(Object.keys(race.calls[0].args.update),[]);
});
test('Actual company service creates the shop, warehouse, cash register, owner access, trial and completed onboarding in one transaction',async()=>{
 const b=backend({mailFailure:true});const result=await b.service.createCompany({pendingToken:'qa-pending-token',companyName:'Boutique test',businessCategory:'commerce',primaryActivity:'Boutique',businessProfileSlug:'commerce',city:'Jacmel',country:'Haiti',currency:'HTG'});
 assert.equal(result.user.tenantId,'qa-tenant');assert.equal(b.calls.filter(c=>c.transaction).length,1);
 for(const model of ['tenant','user','companyProfile','tenantSettings','userProfile','store','warehouse','cashRegister','role','userRole','rolePermission','tenantBusinessProfile','onboardingState'])assert.ok(b.calls.some(c=>c.model===model),model);
 assert.equal(b.calls.find(c=>c.model==='role').args.data.name,'OWNER');assert.ok(b.calls.some(c=>c.trial));
 assert.equal(b.calls.find(c=>c.model==='onboardingState').args.data.completed,true);assert.ok(b.calls.some(c=>c.model==='pendingRegistration'&&c.method==='delete'));
 assert.ok(b.calls.some(c=>c.session));assert.ok(b.calls.some(c=>c.welcome));
});
test('Expired preparations and database failures cannot issue a completed account session',async()=>{
 const expired=backend({expired:true});await assert.rejects(expired.service.createCompany({pendingToken:'expired'}),/expirée/);assert.equal(expired.calls.length,0);
 const failing=backend({transactionFailure:true});await assert.rejects(failing.service.createCompany({pendingToken:'qa',companyName:'Test',businessCategory:'commerce',primaryActivity:'Boutique'}),/Database unavailable/);assert.ok(!failing.calls.some(c=>c.session||c.welcome));
});
test('Restaurant onboarding chooses the existing restaurant starter rather than the generic warehouse branch',async()=>{
 const b=backend();await b.service.createCompany({pendingToken:'qa',companyName:'Restaurant test',businessCategory:'restaurant-food',primaryActivity:'Restaurant',businessProfileSlug:'restaurant'});assert.ok(b.calls.some(c=>c.restaurant));assert.ok(!b.calls.some(c=>c.model==='warehouse'));
});
test('Actual trial creation starts a free calendar month and records the trial event',async()=>{
 const file='apps/api/src/subscriptions/subscription-entitlements.service.ts';const source=fs.readFileSync(file,'utf8');const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);const declaration=parsed.statements.find(ts.isClassDeclaration);const method=declaration.members.find(member=>member.name?.getText(parsed)==='createTrialSubscription');
 const periods={};vm.runInNewContext(transpile('apps/api/src/subscriptions/subscription-period.ts'),{exports:periods,Date});
 const exports={},saved=[];vm.runInNewContext(ts.transpileModule('export class TrialFixture {'+method.getText(parsed)+'}',{compilerOptions:options}).outputText,{exports,Date,SubscriptionPlan:{FREE:'FREE'},SubscriptionStatus:{TRIALING:'TRIALING'},nextMonthlyPeriodEnd:periods.nextMonthlyPeriodEnd});
 const tx={plan:{findUnique:async()=>({id:'trial-plan'})},tenantSubscription:{create:async({data})=>{saved.push(data);return{id:'qa-subscription',...data};}},subscriptionEvent:{create:async({data})=>saved.push(data)}};
 const result=await new exports.TrialFixture().createTrialSubscription(tx,'tenant','owner');assert.equal(result.price,0);assert.equal(result.status,'TRIALING');assert.equal(result.trialEndsAt.toISOString(),periods.nextMonthlyPeriodEnd(result.trialStartedAt).toISOString());assert.equal(saved[1].metadata.trialMonths,1);
});
function clientAuth(responses){const exports={},requests=[],localStorage=storage();vm.runInNewContext(transpile('apps/web/lib/auth.ts'),{exports,Date,CustomEvent:class{},window:{localStorage,dispatchEvent(){}},require:()=>({fetchApi:async(path,init)=>{requests.push({path,...init});const next=responses.shift();return{ok:next.ok!==false,json:async()=>next.body};},publicApiErrorMessage:value=>String(value),apiUnavailableMessage:'Indisponible'})});return{...exports,requests,localStorage};}
test('Client normalizes account contacts without trimming passwords and rejects missing pending tokens',async()=>{
 const c=clientAuth([{body:{pendingToken:'qa',email:'test@example.invalid'}}]);await c.registerUser(account);const payload=JSON.parse(c.requests[0].body);assert.equal(payload.email,'test@example.invalid');assert.equal(payload.firstName,'Test');assert.equal(payload.password,account.password);
 await assert.rejects(clientAuth([{body:{}}]).registerUser(account),/Session d’inscription/);
});
test('Malformed company success cannot store a session; a valid completed account can',async()=>{
 const invalid=clientAuth([{body:{user:{id:'one'}}}]);await assert.rejects(invalid.createCompany({pendingToken:'qa'}),/confirmée/);assert.equal(invalid.localStorage.getItem('vta_access_token'),null);
 const valid=clientAuth([{body:{accessToken:'qa-access',refreshToken:'qa-refresh',user:{id:'qa-user',tenantId:'qa-tenant'}}}]);await valid.createCompany({pendingToken:'qa'});assert.equal(valid.localStorage.getItem('vta_access_token'),'qa-access');
});
function companyFunctions(context){const file='apps/web/app/onboarding/company/page.tsx';const source=fs.readFileSync(file,'utf8'),parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);const functions=[];function walk(node){if(ts.isFunctionDeclaration(node)&&['submit','updateCountry','updateDepartment','withDepartmentInAddress'].includes(node.name?.text))functions.push(node.getText(parsed));ts.forEachChild(node,walk);}walk(parsed);const exports={};vm.runInNewContext(ts.transpileModule(functions.join('\n')+'\nexport {submit,updateCountry,updateDepartment};',{compilerOptions:options}).outputText,{exports,...context});return exports;}
test('Company submit cannot create twice and clears recovery data only after confirmed success',async()=>{
 let complete;const wait=new Promise(resolve=>complete=resolve),calls=[],navigations=[],cleared=[];
 const fields={companyName:' Boutique ',businessSector:'commerce',businessSpecialty:'Boutique',businessProfileSlug:'commerce',secondaryActivities:[],country:'Haiti',department:'Nord',city:'Cap-Haitien',address:'Rue de test',phone:'0000',email:'TEST@example.invalid',logoUrl:''};
 const f=companyFunctions({submitting:{current:false},isLoading:false,isUploadingLogo:false,pendingToken:'qa-pending',form:fields,selectedSector:{name:'Commerce'},setError(){},setIsLoading(){},createCompany:async payload=>{calls.push(payload);await wait;},clearOnboardingProgress:()=>cleared.push(true),router:{replace:route=>navigations.push(route)},process:{env:{NEXT_PUBLIC_IOS_EMBEDDED:'1'}},publicApiErrorMessage:error=>error.message});
 const first=f.submit({preventDefault(){}});await f.submit({preventDefault(){}});assert.equal(calls.length,1);assert.equal(cleared.length,0);complete();await first;assert.equal(cleared.length,1);assert.deepEqual(navigations,['/dashboard/pos']);assert.equal(calls[0].companyName,'Boutique');assert.equal(calls[0].email,'test@example.invalid');assert.match(calls[0].address,/Département: Nord/);
});
test('Country changes coordinate city, currency and local time rather than keeping Haitian defaults abroad',()=>{
 let current={country:'Haiti',currency:'HTG',timezone:'America/Port-au-Prince',city:'Cap-Haitien'};
 const f=companyFunctions({citiesByCountry:{Canada:['Montreal']},citiesForHaitiDepartment:()=>['Cap-Haitien'],setForm:update=>{current=update(current);}});
 f.updateCountry('Canada');assert.equal(current.currency,'CAD');assert.equal(current.timezone,'America/Toronto');assert.equal(current.city,'Montreal');f.updateCountry('Haiti');assert.equal(current.currency,'HTG');assert.equal(current.department,'Nord');
});
