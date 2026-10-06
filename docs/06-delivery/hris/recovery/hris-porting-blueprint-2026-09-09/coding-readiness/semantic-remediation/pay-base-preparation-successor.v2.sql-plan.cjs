#!/usr/bin/env node
'use strict';
// Builds a review-only forward migration draft; never executes or writes SQL.
const fs=require('node:fs'),path=require('node:path');
const B=require('./pay-base-preparation-successor.v2.build.cjs');
const p=JSON.parse(fs.readFileSync(path.join(__dirname,B.prefix+'.json')));
const historical=fs.readFileSync(path.resolve(__dirname,'../../session-evidence/pay/g2-physical-schema.sql'),'utf8');
const declarations=new Map([...historical.matchAll(/CREATE TABLE (pay_\w+)\s*\(([\s\S]*?)\n\);/g)].map(m=>[m[1],'CREATE TABLE public.'+m[1]+' ('+m[2]+'\n);']));
const q=text=>text.replace(/(?<![.\w])(pay_\w+)(?=\s*\()/g,'public.$1');
const foreignKeys=new Map();
const tables=p.tablePlans.map(t=>{let ddl=t.initialCreateDDL||q(declarations.get(t.table)||'');if(!ddl)throw Error('No actual planned/historical DDL '+t.table);for(const m of ddl.matchAll(/FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s*(?:public\.)?(pay_\w+)\s*\(([^)]+)\)/g)){const cols=m[1].split(',').map(x=>x.trim()),targetCols=m[3].split(',').map(x=>x.trim());foreignKeys.set([t.table,...cols,m[2],...targetCols].join(':'),{table:t.table,columns:cols,targetTable:m[2],targetColumns:targetCols});}for(const k of t.foreignKeys){foreignKeys.set([t.table,...k.columns,k.targetTable,...k.targetColumns].join(':'),{table:t.table,...k});}ddl=ddl.split('\n').filter(l=>!l.includes('FOREIGN KEY')).join('\n').replace(/,\s*\n\);/g,'\n);');return ddl;});
const out=['-- DESIGN_PROPOSED / AUTHOR_ONLY / NOT EXECUTED / NO FLYWAY VERSION ALLOCATED',
 '-- Payroll canonical payroll-main / public / flyway_schema_history / classpath:db/migration.',
 '-- Historical G2 blob is preserved. This separate draft normalizes physical ownership only.',
 '-- All tables first, local composite FKs second. Cross-owner FK or SQL reads are forbidden.',
 '-- Exact state/CAS/payload/interval/append-only source review remains G3 OPEN.',
 '-- No tenant, company, currency minor-unit, statutory number, bank endpoint or grant is seeded.',
 'SET LOCAL search_path = pg_catalog, public;',...tables];
let i=0;for(const k of foreignKeys.values()){out.push('ALTER TABLE public.'+k.table+' ADD CONSTRAINT pay_v2_fk_'+(++i)+' FOREIGN KEY ('+k.columns.join(', ')+') REFERENCES public.'+k.targetTable+' ('+k.targetColumns.join(', ')+');');}
for(const m of B.base.stateMachines){const states=m.machineId==='PAY.GlBatch'?[...m.states,'CANCELLED']:m.states;out.push('ALTER TABLE public.'+m.table+' ADD CONSTRAINT pay_v2_state_'+m.table+' CHECK ('+m.stateColumn+' IN ('+states.map(x=>"'"+x+"'").join(',')+'));');}
out.push('-- GL CANCELLED is a proposed real state reached only by common cancellation apply:',
 '-- DRAFT/BALANCED cancel locally; APPROVAL_PENDING requires exact CANCELLED_BEFORE_DECISION.',
 '-- APPROVED/SENT/POSTED/NATIVE_POSTED cannot become CANCELLED; use new inverse journal/refetch.',
 '-- Interval exclusions, unique finalization, signed lineage, rounding-stage uniqueness,',
 '-- financial append-only ACL/forward delta upgrade and production runtime-role source require',
 '-- exact owner-reviewed successor before migration allocation; this SQL is not that approval.');
for(const t of p.tablePlans){out.push('ALTER TABLE public.'+t.table+' ENABLE ROW LEVEL SECURITY;','ALTER TABLE public.'+t.table+' FORCE ROW LEVEL SECURITY;',"CREATE POLICY pay_v2_tenant_scope ON public."+t.table+" USING (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint) WITH CHECK (tenant_id = NULLIF(current_setting('dwp.tenant_id', true), '')::bigint);");}
const sql=out.join('\n\n')+'\n';
module.exports={sql,foreignKeys:[...foreignKeys.values()]};
if(require.main===module){const lines=sql.split('\n'),start=Number(process.argv[2]||0),count=Number(process.argv[3]||lines.length);console.log('*** Begin Patch\n'+(start===0?'*** Add File: ':'*** Update File: ')+path.join(__dirname,B.prefix+'.planned.sql')+'\n'+(start===0?'':'@@\n '+lines[start-1]+'\n')+lines.slice(start,start+count).map(x=>'+'+x).join('\n')+'\n'+(start===0?'':'*** End of File\n')+'*** End Patch');}
