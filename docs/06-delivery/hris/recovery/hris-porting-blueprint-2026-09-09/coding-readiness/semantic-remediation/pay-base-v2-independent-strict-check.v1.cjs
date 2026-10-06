#!/usr/bin/env node
'use strict';
// Independent bounded validation of frozen author preparation. Not a Gate/DDL authorization.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const PREFIX = 'pay-base-preparation-successor.v2';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const normalize = type => type.toUpperCase().replace(/\s+/g, '')
  .replace(/^BIGSERIAL$/, 'BIGINT').replace(/^SERIAL$/, 'INTEGER');
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function pin(file) {
  const stat = fs.statSync(file, {bigint:true});
  return {path:file, sha256:sha(fs.readFileSync(file)), bytes:String(stat.size),
    mtimeNs:String(stat.mtimeNs)};
}
function validatePhysical(proposal, sql) {
  const tables = new Map();
  for (const table of proposal.tablePlans) {
    assert.match(table.table, /^pay_[a-z0-9_]+$/, 'OWNERSHIP_PREFIX');
    assert.equal(table.schemaName, 'public', 'SCHEMA');
    assert.equal(table.stream, 'payroll-main', 'STREAM');
    assert(!tables.has(table.table), 'DUPLICATE_TABLE');
    tables.set(table.table, table);
  }
  const blocks = new Map();
  const pattern = /CREATE TABLE public\.(pay_\w+)\s*\(([\s\S]*?)\n\);/g;
  for (const match of sql.matchAll(pattern)) {
    assert(!blocks.has(match[1]), 'DUPLICATE_SAVED_DDL_TABLE');
    blocks.set(match[1], match[2]);
  }
  assert.deepEqual([...blocks.keys()].sort(), [...tables.keys()].sort(), 'DDL_TABLE_SET');
  let columnCount=0, foreignKeyColumns=0;
  for (const table of tables.values()) {
    const block=blocks.get(table.table), seen=new Set();
    for (const column of table.columns) {
      assert(!seen.has(column.name), 'DUPLICATE_COLUMN'); seen.add(column.name);
      assert.match(column.name, /^[a-z][a-z0-9_]*$/, 'COLUMN_NAME');
      const binding=table.sourceBindings.find(x=>x.column===column.name);
      assert(binding && binding.sqlType===column.sqlType, 'SOURCE_COLUMN_TYPE');
      const line=block.split('\n').find(x=>new RegExp('^\\s*'+escape(column.name)+'\\s+').test(x));
      assert(line, 'SAVED_DDL_COLUMN_MISSING');
      // This checks the exact constrained draft convention, not general SQL parsing.
      const actual=line.trim().slice(column.name.length).trim();
      assert(new RegExp('^'+escape(column.sqlType)+'(?=\\s|,|$)', 'i').test(actual),
        'SAVED_DDL_COLUMN_TYPE');
      columnCount++;
    }
    for (const fk of table.foreignKeys) {
      const parent=tables.get(fk.targetTable);
      assert(parent, 'SAME_OWNER_PARENT');
      assert(fk.columns.length===fk.targetColumns.length, 'FK_ARITY');
      assert(fk.columns[0]==='tenant_id' && fk.targetColumns[0]==='tenant_id', 'TENANT_FK');
      for(let i=0;i<fk.columns.length;i++) {
        const child=table.columns.find(x=>x.name===fk.columns[i]);
        const target=parent.columns.find(x=>x.name===fk.targetColumns[i]);
        assert(child && target, 'FK_REAL_COLUMNS');
        assert.equal(normalize(child.sqlType), normalize(target.sqlType), 'FK_SQL_TYPE');
        foreignKeyColumns++;
      }
    }
  }
  return {tables:tables.size, columns:columnCount, foreignKeyColumns};
}
function validateReceipt(receipt) {
  assert.equal(receipt.status, 'AUTHOR_STRUCTURE_FIXTURE_VERIFIED_G3_CLOSED', 'AUTHOR_STATUS');
  for(const key of ['sourceIssues','executionDrift','proposalInputPinDrift']) {
    assert(Array.isArray(receipt[key]), 'MISSING_FINDINGS_ARRAY_'+key);
    assert.equal(receipt[key].length, 0, 'UNREJECTED_'+key);
  }
  assert.equal(receipt.actualNativeRuns, 0, 'NO_INFERRED_NATIVE');
  assert.equal(receipt.productionOwnerRegistration, 0, 'NO_INFERRED_REGISTRATION');
  assert.equal(receipt.all119ExactMutationSourceClosed, false, 'RETAIN_SOURCE_OPEN');
  assert.equal(receipt.sourceFamilyMeaningIndependentlyApproved, false, 'RETAIN_MEANING_OPEN');
  assert(receipt.openInitialSources>0, 'DO_NOT_DROP_SOURCE_GAPS');
  assert(receipt.unmatchedFullAPINegativePayloads.length>0, 'DO_NOT_DROP_API_GAPS');
  return true;
}
function main() {
  const beforePaths=[...fs.readdirSync(__dirname).filter(x=>x.startsWith(PREFIX+'.'))
    .map(x=>path.join(__dirname,x)), __filename];
  const test=__filename.replace('.cjs','.test.cjs'); if(fs.existsSync(test))beforePaths.push(test);
  const before=beforePaths.sort().map(pin), startedAt=new Date().toISOString();
  const proposal=JSON.parse(fs.readFileSync(path.join(__dirname,PREFIX+'.json')));
  const sql=fs.readFileSync(path.join(__dirname,PREFIX+'.planned.sql'),'utf8');
  assert.equal(sha(fs.readFileSync(path.join(__dirname,PREFIX+'.json'))),
    '9bebce09bd59908aaf67205c462f707f3d83356af790776931a623b64be24e90', 'FROZEN_CANDIDATE');
  assert.equal(proposal.CURRENT_PUBLISHED, false, 'NOT_PUBLISHED');
  assert.equal(proposal.gateAuthorization, 'NONE_G3_CLOSED', 'NOT_AUTHORIZED');
  const physical=validatePhysical(proposal, sql); assert.equal(physical.tables,88, '88_DRAFT_TABLES');
  const child=spawnSync(process.execPath,[path.join(__dirname,PREFIX+'.check.cjs'),
    process.argv[2]||'/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend'],
    {encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
  assert(!child.error && child.status===0, 'AUTHOR_CHILD_EXECUTION');
  const receipt=JSON.parse(child.stdout); validateReceipt(receipt);
  const after=beforePaths.sort().map(pin); assert.deepEqual(after,before,'SOURCE_DRIFT');
  console.log(JSON.stringify({schemaVersion:'dwp.hris.pay-v2-independent-strict-check.v1',
    status:'BOUNDED_STRUCTURE_PASS_SOURCE_PREPARATION_STILL_OPEN', startedAt,
    finishedAt:new Date().toISOString(), actualArgv:process.argv, before,after,
    sourceStable:true, physical, childExitCode:child.status,
    childOutputSha256:sha(child.stdout), childAssertions:receipt.assertions,
    childCompiledSchemas:receipt.compiledSchemas,
    sourceIssues:receipt.sourceIssues, openInitialSources:receipt.openInitialSources,
    unmatchedFullAPINegativePayloads:receipt.unmatchedFullAPINegativePayloads,
    nativeSQLExecution:0, nativeProviderRegistration:0,
    G3Approval:false, sourceFamilyMeaningIndependentlyApproved:false},null,2));
}
module.exports={validatePhysical,validateReceipt};
if(require.main===module) {
  try { main(); } catch(error) {
    console.error(JSON.stringify({status:'ACTUAL_STRICT_FAIL',code:error.message,
      G3Approval:false})); process.exitCode=1;
  }
}
