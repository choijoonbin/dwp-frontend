#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import openapiTS, { astToString } from 'openapi-typescript';

const root = process.cwd();
const [mode, explicitSource, ...unknownArguments] = process.argv.slice(2);
if (!['--sync', '--check'].includes(mode) || unknownArguments.length > 0) {
  console.error(
    'Usage: node scripts/sync-openapi-contract.mjs --sync [official artifact path] | --check [official artifact path]'
  );
  process.exit(2);
}

const contractRoot = path.join(root, 'libs/api-contracts');
const snapshot = path.join(contractRoot, 'openapi/gateway-public.json');
const generatedTarget = path.join(contractRoot, 'src/gateway-public.ts');
const configuredSource = explicitSource ?? process.env.DWP_GATEWAY_OPENAPI;
const officialSource = configuredSource ? path.resolve(configuredSource) : undefined;
const syncSource =
  officialSource ??
  path.resolve(path.join(root, '../dwp-backend/contracts/openapi/gateway-public.json'));

if (mode === '--sync') {
  if (!fs.existsSync(syncSource)) {
    console.error(`Backend Gateway contract is missing: ${syncSource}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(snapshot), { recursive: true });
  fs.copyFileSync(syncSource, snapshot);
}
if (!fs.existsSync(snapshot)) {
  console.error(`Frontend Gateway contract snapshot is missing: ${snapshot}`);
  process.exit(1);
}

const ast = await openapiTS(pathToFileURL(snapshot));
const generated =
  '/** Generated from contracts/openapi/gateway-public.json. Do not edit manually. */\n' +
  astToString(ast);

if (mode === '--sync') {
  fs.mkdirSync(path.dirname(generatedTarget), { recursive: true });
  fs.writeFileSync(generatedTarget, generated, 'utf8');
  console.log('Synchronized Gateway OpenAPI snapshot and generated TypeScript contracts.');
} else if (
  !fs.existsSync(generatedTarget) ||
  fs.readFileSync(generatedTarget, 'utf8') !== generated
) {
  console.error('Generated Gateway API types are stale. Run corepack yarn openapi:sync.');
  process.exit(1);
} else {
  if (officialSource) {
    if (!fs.existsSync(officialSource)) {
      console.error(`Official Gateway contract is missing: ${officialSource}`);
      process.exit(1);
    }
    if (!fs.readFileSync(snapshot).equals(fs.readFileSync(officialSource))) {
      console.error(
        'Frontend Gateway OpenAPI snapshot is not byte-identical to the official backend artifact.'
      );
      process.exit(1);
    }
  }
  console.log(
    'PASS generated Gateway API types match the approved OpenAPI snapshot' +
      `${officialSource ? '; official backend artifact matched.' : '.'}`
  );
}
