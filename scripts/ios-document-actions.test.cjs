const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
test('iOS generated downloads retain the Blob through immediate revoke, and print uses the native A4 sheet',async()=>{
 const exports={},calls=[];let click;class Element{closest(){return this.anchor}}
 let count=0;const oldCreate=()=>`blob:test-${++count}`,oldRevoke=()=>{},oldPrint=()=>{};
 const URL={createObjectURL:oldCreate,revokeObjectURL:oldRevoke};
 const document={title:'Rapport de test',addEventListener:(_,fn)=>click=fn,removeEventListener:()=>{},querySelector:()=>({cloneNode:()=>({querySelectorAll:()=>[],innerHTML:'<h1>Rapport</h1><table><tr><td>1250 HTG</td></tr></table>'})})};
 const window={print:oldPrint,alert:message=>{throw Error(message)}};
 const code=ts.transpileModule(fs.readFileSync('apps/web/lib/ios-document-actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{exports,Element,Blob,URL,document,window,require:()=>({shareFileNative:async(blob,name)=>calls.push({blob,name}),printHtmlNative:async options=>calls.push(options)})});
 const cleanup=exports.installIosDocumentActions();const blob=new Blob(['é,1250'],{type:'text/csv'});const href=URL.createObjectURL(blob);const target=new Element();target.anchor={href,download:'test.csv'};let prevented=false;click({target,preventDefault:()=>prevented=true});URL.revokeObjectURL(href);window.print();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(prevented,true);assert.equal(calls[0].blob,blob);assert.equal(calls[0].name,'test.csv');assert.equal(calls[1].format,'A4');assert.match(calls[1].html,/1250 HTG/);cleanup();assert.equal(URL.createObjectURL,oldCreate);assert.equal(window.print,oldPrint);
});
