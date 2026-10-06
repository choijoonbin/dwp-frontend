'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {validatePhysical,validateReceipt}=require('./pay-base-v2-independent-strict-check.v1.cjs');
const p=JSON.parse(fs.readFileSync(path.join(__dirname,'pay-base-preparation-successor.v2.json')));
const sql=fs.readFileSync(path.join(__dirname,'pay-base-preparation-successor.v2.planned.sql'),'utf8');
test('frozen88 draft physical columns and local tenant FK types agree',()=>{
  const result=validatePhysical(p,sql);assert.equal(result.tables,88);assert(result.columns>0);
});
test('actual legal-entity FK BIGINT to TEXT plus matching source binding is rejected',()=>{
  const value=structuredClone(p),t=value.tablePlans.find(x=>x.table==='pay_pay_groups');
  t.columns.find(x=>x.name==='legal_payroll_entity_id').sqlType='TEXT';
  t.sourceBindings.find(x=>x.column==='legal_payroll_entity_id').sqlType='TEXT';
  // Change the saved draft too: FK detection must remain independent of DDL equality.
  const draft=sql.replace(/(CREATE TABLE public\.pay_pay_groups \([\s\S]*?legal_payroll_entity_id )BIGINT/,
    '$1TEXT');
  assert.throws(()=>validatePhysical(value,draft),/FK_SQL_TYPE/);
});
test('actual saved DDL SQL type drift is rejected even with consistent FK parent',()=>{
  const draft=sql.replace('entity_key VARCHAR(100)','entity_key TEXT');
  assert.throws(()=>validatePhysical(p,draft),/SAVED_DDL_COLUMN_TYPE/);
});
test('actual saved DDL missing table and duplicate table are rejected',()=>{
  assert.throws(()=>validatePhysical(p,sql.replace('CREATE TABLE public.pay_pay_groups','CREATE TABLE public.pay_absent')),/DDL_TABLE_SET/);
  assert.throws(()=>validatePhysical(p,sql+'\nCREATE TABLE public.pay_pay_groups (\n);'),/DUPLICATE/);
});
test('actual FK tenant-only arity and missing target columns are rejected',()=>{
  const value=structuredClone(p),t=value.tablePlans.find(x=>x.table==='pay_pay_groups');
  t.foreignKeys[0].targetColumns.push('missing');assert.throws(()=>validatePhysical(value,sql),/FK_ARITY/);
  const second=structuredClone(p),s=second.tablePlans.find(x=>x.table==='pay_pay_groups');
  s.foreignKeys[0].targetColumns[1]='missing';assert.throws(()=>validatePhysical(second,sql),/FK_REAL_COLUMNS/);
});
const receipt={status:'AUTHOR_STRUCTURE_FIXTURE_VERIFIED_G3_CLOSED',sourceIssues:[],
  executionDrift:[],proposalInputPinDrift:[],actualNativeRuns:0,productionOwnerRegistration:0,
  all119ExactMutationSourceClosed:false,sourceFamilyMeaningIndependentlyApproved:false,
  openInitialSources:856,unmatchedFullAPINegativePayloads:['synthetic-unmatched']};
test('valid bounded author receipt retains all disclosed readiness gaps',()=>assert(validateReceipt(receipt)));
for(const key of ['sourceIssues','executionDrift','proposalInputPinDrift']) {
  test('nonempty '+key+' cannot return strict success',()=>{
    const value=structuredClone(receipt);value[key].push({issue:'synthetic-mutated'});
    assert.throws(()=>validateReceipt(value),new RegExp('UNREJECTED_'+key));
  });
}
test('omitted diagnostics and unearned source/native approval are rejected',()=>{
  const value=structuredClone(receipt);delete value.sourceIssues;
  assert.throws(()=>validateReceipt(value),/MISSING_FINDINGS/);
  for(const key of ['all119ExactMutationSourceClosed','sourceFamilyMeaningIndependentlyApproved']) {
    const changed=structuredClone(receipt);changed[key]=true;
    assert.throws(()=>validateReceipt(changed),/RETAIN_/);
  }
});
