import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = resolve(root, 'docs/06-delivery/release-evidence/release-readiness.json');
const releaseMode = process.argv.includes('--release');

const expected = {
  qualityGates: range('R2-', 1, 5),
  productionHardening: range('R3-', 1, 5),
  externalDecisions: range('D-', 1, 17),
  approvals: range('A-', 1, 5),
};
const allowedStates = new Set(['COMPLETE', 'BLOCKED_EXTERNAL', 'FEATURE_DISABLED']);
const errors = [];

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
if (registry.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
if (!/^\d{4}-\d{2}-\d{2}$/.test(registry.asOf ?? '')) {
  errors.push('asOf must be an ISO date.');
}

for (const [section, expectedIds] of Object.entries(expected)) {
  const items = registry[section];
  if (!Array.isArray(items)) {
    errors.push(`${section} must be an array.`);
    continue;
  }
  const ids = items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) errors.push(`${section} contains duplicate IDs.`);
  const missing = expectedIds.filter((id) => !ids.includes(id));
  const unknown = ids.filter((id) => !expectedIds.includes(id));
  if (missing.length) errors.push(`${section} is missing ${missing.join(', ')}.`);
  if (unknown.length) errors.push(`${section} has unknown IDs ${unknown.join(', ')}.`);

  for (const item of items) validateItem(section, item);
}

if (registry.status === 'READY' && releaseItems().some((item) => item.state !== 'COMPLETE')) {
  errors.push('Registry status cannot be READY while a release-required item is incomplete.');
}

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
console.log(`- external evidence pending: ${(counts.BLOCKED_EXTERNAL ?? []).length}`);

if (releaseMode) {
  const blocked = releaseItems().filter((item) => item.state !== 'COMPLETE');
  const enabledWithoutDecision = registry.externalDecisions.filter(
    (item) => item.releaseRequired && item.state !== 'COMPLETE'
  );
  const unresolved = [...blocked, ...enabledWithoutDecision];
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
    if (typeof evidence !== 'string' || !evidence.trim()) {
      errors.push(`${item.id} has an empty evidence reference.`);
      continue;
    }
    if (/^https:\/\//.test(evidence)) continue;
    const target = isAbsolute(evidence) ? evidence : resolve(root, evidence);
    if (!existsSync(target)) errors.push(`${item.id} evidence does not exist: ${evidence}.`);
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

function range(prefix, start, end) {
  return Array.from(
    { length: end - start + 1 },
    (_, index) => `${prefix}${String(start + index).padStart(2, '0')}`
  );
}
