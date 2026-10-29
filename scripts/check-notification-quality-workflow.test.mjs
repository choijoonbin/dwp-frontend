import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflowPath = new URL(
  '../.github/workflows/notification-frontend-quality.yml',
  import.meta.url
);
const workflow = readFileSync(workflowPath, 'utf8');
const performanceSpec = readFileSync(
  new URL('../e2e/notification-performance.spec.ts', import.meta.url),
  'utf8'
);
const routeBudgets = JSON.parse(
  readFileSync(new URL('./notification-route-budgets.json', import.meta.url), 'utf8')
);
const pinnedSetupNode = 'actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6';

test('Notification quality CI runs when shared build or browser configuration changes', () => {
  const requiredTriggerPaths = [
    '.node-version',
    'eslint.config.mjs',
    'tsconfig.json',
    'tsconfig.base.json',
    'tsconfig.node.json',
    'vitest.config.ts',
    'vite.config.ts',
    'playwright.config.ts',
    'e2e/notification-stitch-visual-parity.spec.ts-snapshots/**',
  ];
  for (const trigger of ['pull_request', 'push']) {
    const marker = trigger === 'pull_request' ? '  pull_request:\n' : '  push:\n';
    const start = workflow.indexOf(marker);
    assert.notEqual(start, -1, `${trigger} trigger must exist`);
    const remaining = workflow.slice(start + marker.length);
    const nextSection = remaining.search(/^ {2}[a-z_]+:\n/mu);
    const source = nextSection === -1 ? remaining : remaining.slice(0, nextSection);
    for (const requiredPath of requiredTriggerPaths) {
      assert.ok(source.includes(`- '${requiredPath}'`), `${trigger} ${requiredPath}`);
    }
  }
});

function jobSource(jobId) {
  const marker = `  ${jobId}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `${jobId} must remain a required Notification quality job`);
  const remaining = workflow.slice(start + marker.length);
  const nextJob = remaining.search(/^ {2}[a-z0-9-]+:\n/mu);
  return nextJob === -1
    ? workflow.slice(start)
    : workflow.slice(start, start + marker.length + nextJob);
}

test('Notification quality jobs activate Yarn 4 before restoring its cache', () => {
  for (const [jobId, runner] of [
    ['behavior', 'ubuntu-latest'],
    ['visual-baselines', 'macos-15'],
  ]) {
    const source = jobSource(jobId);
    const setupIndex = source.indexOf('      - name: Set up Node.js runtime\n');
    const corepackIndex = source.indexOf('      - name: Enable Corepack and activate Yarn\n');
    const cacheIndex = source.indexOf('      - name: Restore Yarn cache\n');
    const installIndex = source.indexOf('      - name: Install dependencies\n');

    assert.ok(
      setupIndex >= 0 &&
        setupIndex < corepackIndex &&
        corepackIndex < cacheIndex &&
        cacheIndex < installIndex,
      `${jobId} must set up Node, activate Corepack, restore Yarn cache, then install`
    );
    assert.match(source, new RegExp(`runs-on: ${runner}`, 'u'));

    const initialSetup = source.slice(setupIndex, corepackIndex);
    assert.ok(initialSetup.includes(`uses: ${pinnedSetupNode}`));
    assert.match(initialSetup, /node-version-file: \.node-version/u);
    assert.doesNotMatch(initialSetup, /cache: yarn|cache-dependency-path:/u);

    const corepack = source.slice(corepackIndex, cacheIndex);
    assert.match(corepack, /corepack enable/u);
    assert.match(corepack, /corepack prepare yarn@4\.17\.1 --activate/u);

    const cache = source.slice(cacheIndex, installIndex);
    assert.ok(cache.includes(`uses: ${pinnedSetupNode}`));
    assert.match(cache, /node-version-file: \.node-version/u);
    assert.match(cache, /cache: yarn/u);
    assert.match(cache, /cache-dependency-path: yarn\.lock/u);
  }
});

test('Notification behavior CI keeps unit, type, lint, build, chunk, and E2E gates mandatory', () => {
  const source = jobSource('behavior');
  for (const contract of [
    'node --test',
    'scripts/check-notification-route-chunks.test.mjs',
    'scripts/check-notification-quality-workflow.test.mjs',
    'scripts/check-notification-source-size.test.mjs',
    'node scripts/check-notification-source-size.mjs',
    'corepack yarn vitest run',
    'libs/shared-utils/src/axios-instance.test.ts',
    'corepack yarn typecheck',
    'corepack yarn eslint',
    'corepack yarn vite build',
    'node scripts/check-notification-route-chunks.mjs',
    'corepack yarn vite preview',
    '--grep @production-preview',
    'e2e/notification*.spec.ts',
    '--project=chromium',
    '--project=mobile',
    '--workers=1',
    '--ignore-snapshots',
    '--grep-invert @production-preview',
  ]) {
    assert.match(source, new RegExp(contract.replaceAll('*', '\\*'), 'u'), contract);
  }
  assert.doesNotMatch(source, /continue-on-error/u);
  assert.equal(Object.keys(routeBudgets).length, 7);
  for (const budget of Object.values(routeBudgets)) {
    assert.ok(Number.isInteger(budget.rawBytes) && budget.rawBytes > 0);
    assert.ok(Number.isInteger(budget.gzipBytes) && budget.gzipBytes > 0);
    assert.ok(Number.isInteger(budget.closureRawBytes) && budget.closureRawBytes > 0);
    assert.ok(Number.isInteger(budget.closureGzipBytes) && budget.closureGzipBytes > 0);
  }
});

test('Notification performance CI uses the built preview and retains every hard budget', () => {
  const source = jobSource('behavior');
  for (const contract of [
    'corepack yarn vite preview --host 127.0.0.1 --port 4300 --strictPort',
    'curl --fail --silent http://127.0.0.1:4300/',
    'E2E_BASE_URL=http://127.0.0.1:4300 E2E_REUSE_EXISTING_SERVER=true',
    'e2e/notification-performance.spec.ts',
    '--grep @production-preview',
    '--grep-invert @production-preview',
  ]) {
    assert.match(source, new RegExp(contract.replaceAll('*', '\\*'), 'u'), contract);
  }

  for (const size of [30, 300, 1000]) {
    assert.match(performanceSpec, new RegExp(`\\b${size}: \\{ readyMs:`, 'u'));
  }
  assert.match(performanceSpec, /for \(const size of \[30, 300, 1000\] as const\)/u);
  assert.ok(performanceSpec.includes('test(`@production-preview ${size}'));

  const expectedRoutes = [
    '/notifications/settings',
    '/notifications/admin/overview',
    '/notifications/admin/contracts',
    '/notifications/admin/policies',
    '/notifications/admin/templates',
    '/notifications/admin/operations',
    '/notifications/admin/suppressions',
  ];
  for (const route of expectedRoutes) {
    assert.match(performanceSpec, new RegExp(`path: '${route}'`, 'u'), route);
  }
  assert.match(performanceSpec, /readyMs: (?:2_500|3_000)/u);
  assert.doesNotMatch(performanceSpec, /test\.skip|test\.fixme/u);
});

test('Notification visual CI retains the approved macOS pixel gate without snapshot rewrites', () => {
  const source = jobSource('visual-baselines');
  assert.match(source, /runs-on: macos-15/u);
  assert.match(source, /e2e\/notification-stitch-visual-parity\.spec\.ts/u);
  assert.match(source, /--project=chromium\b/u);
  assert.match(source, /--workers=1\b/u);
  assert.doesNotMatch(source, /--ignore-snapshots/u);
  assert.doesNotMatch(source, /--update-snapshots/u);
  assert.doesNotMatch(source, /continue-on-error/u);
});
