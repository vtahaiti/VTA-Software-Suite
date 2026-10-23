const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript'), React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const compilerOptions={jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020};
const selection={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/web/lib/business-selection.ts','utf8'),{compilerOptions}).outputText,{exports:selection});
const configuration={businessCategory:'commerce',primaryActivity:'Boutique',secondaryActivities:[],modules:[{key:'sales'}],profiles:[],menuSections:[],allowedModuleKeys:['sales']};
const categories=[{key:'commerce',name:'Commerce',activities:[{name:'Boutique'},{name:'Épicerie'}]}];
function page({activity='Boutique',loading=false,error='',save=async()=>configuration}={}){
 const values=[false,null,error,loading,categories,[{key:'sales',name:'Ventes',category:'commerce'}],configuration,'commerce',activity,[],''];
 let index=0;const writes=[],events=[],exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/web/app/dashboard/settings/business-modules/page.tsx','utf8'),{compilerOptions}).outputText,{
 exports,process:{env:{NEXT_PUBLIC_IOS_EMBEDDED:'1'}},window:{confirm:()=>true,dispatchEvent:event=>events.push(event.type)},CustomEvent:class {constructor(type){this.type=type;}},
 require:key=>key==='react'?{useState:()=>{const slot=index++;return[values[slot],value=>writes.push([slot,value])]},useEffect(){},useMemo:fn=>fn()}:key==='next/link'?{default:({children,...props})=>React.createElement('a',props,children)}:key==='@/components/ios-page-heading'?{IosPageHeading:({title})=>React.createElement('h1',null,title)}:key==='@/lib/business-selection'?selection:key==='@/lib/business-profiles'?{updateBusinessSelection:save}:require(key)
 });
 const tree=exports.default();return{tree,html:renderToStaticMarkup(tree),writes,events};
}
function nodes(node){if(!node||typeof node!=='object')return[];return[node,...React.Children.toArray(node.props?.children).flatMap(nodes)];}
test('Selection detects real activity changes without treating reordered secondary activities as edits',()=>{
 assert.equal(selection.hasBusinessSelectionChanges({...configuration,secondaryActivities:['A','B']},'commerce','Boutique',['B','A']),false);
 assert.equal(selection.hasBusinessSelectionChanges(configuration,'commerce','Épicerie',[]),true);
 assert.equal(selection.hasBusinessSelectionChanges(configuration,'commerce','Boutique',['Livraison']),true);
});
test('An unsaved activity keeps saved modules visible but prevents editing them until the type is saved',()=>{
 const result=page({activity:'Épicerie'});assert.match(result.html,/Modification non enregistrée/);assert.match(result.html,/Activité enregistrée/);
 const controls=nodes(result.tree);assert.equal(controls.find(n=>n.type==='input'&&n.props.type==='checkbox').props.disabled,true);
 assert.equal(controls.find(n=>n.type==='button'&&n.props.className==='vm-primary-button').props.disabled,false);
 const saved=page();assert.equal(nodes(saved.tree).find(n=>n.type==='button'&&n.props.className==='vm-primary-button').props.disabled,true);
});
test('Unavailable business configuration shows retry instead of a default Commerce selector',()=>{
 const {html}=page({error:'Impossible de charger votre activité.'});assert.match(html,/Réessayer/);assert.doesNotMatch(html,/<select|Modules de l’activité enregistrée/);
});
test('Saving uses the existing selection endpoint payload and applies the returned canonical configuration before refreshing menus',async()=>{
 const calls=[];const canonical={...configuration,primaryActivity:'Épicerie',modules:[{key:'inventory'}]};
 const result=page({activity:'Épicerie',save:async payload=>{calls.push(payload);return canonical;}});
 nodes(result.tree).find(n=>n.type==='button'&&n.props.className==='vm-primary-button').props.onClick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(JSON.stringify(calls[0]),JSON.stringify({businessCategory:'commerce',primaryActivity:'Épicerie',secondaryActivities:[]}));
 assert.ok(result.writes.some(([slot,value])=>slot===6&&value===canonical));
 assert.ok(result.writes.some(([slot,value])=>slot===8&&value==='Épicerie'));
 assert.deepEqual(result.events,['vta:business-profile-updated']);
});
