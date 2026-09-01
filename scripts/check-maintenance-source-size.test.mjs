import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checker = resolve(repositoryRoot, 'scripts/check-maintenance-source-size.mjs');
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixture(files = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'dwp-maintenance-source-size-'));
  temporaryDirectories.push(directory);
  mkdirSync(join(directory, 'scripts'), { recursive: true });
  mkdirSync(join(directory, 'e2e'), { recursive: true });
  writeFileSync(
    join(directory, 'scripts/maintenance-source-size-baseline.json'),
    `${JSON.stringify({ version: 1, files }, null, 2)}\n`
  );
  return directory;
}

function oversizedSource(lines) {
  return 'export const value = 1;\n'.repeat(lines);
}

function run(directory, args = []) {
  return spawnSync(process.execPath, [checker, ...args], {
    cwd: directory,
    encoding: 'utf8',
  });
}

test('accepts an exact legacy maintenance exception', () => {
  const relative = 'e2e/legacy.spec.ts';
  const directory = fixture({ [relative]: 1_005 });
  writeFileSync(join(directory, relative), oversizedSource(1_005));

  const result = run(directory);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 exact legacy exception/);
});

test('rejects a new maintenance file above the default limit', () => {
  const directory = fixture();
  writeFileSync(join(directory, 'e2e/new-large.spec.ts'), oversizedSource(1_001));

  const result = run(directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /new-large\.spec\.ts: 1001 lines exceeds 1000/);
});

test('rejects growth above an exact maintenance baseline', () => {
  const relative = 'scripts/legacy.mjs';
  const directory = fixture({ [relative]: 1_005 });
  writeFileSync(join(directory, relative), oversizedSource(1_006));

  const result = run(directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /legacy\.mjs: 1006 lines exceeds 1005/);
});

test('rejects stale and no-longer-needed maintenance exceptions', () => {
  const reduced = 'e2e/reduced.spec.ts';
  const directory = fixture({
    [reduced]: 1_005,
    'e2e/deleted.spec.ts': 1_010,
  });
  writeFileSync(join(directory, reduced), oversizedSource(999));

  const result = run(directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no longer needs an exception/);
  assert.match(result.stderr, /deleted\.spec\.ts: stale maintenance source-size baseline entry/);
});

test('requires a baseline refresh after an oversized file shrinks', () => {
  const relative = 'e2e/shrunk.spec.ts';
  const directory = fixture({ [relative]: 1_010 });
  writeFileSync(join(directory, relative), oversizedSource(1_005));

  const result = run(directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /reduced from 1010 to 1005 lines/);
});

test('baseline writer cannot add a new oversized maintenance exception', () => {
  const directory = fixture();
  writeFileSync(join(directory, 'scripts/new-large.mjs'), oversizedSource(1_001));

  const result = run(directory, ['--write']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to raise the maintenance source-size baseline/);
});

test('invalid maintenance paths and limits fail closed', () => {
  const invalidBaselines = [
    { '../outside.ts': 1_005 },
    { 'apps/dwp/src/not-maintenance.ts': 1_005 },
    { 'e2e/not-source.json': 1_005 },
    { 'e2e/large.spec.ts': 1_000 },
    { 'e2e/large.spec.ts': 'unbounded' },
  ];

  for (const files of invalidBaselines) {
    const directory = fixture(files);
    const result = run(directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid maintenance source-size baseline/);
  }
});
