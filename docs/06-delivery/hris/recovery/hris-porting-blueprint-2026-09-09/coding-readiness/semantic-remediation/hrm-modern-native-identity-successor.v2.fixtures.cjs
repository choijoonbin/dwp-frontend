'use strict';
// Concrete schema/model fixtures, NOT native authority or SQL runtime. No filesystem writes.
const D=require('./hrm-modern-native-identity-successor.v2.design.cjs');
const C=x=>JSON.parse(JSON.stringify(x)),U=D.U;
const id=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0');
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const hash=x=>D.sha(JSON.stringify(canonical(x)));
function artifact(owner,n,version=1,payload={enabled:true}){return{reference:{owner,publicId:id(n),version,schemaVersion:'fixture-'+owner+'-v2',digest:hash(payload)},payload};}
const now='2026-11-02T10:00:00Z',expiry='2026-11-02T10:00:20Z';
function fixture(kind,mode,letter='A',importMode='NATIVE_STAGED'){
 const offset=letter==='A'?0:100,tenantId=letter==='A'?92001:92002;
 const policy=artifact('Configuration',30+offset,4,{allowedSourceKinds:['HR_NATIVE','ATS_CASE','IMPORT'],createAllowed:true,reuseAllowed:true,version:4});
 const field=artifact('Configuration',31+offset,8,{allowedFields:['PERSON_IDENTITY','ADMISSION_RESULT','EMPLOYMENT_CONTEXT'],version:8});
 const evidence=artifact('Privacy',32+offset,2,{vaultSubjectKey:'fixture-person-'+letter,consentedPurposes:['PERSON_ADMIT'],verified:true});
 const decision=artifact('People',33+offset,3,{businessPurpose:'CONTINGENT_CREATE',authorized:true,workspacePublicId:id(34+offset),workspaceVersion:2});
 const mapping=artifact('Integration',35+offset,6,{fields:{personKey:'normalized.employeeKey',displayName:'normalized.displayName'},version:6});
 const source=kind==='HR_NATIVE'?{kind,workspacePublicId:id(34+offset),workspaceVersion:2,decisionReceipt:decision.reference,businessPurpose:'CONTINGENT_CREATE'}:kind==='ATS_CASE'?{kind,candidateCasePublicId:id(36+offset),candidateCaseVersion:7,requisitionPublicId:id(37+offset),sourceSystemPublicId:id(38+offset),sourceCandidateKey:'ATS-'+letter,candidatePersonToken:hash({vaultSubjectKey:evidence.payload.vaultSubjectKey}),consentReceipt:evidence.reference}:{kind,acceptedBatchPublicId:id(39+offset),batchVersion:3,itemPublicId:id(40+offset),itemVersion:5,mappingVersion:mapping.reference,sourceRecordKey:'IMPORT-'+letter,importMode};
 const mutation=mode==='CREATE_NATIVE_PERSON'?{disposition:mode,facts:{personKey:'PERSON-'+letter,displayName:'Fixture native person '+letter,preferredLocale:letter==='A'?'en-US':'fr-CA'},identityEvidence:evidence.reference}:{disposition:mode,existingPersonPublicId:id(42+offset),expectedPersonVersion:19,identityEvidence:evidence.reference};
 const request={requestPublicId:id(41+offset),source,personMutation:mutation,admissionPolicy:policy.reference};
 const actorBinding={tenantId,userId:80001+offset,principalPublicId:id(1+offset),personPublicId:id(2+offset),identityPlane:'TENANT',status:'ACTIVE',userRowVersion:71,accessRevision:113,capturedAt:now,expiresAt:expiry};
 const actorAuthority={tenantId,principalPublicId:actorBinding.principalPublicId,authVersions:{userRowVersion:71,accessRevision:113},purpose:'PERSON_ADMIT',audience:'HRIS_HRM',appEntitled:true,sodAllowed:true,stepUpSatisfied:true,permissionRevision:17,populationPolicy:policy.reference,fieldPolicy:field.reference,authorityReceiptPublicId:id(3+offset),issuedAt:now,expiresAt:expiry};
 const personRow={person_id:60001+offset,tenant_id:tenantId,public_id:id(42+offset),version:mode==='CREATE_NATIVE_PERSON'?0:19,lifecycle_state:'ACTIVE',person_key:'PERSON-'+letter,display_name:'Fixture native person '+letter};
 const sourceRow={tenant_id:tenantId,source:C(source),status:'AUTHORIZED',vaultSubjectKey:evidence.payload.vaultSubjectKey,normalizedPersonMutation:C(mutation),aggregate_version:kind==='HR_NATIVE'?2:kind==='ATS_CASE'?7:5};
 const creationPopulation={tenantId,source:C(source),purpose:'PERSON_ADMIT',populationPolicy:policy.reference,fieldPolicy:field.reference,decisionRevision:23,authorized:true,expiresAt:expiry};
 const ownerSubjectPopulation={tenantId,ownerSnapshotPublicId:id(44+offset),subject:{kind:'PERSON',personPublicId:personRow.public_id,personVersion:personRow.version,personState:personRow.lifecycle_state,capturedAt:now},populationPolicy:policy.reference,fieldPolicy:field.reference,purpose:'PERSON_ADMIT',decisionRevision:27,authorizedFields:['PERSON_IDENTITY','ADMISSION_RESULT'],expiresAt:expiry};
 return{caseId:kind+'-'+mode+'-'+letter+'-'+importMode,scope:'CONCRETE_SYNTHETIC_API_OWNER_ROW_FIXTURE_NOT_NATIVE_AUTH_OR_DB',now,request,actorBinding,actorAuthority,creationPopulation,ownerSubjectPopulation,ownerSubjectAuthorized:true,ownerArtifacts:[policy,field,evidence,decision,mapping],ownerSourceRow:sourceRow,ownerPersonRow:personRow,ownerReturning:{...personRow},ownerReceiptReturning:{public_id:id(43+offset),owner_revision:1,recorded_at:now},ownerSnapshotPublicId:id(44+offset),optional:{atsInstalled:kind==='ATS_CASE',connectorInstalled:importMode==='OPTIONAL_CONNECTOR',admissionAdapterPresent:true,targetAdapterPresent:true,actorAdapterPresent:true},targetAuthAccountExists:false,traceId:id(99+offset),expected:{atsCalls:kind==='ATS_CASE'?1:0,connectorCalls:kind==='IMPORT'&&importMode==='OPTIONAL_CONNECTOR'?1:0,targetAuthCalls:0,personVersion:personRow.version,actorAuthStampsNotSubject:true}};
}
function document(){return{status:'AUTHOR_ONLY_CONCRETE_FIXTURES_NOT_NATIVE_PG_HTTP_OR_AUTH',cases:['A','B'].flatMap(l=>['HR_NATIVE','ATS_CASE','IMPORT'].flatMap(k=>['CREATE_NATIVE_PERSON','REUSE_NATIVE_PERSON'].map(m=>fixture(k,m,l)))),optionalConnectorCase:fixture('IMPORT','CREATE_NATIVE_PERSON','B','OPTIONAL_CONNECTOR'),negativeBoundaryCases:negativeDefinitions().map(x=>({caseId:x.id,expectedError:x.error,apiPayload:'Mutated concrete case; schema validation recorded before model execution',scope:'AUTHOR_G3_BOUNDARY_MODEL_NOT_PRODUCTION_AUTH'})),all83RequestWitnessBoundary:'Inherited operation schema witnesses are shape only; concrete cases cover bounded admission/target source guards, not83 domain journeys.'};}
function fail(code){throw Error(code);}
function same(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
function fetchArtifact(f,reference){const found=f.ownerArtifacts.find(x=>x.reference.owner===reference.owner&&x.reference.publicId===reference.publicId);if(!found)fail('OWNER_ARTIFACT_MISSING');if(!same(found.reference,reference)||hash(found.payload)!==reference.digest)fail('ARTIFACT_VERSION_OR_DIGEST_STALE');return found.payload;}
function acting(f,calls){
 if(!f.optional.actorAdapterPresent||!f.optional.admissionAdapterPresent||!f.optional.targetAdapterPresent)fail('MISSING_ADAPTER');
 const b=f.actorBinding,a=f.actorAuthority;
 if(a.tenantId!==b.tenantId||a.principalPublicId!==b.principalPublicId)fail('ACTOR_TENANT_OR_PRINCIPAL');
 if(b.status!=='ACTIVE'||b.identityPlane!=='TENANT')fail('ACTOR_REVOKED');
 if(!same(a.authVersions,{userRowVersion:b.userRowVersion,accessRevision:b.accessRevision}))fail('ACTOR_AUTH_STALE');
 if(new Date(a.expiresAt)<=new Date(f.now)||new Date(b.expiresAt)<=new Date(f.now))fail('ACTOR_EXPIRED');
 if(a.purpose!=='PERSON_ADMIT'||a.audience!=='HRIS_HRM'||!a.appEntitled||!a.sodAllowed||!a.stepUpSatisfied)fail('ACTOR_PURPOSE_OR_SOD');
 if(new Date(a.issuedAt)>new Date(f.now)||new Date(b.capturedAt)>new Date(f.now))fail('ACTOR_FUTURE_CAPTURE');
 calls.actorAuth++;
 const policy=fetchArtifact(f,a.populationPolicy),field=fetchArtifact(f,a.fieldPolicy);
 if(!field.allowedFields.includes('PERSON_IDENTITY'))fail('FIELD_POLICY_DENIED');
 return{policy,field};
}
function source(f,calls){
 const s=f.request.source,r=f.ownerSourceRow;
 if(s.kind==='ATS_CASE'&&!f.optional.atsInstalled)fail('ATS_DISABLED');
 if(s.kind==='IMPORT'&&s.importMode==='OPTIONAL_CONNECTOR'&&!f.optional.connectorInstalled)fail('CONNECTOR_DISABLED');
 if(s.kind==='ATS_CASE')calls.ats++;
 if(s.kind==='IMPORT'&&s.importMode==='OPTIONAL_CONNECTOR')calls.connector++;
 if(r.tenant_id!==f.actorAuthority.tenantId||!same(r.source,s)||r.status!=='AUTHORIZED')fail('SOURCE_TENANT_VERSION_OR_PARENT');
 if(s.kind==='HR_NATIVE'){const decision=fetchArtifact(f,s.decisionReceipt);if(!decision.authorized||decision.businessPurpose!==s.businessPurpose||decision.workspacePublicId!==s.workspacePublicId||decision.workspaceVersion!==s.workspaceVersion)fail('NATIVE_DECISION_MISMATCH');}
 if(s.kind==='ATS_CASE')fetchArtifact(f,s.consentReceipt);
 if(s.kind==='IMPORT'){fetchArtifact(f,s.mappingVersion);if(!same(r.normalizedPersonMutation,f.request.personMutation))fail('IMPORT_NORMALIZED_MUTATION_MISMATCH');}
 return r;
}
function prepare(f){
 const calls={actorAuth:0,ats:0,connector:0,targetAuth:0,peopleTarget:0,personInsert:0,workerWrites:0,authRelinks:0,grants:0},a=f.actorAuthority,m=f.request.personMutation;
 try{
  const {policy}=acting(f,calls),cp=f.creationPopulation;
  if(!cp.authorized||cp.tenantId!==a.tenantId||!same(cp.source,f.request.source)||cp.purpose!=='PERSON_ADMIT'||!same(cp.populationPolicy,a.populationPolicy)||!same(cp.fieldPolicy,a.fieldPolicy)||new Date(cp.expiresAt)<=new Date(f.now))fail('SOURCE_POPULATION_DENIED');
  if(!same(a.populationPolicy,f.request.admissionPolicy))fail('ADMISSION_POLICY_MISMATCH');
  fetchArtifact(f,f.request.admissionPolicy);
  if(!policy.allowedSourceKinds.includes(f.request.source.kind))fail('SOURCE_KIND_POLICY_DENIED');
  const r=source(f,calls),evidence=fetchArtifact(f,m.identityEvidence);
  if(!evidence.verified||!evidence.consentedPurposes.includes('PERSON_ADMIT')||evidence.vaultSubjectKey!==r.vaultSubjectKey)fail('PRIVACY_IDENTITY_MISMATCH');
  const normalizedRequest=C(f.request),inputDigest=hash(normalizedRequest);
  let person;
  if(m.disposition==='CREATE_NATIVE_PERSON'){
   if(!policy.createAllowed)fail('CREATE_POLICY_DENIED');
   if(!same(r.normalizedPersonMutation,m))fail('NORMALIZED_MUTATION_MISMATCH');
   person=f.ownerReturning;if(!f.replay)calls.personInsert++;
   if(person.tenant_id!==a.tenantId||person.person_key!==m.facts.personKey||person.display_name!==m.facts.displayName||person.public_id===f.traceId||person.public_id===a.principalPublicId)fail('RETURNING_NATIVE_IDENTITY_MISMATCH');
  }else{
   if(!policy.reuseAllowed||!f.optional.targetAdapterPresent)fail('TARGET_ADAPTER_OR_REUSE_POLICY');
   person=f.ownerPersonRow;calls.peopleTarget++;
   if(person.tenant_id!==a.tenantId||person.public_id!==m.existingPersonPublicId||person.version!==m.expectedPersonVersion||person.lifecycle_state!=='ACTIVE')fail('TARGET_PEOPLE_STALE_OR_TENANT');
  }
  if(person.lifecycle_state!=='ACTIVE')fail('TARGET_PERSON_STATE');
  // Separate current People owner target decision, not inferred from actor/source workspace proof.
  const sp=f.ownerSubjectPopulation;
  if(!f.ownerSubjectAuthorized||!f.optional.targetAdapterPresent||sp.tenantId!==a.tenantId||sp.subject.personPublicId!==person.public_id||sp.subject.personVersion!==person.version||sp.purpose!=='PERSON_ADMIT'||!same(sp.populationPolicy,a.populationPolicy)||!same(sp.fieldPolicy,a.fieldPolicy)||!sp.authorizedFields.includes('PERSON_IDENTITY')||new Date(sp.expiresAt)<=new Date(f.now))fail('TARGET_POPULATION_DENIED');
  const subjectPopulation=C(sp);
  if(f.replay){if(!same(f.replay.normalizedRequest,normalizedRequest)||f.replay.receipt.inputDigest!==inputDigest)fail('CHANGED_REQUEST_REPLAY');return{calls,receipt:C(f.replay.receipt),replayed:true,normalizedRequest};}
  const receipt={receiptPublicId:f.ownerReceiptReturning.public_id,tenantId:a.tenantId,requestPublicId:f.request.requestPublicId,source:C(f.request.source),personPublicId:person.public_id,personVersion:person.version,disposition:m.disposition==='CREATE_NATIVE_PERSON'?'CREATED_NATIVE_PERSON':'REUSED_NATIVE_PERSON',ownerRevision:f.ownerReceiptReturning.owner_revision,recordedAt:f.ownerReceiptReturning.recorded_at,actorAuthority:C(a),subjectPopulation,inputDigest};
  const event={eventPublicId:id(90+(a.tenantId===92001?0:100)),eventType:'People.NativePersonAdmitted.proposal.v2',aggregatePublicId:receipt.receiptPublicId,aggregateVersion:receipt.ownerRevision,personPublicId:person.public_id,personVersion:person.version,sourceKind:f.request.source.kind,actorAuthorityReceiptPublicId:a.authorityReceiptPublicId,recordedAt:receipt.recordedAt};
  return{calls,receipt,event,normalizedRequest,replayed:false,columnSources:{'ppl_person_admission_receipts.person_id':m.disposition==='CREATE_NATIVE_PERSON'?'owner INSERT RETURNING ppl_persons.person_id':'tenant-bound SELECT existing ppl_persons.person_id','ppl_person_admission_receipts.person_public_id':m.disposition==='CREATE_NATIVE_PERSON'?'owner INSERT RETURNING ppl_persons.public_id':'tenant-bound existing ppl_persons.public_id','ppl_person_admission_receipts.person_version':m.disposition==='CREATE_NATIVE_PERSON'?'owner INSERT RETURNING ppl_persons.version':'tenant-bound existing ppl_persons.version','ppl_person_admission_receipts.actor_user_row_version':'current ACTING Auth com_users.version','ppl_person_admission_receipts.actor_access_revision':'current ACTING Auth com_users.access_revision','sys_people_outbox_events.aggregate_id':'actual admission receipt RETURNING public_id, NOT person/candidate/correlation ID'}};
 }catch(e){e.calls=calls;throw e;}
}
function employmentCase(){const f=fixture('HR_NATIVE','REUSE_NATIVE_PERSON','B'),person=f.ownerPersonRow;return{now:f.now,actorAuthority:{...f.actorAuthority,purpose:'ONBOARDING_BIND'},actorBinding:f.actorBinding,query:{kind:'EMPLOYMENT',selector:{workerPublicId:id(150),workRelationshipPublicId:id(151),assignmentPublicId:id(152)},expectedVersions:{personVersion:19,workerVersion:29,relationshipVersion:31,assignmentVersion:37},asOf:'2026-11-02T09:59:50Z',purpose:'ONBOARDING_BIND'},rows:{person,worker:{public_id:id(150),person_public_id:person.public_id,version:29},relationship:{public_id:id(151),worker_public_id:id(150),legal_employer_public_id:id(153),version:31,start_date:'2026-01-01',end_date:'2026-11-02'},assignment:{public_id:id(152),relationship_public_id:id(151),version:37,effective_start_date:'2026-01-01',effective_end_date:'2026-11-02',effective_sequence:2,work_zone:'America/New_York'},higherCorrectionExists:false,overlapExists:false},targetAuthAccountExists:false,targetAdapterPresent:true,populationAllowed:true,fieldAllowed:true,purposeAllowed:true};}
function civilDate(at,zone){try{return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));}catch(e){fail('TARGET_ZONE_INVALID');}}
function target(f){
 const a=f.actorAuthority,q=f.query,r=f.rows,calls={targetAuth:0,peopleTarget:0};
 if(!f.targetAdapterPresent)fail('TARGET_ADAPTER_MISSING');
 if(!f.populationAllowed||!f.fieldAllowed||!f.purposeAllowed||a.purpose!==q.purpose||!a.sodAllowed)fail('TARGET_PEP_DENIED');
 if(a.authVersions.userRowVersion!==f.actorBinding.userRowVersion||a.authVersions.accessRevision!==f.actorBinding.accessRevision)fail('ACTOR_AUTH_STALE');
 if(new Date(a.expiresAt)<=new Date(f.now)||new Date(q.asOf)>new Date(f.now))fail('TARGET_AUTH_EXPIRED_OR_FUTURE');
 if(a.tenantId!==r.person.tenant_id)fail('TARGET_TENANT');
 calls.peopleTarget++;
 if(r.worker.person_public_id!==r.person.public_id||r.relationship.worker_public_id!==r.worker.public_id||r.assignment.relationship_public_id!==r.relationship.public_id)fail('TARGET_NATIVE_PARENT');
 if(q.selector.workerPublicId!==r.worker.public_id||q.selector.workRelationshipPublicId!==r.relationship.public_id||q.selector.assignmentPublicId!==r.assignment.public_id)fail('TARGET_SELECTOR');
 const v={personVersion:r.person.version,workerVersion:r.worker.version,relationshipVersion:r.relationship.version,assignmentVersion:r.assignment.version};
 if(!same(v,q.expectedVersions))fail('TARGET_PEOPLE_VERSION');
 if(r.higherCorrectionExists||r.overlapExists)fail('TARGET_SEQUENCE_OR_OVERLAP');
 const day=civilDate(q.asOf,r.assignment.work_zone);
 if(day<r.relationship.start_date||r.relationship.end_date&&day>r.relationship.end_date||day<r.assignment.effective_start_date||r.assignment.effective_end_date&&day>r.assignment.effective_end_date)fail('TARGET_DATE_INTERVAL');
 return{calls,subject:{kind:'EMPLOYMENT',personPublicId:r.person.public_id,selector:C(q.selector),versions:v,legalEmployerPublicId:r.relationship.legal_employer_public_id,relationshipStartDate:r.relationship.start_date,relationshipEndDate:r.relationship.end_date,assignmentStartDate:r.assignment.effective_start_date,assignmentEndDate:r.assignment.effective_end_date,effectiveSequence:r.assignment.effective_sequence,workZone:r.assignment.work_zone,asOf:q.asOf,capturedAt:f.now},actorAuthVersions:C(a.authVersions)};
}
function negativeDefinitions(){return[
 {id:'ATS_DISABLED_ZERO_CALLS',error:'ATS_DISABLED',caseKind:'ATS_CASE',mutate:f=>f.optional.atsInstalled=false},
 {id:'OPTIONAL_CONNECTOR_DISABLED_ZERO_CALLS',error:'CONNECTOR_DISABLED',caseKind:'IMPORT',connector:true,mutate:f=>f.optional.connectorInstalled=false},
 {id:'MISSING_ADAPTER_ZERO_SOURCE_CALLS',error:'MISSING_ADAPTER',mutate:f=>f.optional.admissionAdapterPresent=false},
 {id:'MISSING_TARGET_ADAPTER_ZERO_SOURCE_CALLS',error:'MISSING_ADAPTER',mutate:f=>f.optional.targetAdapterPresent=false},
 {id:'ACTOR_AUTH2_STALE',error:'ACTOR_AUTH_STALE',mutate:f=>f.actorBinding.accessRevision++},
 {id:'ACTOR_AUTH_EXPIRED',error:'ACTOR_EXPIRED',mutate:f=>f.actorAuthority.expiresAt=f.now},
 {id:'ACTOR_REVOKED',error:'ACTOR_REVOKED',mutate:f=>f.actorBinding.status='SUSPENDED'},
 {id:'SELF_PROFILE_NOT_ADMISSION_ACTION',error:'ACTOR_PURPOSE_OR_SOD',mutate:f=>f.actorAuthority.purpose='SELF_PROFILE_READ'},
 {id:'ACTOR_SOD_DENIED',error:'ACTOR_PURPOSE_OR_SOD',mutate:f=>f.actorAuthority.sodAllowed=false},
 {id:'HRIS_ENTITLEMENT_DENIED_NOT_AUTOGRANT',error:'ACTOR_PURPOSE_OR_SOD',mutate:f=>f.actorAuthority.appEntitled=false},
 {id:'CURRENT_FIELD_POLICY_DENIED',error:'FIELD_POLICY_DENIED',mutate:f=>{const x=f.ownerArtifacts.find(a=>a.reference.publicId===f.actorAuthority.fieldPolicy.publicId);x.payload.allowedFields=[];x.reference.digest=hash(x.payload);f.actorAuthority.fieldPolicy=C(x.reference);f.creationPopulation.fieldPolicy=C(x.reference);}},
 {id:'SOURCE_POPULATION_DENIED',error:'SOURCE_POPULATION_DENIED',mutate:f=>f.creationPopulation.authorized=false},
 {id:'CURRENT_TARGET_POPULATION_DENIED',error:'TARGET_POPULATION_DENIED',mutate:f=>f.ownerSubjectAuthorized=false},
 {id:'TARGET_PEOPLE_PROOF_STALE',error:'TARGET_POPULATION_DENIED',mutate:f=>f.ownerSubjectPopulation.subject.personVersion++},
 {id:'TARGET_PROOF_ACTOR_AUTH_IS_NOT_SUBJECT_VERSION',error:'TARGET_POPULATION_DENIED',mutate:f=>f.ownerSubjectPopulation.subject.personVersion=f.actorBinding.userRowVersion},
 {id:'ARTIFACT_DIGEST_TAMPER',error:'ARTIFACT_VERSION_OR_DIGEST_STALE',mutate:f=>f.ownerArtifacts[0].payload.createAllowed=false},
 {id:'SOURCE_PARENT_OR_VERSION_MISMATCH',error:'SOURCE_TENANT_VERSION_OR_PARENT',mutate:f=>f.ownerSourceRow.source.workspaceVersion++},
 {id:'SOURCE_TENANT_MISMATCH',error:'SOURCE_TENANT_VERSION_OR_PARENT',mutate:f=>f.ownerSourceRow.tenant_id++},
 {id:'PRIVACY_SUBJECT_MISMATCH',error:'PRIVACY_IDENTITY_MISMATCH',mutate:f=>f.ownerSourceRow.vaultSubjectKey='different-person'},
 {id:'NATIVE_PERSON_RETURNING_NOT_TRACE',error:'RETURNING_NATIVE_IDENTITY_MISMATCH',mutate:f=>f.ownerReturning.public_id=f.traceId},
 {id:'BODY_NORMALIZED_MUTATION_MISMATCH',error:'NORMALIZED_MUTATION_MISMATCH',mutate:f=>f.ownerSourceRow.normalizedPersonMutation.facts.displayName='changed'},
 {id:'REUSE_TARGET_PEOPLE_VERSION_STALE',error:'TARGET_PEOPLE_STALE_OR_TENANT',reuse:true,mutate:f=>f.ownerPersonRow.version++},
 {id:'REUSE_TARGET_TENANT_MISMATCH',error:'TARGET_PEOPLE_STALE_OR_TENANT',reuse:true,mutate:f=>f.ownerPersonRow.tenant_id++},
 {id:'ACTOR_AUTH_STAMP_IS_NOT_PERSON_VERSION',error:'TARGET_PEOPLE_STALE_OR_TENANT',reuse:true,mutate:f=>f.request.personMutation.expectedPersonVersion=f.actorBinding.userRowVersion},
 {id:'IMPORT_NORMALIZED_MUTATION_MISMATCH',error:'IMPORT_NORMALIZED_MUTATION_MISMATCH',caseKind:'IMPORT',mutate:f=>f.ownerSourceRow.normalizedPersonMutation.facts.personKey='other'},
 {id:'CHANGED_IMMUTABLE_REQUEST_REPLAY',error:'CHANGED_REQUEST_REPLAY',mutate:f=>{const r=prepare(f);f.replay={normalizedRequest:C(r.normalizedRequest),receipt:C(r.receipt)};f.request.requestPublicId=id(888);}},
 {id:'ACTOR_UUID_NOT_TARGET_PERSON_UUID',error:'TARGET_PEOPLE_STALE_OR_TENANT',reuse:true,mutate:f=>f.request.personMutation.existingPersonPublicId=f.actorBinding.personPublicId}
 ];}
module.exports={fixture,document,prepare,target,employmentCase,negativeDefinitions,id,hash,artifact,clone:C,now,expiry};
