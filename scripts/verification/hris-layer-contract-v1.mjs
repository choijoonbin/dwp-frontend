#!/usr/bin/env node
// Verification-only. No repository edits, browser execution, domain readiness, or Gate mutation.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const self = fileURLToPath(import.meta.url);
export const FRONTEND_ROOT = path.resolve(path.dirname(self), '../..');
export const FIXTURE_FILE = path.join(path.dirname(self), 'fixtures/hris-layer-contract-v1.json');
export const EDGES = Object.freeze([
  'routes>pages', 'pages>components', 'pages>model', 'pages>hooks', 'pages>forms',
  'components>model', 'api>model', 'forms>model', 'hooks>api', 'hooks>model',
  'hooks>forms', 'testing>public-api',
]);
export const FORBIDDEN = 'feature->foreign_feature_internal|ui->transport_dto|model->react|feature->gateway_raw_client';
const layers = new Set(['routes', 'pages', 'components', 'api', 'model', 'forms', 'hooks', 'testing']);
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.cts'];
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const slash = (value) => value.split(path.sep).join('/');
const absoluteSources = (sources, root) => new Map(Object.entries(sources).map(([file, text]) => [path.resolve(root, file), text]));

export function csvRows(text) {
  const rows = [], row = [];
  let value = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(value.replace(/\r$/, '')); value = '';
      if (char === '\n') { rows.push(row.splice(0)); }
    } else value += char;
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  if (!rows.length || new Set(rows[0]).size !== rows[0].length) throw new Error('Missing or duplicate CSV header');
  const header = rows.shift();
  return rows.filter((cells) => cells.some(Boolean)).map((cells) => {
    if (cells.length !== header.length) throw new Error('CSV column cardinality mismatch');
    return Object.fromEntries(header.map((key, index) => [key, cells[index]]));
  });
}

export function readContract(file) {
  const bytes = fs.readFileSync(file), rows = csvRows(bytes.toString('utf8')), errors = [];
  const expected = ['HRIS-HRM', 'HRIS-PER', 'HRIS-TIM', 'HRIS-PAY', 'HRIS-SYS'];
  if (rows.length !== 5 || new Set(rows.map((row) => row.session_id)).size !== 5
      || expected.some((id) => !rows.some((row) => row.session_id === id))) errors.push('EXACT_FIVE_SESSION_SCOPE');
  for (const row of rows) {
    if (row.frontend_layer_contract !== EDGES.join('|')) errors.push('LAYER_CONTRACT:' + row.session_id);
    if (row.frontend_forbidden_dependencies !== FORBIDDEN) errors.push('FORBIDDEN_CONTRACT:' + row.session_id);
  }
  return { file: path.resolve(file), sha256: sha256(bytes), rows: rows.map((row) => ({
    sessionId: row.session_id, state: row.state, featureRoots: row.frontend_feature_roots,
  })), errors, structuralPass: errors.length === 0, readinessPass: false };
}

export function identity(file, root = FRONTEND_ROOT) {
  const relative = slash(path.relative(root, file));
  if (!relative.startsWith('apps/dwp/src/features/')) return undefined;
  const parts = relative.slice('apps/dwp/src/features/'.length).split('/');
  const nested = parts[0] === 'hris', count = nested && parts.length > 2 ? 2 : 1;
  if (parts.length <= count) return undefined;
  const tail = parts.slice(count);
  return { feature: parts.slice(0, count).join('/'), hris: nested,
    layer: layers.has(tail[0]) ? tail[0] : (tail.length === 1 && /^index\.[cm]?[jt]sx?$/.test(tail[0]) ? 'public-api' : undefined) };
}

export function readAliases(root = FRONTEND_ROOT) {
  const configFile = path.join(root, 'tsconfig.json');
  const read = ts.readConfigFile(configFile, ts.sys.readFile);
  if (read.error) throw new Error('Unreadable TypeScript configuration');
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root);
  if (parsed.errors.length) throw new Error('Invalid TypeScript configuration');
  return Object.fromEntries(Object.entries(parsed.options.paths ?? {}).map(([key, targets]) =>
    [key, targets.map((target) => path.resolve(parsed.options.baseUrl ?? root, target))]));
}

function resolveSpecifier(file, specifier, files, aliases) {
  const bases = [];
  let project = specifier.startsWith('.');
  if (project) bases.push(path.resolve(path.dirname(file), specifier));
  for (const [pattern, targets] of Object.entries(aliases)) {
    const star = pattern.indexOf('*');
    if (star < 0 ? specifier !== pattern
      : (!specifier.startsWith(pattern.slice(0, star)) || !specifier.endsWith(pattern.slice(star + 1)))) continue;
    project = true;
    const capture = star < 0 ? '' : specifier.slice(star, specifier.length - pattern.slice(star + 1).length);
    bases.push(...targets.map((target) => target.replace('*', capture)));
  }
  for (const base of bases) {
    const found = [base, ...extensions.map((ext) => base + ext),
      ...extensions.map((ext) => path.join(base, 'index' + ext))].find((candidate) => files.has(candidate));
    if (found) return { target: found, project: true };
  }
  return { project: project || specifier.startsWith('@dwp-frontend/') || specifier.includes('/features/hris/') };
}

function references(sourceFile) {
  const imports = [], unsafe = [];
  function visit(node) {
    let literal;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) literal = node.moduleSpecifier;
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) literal = node.argument.literal;
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) literal = node.moduleReference.expression;
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      if (node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) literal = node.arguments[0];
      else unsafe.push({ code: 'COMPUTED_IMPORT', node });
    }
    if (literal && ts.isStringLiteralLike(literal)) imports.push({ specifier: literal.text, node: literal });
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const name = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : ts.isElementAccessExpression(node.expression)
        && node.expression.argumentExpression && ts.isStringLiteralLike(node.expression.argumentExpression)
        ? node.expression.argumentExpression.text : node.expression.getText(sourceFile);
      if (/^(fetch|XMLHttpRequest|EventSource|WebSocket|sendBeacon)$/.test(name)) unsafe.push({ code: 'FEATURE_RAW_TRANSPORT', node });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { imports, unsafe };
}

function cycles(graph) {
  const index = new Map(), low = new Map(), stack = [], active = new Set(), result = [];
  let next = 0;
  function visit(file) {
    index.set(file, next); low.set(file, next); next += 1; stack.push(file); active.add(file);
    for (const target of graph.get(file) ?? []) {
      if (!index.has(target)) { visit(target); low.set(file, Math.min(low.get(file), low.get(target))); }
      else if (active.has(target)) low.set(file, Math.min(low.get(file), index.get(target)));
    }
    if (low.get(file) !== index.get(file)) return;
    const component = [];
    let member;
    do { member = stack.pop(); active.delete(member); component.push(member); } while (member !== file);
    if (component.length > 1 || graph.get(file)?.has(file)) result.push(component.sort());
  }
  for (const file of graph.keys()) if (!index.has(file)) visit(file);
  return result;
}

export function inspectSources(sources, { root = FRONTEND_ROOT, aliases = {}, edges = EDGES } = {}) {
  const files = absoluteSources(sources, root), graph = new Map([...files.keys()].map((file) => [file, new Set()]));
  const errors = [], usedEdges = new Set(), classified = [], unclassified = [];
  for (const [file, text] of files) {
    const from = identity(file, root), scoped = from?.hris;
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const report = (code, node, details = {}) => errors.push({ code, file: slash(path.relative(root, file)),
      line: node ? ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 : 1, ...details });
    if (scoped) {
      (from.layer ? classified : unclassified).push(slash(path.relative(root, file)));
      if (!from.layer) report('UNCLASSIFIED_FEATURE_LAYER');
      for (const diagnostic of ast.parseDiagnostics) report('PARSE_ERROR', undefined, { message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n') });
    }
    const refs = references(ast);
    if (scoped) for (const unsafe of refs.unsafe) report(unsafe.code, unsafe.node);
    for (const { specifier, node } of refs.imports) {
      const resolution = resolveSpecifier(file, specifier, files, aliases), target = resolution.target;
      if (target) graph.get(file).add(target);
      if (!scoped) continue;
      if (resolution.project && !target) report('UNRESOLVED_PROJECT_IMPORT', node, { specifier });
      if (from.layer === 'model' && /^(react(?:\/|$)|@tanstack\/react-query(?:\/|$))/.test(specifier)) report('MODEL_REACT', node, { specifier });
      if (from.layer === 'forms' && /^(react(?:\/|$)|@tanstack\/react-query(?:\/|$))/.test(specifier)) report('FORM_REACT', node, { specifier });
      if (!['hooks', 'testing'].includes(from.layer) && specifier.startsWith('@tanstack/react-query')) report('UI_QUERY_ORCHESTRATION', node, { specifier });
      const transport = /(?:^|\/)(?:api-contracts|generated)(?:\/|$)/.test(specifier)
        || (target && (/\/(?:api-contracts|generated)\//.test(slash(target)) || /@generated/.test(files.get(target).slice(0, 512))));
      if (transport && from.layer !== 'api') report('UI_TRANSPORT_DTO', node, { specifier });
      if (/gateway[-_/](?:raw|client)|(?:^|\/)raw[-_]client(?:[./]|$)/.test(specifier)) report('FEATURE_GATEWAY_RAW_CLIENT', node, { specifier });
      if (from.layer !== 'api' && (specifier === 'axios' || /axios-instance/.test(specifier))) report('UI_RAW_CLIENT', node, { specifier });
      const to = target && identity(target, root);
      if (!to) continue;
      if (from.feature !== to.feature) {
        if (to.layer !== 'public-api') report('FOREIGN_FEATURE_INTERNAL', node, { specifier, targetFeature: to.feature });
      } else if (from.layer !== 'public-api' && from.layer && to.layer && from.layer !== to.layer) {
        const edge = from.layer + '>' + to.layer; usedEdges.add(edge);
        if (!edges.includes(edge)) report('FORBIDDEN_LAYER_EDGE', node, { edge, specifier });
      } else if (from.layer && !to.layer) report('UNCLASSIFIED_TARGET_LAYER', node, { specifier });
    }
  }
  for (const component of cycles(graph)) if (component.some((file) => identity(file, root)?.hris))
    errors.push({ code: 'IMPORT_CYCLE', files: component.map((file) => slash(path.relative(root, file))) });
  const layeredCount = classified.filter((file) => identity(path.resolve(root, file), root).layer !== 'public-api').length;
  if (layeredCount === 0) errors.push({ code: 'NO_LAYERED_HRIS_SOURCES' });
  return { sourceCount: files.size, classifiedCount: classified.length, layeredCount, unclassifiedCount: unclassified.length,
    classified, unclassified, usedEdges: [...usedEdges].sort(), errors,
    structuralPass: errors.length === 0 && layeredCount > 0, readinessPass: false, g3StartAuthorized: false };
}

export function compileFixture(sources, root = FRONTEND_ROOT) {
  const virtualRoot = path.join(root, '__hris_readonly_compile_fixture__'), files = absoluteSources(sources, virtualRoot);
  const directories = new Set();
  for (const file of files.keys()) for (let dir = path.dirname(file); dir.startsWith(virtualRoot); dir = path.dirname(dir)) directories.add(dir);
  const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
    types: ['react'], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'] };
  const original = ts.createCompilerHost(options), host = { ...original,
    fileExists: (file) => files.has(file) || original.fileExists(file),
    readFile: (file) => files.get(file) ?? original.readFile(file),
    directoryExists: (dir) => directories.has(dir) || original.directoryExists(dir),
    realpath: (file) => files.has(file) ? file : original.realpath(file),
    getSourceFile: (file, language, onError) => files.has(file)
      ? ts.createSourceFile(file, files.get(file), language, true) : original.getSourceFile(file, language, onError),
    writeFile: () => { throw new Error('Verification compiler must never emit'); },
  };
  const program = ts.createProgram([...files.keys()], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
    code: diagnostic.code, file: diagnostic.file && slash(path.relative(virtualRoot, diagnostic.file.fileName)),
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  }));
  return { virtualSourceCount: files.size, diagnostics, structuralPass: diagnostics.length === 0,
    filesystemWrites: 0, emitRequested: false, domRendered: false, domainRuntimeExecuted: false };
}

export function readRepository(root = FRONTEND_ROOT) {
  const sources = {};
  function visit(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Symlink source traversal is unsupported: ' + slash(path.relative(root, file)));
      if (entry.isDirectory()) { if (!['node_modules', 'dist', 'coverage', '.turbo', '.git'].includes(entry.name)) visit(file); }
      else if (extensions.includes(path.extname(file))) sources[slash(path.relative(root, file))] = fs.readFileSync(file, 'utf8');
    }
  }
  visit(path.join(root, 'apps')); visit(path.join(root, 'libs'));
  return sources;
}

export function loadFixture(file = FIXTURE_FILE) {
  const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (fixture.contractId !== 'HRIS_LAYER_CONTRACT_VERIFICATION_V1' || fixture.schemaVersion !== 1
      || fixture.g3StartAuthorized !== false || fixture.domainRuntimeExecuted !== false
      || Object.keys(fixture.compileSources ?? {}).length !== 7 || !Array.isArray(fixture.negatives)
      || new Set(fixture.negatives.map((item) => item.id)).size !== fixture.negatives.length) throw new Error('Unsupported fixture envelope or scope');
  for (const fileName of Object.keys(fixture.compileSources)) if (path.isAbsolute(fileName) || fileName.split(/[\\/]/).includes('..'))
    throw new Error('Unsafe virtual compile source path');
  return fixture;
}

export function fixtureChecks(fixture = loadFixture(), root = FRONTEND_ROOT) {
  const prefix = 'apps/dwp/src/features/hris/people/';
  const compile = compileFixture(fixture.compileSources, root);
  const graph = inspectSources(Object.fromEntries(Object.entries(fixture.compileSources).map(([file, text]) => [prefix + file, text])), { root });
  const testing = inspectSources(fixture.testingSources, { root });
  const aliases = Object.fromEntries(Object.entries(fixture.fixtureAliases).map(([key, targets]) => [key, targets.map((target) => path.resolve(root, target))]));
  const negatives = fixture.negatives.map((item) => {
    const result = inspectSources(item.sources, { root, aliases });
    return { id: item.id, expectedCode: item.expectedCode, rejected: result.errors.some((error) => error.code === item.expectedCode), errors: result.errors };
  });
  const coveredEdges = [...new Set([...graph.usedEdges, ...testing.usedEdges])].sort();
  return { compile, graph, testing, coveredEdges, negatives,
    structuralPass: compile.structuralPass && graph.structuralPass && testing.structuralPass
      && EDGES.every((edge) => coveredEdges.includes(edge)) && negatives.every((item) => item.rejected),
    readinessPass: false, g3StartAuthorized: false, apiImplementations: 'SYNTHETIC_MAPPING_AND_DECLARATION_ONLY_NOT_EXECUTED' };
}

export function sourceEvidence(sources, root = FRONTEND_ROOT, extraFiles = []) {
  const pins = [self, path.join(path.dirname(self), 'hris-layer-contract-v1.test.mjs'), FIXTURE_FILE,
    path.join(root, 'package.json'), path.join(root, 'tsconfig.json'), path.join(root, 'tsconfig.base.json'), ...extraFiles]
    .map((file) => ({ file: path.resolve(file), sha256: sha256(fs.readFileSync(file)), mtimeNs: fs.statSync(file, { bigint: true }).mtimeNs.toString() }));
  const namespace = Object.entries(sources).sort(([a], [b]) => a.localeCompare(b)).map(([file, text]) => ({ file, sha256: sha256(text) }));
  const diskNs = namespace.filter((item) => fs.existsSync(path.resolve(root, item.file))).map((item) => ({
    file: item.file, mtimeNs: fs.statSync(path.resolve(root, item.file), { bigint: true }).mtimeNs.toString(),
  }));
  return { pins, namespaceCount: namespace.length, namespaceSha256: sha256(JSON.stringify(namespace)),
    diskNamespaceNsCount: diskNs.length, diskNamespaceNsSha256: sha256(JSON.stringify(diskNs)),
    versions: { typescript: ts.version, react: require('react/package.json').version, reactQuery: require('@tanstack/react-query/package.json').version } };
}

export function main(args = process.argv.slice(2)) {
  const started = new Date(), parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    if (!['--mode', '--root', '--register', '--require-readiness'].includes(args[index])) throw new Error('Unknown verification option');
    if (args[index] === '--require-readiness') parsed.requireReadiness = true;
    else { if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Missing option value'); parsed[args[index].slice(2)] = args[++index]; }
  }
  const root = path.resolve(parsed.root ?? FRONTEND_ROOT), mode = parsed.mode ?? 'fixture';
  if (!['fixture', 'scan', 'contract'].includes(mode)) throw new Error('Unsupported verification mode');
  if (mode === 'contract' && !parsed.register) throw new Error('Contract mode requires an explicit register');
  const sources = mode === 'scan' ? readRepository(root) : {};
  const result = mode === 'fixture' ? fixtureChecks(loadFixture(), root)
    : mode === 'scan' ? inspectSources(sources, { root, aliases: readAliases(root) }) : readContract(parsed.register);
  const register = parsed.register && mode !== 'contract' ? readContract(parsed.register) : undefined;
  const structuralPass = result.structuralPass && (!register || register.structuralPass);
  const exitCode = structuralPass && !parsed.requireReadiness ? 0 : 1, ended = new Date();
  const evidence = { contractId: 'HRIS_LAYER_VERIFICATION_EVIDENCE_V1', mode, argv: process.argv, cwd: process.cwd(),
    startedAtUtc: started.toISOString(), endedAtUtc: ended.toISOString(), elapsedMs: ended.getTime() - started.getTime(),
    exitCode, evidenceScope: mode === 'fixture' ? 'IN_MEMORY_COMPILE_AND_AST_ONLY' : mode === 'scan' ? 'ACTUAL_REPOSITORY_HRIS_LAYER_SCAN_ONLY' : 'REGISTER_ONLY',
    structuralPass, readinessPass: false, g3StartAuthorized: false, result, register,
    sourceEvidence: sourceEvidence(sources, root, parsed.register ? [parsed.register] : []) };
  console.log(JSON.stringify(evidence, null, 2));
  return exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  try { process.exitCode = main(); }
  catch (error) { console.error(JSON.stringify({ structuralPass: false, readinessPass: false, g3StartAuthorized: false, error: error.message })); process.exitCode = 1; }
}
