'use strict';
// Full installed Draft-07 engine. Input/output only; no filesystem mutation.
const fs = require('node:fs');
const {createRequire} = require('node:module');
const sourceRequire = createRequire('/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend/package.json');
const Ajv = sourceRequire('ajv');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const ajv = new Ajv({allErrors: true, jsonPointers: true, strictKeywords: true, coerceTypes: false, useDefaults: false, removeAdditional: false, unknownFormats: 'fail'});
ajv.addKeyword('referenceContract');
const annotations = new Set();
function scan(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('x-')) annotations.add(key);
    scan(child);
  }
}
scan(input.definitions);
for (const key of annotations) ajv.addKeyword(key);
function draft07(value) {
  if (Array.isArray(value)) return value.map(draft07);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) =>
    [key === '$defs' ? 'definitions' : key, key === '$ref' && typeof child === 'string' ? child.replace('#/$defs/', '#/definitions/') : draft07(child)]));
}
const errors = [];
let compiled = 0;
for (const [name, schema] of Object.entries(input.schemas)) {
  const validate = ajv.compile(draft07({$schema: 'http://json-schema.org/draft-07/schema#', $defs: input.definitions, ...schema}));
  compiled++;
  for (const c of input.cases.filter(c => c.schema === name)) {
    const valid = validate(c.value);
    if (valid !== c.valid) errors.push({caseId: c.id, expectedValid: c.valid, valid, errors: validate.errors});
  }
}
process.stdout.write(JSON.stringify({engine: 'Ajv', version: sourceRequire('ajv/package.json').version, dialect: 'FULL_DRAFT_07', referenceStorageTransformation: '$defs→definitions', annotations: [...annotations], compiled, cases: input.cases.length, errors}));
process.exitCode = errors.length ? 1 : 0;
