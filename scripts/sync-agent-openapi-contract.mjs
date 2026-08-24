#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import openapiTS, { astToString } from 'openapi-typescript';

const root = process.cwd();
const mode = process.argv[2];
if (!['--sync', '--check'].includes(mode)) {
  console.error('Usage: node scripts/sync-agent-openapi-contract.mjs --sync|--check');
  process.exit(2);
}

const contractRoot = path.join(root, 'libs/api-contracts');
const snapshot = path.join(contractRoot, 'openapi/agent-public.json');
const generatedTarget = path.join(contractRoot, 'src/agent-public.ts');
const agentSource = path.resolve(
  process.env.DWP_AGENT_OPENAPI ??
    path.join(root, '../dwp_agent/contracts/openapi/agent-public.json')
);
const sourceIsExplicit = Boolean(process.env.DWP_AGENT_OPENAPI);

const canonicalizeJson = (value) => {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalizeJson(nestedValue)])
    );
  }
  return value;
};
const readCanonicalJson = (file) =>
  JSON.stringify(canonicalizeJson(JSON.parse(fs.readFileSync(file, 'utf8'))));

if (mode === '--sync') {
  if (!fs.existsSync(agentSource)) {
    console.error(`Agent contract is missing: ${agentSource}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(snapshot), { recursive: true });
  fs.copyFileSync(agentSource, snapshot);
}
if (!fs.existsSync(snapshot)) {
  console.error(`Frontend Agent contract snapshot is missing: ${snapshot}`);
  process.exit(1);
}
if (mode === '--check' && fs.existsSync(agentSource)) {
  if (readCanonicalJson(agentSource) !== readCanonicalJson(snapshot)) {
    console.error(
      'Frontend Agent contract differs from the runtime contract. Run yarn openapi:sync.'
    );
    process.exit(1);
  }
} else if (mode === '--check' && sourceIsExplicit) {
  console.error(`Configured Agent contract is missing: ${agentSource}`);
  process.exit(1);
}

const ast = await openapiTS(pathToFileURL(snapshot));
const generated =
  '/** Generated from openapi/agent-public.json. Do not edit manually. */\n' + astToString(ast);
if (mode === '--sync') {
  fs.writeFileSync(generatedTarget, generated, 'utf8');
  console.log('Synchronized Agent OpenAPI snapshot and generated TypeScript contracts.');
} else if (
  !fs.existsSync(generatedTarget) ||
  fs.readFileSync(generatedTarget, 'utf8') !== generated
) {
  console.error('Generated Agent API types are stale. Run yarn openapi:sync.');
  process.exit(1);
} else {
  console.log('PASS generated Agent API types match the approved OpenAPI snapshot.');
}
