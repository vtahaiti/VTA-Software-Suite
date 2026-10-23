const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function screen(file,states){let index=0;const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText,{exports,process:{env:{NEXT_PUBLIC_IOS_EMBEDDED:'1'}},require:key=>key==='react'?{useState:initial=>[index<states.length?states[index++]:initial,()=>{}],useEffect(){},useMemo:fn=>fn()}:key==='@/lib/auth'?{getAccessToken:()=>'',getCurrentUser:()=>({role:'OWNER'})}:key==='@/lib/api-url'?{apiBaseUrl:'https://example.invalid'}:key==='@/components/ios-page-heading'?{IosPageHeading:({title})=>React.createElement('h1',null,title)}:key==='@/components/ios-sheet'?{IosSheet:({children})=>React.createElement('section',null,children)}:require(key)});return exports.default;}
test('Populated permission catalogue renders once outside filtering and retains role grants',()=>{
 const permission={id:'read',name:'Consulter les ventes',key:'sales.read',category:'Ventes'};
 const Screen=screen('apps/web/app/dashboard/settings/permissions/page.tsx',[[permission],[{id:'cashier',name:'CASHIER',permissions:[{permission}]}],'','','']);
 const html=renderToStaticMarkup(React.createElement(Screen));
 assert.match(html,/Consulter les ventes/);assert.match(html,/Autorisé/);assert.match(html,/Caissier/);assert.doesNotMatch(html,/<table/);
});
test('Permission search filters populated categories rather than hiding the entire screen',()=>{
 const Screen=screen('apps/web/app/dashboard/settings/permissions/page.tsx',[[{id:'one',name:'Stock',key:'stock.read',category:'Stock'}],[],'no-match','','']);
 const html=renderToStaticMarkup(React.createElement(Screen));assert.match(html,/Aucune permission à afficher/);assert.doesNotMatch(html,/<summary/);
});
test('Roles start with a list and keep the permission editor closed',()=>{
 const Screen=screen('apps/web/app/dashboard/settings/roles/page.tsx',[[{id:'cashier',name:'Caissier',permissions:[]}],[],'','',[],null,null,false,false,false,'']);
 const html=renderToStaticMarkup(React.createElement(Screen));assert.match(html,/Caissier/);assert.match(html,/Créer un rôle/);assert.doesNotMatch(html,/<form|Attribuer les permissions/);
});
