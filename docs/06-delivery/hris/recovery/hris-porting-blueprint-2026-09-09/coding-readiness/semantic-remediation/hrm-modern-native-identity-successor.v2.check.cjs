#!/usr/bin/env node
'use strict';
// Author replay only: installed full Draft07 engine + concrete models. Read-only source; no service/SQL calls.
const fs=require('fs'),path=require('path'),{createRequire}=require('module'),{spawnSync}=require('child_process');
const D=require('./hrm-modern-native-identity-successor.v2.design.cjs'),F=require('./hrm-modern-native-identity-successor.v2.fixtures.cjs');
const frontend=process.argv.includes('--frontend')?process.argv[process.argv.indexOf('--frontend')+1]:path.join(D.BE,'../frontend');
const req=createRequire(path.join(frontend,'package.json')),Ajv=req('ajv');
const ajv=new Ajv({allErrors:true,format:'full',coerceTypes:false,useDefaults:false,removeAdditional:false,unknownFormats:'fail'});
const startedAt=new Date().toISOString(),failures=[],sourceIssues=[],counts={assertions:0,compiledDefinitions:0,inheritedShapeRequests:0,concreteAdmissionRequests:0,admissionOutputs:0,negativeModels:0,negativeSchemas:0,targetPositives:0,targetNegatives:0,semanticMutations:0,sourceColumns:0};
const assert=(ok,label)=>{counts.assertions++;if(!ok)failures.push(label);};
const p=D.read(path.join(D.DIR,D.PREFIX+'.json')),schemaFile=D.read(path.join(D.DIR,D.PREFIX+'.schemas.json')),fixtures=D.read(path.join(D.DIR,D.PREFIX+'.fixtures.json'));
const tracked=[...p.base.files.map(x=>x.path),...p.sourcePins.map(x=>x.path),...['json','schemas.json','fixtures.json','design.cjs','fixtures.cjs','check.cjs','source-contract.json','source-contract.cjs','md'].map(s=>path.join(D.DIR,D.PREFIX+'.'+s)).filter(fs.existsSync)];
const before=tracked.map(D.pin),jsonSame=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const snapshotStable=(rows)=>rows.map(x=>({...x,current:D.pin(x.path)})).filter(x=>x.sha256!==x.current.sha256||x.mtimeNs!==x.current.mtimeNs);
assert(p.status==='DESIGN_PROPOSED_G3_NONE'&&p.authorOnly&&!p.canonicalOverlayDialectApproved&&!p.canonicalSemanticLineagePass,'Forbidden readiness/canonical approval');
assert(jsonSame(fixtures,F.document()),'Saved fixture models differ from owned generator');
const effective=D.materialize(p),b=D.base(),schemas=D.schemas(p);
assert(jsonSame(schemaFile,D.schemaFile(p)),'Saved fullDraft07 schema/source projection digest differs');
assert(jsonSame(p.scope.preservedOperationIds,b.operationDeltas.map(x=>x.operationId)),'Frozen83 operation IDs changed');
assert(jsonSame(effective.operationDeltas.map(x=>x.operationId),p.scope.preservedOperationIds),'Materialized operation IDs dropped');
assert(p.operationSourceGapRegistry.length===83&&p.operationSourceGapRegistry.every(x=>x.sourceClosure===false),'Missing operation gap or false whole-source closure');
assert(p.eventRegistry.length===30&&p.eventRegistry.filter(x=>x.twelveSubjectBusinessEventScope).length===12,'Event scope loss');
for(const pin of p.sourcePins)assert(D.pin(pin.path).sha256===pin.sha256,'Observed current owner source SHA drift: '+pin.path);
for(const [id,schema]of Object.entries(schemas.definitions)){assert(ajv.validateSchema(schema),'Invalid fullDraft07 schema '+id);ajv.addSchema(schema);counts.compiledDefinitions++;}
for(const schema of Object.values(schemas.definitions)){try{assert(typeof ajv.getSchema(schema.$id)==='function','Missing compiled '+schema.$id);}catch(e){assert(false,'Compile: '+e.message);}}
const validate=(id,value)=>{const fn=ajv.getSchema(D.U+id);return fn&&fn(value);};
// 83 complete projected request shapes; these are explicitly NOT business acceptance receipts.
const converted=require('./'+D.OLD+'.fixture-check.js').fixtureDocument(effective,schemas);
for(const witness of converted.shapeWitnesses){const op=effective.operationDeltas.find(x=>x.operationId===witness.operationId);assert(ajv.getSchema('urn:hrm-native-successor:'+op.requestSchema.schemaId)(witness.request),'Inherited shape failed '+op.operationId);counts.inheritedShapeRequests++;}
const records=[];
for(const f of [...fixtures.cases,fixtures.optionalConnectorCase]){
 assert(validate('AdmissionRequest',f.request),'Concrete closed admission request '+f.caseId);
 assert(validate('ActorAuthority',f.actorAuthority),'Actor authority schema '+f.caseId);
 assert(validate('CreationPopulation',f.creationPopulation),'Creation source-population schema '+f.caseId);
 assert(validate('SubjectPopulation',f.ownerSubjectPopulation),'Separate current owner target-population schema '+f.caseId);
 counts.concreteAdmissionRequests++;
 try{
  const r=F.prepare(f);
  assert(validate('AdmissionReceipt',r.receipt),'Actual modeled receipt schema '+f.caseId);
  assert(validate('SubjectPopulation',r.receipt.subjectPopulation),'Actual modeled target person-only schema '+f.caseId);
  assert(validate('NativeAdmissionEvent',r.event),'Actual modeled native event schema '+f.caseId);
  assert(r.receipt.personPublicId===f.ownerPersonRow.public_id&&r.receipt.personVersion===f.ownerPersonRow.version,'Native result identity/version not owner row');
  assert(r.receipt.personPublicId!==r.receipt.actorAuthority.principalPublicId&&r.receipt.personPublicId!==f.actorBinding.personPublicId,'Actor binding copied into subject');
  assert(r.receipt.subjectPopulation.subject.personVersion!==r.receipt.actorAuthority.authVersions.userRowVersion,'Actor Auth version substituted for target Person version');
  assert(r.calls.ats===f.expected.atsCalls&&r.calls.connector===f.expected.connectorCalls&&r.calls.targetAuth===0,'Optional ATS/connector/target Auth calls '+f.caseId);
  assert(r.calls.workerWrites===0&&r.calls.authRelinks===0&&r.calls.grants===0,'Person admission grants/future worker/relink side effect');
  assert(r.event.aggregatePublicId===r.receipt.receiptPublicId&&r.event.personPublicId===r.receipt.personPublicId&&r.event.aggregatePublicId!==r.event.personPublicId,'Native receipt/person aggregate identities collapsed');
  const replay=F.clone(f);replay.replay={normalizedRequest:r.normalizedRequest,receipt:r.receipt};const rr=F.prepare(replay);assert(rr.replayed&&rr.calls.personInsert===0&&jsonSame(rr.receipt,r.receipt),'Replay repeats Person DML or changes result');
  replay.request=Object.fromEntries(Object.entries(replay.request).reverse());assert(F.prepare(replay).replayed,'Equivalent object-key-order replay changes normalized digest');
  records.push({caseId:f.caseId,sourceBoundary:'MODEL_EXECUTION_FROM_CONCRETE_OWNER_ROW_FIXTURE_NOT_NATIVE_DB',...r});counts.admissionOutputs++;
 }catch(e){assert(false,'Positive admission '+f.caseId+': '+e.message);}
}
const negativeResults=[];
for(const n of F.negativeDefinitions()){
 const f=F.fixture(n.caseKind||'HR_NATIVE',n.reuse?'REUSE_NATIVE_PERSON':'CREATE_NATIVE_PERSON','A',n.connector?'OPTIONAL_CONNECTOR':'NATIVE_STAGED');n.mutate(f);
 const schemaValid=validate('AdmissionRequest',f.request),actorSchemaValid=validate('ActorAuthority',f.actorAuthority);
 let error=null,calls=null;try{F.prepare(f);}catch(e){error=e.message;calls=e.calls;}
 assert(error===n.error,'Negative model '+n.id+' expected '+n.error+' got '+error);
 if(/ZERO_CALLS/.test(n.id))assert(calls&&calls.ats===0&&calls.connector===0&&calls.targetAuth===0,'Negative optional zero-call failure '+n.id);
 if(n.id==='CHANGED_IMMUTABLE_REQUEST_REPLAY')assert(calls.personInsert===0,'Changed replay performed native Person INSERT');
 negativeResults.push({caseId:n.id,requestSchemaValid:schemaValid,actorSchemaValid,error,calls});counts.negativeModels++;
}
const schemaNegatives=[
 ['UNKNOWN_SOURCE_KIND',f=>f.request.source.kind='GENERIC','AdmissionRequest',f=>f.request],
 ['HR_NATIVE_FORBIDS_CANDIDATE_CASE',f=>f.request.source.candidateCasePublicId=F.id(700),'AdmissionRequest',f=>f.request],
 ['CREATE_FORBIDS_EXISTING_PERSON',f=>f.request.personMutation.existingPersonPublicId=F.id(701),'AdmissionRequest',f=>f.request],
 ['MISSING_NATIVE_PERSON_FACTS',f=>delete f.request.personMutation.facts,'AdmissionRequest',f=>f.request],
 ['ACTOR_AUTH2_NOT_SUBJECT_INPUT',f=>f.request.personMutation.authUserRowVersion=71,'AdmissionRequest',f=>f.request],
 ['BODY_AUTHORITY_NOT_TRUSTED_INPUT',f=>f.request.actorAuthority=f.actorAuthority,'AdmissionRequest',f=>f.request],
 ['UUID_IS_NOT_DIGEST',f=>f.request.requestPublicId='a'.repeat(64),'AdmissionRequest',f=>f.request],
 ['UNSAFE_VERSION_CODEC',f=>f.request.source.workspaceVersion=9007199254740992,'AdmissionRequest',f=>f.request],
 ['MISSING_ATS_CASE_ID',f=>{f.request.source=F.fixture('ATS_CASE','CREATE_NATIVE_PERSON').request.source;delete f.request.source.candidateCasePublicId;},'AdmissionRequest',f=>f.request],
 ['IMPORT_FORBIDS_CANDIDATE_CASE',f=>{f.request.source=F.fixture('IMPORT','CREATE_NATIVE_PERSON').request.source;f.request.source.candidateCasePublicId=F.id(700);},'AdmissionRequest',f=>f.request],
 ['SELF_PROFILE_NOT_ACTING_ADMISSION_PURPOSE',f=>f.actorAuthority.purpose='SELF_PROFILE_READ','ActorAuthority',f=>f.actorAuthority]
];
for(const[id,mutate,schema,select]of schemaNegatives){const f=F.fixture('HR_NATIVE','CREATE_NATIVE_PERSON');mutate(f);assert(!validate(schema,select(f)),'Schema negative accepted '+id);counts.negativeSchemas++;negativeResults.push({caseId:id,schema,accepted:false});}
// PERSON/EMPLOYMENT are different target schemas; no Auth subject lookup under either.
const targetRecords=[];
for(const at of ['2026-11-02T09:59:50Z','2026-11-01T05:30:00Z','2026-11-01T06:30:00Z']){const f=F.employmentCase();f.query.asOf=at;assert(validate('TargetQuery',f.query),'Target query concrete schema');try{const r=F.target(f);assert(r.calls.targetAuth===0&&r.subject.versions.personVersion===19&&r.actorAuthVersions.userRowVersion===71,'TargetAuth0 and People/Auth versions separate');const population={tenantId:f.actorAuthority.tenantId,ownerSnapshotPublicId:F.id(900),subject:r.subject,populationPolicy:f.actorAuthority.populationPolicy,fieldPolicy:f.actorAuthority.fieldPolicy,purpose:'ONBOARDING_BIND',decisionRevision:23,authorizedFields:['PERSON_IDENTITY','EMPLOYMENT_CONTEXT'],expiresAt:F.expiry};assert(validate('SubjectPopulation',population),'EMPLOYMENT closed target output');targetRecords.push({asOf:at,...r,population});counts.targetPositives++;}catch(e){assert(false,'Positive target '+e.message);}}
const targetNegatives=[['MISSING_TARGET_ADAPTER',f=>f.targetAdapterPresent=false,'TARGET_ADAPTER_MISSING'],['POPULATION_PEP_DENIED',f=>f.populationAllowed=false,'TARGET_PEP_DENIED'],['FIELD_PEP_DENIED',f=>f.fieldAllowed=false,'TARGET_PEP_DENIED'],['PURPOSE_PEP_DENIED',f=>f.purposeAllowed=false,'TARGET_PEP_DENIED'],['TARGET_TENANT_MISMATCH',f=>f.rows.person.tenant_id++,'TARGET_TENANT'],['TARGET_PERSON_PARENT',f=>f.rows.worker.person_public_id=F.id(999),'TARGET_NATIVE_PARENT'],['TARGET_WORKER_PARENT',f=>f.rows.relationship.worker_public_id=F.id(999),'TARGET_NATIVE_PARENT'],['TARGET_RELATIONSHIP_PARENT',f=>f.rows.assignment.relationship_public_id=F.id(999),'TARGET_NATIVE_PARENT'],['TARGET_PEOPLE4_STALE',f=>f.rows.assignment.version++,'TARGET_PEOPLE_VERSION'],['ACTING_AUTH2_IS_NOT_PEOPLE4',f=>f.query.expectedVersions.personVersion=f.actorBinding.userRowVersion,'TARGET_PEOPLE_VERSION'],['TARGET_SEQUENCE_CORRECTION',f=>f.rows.higherCorrectionExists=true,'TARGET_SEQUENCE_OR_OVERLAP'],['TARGET_OVERLAP',f=>f.rows.overlapExists=true,'TARGET_SEQUENCE_OR_OVERLAP'],['TARGET_ZONE_MISSING',f=>f.rows.assignment.work_zone='Invalid/Zone','TARGET_ZONE_INVALID'],['TARGET_DATE_AFTER_INCLUSIVE_END',f=>{f.rows.assignment.effective_end_date='2026-11-01';},'TARGET_DATE_INTERVAL'],['FUTURE_IDENTITY_ASOF',f=>f.query.asOf='2026-11-03T00:00:00Z','TARGET_AUTH_EXPIRED_OR_FUTURE']];
for(const[id,mutate,expected]of targetNegatives){const f=F.employmentCase();mutate(f);let error=null;try{F.target(f);}catch(e){error=e.message;}assert(error===expected,'Target negative '+id+' got '+error);negativeResults.push({caseId:id,error});counts.targetNegatives++;}
const modelReceipt=F.prepare(F.fixture('HR_NATIVE','CREATE_NATIVE_PERSON')).receipt;
const wrongSubject=F.clone(modelReceipt);wrongSubject.subjectPopulation.subject.authUserRowVersion=71;assert(!validate('AdmissionReceipt',wrongSubject),'Target population permits acting Auth field');counts.negativeSchemas++;
const six=F.clone(F.employmentCase().query);six.expectedVersions.authAccessRevision=113;assert(!validate('TargetQuery',six),'Target expected People4 accepts Auth6');counts.negativeSchemas++;
// Exact observed SQL column/type registry. Any finding is fatal (not merely sourceIssues telemetry).
const ddl=fs.readFileSync(path.join(D.BE,'dwp-people-server/src/main/resources/db/migration/V1__create_workforce_projection.sql'),'utf8');
const columns={};for(const m of ddl.matchAll(/CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\n\);/g)){columns[m[1]]={};for(const line of m[2].split('\n')){const c=line.match(/^\s{4}(\w+)\s+(BIGSERIAL|BIGINT|UUID|VARCHAR\(\d+\)|TIMESTAMPTZ|INTEGER|DATE|BOOLEAN|NUMERIC\([^)]*\)|JSONB)/);if(c)columns[m[1]][c[1]]=c[2];}}
const authDdl=fs.readFileSync(path.join(D.BE,'dwp-auth-server/src/main/resources/db/migration/V4__add_identity_access_governance.sql'),'utf8');
columns.com_users={};
for(const m of authDdl.matchAll(/ADD COLUMN\s+(\w+)\s+(BIGINT|UUID)/g))columns.com_users[m[1]]=m[2];
for(const filename of ['V41__harden_hcm_entity_boundaries.sql','V49__add_native_legal_employer_public_id.sql']){const text=fs.readFileSync(path.join(D.BE,'dwp-people-server/src/main/resources/db/migration',filename),'utf8');for(const m of text.matchAll(/ALTER TABLE\s+(?:public\.)?(\w+)\s*([\s\S]*?);/g))for(const c of m[2].matchAll(/ADD COLUMN\s+(\w+)\s+(UUID|BIGINT)/g))columns[m[1]][c[1]]=c[2];}
const sourceDoc=fs.existsSync(path.join(D.DIR,D.PREFIX+'.source-contract.json'))?D.read(path.join(D.DIR,D.PREFIX+'.source-contract.json')):null;
// The eight new owner operation deltas are schema compiled and concretely A/B exercised;
// source/decision truth is still synthetic and producer publication explicitly OPEN.
const ownerApiResults=[];
if(sourceDoc){for(const op of sourceDoc.operations){for(const side of ['request','response']){const schema={$schema:'http://json-schema.org/draft-07/schema#',$id:D.U+'OwnerOperation:'+op.id+':'+side,...op[side]};assert(ajv.validateSchema(schema),'Owner API Draft07 '+op.id+'/'+side);ajv.addSchema(schema);assert(typeof ajv.getSchema(schema.$id)==='function','Owner API compile '+op.id+'/'+side);counts.compiledDefinitions++;}}
 for(const letter of ['A','B']){const f=F.fixture('HR_NATIVE','CREATE_NATIVE_PERSON',letter),im=F.fixture('IMPORT','CREATE_NATIVE_PERSON',letter),ad=F.prepare(f),workspace={publicId:f.request.source.workspacePublicId,version:2,status:'AUTHORIZED',businessPurpose:f.request.source.businessPurpose,personMutation:f.request.personMutation},batch={publicId:im.request.source.acceptedBatchPublicId,version:im.request.source.batchVersion,status:'ACCEPTED',mapping:im.request.source.mappingVersion,importMode:'NATIVE_STAGED',items:[{itemPublicId:im.request.source.itemPublicId,itemVersion:im.request.source.itemVersion,sourceRecordKey:im.request.source.sourceRecordKey,personMutation:im.request.personMutation}]};
  const payloads=[f.request,{receiptPublicId:ad.receipt.receiptPublicId,expectedOwnerRevision:ad.receipt.ownerRevision,purpose:'PERSON_ADMIT'},{kind:'PERSON',personPublicId:ad.receipt.personPublicId,expectedPersonVersion:ad.receipt.personVersion,purpose:'PERSON_ADMIT'},{requestPublicId:f.request.requestPublicId,businessPurpose:f.request.source.businessPurpose,personMutation:f.request.personMutation},{workspacePublicId:workspace.publicId,expectedVersion:workspace.version,decisionReceipt:f.request.source.decisionReceipt},{workspacePublicId:workspace.publicId,expectedVersion:workspace.version,reasonCode:'MANUAL_CANCEL'},{requestPublicId:im.request.requestPublicId,mapping:im.request.source.mappingVersion,importMode:'NATIVE_STAGED',items:[{sourceRecordKey:im.request.source.sourceRecordKey,personMutation:im.request.personMutation}]},{batchPublicId:batch.publicId,expectedBatchVersion:batch.version,decisionReceipt:f.request.source.decisionReceipt}];
  const responses=[ad.receipt,ad.receipt,ad.receipt.subjectPopulation,{...workspace,status:'DRAFT'},{...workspace,version:3},{...workspace,status:'CANCELLED',version:3},{...batch,status:'VALIDATED'},{...batch,version:4}];
  sourceDoc.operations.forEach((op,i)=>{assert(ajv.getSchema(D.U+'OwnerOperation:'+op.id+':request')(payloads[i]),'Concrete owner request '+letter+'/'+op.id);assert(ajv.getSchema(D.U+'OwnerOperation:'+op.id+':response')(responses[i]),'Concrete owner response '+letter+'/'+op.id);ownerApiResults.push({fixture:letter,operationId:op.id,request:payloads[i],response:responses[i],sourceTruth:'SYNTHETIC_API_VALID_BOUNDARY_NOT_NATIVE_PRODUCER_OR_DECISION_APPROVAL'});});
 }
}
const executableRemoved=[];function scan(v,pointer=''){if(Array.isArray(v))v.forEach((x,i)=>scan(x,pointer+'/'+i));else if(v&&typeof v==='object')Object.entries(v).forEach(([k,x])=>{if(D.AUTH.test(k))executableRemoved.push({pointer:pointer+'/'+k,value:k});scan(x,pointer+'/'+k);});else if(typeof v==='string'&&(D.AUTH.test(v)||D.STALE.test(v)))executableRemoved.push({pointer,value:v});}
scan(effective);assert(executableRemoved.length===0,'Executable flat subject Auth/mandatory ATS receipt references remain '+JSON.stringify(executableRemoved));
const modernApiResults=[];
for(const letter of ['A','B']){const f=F.fixture('HR_NATIVE','CREATE_NATIVE_PERSON',letter),r=F.prepare(f),contingent=effective.operationDeltas.find(o=>o.operationId==='modern.contingent.worker.proposal.create'),onboarding=effective.operationDeltas.find(o=>o.operationId==='modern.onboarding.journey.assign');
 const header={'Idempotency-Key':'native-v2:'+letter,'X-Correlation-ID':f.traceId};
 const workerProposal={personToken:f.ownerSourceRow.vaultSubjectKey?F.hash({vaultSubjectKey:f.ownerSourceRow.vaultSubjectKey}):null,classificationPolicyVersionId:F.id(800),workerType:'CONTINGENT',positionPublicId:F.id(801),organizationPublicId:F.id(802),effectiveFrom:'2026-11-10',effectiveTo:'2027-02-10',sourceSystemId:F.id(803),sourceRecordKey:'NATIVE-WORKSPACE-'+f.request.source.workspacePublicId,personAdmissionReceiptId:r.receipt.receiptPublicId,identityDisposition:'CREATE_NEW_WORKER',reusePolicyVersionId:F.id(804),expectedAdmissionRevision:r.receipt.ownerRevision};
 const cw={pathParameters:{},queryParameters:{},headers:header,body:{workerProposal}};
 const jo={pathParameters:{},queryParameters:{},headers:{...header,'Idempotency-Key':header['Idempotency-Key']+':onboarding'},body:{templateVersionId:F.id(805),dueAt:'2026-11-08T17:00:00Z',calendarVersionId:F.id(806),assigneeBindings:[{taskKey:'HR_PREHIRE_REVIEW',principalPublicId:f.actorBinding.principalPublicId}],subject:{kind:'PREHIRE_PERSON',personAdmissionReceiptId:r.receipt.receiptPublicId,expectedAdmissionRevision:r.receipt.ownerRevision},identityAsOf:f.now,onboardingZone:letter==='A'?'Europe/London':'America/New_York',tzdbVersion:'2026a'}};
 for(const [op,request]of [[contingent,cw],[onboarding,jo]]){assert(ajv.getSchema('urn:hrm-native-successor:'+op.requestSchema.schemaId)(request),'Modern concrete API '+letter+'/'+op.operationId);assert(r.calls.ats===0&&r.calls.targetAuth===0,'Modern native fixture requires ATS/target Auth');modernApiResults.push({letter,operationId:op.operationId,request,nativeReceipt:r.receipt.receiptPublicId,prerequisites:'Synthetic explicit owner-issued classification/position/org/source/reuse/template/calendar fixtures. Template task HR_PREHIRE_REVIEW binds actual HR_AGENT Auth principal. No candidate/account/worker for target. Real owner PEP/refetch publication OPEN.',nativeHttpExecuted:false});}
 const wrong=F.clone(jo);wrong.body.subject.candidateCaseId=F.id(899);assert(!ajv.getSchema('urn:hrm-native-successor:'+onboarding.requestSchema.schemaId)(wrong),'PREHIRE common subject still admits ATS candidate selector');counts.negativeSchemas++;
}
for(const plan of effective.nativeIdentityPreparation.sourceWritePlans)for(const c of plan.columns)if(c.responseSchemaPath){let schema=D.schemaDefinitions().SubjectPopulation;for(const part of c.responseSchemaPath){if(schema?.$ref)schema=D.schemaDefinitions()[schema.$ref.slice(D.U.length)];schema=part.startsWith('oneOf:')?schema?.oneOf?.[Number(part.slice(6))]:schema?.properties?.[part];}assert(!!schema,'Native write owner source leaf absent '+c.column+'/'+c.responseSchemaPath.join('.'));}
function sourceErrors(doc){const issues=[];if(!doc)return[{reason:'SOURCE_CONTRACT_MISSING'}];for(const row of doc.nativeColumnBindings){const actual=columns[row.table]?.[row.column];if(actual!==row.sqlType)issues.push({target:row.target,reason:'ACTUAL_COLUMN_TYPE_MISMATCH',actual,planned:row.sqlType});const root=doc.schemaRootForTarget[row.root];let schema=D.schemaDefinitions()[root?.definition];for(const part of root?.path||[]){schema=part.startsWith('oneOf:')?schema?.oneOf?.[Number(part.slice(6))]:schema?.properties?.[part];}for(const part of row.target.split('.').slice(1)){if(schema?.$ref)schema=D.schemaDefinitions()[schema.$ref.slice(D.U.length)];schema=schema?.properties?.[part];}if(schema?.anyOf)schema=schema.anyOf.find(x=>x.type!=='null');if(!schema||schema.type!==row.jsonType||row.jsonFormat&&schema.format!==row.jsonFormat)issues.push({target:row.target,reason:'RECURSIVE_SCHEMA_LEAF_TYPE_OR_FORMAT_MISMATCH',schema,plannedType:row.jsonType});if(row.jsonType==='integer'&&!['BIGINT','INTEGER'].includes(actual)||row.jsonFormat==='uuid'&&actual!=='UUID')issues.push({target:row.target,reason:'NATIVE_JSON_TYPE_SPACE_MISMATCH'});if(row.entityType&&row.sqlType!=='UUID')issues.push({target:row.target,reason:'PUBLIC_UUID_ENTITY_WRONG_SPACE'});}
 const expectedParents=[['ppl_workers','person_id','ppl_persons','person_id'],['ppl_work_relationships','worker_id','ppl_workers','worker_id'],['ppl_assignments','work_relationship_id','ppl_work_relationships','work_relationship_id']];for(const tuple of expectedParents)if(!doc.parentJoins.some(x=>jsonSame(x,tuple)))issues.push({reason:'NATIVE_PARENT_BINDING_MISSING',tuple});
 if(doc.targetAuthLookup!==false||doc.subjectUsesActingAuthStamps!==false)issues.push({reason:'TARGET_AUTH_IDENTITY_SHADOW'});
 if(doc.commonReceiptCandidateRequired!==false||doc.atsFkBranchOnly!==true)issues.push({reason:'MANDATORY_ATS_COUPLING'});
 return issues;
}
assert(jsonSame(sourceDoc,require('./'+D.PREFIX+'.source-contract.cjs').build()),'Saved exact source/operation contracts differ from generator');
sourceIssues.push(...sourceErrors(sourceDoc));counts.sourceColumns=sourceDoc?.nativeColumnBindings.length||0;assert(sourceIssues.length===0,'Exact native source/column/type/parent issues '+JSON.stringify(sourceIssues));
if(sourceDoc){const mutations=[['NATIVE_COLUMN_TYPE_TEXT',x=>x.nativeColumnBindings.find(r=>r.sqlType==='BIGINT').sqlType='TEXT'],['PUBLIC_UUID_FROM_INTERNAL_ID',x=>{const r=x.nativeColumnBindings.find(r=>r.table==='ppl_workers'&&r.column==='public_id');r.column='worker_id';r.sqlType='BIGINT';}],['MISSING_PARENT_RELATION',x=>x.parentJoins.pop()],['ACTOR_STAMPS_IN_TARGET',x=>x.subjectUsesActingAuthStamps=true],['COMMON_ATS_REQUIRED',x=>x.commonReceiptCandidateRequired=true],['TARGET_AUTH_LOOKUP_REQUIRED',x=>x.targetAuthLookup=true]];for(const[id,mutate]of mutations){const doc=F.clone(sourceDoc);mutate(doc);assert(sourceErrors(doc).length>0,'Semantic source mutation undetected '+id);counts.semanticMutations++;negativeResults.push({caseId:id,actualSourceIssues:sourceErrors(doc)});}}
const after=tracked.map(D.pin),drift=snapshotStable(before);assert(drift.length===0,'Exact SHA/decimal-ns before/after drift');
const head=spawnSync('git',['rev-parse','HEAD'],{cwd:D.BE,encoding:'utf8'});assert(head.status===0,'Read-only integration HEAD unavailable');
const report={status:failures.length?'AUTHOR_CHECK_FAIL':'AUTHOR_CHECK_PASS_NOT_G3',authorOnly:true,startedAt,completedAt:new Date().toISOString(),actualArgv:process.argv,engine:{package:req.resolve('ajv'),version:req('ajv/package.json').version,draft:'FULL_DRAFT07_LOCAL_PROJECTION',coercion:false,defaults:false,removeAdditional:false},integrationHead:head.stdout.trim(),wholeWorktreeApproved:false,counts,failures,sourceIssues,executableRemoved,sourcePinsBefore:before,sourcePinsAfter:after,pinDrift:drift,negativeResults,recordOutputs:records,targetOutputs:targetRecords,ownerApiResults,modernApiResults,nativeAuthExecuted:false,nativeDbExecuted:false,authorityOrPepProven:false,domainCrudExecuted:false,canonicalLineagePass:false,independentScopeApproved:false,all83SourceClosure:false,gateDecision:'UNCHANGED_CLOSED'};
const recordDoc={status:report.status,sourceBoundary:'ACTUAL_AUTHOR_MODEL_OUTPUTS_FROM_CONCRETE_FIXTURES_NOT_NATIVE_DB_HTTP_AUTH',records:report.recordOutputs,targets:report.targetOutputs,ownerApi:report.ownerApiResults,modernApi:report.modernApiResults};
report.recordOutputsDigest=D.sha(JSON.stringify(recordDoc));report.recordOutputsFile=D.PREFIX+'.record-outputs.json';
if(process.argv.includes('--emit-evidence')){const summary={...report};for(const k of ['recordOutputs','targetOutputs','ownerApiResults','modernApiResults'])delete summary[k];summary.actualOutputCounts={admission:records.length,targets:targetRecords.length,ownerApi:ownerApiResults.length,modernApi:modernApiResults.length};D.emit('evidence.json',summary);}
else if(process.argv.includes('--emit-records-chunk')){const index=Number(process.argv[process.argv.indexOf('--emit-records-chunk')+1]),lines=JSON.stringify(recordDoc,null,2).split('\n'),size=1100,start=index*size,chunk=lines.slice(start,start+size);if(!chunk.length)throw Error('Record chunk out of range');const last=start+size>=lines.length;process.stdout.write('*** Begin Patch\n'+(index?'*** Update File: ':'*** Add File: ')+path.join(D.DIR,D.PREFIX+'.record-outputs.json')+'\n'+(index?'@@\n-__HRM_NATIVE_V2_RECORDS_CONTINUE__\n':'')+chunk.map(s=>'+'+s).join('\n')+'\n'+(last?'':'+__HRM_NATIVE_V2_RECORDS_CONTINUE__\n')+'*** End Patch\n');}
else if(process.argv.includes('--emit-records'))D.emit('record-outputs.json',recordDoc);else console.log(JSON.stringify(report));
process.exitCode=failures.length?1:0;
