import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checker = resolve(root, 'scripts/check-product-surface-production-readiness.mjs');
const temporaryDirectories = [];

export function cleanupReadinessFixtures() {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function createReadinessFixtureDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'dwp-product-surface-readiness-'));
  temporaryDirectories.push(directory);
  return directory;
}

export function run(value, arguments_ = [], environment = {}) {
  writeFileSync(value.path, `${JSON.stringify(value.manifest, null, 2)}\n`);
  writeFileSync(value.closurePath, `${JSON.stringify(value.closure, null, 2)}\n`);
  writeFileSync(value.authorizationPath, `${JSON.stringify(value.authorization, null, 2)}\n`);
  writeFileSync(value.trustPolicyPath, `${JSON.stringify(value.trustPolicy, null, 2)}\n`);
  const evidenceArguments = [];
  if (value.evidenceCheckout) {
    evidenceArguments.push('--evidence-checkout', value.evidenceCheckout);
  }
  if (value.evidenceRevision) {
    evidenceArguments.push('--evidence-revision', value.evidenceRevision);
  }
  return spawnSync(
    process.execPath,
    [
      checker,
      '--manifest',
      value.path,
      '--closure',
      value.closurePath,
      '--authorization',
      value.authorizationPath,
      '--trust-policy',
      value.trustPolicyPath,
      '--root',
      root,
      ...evidenceArguments,
      ...arguments_,
    ],
    { cwd: root, encoding: 'utf8', env: { ...process.env, ...environment } }
  );
}
