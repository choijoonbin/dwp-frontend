import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  EDGES, FRONTEND_ROOT, FORBIDDEN, compileFixture, csvRows, fixtureChecks, identity,
  inspectSources, loadFixture, readAliases, readContract, sha256, sourceEvidence,
} from './hris-layer-contract-v1.mjs';

const fixture = loadFixture();
const prefix = 'apps/dwp/src/features/hris/people/';
const aliases = { '@hris-fixture/*': [path.join(FRONTEND_ROOT, 'apps/dwp/src/features/hris/*')] };
const inspect = (sources, options = {}) => inspectSources(sources, { aliases, ...options });

test('compile seven virtual React Query / controlled-form sources against installed types without emit', () => {
  const result = compileFixture(fixture.compileSources);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.virtualSourceCount, 7);
  assert.equal(result.filesystemWrites, 0);
  assert.equal(result.emitRequested, false);
  assert.equal(result.domainRuntimeExecuted, false);
  assert.equal(result.domRendered, false);
});

test('fixture eleven compiled edges plus separate testing/public-api witness cover all twelve edges', () => {
  const result = fixtureChecks(fixture);
  assert.equal(result.structuralPass, true);
  assert.deepEqual(result.coveredEdges, [...EDGES].sort());
  assert.equal(result.graph.usedEdges.length, 11);
  assert.deepEqual(result.testing.usedEdges, ['testing>public-api']);
  assert.equal(result.readinessPass, false);
  assert.equal(result.g3StartAuthorized, false);
});

test('original eight-edge graph rejects exactly four distinct missing orchestration edges', () => {
  const old = EDGES.filter((edge) => !['pages>hooks', 'pages>forms', 'hooks>model', 'hooks>forms'].includes(edge));
  const sources = Object.fromEntries(Object.entries(fixture.compileSources).map(([file, text]) => [prefix + file, text]));
  const errors = inspect(sources, { edges: old }).errors.filter((error) => error.code === 'FORBIDDEN_LAYER_EDGE');
  assert.deepEqual([...new Set(errors.map((error) => error.edge))].sort(), ['hooks>forms', 'hooks>model', 'pages>forms', 'pages>hooks']);
  assert.equal(errors.filter((error) => error.edge === 'hooks>model').length, 2, 'both type and value imports remain inspected');
});

test('twelve-layer contract remains a DAG; reverse forms/hooks is not an allowed edge', () => {
  const graph = new Map();
  for (const edge of EDGES) { const [from, to] = edge.split('>'); graph.set(from, [...(graph.get(from) ?? []), to]); }
  const active = new Set(), done = new Set();
  function visit(node) {
    assert.equal(active.has(node), false, 'layer cycle at ' + node);
    if (done.has(node)) return;
    active.add(node); for (const target of graph.get(node) ?? []) visit(target); active.delete(node); done.add(node);
  }
  for (const node of graph.keys()) visit(node);
  assert.equal(EDGES.includes('forms>hooks'), false);
});

for (const negative of fixture.negatives) test('AST negative: ' + negative.id, () => {
  const result = inspect(negative.sources);
  assert.equal(result.errors.some((error) => error.code === negative.expectedCode), true, JSON.stringify(result.errors));
  assert.equal(result.structuralPass, false);
  assert.equal(result.readinessPass, false);
});

test('nested HRIS features are distinct despite their common hris directory', () => {
  assert.equal(identity(path.join(FRONTEND_ROOT, prefix + 'pages/a.ts')).feature, 'hris/people');
  assert.equal(identity(path.join(FRONTEND_ROOT, 'apps/dwp/src/features/hris/performance/model/a.ts')).feature, 'hris/performance');
});

test('foreign feature public barrel is legal, but a lookalike nested index remains internal', () => {
  const sources = {
    [prefix + 'hooks/x.ts']: "import {publicValue} from '@hris-fixture/performance'; export const x=publicValue;",
    'apps/dwp/src/features/hris/performance/index.ts': 'export const publicValue=1;',
  };
  assert.equal(inspect(sources).structuralPass, true);
  sources[prefix + 'hooks/x.ts'] = "import '@hris-fixture/performance/model';";
  sources['apps/dwp/src/features/hris/performance/model/index.ts'] = 'export {};';
  assert.equal(inspect(sources).errors.some((error) => error.code === 'FOREIGN_FEATURE_INTERNAL'), true);
});

test('same layer acyclic helpers are allowed but type-only cycles are not hidden', () => {
  const sources = { [prefix + 'model/a.ts']: "import type {B} from './b'; export type A=B;", [prefix + 'model/b.ts']: 'export type B=string;' };
  assert.equal(inspect(sources).structuralPass, true);
  sources[prefix + 'model/b.ts'] = "import type {A} from './a'; export type B=A;";
  assert.equal(inspect(sources).errors.some((error) => error.code === 'IMPORT_CYCLE'), true);
});

test('ordinary comments and strings do not manufacture imports or raw fetch calls', () => {
  const sources = { [prefix + 'pages/a.ts']: "// import '../api/x'; fetch('/api/x');\nexport const text=\"import('../api/x')\";" };
  assert.equal(inspect(sources).structuralPass, true);
});

test('qualified and string-element browser transport calls cannot bypass the AST raw-transport rule', () => {
  for (const code of ["window.fetch('/api/x');", "globalThis['fetch']('/api/x');", "new window.WebSocket('wss://example.test');", "navigator.sendBeacon('/api/x');"]) {
    assert.equal(inspect({ [prefix + 'pages/a.ts']: code }).errors.some((error) => error.code === 'FEATURE_RAW_TRANSPORT'), true);
  }
});

test('an HRIS-root file is explicitly unclassified instead of disappearing from coverage', () => {
  const result = inspect({ 'apps/dwp/src/features/hris/Root.tsx': 'export const Root=()=>null;' });
  assert.equal(result.unclassifiedCount, 1);
  assert.equal(result.structuralPass, false);
});

test('missing relative project target is rejected, not treated as an external dependency', () => {
  assert.equal(inspect({ [prefix + 'pages/a.ts']: "import '../hooks/missing';" }).errors.some((error) => error.code === 'UNRESOLVED_PROJECT_IMPORT'), true);
});

test('computed template import is rejected while a no-substitution template is resolved', () => {
  const tick = String.fromCharCode(96);
  const sources = { [prefix + 'hooks/a.ts']: 'export const a=()=>import(' + tick + './b' + tick + ');', [prefix + 'hooks/b.ts']: 'export {};' };
  assert.equal(inspect(sources).structuralPass, true);
  sources[prefix + 'hooks/a.ts'] = 'export const a=(name:string)=>import(' + tick + './' + '$' + '{name}' + tick + ');';
  assert.equal(inspect(sources).errors.some((error) => error.code === 'COMPUTED_IMPORT'), true);
});

test('renamed generated DTO via actual configured alias is rejected in UI and allowed in api', () => {
  const realAliases = readAliases(), target = realAliases['@dwp-frontend/api-contracts'][0];
  const sources = {
    [prefix + 'hooks/a.ts']: "import type {Dto as Anything} from '@dwp-frontend/api-contracts'; export type A=Anything;",
    [path.relative(FRONTEND_ROOT, target)]: '// @generated\nexport type Dto={public_id:string};',
  };
  assert.equal(inspect(sources, { aliases: realAliases }).errors.some((error) => error.code === 'UI_TRANSPORT_DTO'), true);
  const apiSources = { [prefix + 'api/a.ts']: sources[prefix + 'hooks/a.ts'], [path.relative(FRONTEND_ROOT, target)]: sources[path.relative(FRONTEND_ROOT, target)] };
  assert.equal(inspect(apiSources, { aliases: realAliases }).structuralPass, true);
});

test('import-equals cannot bypass nested HRIS isolation', () => {
  const sources = { [prefix + 'hooks/a.ts']: "import x=require('@hris-fixture/performance/model/a'); export {x};",
    'apps/dwp/src/features/hris/performance/model/a.ts': 'export const a=1;' };
  assert.equal(inspect(sources).errors.some((error) => error.code === 'FOREIGN_FEATURE_INTERNAL'), true);
});

test('flat pilot sources and an empty namespace cannot give a zero-coverage PASS', () => {
  for (const sources of [{}, { [prefix + 'pilot.tsx']: 'export const Pilot=()=>null;' }]) {
    const result = inspect(sources);
    assert.equal(result.layeredCount, 0);
    assert.equal(result.structuralPass, false);
    assert.equal(result.errors.some((error) => error.code === 'NO_LAYERED_HRIS_SOURCES'), true);
  }
});

test('CSV quote parsing and exact contract comparison are read-only operations', () => {
  assert.deepEqual(csvRows('a,b\n"x,y","z""q"\n'), [{ a: 'x,y', b: 'z"q' }]);
  assert.throws(() => csvRows('a,a\n1,2'), /duplicate/);
  assert.throws(() => csvRows('a,b\n"x,y'), /Unterminated/);
  const register = process.env.HRIS_STRUCTURE_REGISTER;
  if (register) {
    const before = sha256(fs.readFileSync(register));
    assert.equal(readContract(register).structuralPass, true);
    assert.equal(sha256(fs.readFileSync(register)), before);
  }
  assert.equal(EDGES.join('|').split('|').length, 12);
  assert.equal(FORBIDDEN.split('|').length, 4);
});

test('evidence hashes exact source namespace and labels installed package versions without readiness', () => {
  const sources = { a: 'first', b: 'second' }, a = sourceEvidence(sources), b = sourceEvidence({ b: 'second', a: 'first' });
  assert.equal(a.namespaceSha256, b.namespaceSha256);
  assert.notEqual(a.namespaceSha256, sourceEvidence({ a: 'changed', b: 'second' }).namespaceSha256);
  assert.equal(a.namespaceCount, 2);
  assert.ok(a.pins.every((pin) => /^[0-9a-f]{64}$/.test(pin.sha256) && /^\d+$/.test(pin.mtimeNs)));
  assert.equal(typeof a.versions.reactQuery, 'string');
});
