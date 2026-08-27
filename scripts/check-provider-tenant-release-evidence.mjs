#!/usr/bin/env node

import process from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  readJsonFile,
  summarizeStates,
  validateProviderTenantManifest,
} from './release-evidence-validation.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arguments_ = parseArguments(process.argv.slice(2));
const manifestPath = resolve(
  arguments_.manifest ??
    resolve(repositoryRoot, 'docs/06-delivery/release-evidence/provider-tenant-acceptance.json')
);
const root = resolve(arguments_.root ?? repositoryRoot);
let manifest;
try {
  manifest = readJsonFile(manifestPath);
} catch (error) {
  console.error(`Provider-Tenant release evidence is unreadable: ${error.message}`);
  process.exit(1);
}

const validation = validateProviderTenantManifest(manifest, {
  root,
  releaseMode: arguments_.release,
  environment: process.env,
});
if (validation.errors.length > 0) {
  console.error('Provider-Tenant release evidence is invalid:\n');
  validation.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

printSummary(manifest, validation.items);
if (arguments_.release && validation.releaseBlocked.length > 0) {
  console.error('\nProvider-Tenant release gate blocked by incomplete evidence:');
  validation.releaseBlocked.forEach((item) =>
    console.error(`- ${item.id} ${item.state}: ${item.blockers.join(', ')}`)
  );
  process.exit(2);
}
if (arguments_.release) console.log('\nProvider-Tenant release gate passed.');

function parseArguments(argv) {
  const parsed = { release: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--release') {
      parsed.release = true;
      continue;
    }
    if (argument === '--manifest' || argument === '--root') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) usage();
      parsed[argument === '--manifest' ? 'manifest' : 'root'] = value;
      index += 1;
      continue;
    }
    usage();
  }
  return parsed;
}

function usage() {
  console.error(
    'usage: node scripts/check-provider-tenant-release-evidence.mjs ' +
      '[--manifest <path>] [--root <repository-root>] [--release]'
  );
  process.exit(2);
}

function printSummary(manifestValue, items) {
  const counts = summarizeStates(items);
  console.log('Provider-Tenant acceptance evidence');
  console.log(`- manifest: ${manifestValue.manifestId}`);
  console.log(`- acceptance IDs: ${items.length}`);
  console.log(`- complete: ${counts.COMPLETE}`);
  console.log(`- pending internal: ${counts.PENDING_INTERNAL}`);
  console.log(`- blocked external: ${counts.BLOCKED_EXTERNAL}`);
  console.log(`- feature disabled: ${counts.FEATURE_DISABLED}`);
}
