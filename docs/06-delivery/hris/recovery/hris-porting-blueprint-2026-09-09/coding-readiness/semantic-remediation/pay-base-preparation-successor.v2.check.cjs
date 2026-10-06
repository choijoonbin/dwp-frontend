#!/usr/bin/env node
'use strict';
// Synthetic author verification; no DB, DML, process, server or source writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{createRequire}=require('node:module');
async function main(){
const B=require('./pay-base-preparation-successor.v2.build.cjs');
const prefix=B.prefix,read=s=>JSON.parse(fs.readFileSync(path.join(__dirname,prefix+s)));
const p=read('.json'),s=read('.schemas.json'),f=read('.fixtures.json'),foundation=read('.foundation.schemas.json');
const rf=createRequire(path.resolve(process.argv[2]||'/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend','package.json'));
const Ajv=rf('ajv');let assertions=0;const check=(x,label)=>{assert.ok(x,label);assertions++;};
const files=[...B.sourceFiles,...['.build.cjs','.check.cjs','.json','.schemas.json','.fixtures.json','.md','.sql-plan.cjs','.planned.sql','.graphs.cjs','.graphs.json','.native-columns.json','.owner-fixtures.json','.cancel-fixtures.json','.foundation.schemas.json','.foundation-fixtures.json','.source-file-allocation.json'].map(x=>path.join(__dirname,prefix+x)).filter(fs.existsSync)];
const before=files.map(B.pin),startedAt=new Date().toISOString();
check(p.CURRENT_PUBLISHED===false&&p.gateAuthorization==='NONE_G3_CLOSED','proposal not Gate');
check(B.sha(fs.readFileSync(path.join(__dirname,'pay-base-exact.proposal.v1.json')))==='bfe3e38b1417b180339e91ca22e20409e75f3991904ab26ecf0e8f3cb7e22455','historical input SHA');
check(JSON.stringify(p.operationRegistry.map(x=>x.operationId))===JSON.stringify(B.base.operationDeltas.map(x=>x.operationId)),'119 input op IDs/order retained; not independent oracle');
check(p.operationRegistry.every(x=>x.openGaps.length>0),'all operations disclose source gap');
const unsupported=new Set(['unevaluatedProperties','unevaluatedItems','prefixItems','$dynamicRef','$dynamicAnchor','dependentSchemas','dependentRequired','$recursiveRef']);
let leafCount=0,annotations=0;
function recursive(value,pointer){if(!value||typeof value!=='object')return;if(Array.isArray(value))return value.forEach((v,i)=>recursive(v,pointer+'/'+i));for(const[k,v]of Object.entries(value)){check(!unsupported.has(k),'unsupported projection '+pointer+'/'+k);if(k==='$ref')check(v.startsWith('#/$defs/'),'local schema reference');recursive(v,pointer+'/'+k);}if(value.$ref){const allowed=new Set(['$ref','description','title','$comment','examples','default','referenceContract']);check(Object.keys(value).every(k=>allowed.has(k)||k.startsWith('x-')),'ref constraint siblings not discarded');if(value.referenceContract)annotations++;}if(value.type&&!['object','array'].includes(value.type))leafCount++;}
recursive(B.base.$defs,'base');recursive(s.$defs,'v2');recursive(foundation.$defs,'foundation');
const engine=new Ajv({allErrors:true,format:'full',coerceTypes:false,useDefaults:false,removeAdditional:false,logger:false});
const id='urn:dwp:pay:v2:full-draft07-author',defs={...B.base.$defs,...s.$defs,...foundation.$defs};
engine.addSchema({$schema:'http://json-schema.org/draft-07/schema#',$id:id,$defs:defs});
const validators=new Map(Object.keys(defs).map(k=>[k,engine.compile({$ref:id+'#/$defs/'+k})]));
const shape=(key,v,label)=>{const validator=validators.get(key);check(!!validator,'schema '+key);check(validator(v),label+' '+JSON.stringify(validator.errors));};
let apiBodies=0,ownerBodies=0,digests=0;
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>B.sha(JSON.stringify(canonical(v)));
for(const fixture of f.configurationFixtures){for(const r of fixture.requests){const op=B.base.operationDeltas.find(x=>x.operationId===r.operationId);shape(op.requestBodySchemaRef,r.body,fixture.fixtureId+' '+r.operationId);apiBodies++;}for(const[k,v]of Object.entries(fixture.ownerResponses)){shape(k,v,fixture.fixtureId+' '+k);ownerBodies++;}check(hash(fixture.expectedFrozenInputMaterialization)===fixture.expectedFrozenFixtureDigest,'actual full ordered frozen materialization digest');check(hash(fixture.expectedResultMaterialization)===fixture.expectedResultFixtureDigest,'actual result materialization digest');digests+=2;}
const tableMap=new Map(p.tablePlans.map(t=>[t.table,t]));let columns=0,fks=0,ddl=0,openSources=0,directSources=0;const sourceIssues=[];
const sqlBase=t=>t.toUpperCase().replace('BIGSERIAL','BIGINT').replace('SERIAL','INTEGER');
for(const t of p.tablePlans){check(t.schemaName==='public'&&t.stream==='payroll-main'&&t.historyTable==='flyway_schema_history','canonical physical policy');check(/^pay_/.test(t.table),'PAY prefix');if(t.initialCreateDDL){check(!t.initialCreateDDL.includes('hris_payroll'),'no shadow schema DDL');check(t.initialCreateDDL.includes('CREATE TABLE public.'+t.table),'public table DDL');check(t.rlsSQL.includes('FORCE ROW LEVEL SECURITY')&&t.rlsSQL.includes("current_setting('dwp.tenant_id', true)"),'failclosed tenant RLS');ddl++;}for(const c of t.columns){columns++;check(typeof c.sqlType==='string','actual column type '+t.table+'.'+c.name);const binding=t.sourceBindings.find(x=>x.column===c.name);shape('PAYV2.PhysicalSource',binding,'physical source row');check(binding.sqlType===c.sqlType,'source column type');if(binding.sourceStatus==='DIRECT_PLANNED'){check(binding.inputs.length>0,'direct source real input');directSources++;}else openSources++;}for(const fk of t.foreignKeys){const target=tableMap.get(fk.targetTable);check(!!target,'same-owner target table');check(fk.columns.length===fk.targetColumns.length,'FK arity');check(fk.columns[0]==='tenant_id'&&fk.targetColumns[0]==='tenant_id','tenant composite parent');for(let i=0;i<fk.columns.length;i++){const c=t.columns.find(x=>x.name===fk.columns[i]),d=target.columns.find(x=>x.name===fk.targetColumns[i]);check(!!c&&!!d,'parent actual column exists');if(sqlBase(c.sqlType)!==sqlBase(d.sqlType))sourceIssues.push({table:t.table,column:c.name,target:target.table+'.'+d.name,issue:'FK SQL type mismatch'});fks++;}}}
let loadedLeaves=0;for(const o of p.operationRegistry){for(const table of [...o.readTables,...o.writeTables])check(tableMap.has(table.replace('public.','')),'declared physical table '+o.operationId);for(const column of o.sourcePlan.loadedColumns){const parts=column.split('.');check(parts[0]==='public'&&tableMap.get(parts[1]).columns.some(x=>x.name===parts[2]),'loaded actual source column');loadedLeaves++;}check(!/correlation|receipt/i.test(o.sourcePlan.businessIdInput),'business UUID allocator not audit/receipt');}
for(const[op,required]of Object.entries(B.extraReads)){const actual=p.operationRegistry.find(x=>x.operationId===op);check(required.every(t=>actual.readTables.includes('public.'+t)),'critical transitive reads '+op);}
check(p.ownerPort.methods.length===8,'8 governance queries');let governanceCases=0;const u=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const allocation=read('.source-file-allocation.json');check(allocation.rows.length===19&&new Set(allocation.rows.map(x=>x.file)).size===19,'19 unique exact owner Java files');for(const a of allocation.rows)check(a.file.endsWith('.java')&&!a.file.includes('...')&&!a.file.includes('..'),'exact planned source/test path, not ellipsis');
for(const m of p.ownerPort.methods){check(m.CURRENT_PUBLISHED===false,'owner label not native publication');const op=p.operationRegistry.find(o=>o.operationId===m.consumerOperationId);check(op.ownerReadContracts.includes(p.ownerPort.contractRef),'registered planned owner consumer');const request={artifactKind:m.requestConstant.artifactKind,scope:{legalPayrollEntityId:u(10),payGroupId:u(11)},asOf:'2026-09-14T00:00:00Z',validFrom:'2026-09-01',validTo:'2026-10-01',expectedSchemaVersion:'PAYROLL_CONFIG_GOVERNANCE_V2',expectedPolicyRevision:7,expectedPayloadDigest:null};const payload={snapshotId:u(20+governanceCases),schemaVersion:'PAYROLL_CONFIG_GOVERNANCE_V2',artifactKind:request.artifactKind,scope:request.scope,policyRevision:7,ownerRevision:8,asOf:request.asOf,validFrom:request.validFrom,validTo:request.validTo,expiresAt:'2026-09-14T01:00:00Z',operatorRegistryVersion:'PAY_RULE_AST_V1',currencyRegistry:['TST'],timeZoneRegistry:['Etc/UTC'],approvalPolicyId:u(30),retentionPolicyId:u(31),allowedArtifactKinds:[request.artifactKind],payloadDigest:'0'.repeat(64)};const own={...payload};delete own.payloadDigest;payload.payloadDigest=hash(own);shape(m.requestSchemaRef,request,m.method);shape(m.responseSchemaRef,payload,m.method);check(Object.keys(payload).every(k=>m.fieldSources[k]),'every owner response typed field source');check(hash(own)===payload.payloadDigest,'owner actual payload hash');governanceCases++;}
function zero(x){if(typeof x!=='string'||!/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?/.test(x)||!/^[-]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(x))throw Error('DECIMAL_INVALID');const neg=x.startsWith('-'),raw=neg?x.slice(1):x;let[a,b='']=raw.split('.');b=b.replace(/0+$/,'');return /^0*$/.test(a+b)?'0':(neg?'-':'')+a+(b?'.'+b:'');}
function evaluate(op,x){
 if(x.tenantId!==x.targetTenantId||!x.groupAllowed||x.worker!==x.authorizedWorker||!x.parentValid||!x.entitlement)return'404_OPAQUE';
 if(!x.person||!x.personAuthority)return'403_SELF_IDENTITY_UNVERIFIED';
 if(op==='payslip.query'&&x.contexts>1&&x.payPurpose&&x.appEntitled)return'PERSON_BOUND_STATEMENT_NO_CURRENT_CONTEXT_REQUIRED';
 if(!x.ownerPublished)return'503_SOURCE_OWNER_CONTRACT_NOT_PUBLISHED';
 if(!x.payloadPresent||x.operator==='UNKNOWN')return'400_SCHEMA_INVALID';
 if(!x.digestValid)return'422_SOURCE_DIGEST_MISMATCH';
 if(!x.ownerFresh)return op==='yearend.case.create'?'404_OPAQUE':'422_SOURCE_STALE';
 if(x.ownerSuperseded)return'422_SOURCE_SUPERSEDED';
 if(x.sequence.length!==x.declaredCount||new Set(x.sequence).size!==x.sequence.length||x.sequence.some((n,i)=>n!==i+1))return'422_SOURCE_SEQUENCE_OR_COUNT';
 if(x.requiredOptional&&!x.optionalSelected)return'422_MISSING_REQUIRED_INPUT';
 if(x.cycle)return'422_FORMULA_CYCLE';
 if(x.operator==='ADD'&&x.leftUnit!==x.rightUnit||x.operator==='MULTIPLY'&&x.leftUnit==='HOUR'&&x.rightUnit==='DAY')return'422_UNIT_MISMATCH';
 if(x.leftCurrency!==x.rightCurrency)return'422_CROSS_CURRENCY_FORBIDDEN';
 if(x.operator==='DIVIDE'&&zero(x.denominator)==='0')return'422_DIVIDE_BY_ZERO';
 if(x.nodeCount>x.nodeLimit)return'422_FORMULA_LIMIT';
 try{if(x.decimal!==null)zero(x.decimal);}catch{return'400_OR_422_DECIMAL_INVALID';}
 if(op==='run.finalize'&&x.maker===x.actor||op==='payment.release'&&x.bankEditor===x.actor)return'409_SOD_CONFLICT';
 if(x.expectedVersion!==x.loadedVersion)return'409_STALE_OR_STATE';
 if(Date.parse(x.fenceExpiresAt)<=Date.parse(x.now))return'409_STALE_FENCE';
 if(x.existingReceipt)return'ORIGINAL_SUCCEEDED_RECEIPT';
 if(x.sameKey&&!x.sameDigest)return'409_IDEMPOTENCY_KEY_REUSED';
 if(x.sameKey&&!x.sameActor)return'INDEPENDENT_SCOPE_RECEIPT';
 if(op==='pay.input.source.invalidate'&&x.finalized)return'FINAL_RETRO_ASSESSMENT';
 if(op==='pay.input.source.invalidate'&&x.approvalPending)return'INPUT_INVALIDATED_OR_BLOCKED_PENDING_CANCEL';
 if(x.activeRegular)return'409_REGULAR_RUN_EXISTS';
 if(x.finalized&&x.destructive)return'409_FINAL_FACT_IMMUTABLE';
 if(x.correctionModes.length!==1)return'422_CORRECTION_MODE_CONFLICT';
 if(!x.bankVerified)return'422_BANK_TOKEN_UNVERIFIED';
 if(op==='pay.payment.cancel'&&x.settlementOutcome==='UNKNOWN')return'409_RESULT_UNKNOWN_RECONCILE_REQUIRED';
 if(x.settlementOutcome==='UNKNOWN')return'503_RESULT_UNKNOWN';
 if(op==='pay.payment.reconcile'&&x.settlementOutcome==='PARTIAL')return'PARTIALLY_ACKNOWLEDGED';
 if(x.settlementMethod!==x.proofMethod)return'422_SETTLEMENT_METHOD_MISMATCH';
 if(x.approvalOutcome==='APPROVED')return'ADOPT_APPROVED_OWNER_OUTCOME';
 if(['UNKNOWN','NOT_FOUND'].includes(x.approvalOutcome))return'503_RESULT_UNKNOWN';
 if(!x.balanced)return'422_GL_NOT_BALANCED_OR_SOURCE_STALE';
 if(op==='gl.post'&&x.settlementOutcome==='NATIVE')return'NATIVE_POSTED_ONLY';
 if(x.statementRevoked||!x.stepUp||!x.payPurpose||!x.appEntitled)return'404_OR_403_FIELD_STEPUP';
 if(!x.providerActive)return'422_PROVIDER_NOT_ACTIVE';
 if(!x.serviceComplete)return'422_RETIREMENT_BASIS_INCOMPLETE';
 if(!x.annualCoverageComplete)return'422_YEAR_END_SOURCE_COVERAGE_UNVERIFIED';
 try{new Intl.DateTimeFormat('en',{timeZone:x.timeZone});}catch{return'422_TIME_ZONE_INVALID';}
 if(new Set(x.roundingStages).size!==x.roundingStages.length)return'422_ROUNDING_STAGE_DUPLICATE';
 if(x.countryOverlap)return'409_23P01';
 if(op==='pay.period.materialize')return'EXACT_CIVIL_DATE_NO_24H_SHIFT';
 if(x.decimal!==null&&zero(x.decimal)==='0')return'NORMALIZED_ZERO';
 return'ACCEPTED';
}
let typedCases=0;const outcomes=[];
for(const c of [...f.typedBoundaryCases,...f.additionalCases]){shape('PAYV2.FixtureFacts',c.facts,c.caseId);const actual=evaluate(c.operationId||'additional',c.facts);check(actual===c.expected,c.caseId+' actual='+actual+' expected='+c.expected);outcomes.push({caseId:c.caseId,operationId:c.operationId||null,outcome:actual,APIRequestPresent:!!c.APIRequest,scope:'SYNTHETIC_BOUNDARY_MODEL_NO_NATIVE_OR_DML',actualProviderCalls:0});typedCases++;}
const sqlPlan=require('./pay-base-preparation-successor.v2.sql-plan.cjs');
const sql=fs.readFileSync(path.join(__dirname,prefix+'.planned.sql'),'utf8');
check(sql.trimEnd()===sqlPlan.sql.trimEnd(),'saved planned SQL matches owned builder ignoring final newline only');
check((sql.match(/CREATE TABLE public\.pay_/g)||[]).length===88,'all88 public planned DDL');
check(!sql.includes('hris_payroll'),'no shadow schema in draft SQL');
for(const t of p.tablePlans)check(sql.includes('CREATE TABLE public.'+t.table+' ('),'every target in SQL');
const graphs=read('.graphs.json');
check(JSON.stringify(graphs)===JSON.stringify(require('./pay-base-preparation-successor.v2.graphs.cjs')),'saved source graph exact');
let graphFieldSources=0;
for(const q of graphs.queries){check(!/\b(?:ppl_|tme_|prf_|com_|sys_)/.test(q.sql),'PAY cannot owner DB join');for(const[field,v]of Object.entries(q.fieldSources)){check(tableMap.get(q.table).columns.some(c=>c.name===field&&c.sqlType===v.type),'exact query source column/type');graphFieldSources++;}}
check(graphs.cancelBranches.length===6,'6 exact cancellation branch graphs');
for(const b of graphs.cancelBranches){check(b.bindingLookup.parentColumn.source==='public.'+b.bindingTable+'.subject_public_id','actual binding parent column');check(b.bindingLookup.parentValue.source==='public.'+b.subjectTable+'.public_id','actual subject parent UUID');check(b.inputs.includes('header.If-Match')&&b.inputs.includes('runtime.clock.instant'),'real CAS/clock dependency, not tenant/actor placeholder');}
const native=read('.native-columns.json');check(native.nativePhysicalDeltas.length===2,'native result/target physical deltas');
for(const t of native.nativePhysicalDeltas){check(tableMap.has(t.table.replace('public.','')),'existing native target table');for(const c of t.columns){check(!tableMap.get(t.table.replace('public.','')).columns.some(x=>x.name===c.name),'new native column not already present');check(c.sourceStatus==='OWNER_PLANNED_TRANSPORT_PEP_OPEN','native label not current authority');}}
let nativeSyntheticShapes=0,storedGovernancePairs=0;
for(const x of read('.owner-fixtures.json').fixtures){for(const[key,value]of [['PAYV2.AuthBinding',x.auth],['PAYV2.NativeContextSet',x.native],['PAYV2.NativeLegalEmployer',x.employer],['PAYV2.NativeSelector',x.selector],['PAYV2.StatementAuthorityQuery',x.statementQuery],['PAYV2.Download',x.downloadBody],['PAYV2.StatementAuthority',x.statementAuthority]]){shape(key,value,x.fixtureId);nativeSyntheticShapes++;}const c=x.native.contexts[0];check(c.worker.personPublicId===x.auth.personPublicId&&c.relationship.workerPublicId===c.worker.publicId&&c.assignment.workRelationshipPublicId===c.relationship.publicId&&c.relationship.legalEmployerPublicId===x.employer.publicId,'actual native parent tuple');check(x.statementAuthority.personPublicId===x.auth.personPublicId,'statement person is Auth bound');check(x.formerWorkerStatement.currentEmploymentSetRequired===false,'former person statement not current assignment');for(const g of x.governance){shape('PAYV2.ConfigurationQuery',g.request,g.method);shape('PAYV2.ConfigurationResponse',g.response,g.method);const content={...g.response};delete content.payloadDigest;check(hash(content)===g.response.payloadDigest,'stored config digest actual payload');check(g.request.artifactKind===g.response.artifactKind,'governance constant method branch');storedGovernancePairs++;}}
const cancellation=read('.cancel-fixtures.json');let cancelApiShapes=0,cancelBranchOutcomes=0;
for(const x of cancellation.fixtures){shape('PAY.CasCommandHeaders',x.headers,x.fixtureId);shape('PAY.ApprovalCancellation',x.cancelRequest,x.fixtureId);shape('PAY.OwnerCancellationApply',x.reconcileRequest,x.fixtureId);cancelApiShapes+=3;check(x.loadedSubject.publicId===x.loadedBinding.subjectPublicId&&x.loadedSubject.publicId===x.ownerResponse.subjectPublicId&&x.loadedBinding.publicId===x.ownerResponse.bindingPublicId,'exact cancel subject/binding/owner tuple');check(x.headers['If-Match']==='"'+x.loadedSubject.rowVersion+'"','cancel actual CAS header prestate');const m=cancellation.stateMappings[x.cancelRequest.subjectKind],outcome=x.ownerResponse.outcome;const target=outcome==='CANCELLED_BEFORE_DECISION'?'CANCELLED':outcome==='APPROVED'?m.approved:outcome==='REJECTED'?m.rejected:m.pending;check(target===x.expectedSubjectState,'branch exact state, not generic APPROVED/REJECTED');check(x.expectedSubjectWrites===(['UNKNOWN','NOT_FOUND'].includes(outcome)?0:1),'unknown no subject writes');check(x.expectedOriginalFinancialWrites===0,'all original financial facts immutable');cancelBranchOutcomes++;}
let successorFoundationBodies=0;
for(let i=0;i<f.configurationFixtures.length;i++){const current=read('.owner-fixtures.json').fixtures[i];for(const r of f.configurationFixtures[i].requests){const method=p.ownerPort.methods.find(x=>x.consumerOperationId===r.operationId);if(!method)continue;const body=structuredClone(r.body),g=current.governance.find(x=>x.method===method.method);body.governance={...g.request,expectedOwnerRevision:g.response.ownerRevision,expectedPayloadDigest:g.response.payloadDigest};if(method.requestConstant.artifactKind==='ENTITY'){delete body.legalEntitySnapshot;body.legalEmployerRef={publicId:current.employer.publicId,expectedVersion:current.employer.version,asOf:current.employer.capturedAt};}shape(p.operationRegistry.find(x=>x.operationId===r.operationId).requestBodySchemaRef,body,'actual successor '+r.operationId);successorFoundationBodies++;}}
let allEightFoundationBodies=0;for(const x of read('.foundation-fixtures.json').fixtures){shape(x.bodySchemaRef,x.body,x.fixtureId);shape('PAYV2.ConfigurationQuery',x.ownerGovernanceRequest,x.fixtureId);shape('PAYV2.ConfigurationResponse',x.ownerGovernanceResponse,x.fixtureId);const content={...x.ownerGovernanceResponse};delete content.payloadDigest;check(hash(content)===x.body.governance.expectedPayloadDigest,'foundation actual expected owner digest');check(x.body.governance.expectedOwnerRevision===x.ownerGovernanceResponse.ownerRevision,'foundation exact expected native owner revision');check(x.body.governance.artifactKind===x.ownerGovernanceResponse.artifactKind,'foundation typed owner method constant');allEightFoundationBodies++;}
let mutationChecks=0;
function mutate(label,fn){let failed=false;try{fn();}catch{failed=true;}check(failed,'mutation detected '+label);mutationChecks++;}
mutate('unknown recursive schema field',()=>shape('PAYV2.NativeSelector',{workerPublicId:u(3),workRelationshipPublicId:u(4),assignmentPublicId:u(5),linkPublicId:u(6)},'shadow field'));
mutate('invalid full-format date',()=>shape('PAY.Date','2026-02-30','date'));
mutate('loaded phantom column',()=>check(tableMap.get('pay_payroll_runs').columns.some(c=>c.name==='phantom_column'),'phantom'));
mutate('digest nested source altered',()=>{const x=structuredClone(f.configurationFixtures[0].expectedFrozenInputMaterialization);x.mutatedNestedSource={revision:99};check(hash(x)===f.configurationFixtures[0].expectedFrozenFixtureDigest,'full digest mutation');});
mutate('parent UUID substituted',()=>{const x=structuredClone(B.model());x.parentValid=false;check(evaluate('pay.paygroup.version.create',x)==='ACCEPTED','parent mutation');});
mutate('stale CAS hidden',()=>{const x=structuredClone(B.model());x.expectedVersion--;check(evaluate('run.finalize',x)==='ACCEPTED','CAS mutation');});
mutate('actual formula host expression',()=>{const x=structuredClone(read('.foundation-fixtures.json').fixtures.find(x=>x.operationId==='formula.version.create'));x.body.expressionAst={op:'HOST_EVAL',source:'arbitrary host expression'};shape(x.bodySchemaRef,x.body,'closed actual AST noeval');});
mutate('actual governance wrong method kind',()=>{const x=structuredClone(read('.foundation-fixtures.json').fixtures[0]);x.body.governance.artifactKind='GL_MAPPING';shape(x.bodySchemaRef,x.body,'operation-specific method constant');});
mutate('actual governance digest-only missing payload reference',()=>{const x=structuredClone(read('.foundation-fixtures.json').fixtures[0]);delete x.body.governance.expectedSchemaVersion;shape(x.bodySchemaRef,x.body,'schema/version owner contract mandatory');});
mutate('native assignment wrong parent',()=>{const x=structuredClone(read('.owner-fixtures.json').fixtures[0]);x.native.contexts[0].assignment.workRelationshipPublicId=u(999);check(x.native.contexts[0].assignment.workRelationshipPublicId===x.native.contexts[0].relationship.publicId,'native parent mutation');});
check(zero('-0.000')==='0','SSOT signed zero');check(zero('1.2300')==='1.23','canonical decimal');
const expectedBuild=await B.build();check(JSON.stringify(expectedBuild['.json'].sourceRestoration.rows)===JSON.stringify(p.sourceRestoration.rows),'all153 exact source inventory rows/decisions retained; not independent meaning approval');
check(p.sourceRestoration.rows.length===153&&p.sourceRestoration.retirementRows===119,'119 retirement/34 YEA inventory scope exact');
check(JSON.stringify(expectedBuild['.json'].operationRegistry)===JSON.stringify(p.operationRegistry),'saved operation schema/source delta matches own builder');
const after=files.map(B.pin),drift=before.filter((x,i)=>x.sha256!==after[i].sha256||x.mtimeNs!==after[i].mtimeNs);
const pinDrift=p.inputManifest.filter(x=>{const y=B.pin(x.path);return x.sha256!==y.sha256||x.mtimeNs!==y.mtimeNs;});
const result={status:'AUTHOR_STRUCTURE_FIXTURE_VERIFIED_G3_CLOSED',startedAt,endedAt:new Date().toISOString(),actualArgv:process.argv,engine:{name:'Ajv',version:rf('ajv/package.json').version,draft:'FULL_DRAFT07_LOCAL_PROJECTION_NOT_CANONICAL_2020',formats:'full',coercion:false},compiledSchemas:validators.size,recursiveSchemaLeaves:leafCount,referenceMetadataNotAuthority:annotations,assertions,apiValidInheritedABRequestBodies:apiBodies,ownerInheritedBodies:ownerBodies,typedBoundaryCases:typedCases,governanceSyntheticPairs:governanceCases,materializationDigests:digests,mutationChecks,columnsChecked:columns,loadedColumnLeavesChecked:loadedLeaves,sameOwnerFKColumnsChecked:fks,draftPublicDDLTables:ddl,assembledPublicDDLTables:88,SQLNativeSyntaxExecution:0,criticalGraphQueryFields:graphFieldSources,criticalGraphQueries:graphs.queries.length,criticalGraphNodes:graphs.nodes.length,cancellationBranchGraphs:graphs.cancelBranches.length,nativePlannedNewColumns:28,nativeSyntheticShapes,storedGovernancePairs,cancelApiShapes,cancelBranchOutcomes,successorFoundationBodies,allEightFoundationBodies,directInitialSources:directSources,openInitialSources:openSources,sourceIssues,unmatchedFullAPINegativePayloads:f.typedBoundaryCases.filter(x=>!x.APIRequest).map(x=>x.caseId),all119ExactMutationSourceClosed:false,sourceFamilyMeaningIndependentlyApproved:false,before,after,executionDrift:drift,proposalInputPinDrift:pinDrift,outcomes,actualNativeRuns:0,actualDml:0,productionOwnerRegistration:0,authorOnly:true};
console.log(JSON.stringify(result,null,2));
module.exports={evaluate,zero,hash};
if(drift.length||pinDrift.length)process.exitCode=2;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
