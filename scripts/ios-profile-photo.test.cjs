const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const dataUrl='data:image/jpeg;base64,/9j/AAAA';
function photoModule({responses=[],online=true,owner=()=>({id:'user',tenantId:'tenant'})}={}){
 const requests=[],draws=[],revoked=[],exports={};
 const canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage:(...args)=>draws.push(args)}),toDataURL:()=>dataUrl};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/web/lib/profile-photo.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{
 exports,navigator:{onLine:online},Image:class {naturalWidth=1200;naturalHeight=1600;async decode(){}},document:{createElement:()=>canvas},URL:{createObjectURL:()=> 'blob:qa',revokeObjectURL:url=>revoked.push(url)},
 require:key=>key==='./auth'?{getCurrentUser:owner}:{fetchWithAuth:async(path,init)=>{requests.push({path,...init});const next=responses.shift();if(!next)throw Error('Unexpected request');return next;}}
 });
 return{...exports,requests,draws,revoked,canvas};
}
function response(body,ok=true){return {ok,json:async()=>body};}
test('Portrait photos are centre-cropped, compressed and temporary image URLs are released',async()=>{
 const photo=photoModule();assert.equal(await photo.prepareProfilePhoto({size:1000,type:'image/jpeg',name:'portrait.jpg'}),dataUrl);
 assert.equal(photo.canvas.width,512);assert.equal(photo.canvas.height,512);
 assert.deepEqual(Array.from(photo.draws[0].slice(1)),[0,200,1200,1200,0,0,512,512]);assert.deepEqual(photo.revoked,['blob:qa']);
});
test('Invalid or excessive files are rejected before preparing or uploading a photo',async()=>{
 const photo=photoModule();await assert.rejects(photo.prepareProfilePhoto({size:100,type:'text/plain',name:'notes.txt'}),/Choisissez une photo/);
 await assert.rejects(photo.prepareProfilePhoto({size:21*1024*1024,type:'image/png',name:'large.png'}),/20 Mo/);
 assert.throws(()=>photo.validatePhotoData('data:image/jpeg;base64,'+'A'.repeat(3*1024*1024)),/volumineuse/);assert.equal(photo.requests.length,0);
});
test('Photo is saved to the account only after the upload endpoint confirms a persistent URL',async()=>{
 const photo=photoModule({responses:[response({url:'/uploads/users/new.jpg'}),response({profile:{photoUrl:'/uploads/users/new.jpg'}})]});
 assert.equal(await photo.saveProfilePhoto(dataUrl),'/uploads/users/new.jpg');
 assert.deepEqual(photo.requests.map(r=>r.path),['/uploads/user-photo','/profile/photo']);
 assert.deepEqual(JSON.parse(photo.requests[0].body),{dataUrl});assert.deepEqual(JSON.parse(photo.requests[1].body),{photoUrl:'/uploads/users/new.jpg'});
 assert.ok(photo.requests.every(r=>r.method==='POST'&&r.headers['Content-Type']==='application/json'));
});
test('Failed upload cannot overwrite the previous profile photo',async()=>{
 const photo=photoModule({responses:[response({message:'Envoi refusé'},false)]});await assert.rejects(photo.saveProfilePhoto(dataUrl),/Envoi refusé/);assert.equal(photo.requests.length,1);
});
test('Failed profile association is reported rather than treating an uploaded file as a saved avatar',async()=>{
 const photo=photoModule({responses:[response({url:'/uploads/users/new.jpg'}),response({message:'Profil non enregistré'},false)]});await assert.rejects(photo.saveProfilePhoto(dataUrl),/Profil non enregistré/);
});
test('Offline photo saving makes no network request',async()=>{
 const photo=photoModule({online:false});await assert.rejects(photo.saveProfilePhoto(dataUrl),/Internet/);assert.equal(photo.requests.length,0);
});
test('Switching accounts during upload stops association with the new session',async()=>{
 let checks=0;const photo=photoModule({owner:()=>({id:checks++?'other-user':'user',tenantId:'tenant'}),responses:[response({url:'/uploads/users/new.jpg'})]});
 await assert.rejects(photo.saveProfilePhoto(dataUrl),/session a changé/);assert.equal(photo.requests.length,1);
});

test('Prepared photo data stays within the existing small JSON upload budget',()=>{
 const photo=photoModule();assert.throws(()=>photo.validatePhotoData('data:image/jpeg;base64,'+'A'.repeat(95*1024)),/volumineuse/);
});
