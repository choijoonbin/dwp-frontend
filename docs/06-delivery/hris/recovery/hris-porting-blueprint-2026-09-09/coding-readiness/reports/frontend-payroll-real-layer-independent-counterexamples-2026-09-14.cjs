const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const child=require('node:child_process');
const {createRequire}=require('node:module');
const assert=require('node:assert/strict');
const repo='/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend';
const req=createRequire(path.join(repo,'package.json'));
const ts=req('typescript');
const React=req('react');
const {createRoot}=req('react-dom/client');
const {JSDOM}=req('jsdom');
const prefix='apps/dwp/src/features/hris/payroll/';
const files=['index.ts','api/payroll-api.ts','api/payroll-api.test.ts','hooks/use-hris-payroll-workspace.ts','model/payroll-self-service-model.ts','model/payroll-self-service-model.test.ts','pages/hris-payroll-workspace.tsx','testing/hris-payroll-workspace.runtime.test.tsx'].map(x=>path.join(repo,prefix,x));
function pins(){return files.map(p=>({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),mtimeNs:fs.statSync(p,{bigint:true}).mtimeNs.toString()}));}
files.push(...['libs/shared-utils/src/axios-instance.ts','libs/shared-utils/src/http-error.ts','libs/shared-utils/src/api/product-surface-read-scope.ts'].map(x=>path.join(repo,x)));
const pre=pins(),startedAt=new Date().toISOString();
const diagnostics=[];
function compile(text,name,requireFn=req){
 const output=ts.transpileModule(text,{fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},reportDiagnostics:true});
 const fatal=(output.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
 assert.equal(fatal.length,0); const module={exports:{}};
 new Function('require','module','exports',output.outputText)(requireFn,module,module.exports);
 return module.exports;
}
const currentSource=fs.readFileSync(path.join(repo,prefix,'model/payroll-self-service-model.ts'),'utf8');
const oldSource=child.execFileSync('git',['show','HEAD:'+prefix+'payroll-self-service-model.ts'],{cwd:repo,encoding:'utf8'});
const model=compile(currentSource,'model.ts'),oldModel=compile(oldSource,'old-model.ts');
function source(){return {nextCycle:{payCycleId:'cycle-1',name:'September payroll',periodStart:'2026-09-01',periodEnd:'2026-09-30',payDate:'2026-09-25',status:'OPEN',timeValidated:true,absenceValidated:false,sourceConfirmed:true,dataOrigin:'SOURCE'},statements:[{statementId:'statement-a',periodLabel:'August 2026',availabilityState:'AVAILABLE',publishedAt:'2026-08-25T00:00:00Z',downloadable:true},{statementId:'statement-b',periodLabel:'July 2026',availabilityState:'AVAILABLE',publishedAt:'2026-07-25T00:00:00Z',downloadable:true}],monetaryDataRedacted:true};}
const good=source();good.employee={bankAccount:'SYNTHETIC_EMPLOYEE_SECRET'};good.nextCycle.grossAmount=12345;good.statements[0].bankAccount='SYNTHETIC_STATEMENT_SECRET';
const projected=model.buildPayrollSelfServiceModel(good);
assert(!('employee' in projected));assert(!('grossAmount' in projected.nextCycle));assert(!('bankAccount' in projected.statements[0]));assert.notEqual(projected.nextCycle,good.nextCycle);
diagnostics.push({id:'CONTROL_ALLOWLIST_TOP_LEVEL_PRIMITIVE_VALID_SOURCE',actual:'employee and sensitive extras absent; nextCycle copied',result:'PRESERVED_IMPROVEMENT'});
const badBool=source();badBool.statements[0].downloadable='false';badBool.monetaryDataRedacted='false';
const boolResult=model.buildPayrollSelfServiceModel(badBool);
assert.equal(boolResult.statements[0].access,'DOWNLOADABLE');assert.equal(boolResult.statements[0].sourceDownloadable,'false');
assert.equal(oldModel.buildPayrollSelfServiceModel(badBool).statements[0].access,'DOWNLOADABLE');
diagnostics.push({id:'CE_BOOL_STRING_ACCEPTED_AS_DOWNLOADABLE',inputType:'MALFORMED_SYNTHETIC_WIRE_BOOLEAN',actual:{access:boolResult.statements[0].access,sourceDownloadable:boolResult.statements[0].sourceDownloadable,sourceDownloadableType:typeof boolResult.statements[0].sourceDownloadable,monetaryDataRedactedType:typeof boolResult.monetaryDataRedacted},preexistingAtHead:true});
const nested=source();nested.nextCycle.name={bankAccount:'SYNTHETIC_NESTED_SECRET'};
const nestedResult=model.buildPayrollSelfServiceModel(nested);
assert.equal(nestedResult.nextCycle.name,nested.nextCycle.name);
nested.nextCycle.name.bankAccount='SYNTHETIC_CHANGED_SECRET';assert.equal(nestedResult.nextCycle.name.bankAccount,'SYNTHETIC_CHANGED_SECRET');
diagnostics.push({id:'CE_DECLARED_STRING_LEAF_RETAINS_NESTED_OBJECT_REFERENCE',inputType:'MALFORMED_SYNTHETIC_WIRE_STRING',actual:{retainedReference:true,sourceMutationVisible:true,cachedNestedBankAccount:nestedResult.nextCycle.name.bankAccount},preexistingAtHead:true,screenDisclosure:'NOT_CLAIMED: React rejects object child; model/cache retains invalid nested payload'});
for(const [id,mutate] of [['INVALID_AVAILABILITY_NUMBER',x=>x.statements[0].availabilityState=123],['INVALID_STATEMENTS_NULL',x=>x.statements=null]]){
 const x=source();mutate(x);assert.throws(()=>model.buildPayrollSelfServiceModel(x),TypeError);diagnostics.push({id,actual:'TypeError, not accepted model',result:'FAIL_CLOSED_MODEL_EXCEPTION_NOT_TYPED_DIAGNOSTIC'});
}
const oldPage=child.execFileSync('git',['show','HEAD:'+prefix+'hris-payroll-workspace.tsx'],{cwd:repo,encoding:'utf8'});
const pageText=fs.readFileSync(path.join(repo,prefix,'pages/hris-payroll-workspace.tsx'),'utf8');
function namedInitializer(text,name){const ast=ts.createSourceFile('audit.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)found=n.initializer.getText(ast);ts.forEachChild(n,visit);}visit(ast);return found;}
assert.equal(namedInitializer(pageText,'PAYROLL_COPY'),namedInitializer(oldPage,'PAYROLL_COPY'));
assert.equal(namedInitializer(pageText,'downloadStatement'),namedInitializer(oldPage,'downloadStatement'));
const oldApi=child.execFileSync('git',['show','HEAD:'+prefix+'payroll-api.ts'],{cwd:repo,encoding:'utf8'});
assert.equal(fs.readFileSync(path.join(repo,prefix,'api/payroll-api.ts'),'utf8'),oldApi);
diagnostics.push({id:'CONTROL_SOURCE_PRESERVATION',actual:'PAYROLL_COPY initializer, downloadStatement initializer and API file exact equal HEAD source'});
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost.invalid/'});
global.window=dom.window;global.document=dom.window.document;global.HTMLElement=dom.window.HTMLElement;global.IS_REACT_ACT_ENVIRONMENT=true;
let state={ready:true,isLoading:false,isFetching:false,error:null,authorityKey:'authority-a',model:model.buildPayrollSelfServiceModel(source()),retry:()=>{}};
function primitive(tag){return function({children,component,...props}){const attrs={};for(const k of ['role','aria-label','data-testid','data-query-state'])if(props[k]!==undefined)attrs[k]=props[k];return React.createElement(component||tag,attrs,children);};}
const mocks={
 'react-i18next':{useTranslation:()=>({t:k=>k,i18n:{language:'en',resolvedLanguage:'en'}})},
 'lucide-react':Object.fromEntries(['Download','FileLock2','ReceiptText','ShieldCheck'].map(k=>[k,()=>null])),
 '@dwp-frontend/design-system':{
 ActionButton:({children,loading,onClick,...p})=>React.createElement('button',{'aria-label':p['aria-label'],disabled:!!loading,'data-loading':String(!!loading),onClick},children),
 EmptyState:({title,description})=>React.createElement('div',null,title,description),
 InlineFeedback:primitive('div'),SectionHeader:({title,meta})=>React.createElement('div',null,title,meta)},
 '@dwp-frontend/shared-i18n':{formatDate:x=>String(x),resolveSupportedLocale:()=> 'en'},
 '../../../../components/hcm-query-state':{HcmQueryState:({loading,error})=>React.createElement('div',{'data-query-state':loading?'loading':error?'error':'unknown'})},
 '../hooks/use-hris-payroll-workspace':{useHrisPayrollWorkspace:()=>state}
};
function pageRequire(name){if(name in mocks)return mocks[name];if(name.startsWith('@mui/material/')){const leaf=name.split('/').at(-1);return {__esModule:true,default:leaf==='Chip'?({label})=>React.createElement('span',null,label):primitive(leaf==='Typography'?'p':leaf==='Divider'?'hr':'div')};}return req(name);}
const page=compile(pageText,'actual-page.tsx',pageRequire);
const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
const settle=()=>React.act(async()=>new Promise(r=>setTimeout(r,0)));
const render=async handler=>{await React.act(async()=>root.render(React.createElement(page.HrisPayrollWorkspace,{onDownloadStatement:handler})));await settle();};
function deferred(){let resolve;let reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function button(period){return host.querySelector('button[aria-label="Download pay statement for '+period+'"]');}
(async()=>{

 // Execute the real shared HTTP client and real PAY API adapter with explicit env/tenant/locale/fetch stubs.
 const httpErrors=compile(fs.readFileSync(path.join(repo,'libs/shared-utils/src/http-error.ts'),'utf8'),'http-error.ts');
 const client=compile(fs.readFileSync(path.join(repo,'libs/shared-utils/src/axios-instance.ts'),'utf8'),'axios-instance.ts',name=>{
  if(name==='./env')return {API_URL:''};
  if(name==='./http-error')return httpErrors;
  if(name==='./tenant-util')return {getTenantId:()=> 'synthetic-tenant'};
  if(name==='./locale-preference')return {resolveRequestLocale:()=> 'en'};
  return req(name);
 });
 const readScope=compile(fs.readFileSync(path.join(repo,'libs/shared-utils/src/api/product-surface-read-scope.ts'),'utf8'),'read-scope.ts');
 const api=compile(fs.readFileSync(path.join(repo,prefix,'api/payroll-api.ts'),'utf8'),'actual-api.ts',name=>{
  if(name==='@dwp-frontend/shared-utils/axios-instance')return client;
  if(name==='@dwp-frontend/shared-utils/api/product-surface-read-scope')return readScope;
  return req(name);
 });
 const body=deferred();let actualFetchSignal;let bodyReadStarted=false;const originalFetch=global.fetch;
 global.fetch=async(_url,init)=>{actualFetchSignal=init.signal;return {ok:true,status:200,headers:new Headers(),text:()=>{bodyReadStarted=true;return body.promise;}};};
 const caller=new AbortController();const responsePromise=api.getHrisPayrollWorkspace('scope-synthetic-body-read',caller.signal);
 await new Promise(r=>setTimeout(r,0));assert(bodyReadStarted);caller.abort('authority-changed-after-response-headers');
 assert.equal(actualFetchSignal.aborted,false);
 body.resolve(JSON.stringify({data:source()}));const afterAbortResponse=await responsePromise;assert.equal(afterAbortResponse.nextCycle.name,'September payroll');
 global.fetch=originalFetch;
 diagnostics.push({id:'CE_SHARED_GET_ABORT_AFTER_HEADERS_DURING_BODY_READ',actual:{callerAborted:true,realFetchControllerAborted:false,responseStillResolves:true},preexistingAtHead:true,boundary:'Actual shared client and PAY API code, fake fetch body and env/tenant/locale; no server/native PEP. Existing 25 test only covers fetch-pending cancellation.'});

 await render(undefined);assert.equal(host.querySelectorAll('button').length,0);
 diagnostics.push({id:'CONTROL_NO_DOWNLOAD_ADAPTER_NO_ACTION',actual:'actual page has no action without callback',mockBoundary:'ReactDOM/jsdom actual page, hook/i18n/visual adapters mocked'});
 const a=deferred(),b=deferred(),calls=[];const handler=id=>{calls.push(id);return id==='statement-a'?a.promise:b.promise;};
 await render(handler);
 await React.act(async()=>button('August 2026').click());await settle();
 assert.equal(button('August 2026').getAttribute('data-loading'),'true');
 await React.act(async()=>button('July 2026').click());await settle();
 assert.equal(button('August 2026').getAttribute('data-loading'),'false');assert.equal(button('July 2026').getAttribute('data-loading'),'true');
 await React.act(async()=>a.resolve());await settle();
 assert.equal(button('July 2026').getAttribute('data-loading'),'false');
 diagnostics.push({id:'CE_CONCURRENT_DOWNLOAD_LOSES_INFLIGHT_PROGRESS',inputType:'VALID_TYPED_TWO_STATEMENTS_AND_DEFERRED_CALLBACKS',actual:{calls,aProgressClearedWhenBStarted:true,bStillPendingButProgressFalseAfterASettles:true},preexistingAtHead:true,boundary:'UI callback mock only; current production route supplies no callback'});
 await React.act(async()=>b.resolve());await settle();
 state={...state,authorityKey:'authority-b',model:model.buildPayrollSelfServiceModel(badBool)};
 await render(()=>{});assert(button('August 2026'));
 diagnostics.push({id:'CE_MALFORMED_FALSE_STRING_ACTUAL_PAGE_ACTION',actual:{actionShown:true,redactionShowsTruthyYes:host.textContent.includes('Monetary data redacted by sourceYes')},preexistingAtHead:true,boundary:'Synthetic invalid wire; not actual server catalog/grant/PII vulnerability claim'});
 const pending=deferred();let lateSideEffect=0;const late=async()=>{await pending.promise;lateSideEffect++;};
 state={...state,authorityKey:'authority-c',model:model.buildPayrollSelfServiceModel(source())};await render(late);
 await React.act(async()=>button('August 2026').click());await settle();
 state={...state,authorityKey:'authority-d',model:model.buildPayrollSelfServiceModel(source())};await render(late);
 assert.equal(button('August 2026').getAttribute('data-loading'),'false');
 await React.act(async()=>pending.resolve());await settle();assert.equal(lateSideEffect,1);assert.equal(host.querySelector('[role="alert"]'),null);
 diagnostics.push({id:'BOUNDARY_AUTHORITY_CHANGE_RESETS_UI_NOT_EXTERNAL_CALLBACK',actual:{newViewProgressClear:true,oldCallbackCanCompleteSideEffect:true,newViewOldErrorAbsent:true},preexistingAtHead:true,boundary:'Not a proven native authorization bypass; callback API has statementId only and no scope/signal/lease contract'});
 await React.act(async()=>root.unmount());host.remove();dom.window.close();
 const post=pins();assert.deepEqual(pre,post);
 console.log(JSON.stringify({status:'INDEPENDENT_ACTUAL_SOURCE_SYNTHETIC_COUNTEREXAMPLES_REPRODUCED_NOT_NATIVE_PEP',startedAt,finishedAt:new Date().toISOString(),nodeVersion:process.version,preSources:pre,postSources:post,sourceStable:true,diagnostics,boundaries:{sourceFsWrites:0,nativeAuth:0,serverApi:0,browserQa:0,actualReactState:true,actualTypeScriptSourceTranspiled:true,explicitMocks:['UI adapter components','request-scope/query hook','i18n formatter'],scope:'8 PAY frozen sources plus3 direct shared transport dependencies; old HEAD read-only comparator'}},null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
