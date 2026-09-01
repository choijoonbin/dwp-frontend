import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { checkUnusedInternalExports } from './check-unused-internal-exports.mjs';

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const allowance = (path, name) => ({
  path,
  name,
  owner: 'Architecture',
  reason: 'Reserved internal verification contract.',
  removalCondition: 'Remove when the contract is retired.',
});

function fixture(entries = [], maximumEntries = entries.length) {
  const root = mkdtempSync(join(tmpdir(), 'dwp-internal-exports-'));
  temporaryDirectories.push(root);
  mkdirSync(join(root, 'apps/dwp/src/components'), { recursive: true });
  mkdirSync(join(root, 'apps/dwp/src/features/example'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  writeFileSync(
    join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler' },
      include: ['apps'],
    })
  );
  writeFileSync(
    join(root, 'scripts/internal-export-allowlist.json'),
    `${JSON.stringify({ version: 1, maximumEntries, entries }, null, 2)}\n`
  );
  return root;
}

test('accepts internal exports referenced by production or verification code', () => {
  const root = fixture();
  writeFileSync(
    join(root, 'apps/dwp/src/components/value.ts'),
    'export const runtimeValue = 1; export const verifiedValue = 2;\n'
  );
  writeFileSync(
    join(root, 'apps/dwp/src/features/example/consumer.ts'),
    "import { runtimeValue } from '../../components/value'; void runtimeValue;\n"
  );
  writeFileSync(
    join(root, 'apps/dwp/src/components/value.test.ts'),
    "import { verifiedValue } from './value'; void verifiedValue;\n"
  );
  assert.deepEqual(checkUnusedInternalExports({ repositoryRoot: root }).errors, []);
});

test('rejects a new unused named internal export', () => {
  const root = fixture();
  writeFileSync(join(root, 'apps/dwp/src/components/value.ts'), 'export const orphan = true;\n');
  assert.deepEqual(checkUnusedInternalExports({ repositoryRoot: root }).errors, [
    'unused internal export: apps/dwp/src/components/value.ts#orphan',
  ]);
});

test('enforces exact exceptions without stale entries or headroom', () => {
  const entry = allowance('apps/dwp/src/components/value.ts', 'orphan');
  const root = fixture([entry]);
  writeFileSync(join(root, 'apps/dwp/src/components/value.ts'), 'export const orphan = true;\n');
  assert.deepEqual(checkUnusedInternalExports({ repositoryRoot: root }).errors, []);

  const staleRoot = fixture([entry]);
  writeFileSync(join(staleRoot, 'apps/dwp/src/components/value.ts'), 'export const used = true;\n');
  writeFileSync(
    join(staleRoot, 'apps/dwp/src/features/example/use.ts'),
    "import { used } from '../../components/value'; void used;\n"
  );
  assert.ok(
    checkUnusedInternalExports({ repositoryRoot: staleRoot }).errors.includes(
      'stale allowlist entry: apps/dwp/src/components/value.ts#orphan'
    )
  );

  const headroomRoot = fixture([entry], 2);
  writeFileSync(
    join(headroomRoot, 'apps/dwp/src/components/value.ts'),
    'export const orphan = true;\n'
  );
  assert.ok(
    checkUnusedInternalExports({ repositoryRoot: headroomRoot }).errors.some((error) =>
      error.startsWith('allowlist maximumEntries must equal the exact current inventory')
    )
  );
});

test('excludes default exports and generated dynamic contracts', () => {
  const root = fixture();
  writeFileSync(
    join(root, 'apps/dwp/src/components/default-view.ts'),
    'export default function DefaultView() { return null; }\n'
  );
  writeFileSync(
    join(root, 'apps/dwp/src/features/example/example-product-manifest.ts'),
    'export const manifest = {};\n'
  );
  assert.deepEqual(checkUnusedInternalExports({ repositoryRoot: root }).errors, []);
});
