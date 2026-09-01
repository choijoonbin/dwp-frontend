import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { checkProductionReachability } from './check-production-reachability.mjs';

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixture(entries = [], maximumEntries = entries.length) {
  const root = mkdtempSync(join(tmpdir(), 'dwp-production-reachability-'));
  temporaryDirectories.push(root);
  mkdirSync(join(root, 'apps/dwp/src/routes'), { recursive: true });
  mkdirSync(join(root, 'apps/dwp/src/features/example'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  writeFileSync(
    join(root, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler' } })
  );
  writeFileSync(
    join(root, 'scripts/production-reachability-allowlist.json'),
    `${JSON.stringify({ version: 1, maximumEntries, entries }, null, 2)}\n`
  );
  return root;
}

const allowance = (path) => ({
  path,
  owner: 'Architecture',
  reason: 'Verification-only contract.',
  removalCondition: 'Remove with the verification adapter.',
});

test('follows static, re-export, literal dynamic and Vite virtual roots', () => {
  const root = fixture();
  writeFileSync(join(root, 'apps/dwp/src/main.tsx'), "import('./lazy');\n");
  writeFileSync(join(root, 'apps/dwp/src/lazy.ts'), "export { value } from './value';\n");
  writeFileSync(join(root, 'apps/dwp/src/value.ts'), 'export const value = true;\n');
  writeFileSync(
    join(root, 'apps/dwp/src/routes/example-routes.tsx'),
    'export const routes = [];\n'
  );
  writeFileSync(
    join(root, 'apps/dwp/src/features/example/example-product-manifest.ts'),
    'export const manifest = {};\n'
  );
  writeFileSync(
    join(root, 'vite.product.config.ts'),
    "const routeExports = { example: ['example-routes.tsx', 'routes'] };\n" +
      "const manifestExports = { example: [['example/example-product-manifest.ts', 'manifest']] };\n"
  );

  const result = checkProductionReachability({
    repositoryRoot: root,
    entryRoots: ['apps/dwp/src/main.tsx'],
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.candidates, 5);
  assert.equal(result.reachable, 5);
});

test('rejects a newly unreachable production module', () => {
  const root = fixture();
  writeFileSync(join(root, 'apps/dwp/src/main.tsx'), 'export {};\n');
  writeFileSync(join(root, 'apps/dwp/src/orphan.ts'), 'export const orphan = true;\n');

  const result = checkProductionReachability({
    repositoryRoot: root,
    entryRoots: ['apps/dwp/src/main.tsx'],
  });

  assert.deepEqual(result.errors, ['unreachable production module: apps/dwp/src/orphan.ts']);
});

test('accepts a documented verification root but rejects stale and duplicate allowances', () => {
  const root = fixture([
    allowance('apps/dwp/src/verification-contract.ts'),
    allowance('apps/dwp/src/stale.ts'),
    allowance('apps/dwp/src/stale.ts'),
  ]);
  writeFileSync(join(root, 'apps/dwp/src/main.tsx'), 'export {};\n');
  writeFileSync(
    join(root, 'apps/dwp/src/verification-contract.ts'),
    'export const contract = true;\n'
  );

  const result = checkProductionReachability({
    repositoryRoot: root,
    entryRoots: ['apps/dwp/src/main.tsx'],
  });

  assert.ok(result.errors.includes('duplicate allowlist entry: apps/dwp/src/stale.ts'));
  assert.ok(result.errors.includes('stale allowlist entry: apps/dwp/src/stale.ts'));
  assert.ok(!result.errors.some((error) => error.includes('verification-contract')));
});

test('rejects allowlist growth or unclaimed headroom against the exact ratchet', () => {
  const root = fixture([allowance('apps/dwp/src/one.ts'), allowance('apps/dwp/src/two.ts')], 1);
  writeFileSync(join(root, 'apps/dwp/src/main.tsx'), 'export {};\n');
  writeFileSync(join(root, 'apps/dwp/src/one.ts'), 'export const one = true;\n');
  writeFileSync(join(root, 'apps/dwp/src/two.ts'), 'export const two = true;\n');

  const result = checkProductionReachability({
    repositoryRoot: root,
    entryRoots: ['apps/dwp/src/main.tsx'],
  });

  assert.ok(
    result.errors.includes(
      'allowlist maximumEntries must equal the exact current inventory: 2 entries, maximumEntries 1'
    )
  );

  const headroomRoot = fixture([allowance('apps/dwp/src/one.ts')], 2);
  writeFileSync(join(headroomRoot, 'apps/dwp/src/main.tsx'), 'export {};\n');
  writeFileSync(join(headroomRoot, 'apps/dwp/src/one.ts'), 'export const one = true;\n');
  const headroom = checkProductionReachability({
    repositoryRoot: headroomRoot,
    entryRoots: ['apps/dwp/src/main.tsx'],
  });
  assert.ok(
    headroom.errors.includes(
      'allowlist maximumEntries must equal the exact current inventory: 1 entries, maximumEntries 2'
    )
  );
});

test('excludes tests, test support and test utility fixtures from production candidates', () => {
  const root = fixture();
  writeFileSync(join(root, 'apps/dwp/src/main.tsx'), 'export {};\n');
  writeFileSync(join(root, 'apps/dwp/src/value.test.ts'), 'export {};\n');
  writeFileSync(join(root, 'apps/dwp/src/value.test-support.ts'), 'export {};\n');
  mkdirSync(join(root, 'apps/dwp/src/test-utils'), { recursive: true });
  writeFileSync(join(root, 'apps/dwp/src/test-utils/fixture.ts'), 'export {};\n');

  const result = checkProductionReachability({
    repositoryRoot: root,
    entryRoots: ['apps/dwp/src/main.tsx'],
  });

  assert.equal(result.candidates, 1);
  assert.deepEqual(result.errors, []);
});
