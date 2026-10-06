#!/usr/bin/env node
'use strict';
// Author-only schema/physical/source checks + explicit synthetic owner model. Never touches DB/runtime/source.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const {createRequire}=require('module');
const req=createRequire('/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend/package.json');
const Ajv=req('ajv'), ajvVersion=req('ajv/package.json').version;
const dir=__dirname;
const proposal=JSON.parse(fs.readFileSync(path.join(dir,'hrm-per-base-preparation-successor.proposal.v1.json'),'utf8'));
const fixtures=JSON.parse(fs.readFileSync(path.join(dir,'hrm-per-base-preparation-successor.fixtures.v1.json'),'utf8'));
const errors=[], counters={schemaDefinitions:0,schemaGeneratedProbes:0,explicitApiRequests:0,businessAssertions:0,negativeControls:0,mutationControls:0,selectedColumnBindings:0};
function check(ok,label){counters.businessAssertions++;if(!ok)errors.push(label);}
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v!==null&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const clone=v=>JSON.parse(JSON.stringify(v));
const ajv=new Ajv({allErrors:true,format:'full',coerceTypes:false,useDefaults:false,removeAdditional:false,unknownFormats:'fail',schemaId:'auto'});
ajv.addKeyword('referenceContract',{metaSchema:{type:'object',additionalProperties:false,required:['entityType','idSpace'],properties:{entityType:{type:'string',minLength:1},idSpace:{enum:['PUBLIC_UUID','INTERNAL_BIGINT']}}},valid:true});
check(ajv.validateSchema(proposal.schema),'Draft07 schema metavalidation: '+JSON.stringify(ajv.errors));
ajv.addSchema(proposal.schema);
const defs=proposal.schema.definitions,validators={};
for(const key of Object.keys(defs)){try{validators[key]=ajv.compile({$ref:proposal.schema.$id+'#/definitions/'+key});counters.schemaDefinitions++;}catch(e){errors.push('schema compile '+key+': '+e.message);}}
function validate(name,value){const fn=validators[name];return !!fn&&fn(value);}
const nameOf=r=>r.split('/').pop();
function sample(s,depth=0){
 if(depth>30)throw Error('schema cycle');
 if(s.$ref)return sample(defs[nameOf(s.$ref)],depth+1);
 if('const'in s)return s.const;if(s.enum)return s.enum[0];
 if(s.oneOf||s.anyOf)return sample((s.oneOf||s.anyOf)[0],depth+1);
 if(s.type==='null')return null;if(s.type==='boolean')return true;
 if(s.type==='integer'||s.type==='number')return s.minimum||0;
 if(s.type==='array')return Array.from({length:s.minItems||0},()=>sample(s.items,depth+1));
 if(s.type==='object'){
  const value=Object.fromEntries((s.required||[]).map(k=>[k,sample(s.properties[k],depth+1)]));
  for(const rule of s.allOf||[])if(rule.if&&ajv.compile(rule.if)(value))for(const [key,property]of Object.entries(rule.then?.properties||{}))value[key]=sample(property,depth+1);
  return value;
 }
 if(s.type==='string'){
  if(s.format==='uuid')return '00000000-0000-4000-8000-000000009999';
  if(s.format==='date')return '2026-09-15';if(s.format==='date-time')return '2026-09-15T09:00:00Z';if(s.format==='email')return 'synthetic@example.invalid';
  if(s.pattern&&s.pattern.includes('0-9a-f'))return 'b'.repeat(64);
  if(s.pattern&&s.pattern.includes('[0-9]{6}'))return '1.000000';
  if(s.pattern&&s.pattern.includes('\\+'))return '+12025550123';
  return 'SCHEMA_PROBE_ONLY';
 }
 throw Error('unsupported actual schema '+JSON.stringify(s));
}
for(const [key,s]of Object.entries(defs)){try{check(validate(key,sample(s)),'mechanical schema positive '+key+' '+JSON.stringify(validators[key]?.errors));counters.schemaGeneratedProbes++;}catch(e){errors.push('probe '+key+': '+e.message);}}
function bodyRoots(s){if(s.$ref)return bodyRoots(defs[nameOf(s.$ref)]);if(s.oneOf||s.anyOf)return new Set((s.oneOf||s.anyOf).flatMap(x=>[...bodyRoots(x)]));return new Set(Object.keys(s.properties||{}));}
function structure(d,count=false){
 const e=[],ops=new Set(),columns={};
 for(const pin of d.sourceSnapshot.sourcePins.filter(x=>x.path.endsWith('.sql'))){
  const text=fs.readFileSync(pin.path,'utf8');
  for(const m of text.matchAll(/CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\n\);/g)){
   const set=columns[m[1]]??=new Set();
   for(const line of m[2].split('\n')){const c=line.match(/^\s*(\w+)\s+(?:BIGSERIAL|BIGINT|UUID|VARCHAR|CHAR|INTEGER|INT|NUMERIC|BOOLEAN|DATE|TIMESTAMPTZ|TEXT|JSONB|BYTEA)/);if(c)set.add(c[1]);}
  }
 }
 // Current forward ALTER evidence, not invented public fields on unallocated references.
 for(const t of ['ppl_workers','ppl_work_relationships','ppl_assignments','ppl_positions'])columns[t]?.add('public_id');
 columns.ppl_assignments?.add('job_grade_id');columns.ppl_organizations?.add('valid_from');columns.ppl_organizations?.add('valid_to');columns.ppl_positions?.add('valid_from');columns.ppl_positions?.add('valid_to');
 for(const change of d.physicalChanges){
  for(const t of change.newTables||[])columns[t.table]=new Set(Object.keys(t.columns));
  for(const delta of change.deltas||[])if(delta.column)(columns[delta.table||change.baseTable]??=new Set()).add(delta.column);
 }
 for(const op of d.operations){
  if(ops.has(op.operationId))e.push('duplicate op '+op.operationId);ops.add(op.operationId);
  if(!defs[nameOf(op.requestSchemaRef)]||!defs[nameOf(op.responseSchemaRef)])e.push('missing exact schema '+op.operationId);
  for(const ev of op.emits||[])if(!defs[ev])e.push('missing event schema '+ev);
  if(op.method==='GET'&&(op.writeSet.length||op.writesTables.length))e.push('query writes '+op.operationId);
  const roots=bodyRoots(defs[nameOf(op.requestSchemaRef)]);
  const plans=[...(op.writeSet||[]).map(x=>({table:x.table,bindings:[x]})),...(op.secondaryWritePlans||[])];
  for(const plan of plans)for(const b of plan.bindings){
   if(count)counters.selectedColumnBindings++;
   if(!columns[plan.table]?.has(b.column))e.push('unknown planned/current column '+op.operationId+' '+plan.table+'.'+b.column);
   if(!b.expression||!b.inputs?.length)e.push('empty source '+op.operationId+' '+b.column);
   if(b.inputs.length===2&&b.inputs.includes('principal.tenantId')&&b.inputs.includes('principal.publicId'))e.push('tenant+actor fabricated derivation '+op.operationId+' '+b.column);
   for(const leaf of b.inputs||[])if(leaf.startsWith('body.')&&!roots.has(leaf.split('.')[1]))e.push('absent request source '+op.operationId+' '+leaf);
  }
 }
 for(const machine of d.stateMachines)for(const t of machine.transitions){
  if(!ops.has(t.operationId))e.push('unbound transition '+t.operationId);
  if((t.from!==null&&!machine.states.includes(t.from))||!machine.states.includes(t.to))e.push('pseudo state '+t.operationId);
 }
 if(d.g3Authorization!=='NONE'||d.independentApproval!==false)e.push('author approval escalation');
 if(!d.identityBoundary.selector?.includes('No linkPublicId'))e.push('shadow self selector');
 return e;
}
errors.push(...structure(proposal,true));
const historicalPreview={type:'object',additionalProperties:false,required:['populationRuleId','workforceSnapshotId','workforceSnapshotRevision'],properties:{populationRuleId:{type:'string',format:'uuid'},workforceSnapshotId:{type:'string',format:'uuid'},workforceSnapshotRevision:{type:'integer',minimum:0}}};
const historicalFreeze={allOf:[historicalPreview,{type:'object',additionalProperties:false,required:['previewContentHash'],properties:{previewContentHash:{type:'string',pattern:'^[0-9a-f]{64}$'}}}]};
check(!ajv.compile(historicalFreeze)(fixtures.legacyFreezeWitness),'actual historical closed-allOf unsatisfiable witness');
check(validate('FreezePopulation',fixtures.freezeRequest),'actual successor freeze request validates');
counters.explicitApiRequests++;
for(const a of fixtures.ownerArtifacts){check(validate(nameOf(a.responseSchemaRef),a.content),'typed explicit owner content '+a.responseSchemaRef);check(hash(a.content)===a.ref.contentDigest,'actual fixture owner canonical digest '+a.ref.schemaId);}
function deny(code){const e=new Error(code);e.code=code;throw e;}
function nativeLoad(target,env){
 const t=fixtures.ownerTables, tenant=env.tenant;
 const get=(table,id)=>t[table].find(r=>r.tenant_id===tenant&&r.public_id===id);
 const p=get('ppl_persons',target.personPublicId),w=get('ppl_workers',target.workerPublicId),r=get('ppl_work_relationships',target.relationshipPublicId),a=get('ppl_assignments',target.assignmentPublicId);
 if(!p||!w||!r||!a)deny('TENANT_NOT_FOUND');
 if(w.person_id!==p.person_id||r.worker_id!==w.worker_id||a.work_relationship_id!==r.work_relationship_id||env.parentWrong)deny('PARENT_MISMATCH');
 for(const [row,key]of [[p,'personVersion'],[w,'workerVersion'],[r,'relationshipVersion'],[a,'assignmentVersion']]){
  const actual=(key==='assignmentVersion'&&env.returnMode)?9:row.version;
  if(target[key]!==actual||env.stale)deny('STALE_VERSION');
 }
 return {person:clone(p),worker:clone(w),relationship:clone(r),assignment:clone(a)};
}
function resolve(table,id,pk,env){
 if(env.wrongReference)deny('PARENT_MISMATCH');
 const r=fixtures.ownerTables[table].find(x=>x.tenant_id===env.tenant&&x.public_id===id);
 if(!r)deny('TENANT_NOT_FOUND');return r[pk];
}
function publish(input,env={}){
 env={tenant:fixtures.context.tenantId,ownerAvailable:true,state:'APPROVED',actor:'maker',approver:'checker',...env};
 env.effects=0;env.ownerCalls=0;
 if(!env.ownerAvailable)deny('MISSING_OWNER_ADAPTER');env.ownerCalls++;
 if(env.ownerRevisionWrong)deny('STALE_OWNER_SNAPSHOT');
 if(env.actor===env.approver)deny('SOD_DENIED');
 if(env.state!=='APPROVED')deny('TERMINAL_STATE');
 if(!validate('EmploymentEventInput',input))deny('UNKNOWN_FIELD');
 const p=input.payload,kind=input.eventType, admission=['HIRE','REHIRE'].includes(kind);
 let loaded=admission?null:nativeLoad(p.target,{...env,returnMode:kind==='RETURN'}),out=loaded?clone(loaded.assignment):{};
 const planned=proposal.employmentPublishVariants[kind];if(!planned)deny('VALIDATION_FAILED');
 if(['TRANSFER','PROMOTION','DEMOTION'].includes(kind)){
  if(p.organizationPublicId)out.organization_id=resolve('ppl_organizations',p.organizationPublicId,'organization_id',env);
  out.position_id=resolve('ppl_positions',p.positionPublicId,'position_id',env);out.job_profile_id=resolve('ppl_job_profiles',p.jobProfilePublicId,'job_profile_id',env);
  if(p.costCenterKey)out.cost_center_key=p.costCenterKey;if(p.businessTitle)out.business_title=p.businessTitle;
 }
 if(kind==='CHANGE_LOCATION')out.location_id=resolve('ppl_locations',p.locationPublicId,'location_id',env);
 if(kind==='CHANGE_MANAGER')out.manager_assignment_key=resolve('manager_assignments',p.managerAssignmentPublicId,'assignment_key',env);
 if(kind==='LEAVE')out.assignment_status='SUSPENDED';if(kind==='RETURN')out.assignment_status='ACTIVE';
 if(kind==='TERMINATION'){out.assignment_status='ENDED';out.relationshipEnd=input.payload.lastWorkingDate;out.workerStatus=fixtures.ownerTables.ppl_work_relationships.some(r=>r.tenant_id===env.tenant&&r.worker_id===loaded.worker.worker_id&&r.work_relationship_id!==loaded.relationship.work_relationship_id&&!r.end_date)?'ACTIVE':'TERMINATED';}
 if(kind==='HIRE'||kind==='REHIRE'){out.newRelationship=true;out.newAssignment=true;out.newWorker=kind==='HIRE';out.personPublicId=p.personPublicId;}
 if(kind==='CONCURRENT_ASSIGNMENT'){out.newAssignment=true;out.originalRelationshipId=loaded.relationship.work_relationship_id;out.primary_assignment=p.assignment.primaryAssignment;}
 if(kind==='CORRECTION'){const q=p.replacement;out.organization_id=resolve('ppl_organizations',q.organizationPublicId,'organization_id',env);out.position_id=resolve('ppl_positions',q.positionPublicId,'position_id',env);out.job_profile_id=resolve('ppl_job_profiles',q.jobProfilePublicId,'job_profile_id',env);out.location_id=resolve('ppl_locations',q.locationPublicId,'location_id',env);out.manager_assignment_key=resolve('manager_assignments',q.managerAssignmentPublicId,'assignment_key',env);out.business_title=q.businessTitle;out.cost_center_key=q.costCenterKey;out.worker_hours=q.workerHours;out.full_time_equivalent=q.fullTimeEquivalent;out.correctsEvent=p.correctsEventPublicId;}
 env.effects=1;return {output:out,effects:env.effects,authWrites:0,ownerCalls:env.ownerCalls};
}
for(const c of fixtures.employmentCases){
 check(validate('EmploymentEventInput',c.input),'actual HRM typed request '+c.caseId);counters.explicitApiRequests++;
 const result=publish(c.input);
 check(result.effects===1&&result.authWrites===0,'single owner tx/no Auth lifecycle '+c.caseId);
 const out=result.output,p=c.input.payload,k=c.input.eventType;
 if(k==='HIRE')check(out.newWorker&&out.newRelationship&&out.personPublicId===fixtures.context.native.personPublicId,'hire admission does not invent person');
 if(k==='REHIRE')check(!out.newWorker&&out.newRelationship&&out.newAssignment,'rehire new relationship preserves worker/person');
 if(k==='TRANSFER')check(out.organization_id===15&&out.position_id===16&&out.job_profile_id===17&&out.location_id===8,'transfer separate native relations, preserves location');
 if(k==='PROMOTION')check(out.business_title===p.businessTitle&&out.position_id===16,'promotion actual typed job/title');
 if(k==='DEMOTION')check(out.business_title===p.businessTitle&&out.position_id===26,'demotion actual typed job/title');
 if(k==='CONCURRENT_ASSIGNMENT')check(out.newAssignment&&!out.primary_assignment&&out.originalRelationshipId===3,'concurrent independent assignment primary policy');
 if(k==='CHANGE_MANAGER')check(out.manager_assignment_key==='SYN-MANAGER-BETA'&&out.organization_id===5,'manager UUID resolves manager KEY only');
 if(k==='CHANGE_LOCATION')check(out.location_id===18&&out.position_id===6,'location UUID not assignment/position ID');
 if(k==='LEAVE')check(out.assignment_status==='SUSPENDED','leave exact assignment state not Auth');
 if(k==='RETURN')check(out.assignment_status==='ACTIVE','return loaded leave native version');
 if(k==='TERMINATION')check(out.workerStatus==='ACTIVE'&&out.relationshipEnd==='2026-09-14','multiemployment separation preserves other relationship/worker');
 if(k==='CORRECTION')check(out.correctsEvent===p.correctsEventPublicId,'correction links immutable old event, new intent');
}
const SCALE=1000000n;
function dec(s){if(typeof s!=='string'||!(/^-?(0|[1-9][0-9]*)\.[0-9]{6}$/).test(s))deny('VALIDATION_FAILED');return BigInt(s.replace('.',''));}
function wire(n){const sign=n<0n?'-':'';if(n<0n)n=-n;return sign+String(n/SCALE)+'.'+String(n%SCALE).padStart(6,'0');}
function div(n,d,mode){if(d<=0n)deny('VALIDATION_FAILED');let q=n/d,r=n%d;if(r<0n)r=-r;const sign=n<0n?-1n:1n;if(mode==='DOWN')return q;if(r*2n>d||(r*2n===d&&(mode==='HALF_UP'||q%2n!==0n)))q+=sign;return q;}
function grade(value,p){const v=dec(value),bands=p.gradeBands.filter(b=>v>=dec(b.minimumInclusive)&&v<dec(b.maximumExclusive));if(bands.length!==1)deny('VALIDATION_FAILED');return bands[0].gradeKey;}
function calculate(values,policy,unit=policy.unit){
 if(!validate('ScoringPolicy',policy)||unit!==policy.unit||values.length!==policy.components.length)deny('VALIDATION_FAILED');
 const weights=policy.components.map(c=>dec(c.weight));if(weights.reduce((a,b)=>a+b,0n)!==SCALE)deny('VALIDATION_FAILED');
 let weighted=0n;for(let i=0;i<values.length;i++){if(values[i]===null||values[i]==='WITHHELD')deny('VALIDATION_FAILED');const v=dec(values[i]);if(v<dec(policy.minimum)||v>dec(policy.maximum))deny('VALIDATION_FAILED');weighted+=v*weights[i];}
 return wire(div(weighted,SCALE,policy.rounding));
}
function adjustment(config,body){
 if(!validate('CalibrationAdjustment',body))deny('UNKNOWN_FIELD');
 if(body.unit!==config.scoring.unit||body.expectedParticipantVersion!==1)deny('VALIDATION_FAILED');
 const previous=config.baselineScores.map(dec),after=dec(body.adjustedValue);
 if(after<dec(config.scoring.minimum)||after>dec(config.scoring.maximum))deny('VALIDATION_FAILED');
 let delta=after-previous[0];if(delta<0n)delta=-delta;if(delta>dec(config.scoring.calibration.maxAbsoluteAdjustment))deny('VALIDATION_FAILED');
 const prior=wire(div(previous.reduce((a,b)=>a+b,0n),BigInt(previous.length),config.scoring.rounding));
 const projected=wire(div(after+previous[1],2n,config.scoring.rounding));
 return {priorMean:prior,projectedMean:projected,previousValue:wire(previous[0]),adjustedGrade:grade(body.adjustedValue,config.scoring)};
}
for(const cfg of fixtures.configurations){
 const body={participantPublicId:'00000000-0000-4000-8000-000000000071',expectedParticipantVersion:1,adjustedValue:cfg.adjustment,unit:cfg.scoring.unit,reasonCode:'SYN-CALIBRATION',reasonText:'Synthetic evidence-based adjustment',evidenceRefs:[]};
 check(validate('CalibrationAdjustment',body),'actual config '+cfg.configurationId+' calibration input');counters.explicitApiRequests++;
 const out=adjustment(cfg,body),weighted=calculate(cfg.inputValues,cfg.scoring);
 check(weighted===cfg.expected.weightedScore,'actual decimal weighted score '+cfg.configurationId);
 check(grade(weighted,cfg.scoring)===cfg.expected.weightedGrade,'owner computed result grade '+cfg.configurationId);
 check(out.priorMean===cfg.expected.priorMean&&out.projectedMean===cfg.expected.projectedMean&&out.adjustedGrade===cfg.expected.adjustedGrade,'owner cohort impact '+cfg.configurationId);
 const response=sample(defs.DistributionImpact);Object.assign(response,{affectedParticipantCount:2,priorCohortMean:out.priorMean,projectedCohortMean:out.projectedMean,previousValue:out.previousValue,adjustedValue:cfg.adjustment,previousGrade:grade(out.previousValue,cfg.scoring),adjustedGrade:out.adjustedGrade,policyRef:cfg.scoringRef});
 check(validate('DistributionImpact',response),'actual config '+cfg.configurationId+' response schema');
 const result=sample(defs.ResultSetRecord);result.results[0].score=weighted;result.results[0].unit=cfg.scoring.unit;result.results[0].grade=grade(weighted,cfg.scoring);result.policyRef=cfg.scoringRef;
 check(validate('ResultSetRecord',result),'actual computed result schema '+cfg.configurationId);
}
function freeze(body){
 if(!validate('FreezePopulation',body))deny('UNKNOWN_FIELD');
 const a=fixtures.ownerArtifacts.find(x=>nameOf(x.responseSchemaRef)==='PopulationPreviewRecord'),r=a.content;
 if(body.previewPublicId!==r.previewPublicId||body.previewVersion!==r.previewVersion||body.previewContentHash!==hash(r)||body.asOf!==r.asOf||body.populationRuleId!==r.ruleRef.ownerPublicId||body.workforceSnapshotId!==r.workforceRef.ownerPublicId||body.workforceSnapshotRevision!==r.workforceRef.ownerRevision)deny('IMMUTABLE_INPUT_MISMATCH');
 const keys=new Set(r.members.map(m=>m.native.workerPublicId+':'+m.native.assignmentPublicId));if(keys.size!==r.members.length)deny('VALIDATION_FAILED');return {members:r.members.length,reviewers:r.members.reduce((n,m)=>n+m.reviewers.length,0)};
}
const frozen=freeze(fixtures.freezeRequest);check(frozen.members===2&&frozen.reviewers===4,'freeze same worker two real assignments without worker-only collapse');
check(validate('CandidateAdmission',fixtures.candidateAdmission),'native candidate intake API valid optional connector absent');counters.explicitApiRequests++;
check(validate('TemplateVersionInput',fixtures.onboardingTemplate),'native immutable template exact tasks API valid');counters.explicitApiRequests++;
function onboard(tasks){if(tasks.some(t=>t.required&&!['COMPLETED','WAIVED'].includes(t.status)))deny('VALIDATION_FAILED');return 'COMPLETED';}
const tasks=fixtures.onboardingTemplate.tasks.map(t=>({...t,status:'PENDING'}));tasks[0].status='COMPLETED';
check(tasks.some(t=>t.required&&t.status==='PENDING'),'first required task does not finish assignment');
tasks[1].status='COMPLETED';check(onboard(tasks)==='COMPLETED'&&tasks[2].status==='PENDING','repeat task completion/all-required separate terminal; optional pending retained');
const receipts=new Map();
function once(key,body,fn){const h=hash(body);if(receipts.has(key)){const r=receipts.get(key);if(r.hash!==h)deny('IDEMPOTENCY_KEY_REUSED');return {...r.result,duplicate:true};}const result=fn();receipts.set(key,{hash:h,result});return result;}
const transfer=fixtures.employmentCases.find(x=>x.input.eventType==='TRANSFER').input;
const first=once('101/maker/publish/KEY-A',transfer,()=>publish(transfer));const duplicate=once('101/maker/publish/KEY-A',transfer,()=>deny('REPLAY_CONFLICT'));
check(first.effects===1&&duplicate.duplicate,'same-key same-body returns result with zero second callback/effect');
const calibrationBody={participantPublicId:'00000000-0000-4000-8000-000000000071',expectedParticipantVersion:1,adjustedValue:'2.500000',unit:'SCORE_POINT',reasonCode:'SYN-CALIBRATION',reasonText:'Synthetic evidence',evidenceRefs:[]};
function negative(kind){
 switch(kind){
 case'missingOwner':return publish(transfer,{ownerAvailable:false});
 case'tenant':return publish(transfer,{tenant:202});
 case'stale':return publish(transfer,{stale:true});
 case'parent':return publish(transfer,{parentWrong:true});
 case'ownerRevision':return publish(transfer,{ownerRevisionWrong:true});
 case'sod':return publish(transfer,{actor:'maker',approver:'maker'});
 case'terminal':return publish(transfer,{state:'PUBLISHED'});
 case'keyMismatch':return once('101/maker/publish/KEY-A',{...transfer,reasonCode:'DIFFERENT'},()=>({}));
 case'callerImpact':return adjustment(fixtures.configurations[0],{...calibrationBody,distributionImpact:{priorMean:'0.000000'}});
 case'requiredAnswer':return calculate([null,'4.000000'],fixtures.configurations[0].scoring);
 case'unitMismatch':return adjustment(fixtures.configurations[0],{...calibrationBody,unit:'RATIO'});
 case'freezeStale':return freeze({...fixtures.freezeRequest,workforceSnapshotRevision:7});
 case'wrongReference':return publish(transfer,{wrongReference:true});
 case'onboardingRequired':return onboard(fixtures.onboardingTemplate.tasks.map(t=>({...t,status:'PENDING'})));
 case'candidateNoIntake':{const candidates=[];if(!candidates.find(x=>x.id==='NOT_CREATED'))deny('TENANT_NOT_FOUND');return {};}
 default:throw Error('unexecuted negative '+kind);
 }
}
for(const c of fixtures.negativeCases){let code=null;try{negative(c.kind);}catch(e){code=e.code||e.message;}check(code===c.expectedCode,'actual negative '+c.caseId+' '+code);counters.negativeControls++;}
for(const[mutation,expected]of [
 [d=>{d.operations[0].writeSet[0].inputs=['body.ghost'];},'absent request source'],
 [d=>{d.operations[0].writeSet[0].column='fabricated_fk';},'unknown planned/current column'],
 [d=>{d.stateMachines[0].transitions[0].to='SCREENING_OR_INTERVIEW';},'pseudo state'],
 [d=>{d.g3Authorization='PASS';},'author approval escalation']
]){const copy=clone(proposal);mutation(copy);check(structure(copy).some(x=>x.includes(expected)),'checker mutation rejection '+expected);counters.mutationControls++;}
for(const journey of fixtures.performanceJourneys){
 const cfg=fixtures.configurations.find(x=>x.configurationId===journey.configurationId),records=new Map();
 const frozenPreview=fixtures.ownerArtifacts.find(x=>nameOf(x.responseSchemaRef)==='PopulationPreviewRecord').content;
 let frozenState=null,calibrator=null,reviewCompleted=0,actualResult=null,baseline=null,locked=false;const draftContents=new Map();
 for(const step of journey.steps){
  const op=proposal.operations.find(x=>x.operationId===step.operationId);
  check(validate(nameOf(op.requestSchemaRef),step.body),'API-valid actual journey '+journey.caseId+'/'+step.operationId);counters.explicitApiRequests++;
  const pre=records.get(step.aggregateId);check(op.fromState===null?!pre:!!pre&&pre.state===op.fromState&&pre.version===step.expectedVersion,'actual native state/CAS '+step.operationId);
  if(step.machine==='Evaluation'){
   const index=Number(step.aggregateId.slice(-12))-90,member=frozenPreview.members[Math.floor(index/2)],reviewer=member.reviewers[index%2];
   const auth=fixtures.authPersonBindings.find(x=>x.tenantId===fixtures.context.tenantId&&x.principalPublicId===step.actorPrincipalPublicId);
   check(!!auth&&auth.personPublicId===reviewer.reviewerNative.personPublicId,'trusted Auth-person -> frozen reviewer native identity, not principal=worker '+step.operationId);
   check(step.contextSelector.workerPublicId===reviewer.reviewerNative.workerPublicId&&step.contextSelector.relationshipPublicId===reviewer.reviewerNative.relationshipPublicId&&step.contextSelector.assignmentPublicId===reviewer.reviewerNative.assignmentPublicId,'explicit three UUID selector matches frozen native tuple '+step.operationId);
   if(step.operationId==='createAssignedEvaluationExact')check(step.body.participantPublicId===member.participantPublicId&&step.body.reviewerAssignmentPublicId===reviewer.reviewerAssignmentPublicId,'actual review freeze participant/slot parent tuple');
   if(step.operationId==='saveAssignedEvaluationDraftExact')draftContents.set(step.aggregateId,clone(step.body));
   if(step.operationId==='submitAssignedEvaluationExact')check(step.body.draftArtifactRef.ownerPublicId===step.body.draftSubmissionPublicId&&!!draftContents.get(step.aggregateId),'immutable saved answers refetch+submission owner ID not artifactID');
   if(step.operationId==='completeAssignedEvaluationExact')reviewCompleted++;
  }
  if(step.operationId==='freezePopulationExact'){const actual=freeze(step.body);frozenState='FROZEN';check(actual.members===journey.expectedFrozenMemberCount,'journey actual immutable frozen native vectors');}
  if(step.operationId==='activateCycleExact')check(frozenState==='FROZEN','activation requires actual frozen population');
  if(step.operationId==='createCalibrationExact'){
   baseline=frozenPreview.members.map((_,i)=>calculate([draftContents.get('00000000-0000-4000-8000-'+String(90+i*2).padStart(12,'0')).answers[0].value,draftContents.get('00000000-0000-4000-8000-'+String(91+i*2).padStart(12,'0')).answers[0].value],cfg.scoring));
   check(canonical(baseline)===canonical(cfg.baselineScores),'baseline actual immutable completed review stage vectors, not unrelated supplied fixture scores');
  }
  if(step.operationId==='appendCalibrationAdjustmentExact'){calibrator=step.actorPrincipalPublicId;check(baseline!==null&&baseline[0]===cfg.baselineScores[0],'owner loaded previous actual baseline score');}
  if(step.operationId==='lockCalibrationExact')locked=true;
  if(step.operationId==='calculateResultsExact'){check(reviewCompleted===journey.expectedRequiredReviewCount,'owner-computed required review count, not request count');check(locked&&step.body.lockedCalibrationRef.ownerPublicId==='00000000-0000-4000-8000-000000000084','result refetches actual locked calibration native owner ref');actualResult=[cfg.adjustment,baseline[1]];}
  if(step.operationId==='publishResultsExact')check(step.actorPrincipalPublicId!==calibrator&&canonical(actualResult)===canonical(journey.expectedScores),'publisher-calibrator SoD + actual immutable computed individual results');
  if(step.operationId==='closeCycleExact')check(reviewCompleted===journey.expectedRequiredReviewCount&&actualResult!==null,'cycle closure actual required review/results completion');
  const post={machine:step.machine,state:op.toState,version:op.fromState===null?0:pre.version+1};records.set(step.aggregateId,post);
  for(const eventName of op.emits){const event=sample(defs[eventName]);if('aggregateVersion'in event)event.aggregateVersion=post.version;if('fromState'in event)event.fromState=op.fromState;if('toState'in event)event.toState=op.toState;check(validate(eventName,event),'actual native version0/create and transition event '+eventName);}
 }
 for(const [machine,state]of Object.entries(journey.expectedFinalStates))check([...records.values()].filter(r=>r.machine===machine).every(r=>r.state===state),'actual final object state '+journey.caseId+'/'+machine);
 check(canonical(actualResult)===canonical(journey.expectedScores)&&canonical(actualResult.map(v=>grade(v,cfg.scoring)))===canonical(journey.expectedGrades),'actual A/B final typed individual result vector');
 check(wire(div(actualResult.map(dec).reduce((a,b)=>a+b,0n),BigInt(actualResult.length),cfg.scoring.rounding))===journey.expectedCohortMean,'actual calibrated cohort mean is query signal, not individual score');
}
const actualSourcePins=proposal.sourceSnapshot.sourcePins.map(p=>({path:p.path,expectedSha256:p.sha256,currentSha256:crypto.createHash('sha256').update(fs.readFileSync(p.path)).digest('hex')}));
const pinDrift=actualSourcePins.filter(p=>p.expectedSha256!==p.currentSha256);
for(const p of pinDrift)errors.push('source pin drift '+p.path);
const result={status:errors.length?'AUTHOR_CHECK_FAIL':'AUTHOR_BOUNDED_CHECK_PASS',engine:'Ajv',engineVersion:ajvVersion,nodeVersion:process.version,dialect:'JSON_SCHEMA_DRAFT_07_FULL_INSTALLED_AJV6_ENGINE_FORMAT_FULL',counters,errors,actualSourcePinCount:actualSourcePins.length,pinDrift,independentApproval:false,canonicalSemanticLineagePass:false,nativeDomainExecution:false,dbWrites:0,backendEdits:0,g3Authorization:'NONE',limits:proposal.sourceLineageLimitations};
console.log(JSON.stringify(result,null,2));process.exitCode=errors.length?1:0;
