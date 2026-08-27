import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  readJsonFile,
  summarizeStates,
  validateEvidenceReference,
  validateProviderTenantManifest,
} from './release-evidence-validation.mjs';
import {
  RELEASE_READINESS_EXPECTED_IDS,
  validateReleaseReadinessPolicy,
} from './release-readiness-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = resolve(root, 'docs/06-delivery/release-evidence/release-readiness.json');
const providerTenantManifestPath = resolve(
  root,
  'docs/06-delivery/release-evidence/provider-tenant-acceptance.json'
);
const releaseMode = process.argv.includes('--release');

const expected = RELEASE_READINESS_EXPECTED_IDS;
const allowedStates = new Set([
  'COMPLETE',
  'PENDING_INTERNAL',
  'BLOCKED_EXTERNAL',
  'FEATURE_DISABLED',
]);
const errors = [];
const externalCheckouts = new Map();

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const providerTenantManifest = readJsonFile(providerTenantManifestPath);
if (registry.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
if (!/^\d{4}-\d{2}-\d{2}$/.test(registry.asOf ?? '')) {
  errors.push('asOf must be an ISO date.');
}

for (const section of Object.keys(expected)) {
  const items = registry[section];
  if (!Array.isArray(items)) {
    errors.push(`${section} must be an array.`);
    continue;
  }
  for (const item of items) validateItem(section, item);
}
errors.push(...validateReleaseReadinessPolicy(registry));

const providerTenantValidation = validateProviderTenantManifest(providerTenantManifest, {
  root,
  releaseMode,
  environment: process.env,
});
errors.push(...providerTenantValidation.errors);

if (errors.length) {
  console.error('Release evidence registry is invalid:\n');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const all = Object.keys(expected).flatMap((section) => registry[section]);
const counts = all.reduce((result, item) => {
  (result[item.state] ??= []).push(item);
  return result;
}, {});
console.log('DWP release evidence registry');
console.log(`- release: ${registry.release}`);
console.log(`- complete: ${(counts.COMPLETE ?? []).length}`);
console.log(`- safely disabled: ${(counts.FEATURE_DISABLED ?? []).length}`);
console.log(`- internal evidence pending: ${(counts.PENDING_INTERNAL ?? []).length}`);
console.log(`- external evidence pending: ${(counts.BLOCKED_EXTERNAL ?? []).length}`);
const providerTenantCounts = summarizeStates(providerTenantValidation.items);
console.log('- Provider-Tenant acceptance:');
console.log(`  - exact IDs: ${providerTenantValidation.items.length}`);
console.log(`  - complete: ${providerTenantCounts.COMPLETE}`);
console.log(`  - pending internal: ${providerTenantCounts.PENDING_INTERNAL}`);
console.log(`  - blocked external: ${providerTenantCounts.BLOCKED_EXTERNAL}`);
console.log(`  - feature disabled: ${providerTenantCounts.FEATURE_DISABLED}`);

if (releaseMode) {
  const blocked = releaseItems().filter((item) => item.state !== 'COMPLETE');
  const enabledWithoutDecision = registry.externalDecisions.filter(
    (item) => item.releaseRequired && item.state !== 'COMPLETE'
  );
  const unresolved = [
    ...blocked,
    ...enabledWithoutDecision,
    ...providerTenantValidation.releaseBlocked,
  ];
  if (unresolved.length) {
    console.error('\nRelease gate blocked by required evidence:');
    unresolved.forEach((item) =>
      console.error(`- ${item.id} ${item.owner}: ${item.blockers.join(', ')}`)
    );
    process.exit(2);
  }
  console.log('\nRelease gate passed.');
} else {
  console.log('- mode: registry integrity (use yarn release:gate for launch authorization)');
}

function validateItem(section, item) {
  if (!item || typeof item !== 'object') {
    errors.push(`${section} contains a non-object item.`);
    return;
  }
  if (!allowedStates.has(item.state)) errors.push(`${item.id} has invalid state ${item.state}.`);
  for (const field of ['id', 'owner', 'summary']) {
    if (typeof item[field] !== 'string' || !item[field].trim()) {
      errors.push(`${item.id ?? section} requires ${field}.`);
    }
  }
  if (typeof item.releaseRequired !== 'boolean') {
    errors.push(`${item.id} releaseRequired must be boolean.`);
  }
  if (item.state === 'BLOCKED_EXTERNAL' && !nonEmpty(item.blockers)) {
    errors.push(`${item.id} requires explicit blockers.`);
  }
  if (item.state === 'PENDING_INTERNAL') {
    if (!item.releaseRequired)
      errors.push(`${item.id} internal work must remain release-required.`);
    if (!nonEmpty(item.blockers)) errors.push(`${item.id} requires explicit internal blockers.`);
    if (!nonEmpty(item.failClosedEvidence)) {
      errors.push(`${item.id} requires failClosedEvidence while internal work remains.`);
    }
  }
  if (item.state === 'FEATURE_DISABLED') {
    if (item.releaseRequired) errors.push(`${item.id} cannot be disabled and release-required.`);
    if (!nonEmpty(item.failClosedEvidence)) {
      errors.push(`${item.id} requires failClosedEvidence.`);
    }
  }
  if (item.state === 'COMPLETE' && !nonEmpty(item.evidence)) {
    errors.push(`${item.id} cannot be complete without evidence.`);
  }
  for (const evidence of [...(item.evidence ?? []), ...(item.failClosedEvidence ?? [])]) {
    errors.push(
      ...validateEvidenceReference(
        evidence,
        { root, releaseMode, environment: process.env, externalCheckouts },
        item.id
      )
    );
  }
}

function releaseItems() {
  return [...registry.qualityGates, ...registry.productionHardening, ...registry.approvals].filter(
    (item) => item.releaseRequired
  );
}

function nonEmpty(value) {
  return Array.isArray(value) && value.length > 0;
}
