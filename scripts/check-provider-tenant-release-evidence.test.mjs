import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROVIDER_TENANT_ACCEPTANCE_IDS } from './release-evidence-validation.mjs';

const repositoryRoot = path.resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checker = path.join(repositoryRoot, 'scripts/check-provider-tenant-release-evidence.mjs');
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dwp-provider-evidence-'));
  temporaryDirectories.push(root);
  fs.writeFileSync(path.join(root, 'evidence.txt'), 'verified\n');
  const manifest = {
    schemaVersion: 1,
    manifestId: 'provider-tenant-acceptance.v1',
    release: 'test-release',
    asOf: '2026-08-27',
    status: 'READY',
    items: PROVIDER_TENANT_ACCEPTANCE_IDS.map((id) => ({
      id,
      owner: 'Test Owner',
      state: 'COMPLETE',
      releaseRequired: true,
      summary: `Acceptance ${id}`,
      automatedChecks: [
        {
          repository: 'dwp-frontend',
          command: 'corepack yarn vitest run scripts/provider-release-evidence.test.ts',
        },
      ],
      evidence: ['evidence.txt'],
      blockers: [],
      failClosedEvidence: [],
    })),
  };
  return { root, manifest, manifestPath: path.join(root, 'manifest.json') };
}

function writeManifest(fixture) {
  fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);
}

function initializeOfficialFixtureRepository(fixture) {
  execFileSync('git', ['init', '-q'], { cwd: fixture.root });
  execFileSync('git', ['config', 'user.name', 'Evidence Test'], { cwd: fixture.root });
  execFileSync('git', ['config', 'user.email', 'evidence@example.invalid'], {
    cwd: fixture.root,
  });
  execFileSync('git', ['add', 'evidence.txt'], { cwd: fixture.root });
  execFileSync('git', ['commit', '-qm', 'evidence'], { cwd: fixture.root });
}

function cleanEnvironment() {
  const environment = { ...process.env };
  delete environment.DWP_BACKEND_CHECKOUT;
  delete environment.DWP_BACKEND_REVISION;
  return environment;
}

function run(fixture, arguments_ = [], environment = cleanEnvironment()) {
  writeManifest(fixture);
  return spawnSync(
    process.execPath,
    [checker, '--manifest', fixture.manifestPath, '--root', fixture.root, ...arguments_],
    { cwd: repositoryRoot, encoding: 'utf8', env: environment }
  );
}

test('accepts exactly PT-A01 through PT-A30 once each', () => {
  const fixture = createFixture();
  const result = run(fixture);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /acceptance IDs: 30/);
});

test('rejects a duplicate, missing, or unknown acceptance ID', () => {
  const fixture = createFixture();
  fixture.manifest.items[29].id = 'PT-A01';
  const result = run(fixture);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate IDs/);
  assert.match(result.stderr, /missing PT-A30/);
});

test('enforces status-specific evidence and blocker semantics', () => {
  const fixture = createFixture();
  Object.assign(fixture.manifest.items[0], { automatedChecks: [], evidence: [] });
  Object.assign(fixture.manifest.items[1], {
    state: 'PENDING_INTERNAL',
    blockers: ['EXTERNAL_NOT_INTERNAL'],
    failClosedEvidence: [],
  });
  Object.assign(fixture.manifest.items[2], {
    state: 'BLOCKED_EXTERNAL',
    blockers: ['INTERNAL_NOT_EXTERNAL'],
    failClosedEvidence: ['evidence.txt'],
  });
  Object.assign(fixture.manifest.items[3], {
    state: 'FEATURE_DISABLED',
    releaseRequired: true,
    blockers: ['EXTERNAL_POLICY'],
    failClosedEvidence: ['evidence.txt'],
  });
  fixture.manifest.status = 'BLOCKED';

  const result = run(fixture);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /COMPLETE requires automatedChecks/);
  assert.match(result.stderr, /PENDING_INTERNAL blockers must use INTERNAL_/);
  assert.match(result.stderr, /BLOCKED_EXTERNAL blockers must use EXTERNAL_/);
  assert.match(result.stderr, /FEATURE_DISABLED cannot be release-required/);
});

test('rejects same-repository evidence that escapes the repository root', () => {
  const fixture = createFixture();
  fixture.manifest.items[0].evidence = ['../outside.txt'];
  const result = run(fixture);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must remain under the repository root/);
});

test('requires a closed external repository evidence shape', () => {
  const fixture = createFixture();
  fixture.manifest.items[0].evidence = [
    {
      repository: 'dwp-backend',
      path: 'evidence.txt',
      checkoutSource: 'DWP_BACKEND_CHECKOUT',
      mutableBranch: 'main',
    },
  ];
  const result = run(fixture);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown fields: mutableBranch/);
  assert.match(result.stderr, /requires revisionSource/);
});

test('rejects untrusted repositories and shell-fallback automated checks', () => {
  const fixture = createFixture();
  fixture.manifest.items[0].automatedChecks = [
    { repository: 'not-a-repository', command: 'false || true' },
  ];
  fixture.manifest.items[1].automatedChecks = [
    { repository: 'dwp-frontend', command: 'corepack yarn test:e2e:provider || true' },
  ];
  fixture.manifest.items[2].automatedChecks = [
    { repository: 'dwp-backend', command: './gradlew check; true' },
  ];
  fixture.manifest.items[3].automatedChecks = [
    { repository: 'dwp-frontend', command: 'corepack yarn $UNBOUND_GATE' },
  ];
  fixture.manifest.items[4].automatedChecks = [
    { repository: 'dwp-agent', command: 'uv run pytest-fake' },
  ];
  fixture.manifest.items[5].automatedChecks = [
    { repository: 'dwp-frontend', command: 'corepack yarn exec true' },
  ];
  fixture.manifest.items[6].automatedChecks = [
    { repository: 'dwp-backend', command: './gradlew help' },
  ];
  fixture.manifest.items[7].automatedChecks = [
    { repository: 'dwp-frontend', command: 'corepack yarn vitest run --passWithNoTests' },
  ];
  fixture.manifest.items[8].automatedChecks = [
    { repository: 'dwp-backend', command: './gradlew :dwp-provider-server:test --dry-run' },
  ];
  fixture.manifest.items[9].automatedChecks = [
    { repository: 'dwp-agent', command: 'uv run pytest --collect-only' },
  ];
  fixture.manifest.items[10].automatedChecks = [
    { repository: 'dwp-frontend', command: 'corepack yarn vitest run -h' },
  ];
  fixture.manifest.items[11].automatedChecks = [
    { repository: 'dwp-backend', command: './gradlew :dwp-provider-server:test --help' },
  ];
  fixture.manifest.items[12].automatedChecks = [
    { repository: 'dwp-agent', command: 'uv run pytest --fixtures' },
  ];
  fixture.manifest.items[13].automatedChecks = [
    {
      repository: 'dwp-frontend',
      command: "corepack yarn vitest run definitely-not-a-test.ts '--passWithNoTests'",
    },
  ];
  fixture.manifest.items[14].automatedChecks = [
    { repository: 'dwp-backend', command: "./gradlew :dwp-provider-server:test '--dry-run'" },
  ];
  fixture.manifest.items[15].automatedChecks = [
    { repository: 'dwp-agent', command: "uv run pytest '--collect-only'" },
  ];
  fixture.manifest.items[16].automatedChecks = [
    {
      repository: 'dwp-frontend',
      command:
        'corepack yarn vitest run definitely-not-a-test.ts {--passWithNoTests,--passWithNoTests}',
    },
  ];

  const result = run(fixture);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /repository must be one of/);
  assert.match(result.stderr, /without shell control syntax/);
  assert.match(result.stderr, /not an approved dwp-agent test command/);
  assert.match(result.stderr, /not an approved dwp-frontend test command/);
  assert.match(result.stderr, /not an approved dwp-backend test command/);
  assert.match(result.stderr, /without listing, skipping, or replacing the trusted build/);
});

test('allows a pipe only as quoted test-runner input', () => {
  const fixture = createFixture();
  fixture.manifest.items[0].automatedChecks = [
    {
      repository: 'dwp-frontend',
      command:
        "corepack yarn playwright test e2e/provider-critical-operations.spec.ts --project=chromium --workers=1 --grep 'privileged support separates|post-access review'",
    },
  ];

  const result = run(fixture);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('rejects quoted options that skip checks or replace the trusted build', () => {
  const commands = [
    {
      repository: 'dwp-frontend',
      command: "corepack yarn vitest run definitely-not-a-test.ts '--passWithNoTests'",
    },
    {
      repository: 'dwp-frontend',
      command: "corepack yarn vitest run '--config' '/tmp/noop.config.ts'",
    },
    {
      repository: 'dwp-backend',
      command: "./gradlew :dwp-provider-server:test '--dry-run'",
    },
    {
      repository: 'dwp-backend',
      command: "./gradlew :dwp-provider-server:test '--init-script' '/tmp/noop.gradle'",
    },
    { repository: 'dwp-agent', command: "uv run pytest '--collect-only'" },
    { repository: 'dwp-agent', command: 'uv run pytest --setup-only' },
    { repository: 'dwp-agent', command: "uv run pytest '--setup-plan'" },
    {
      repository: 'dwp-agent',
      command: "uv run pytest '-o' 'addopts=--collect-only'",
    },
    {
      repository: 'dwp-agent',
      command: "uv run pytest '--override-ini=addopts=--collect-only'",
    },
    {
      repository: 'dwp-agent',
      command: "uv run pytest '-oaddopts=--collect-only'",
    },
    {
      repository: 'dwp-frontend',
      command: "corepack yarn vitest run '-c/tmp/noop.config.ts'",
    },
    {
      repository: 'dwp-backend',
      command: "./gradlew :dwp-provider-server:test '-I/tmp/noop.gradle'",
    },
  ];

  for (const automatedCheck of commands) {
    const fixture = createFixture();
    fixture.manifest.items[0].automatedChecks = [automatedCheck];
    const result = run(fixture);
    assert.equal(result.status, 1, automatedCheck.command);
    assert.match(
      result.stderr,
      /without listing, skipping, or replacing the trusted build/,
      automatedCheck.command
    );
  }
});

test('accepts every automated check in the current closed release manifest', () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(
        repositoryRoot,
        'docs/06-delivery/release-evidence/provider-tenant-acceptance.json'
      ),
      'utf8'
    )
  );
  const checks = new Map();
  for (const item of manifest.items) {
    for (const automatedCheck of item.automatedChecks) {
      checks.set(`${automatedCheck.repository}\u0000${automatedCheck.command}`, automatedCheck);
    }
  }

  for (const automatedCheck of checks.values()) {
    const fixture = createFixture();
    fixture.manifest.items[0].automatedChecks = [automatedCheck];
    const result = run(fixture);
    assert.equal(result.status, 0, `${automatedCheck.command}\n${result.stdout}\n${result.stderr}`);
  }
});

test('rejects runner options and selectors that can reduce or bypass declared coverage', () => {
  const commands = [
    'uv run pytest --setup-only',
    'uv run pytest --setup-plan',
    'uv run pytest -k one_test',
    'uv run pytest -kprovider.py',
    'uv run pytest -cbypass.py',
    'uv run pytest -m smoke',
    'uv run pytest --lf --lfnf=none',
    'uv run pytest --ignore tests',
    'uv run pytest --ignore-glob=test_*.py',
    'uv run pytest --deselect tests/test_provider.py::test_release',
    'uv run pytest @bypass.py',
    'corepack yarn vitest run --mergeReports',
    'corepack yarn vitest run --listTags',
    'corepack yarn vitest run --clearCache',
    'corepack yarn vitest run -tprovider.test.ts',
    'corepack yarn vitest run apps/dwp/src/features/provider/provider-tenant-entitlement-draft-model.test.ts -t one',
    'corepack yarn vitest run apps/dwp/src/features/provider/provider-tenant-entitlement-draft-model.test.ts --testNamePattern=one',
    'corepack yarn vitest run apps/dwp/src/features/provider/provider-tenant-entitlement-draft-model.test.ts --shard=1/2',
    'corepack yarn vitest run apps/dwp/src/features/provider/provider-tenant-entitlement-draft-model.test.ts --changed',
    'corepack yarn vitest run apps/dwp/src/features/provider/provider-tenant-entitlement-draft-model.test.ts --exclude=noop',
    'corepack yarn vitest run apps/dwp/src/features/provider/provider-tenant-entitlement-draft-model.test.ts --project=noop',
    'corepack yarn provider:artifacts:scan package.json',
    'corepack yarn playwright test e2e/provider-acceptance-evidence.spec.ts --project=chromium --workers=1 --last-failed',
    'corepack yarn playwright test e2e/provider-acceptance-evidence.spec.ts --project=chromium --workers=1 --only-changed',
    'corepack yarn playwright test e2e/provider-acceptance-evidence.spec.ts --project=chromium --workers=1 --grep-invert=release',
    'corepack yarn playwright test e2e/provider-acceptance-evidence.spec.ts --project=chromium --workers=1 --shard=1/2',
    'corepack yarn playwright test e2e/provider-acceptance-evidence.spec.ts --project=chromium --workers=1 --test-list=tests.txt',
    'corepack yarn playwright test e2e/provider-acceptance-evidence.spec.ts --project=chromium --workers=1 --test-list-invert=tests.txt',
    'corepack yarn playwright test e2e/provider-acceptance-evidence.spec.ts --project=chromium --workers=1 --no-deps',
    "corepack yarn playwright test e2e/provider-acceptance-evidence.spec.ts --project=chromium --workers=1 --grep 'one passing test'",
    'corepack yarn playwright test e2e/provider-acceptance-evidence.spec.ts --project=chromium --workers=1',
    'corepack yarn playwright test e2e/responsive-accessibility.spec.ts --project=mobile --workers=1',
  ];

  for (const command of commands) {
    const fixture = createFixture();
    const repository = command.startsWith('uv ') ? 'dwp-agent' : 'dwp-frontend';
    fixture.manifest.items[0].automatedChecks = [{ repository, command }];
    const result = run(fixture);
    assert.equal(result.status, 1, command);
    assert.match(
      result.stderr,
      /without (?:shell control syntax|listing, skipping, or replacing the trusted build)/,
      command
    );
  }
});

test('release mode verifies the immutable external checkout and evidence path', () => {
  const fixture = createFixture();
  initializeOfficialFixtureRepository(fixture);
  const backend = path.join(fixture.root, 'official-backend');
  fs.mkdirSync(backend);
  fs.writeFileSync(path.join(backend, 'evidence.txt'), 'official evidence\n');
  execFileSync('git', ['init', '-q'], { cwd: backend });
  execFileSync('git', ['config', 'user.name', 'Evidence Test'], { cwd: backend });
  execFileSync('git', ['config', 'user.email', 'evidence@example.invalid'], { cwd: backend });
  execFileSync('git', ['add', 'evidence.txt'], { cwd: backend });
  execFileSync('git', ['commit', '-qm', 'evidence'], { cwd: backend });
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: backend,
    encoding: 'utf8',
  }).trim();
  fixture.manifest.items[0].evidence = [
    {
      repository: 'dwp-backend',
      path: 'evidence.txt',
      revisionSource: 'DWP_BACKEND_REVISION',
      checkoutSource: 'DWP_BACKEND_CHECKOUT',
    },
  ];
  const environment = cleanEnvironment();
  environment.DWP_BACKEND_CHECKOUT = backend;
  environment.DWP_BACKEND_REVISION = revision;

  const result = run(fixture, ['--release'], environment);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  environment.DWP_BACKEND_REVISION = 'a'.repeat(40);
  const mismatch = run(fixture, ['--release'], environment);
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /checkout is not revision/);

  environment.DWP_BACKEND_REVISION = revision;
  fs.writeFileSync(path.join(backend, 'evidence.txt'), 'modified external evidence\n');
  const mutable = run(fixture, ['--release'], environment);
  assert.equal(mutable.status, 1);
  assert.match(mutable.stderr, /dwp-backend evidence does not match the official revision/);
});

test('release mode rejects mutable or untracked evidence files', () => {
  const fixture = createFixture();
  initializeOfficialFixtureRepository(fixture);

  const verified = run(fixture, ['--release']);
  assert.equal(verified.status, 0, `${verified.stdout}\n${verified.stderr}`);

  fs.writeFileSync(path.join(fixture.root, 'evidence.txt'), 'changed after verification\n');
  const mutable = run(fixture, ['--release']);
  assert.equal(mutable.status, 1);
  assert.match(mutable.stderr, /does not match the official revision/);

  fs.writeFileSync(path.join(fixture.root, 'untracked-evidence.txt'), 'untracked\n');
  fixture.manifest.items[0].evidence = ['untracked-evidence.txt'];
  const untracked = run(fixture, ['--release']);
  assert.equal(untracked.status, 1);
  assert.match(untracked.stderr, /is not tracked by the official revision/);
});

test('release mode rejects missing official checkout inputs and incomplete required items', () => {
  const fixture = createFixture();
  initializeOfficialFixtureRepository(fixture);
  fixture.manifest.items[0].evidence = [
    {
      repository: 'dwp-backend',
      path: 'evidence.txt',
      revisionSource: 'DWP_BACKEND_REVISION',
      checkoutSource: 'DWP_BACKEND_CHECKOUT',
    },
  ];
  const missingCheckout = run(fixture, ['--release']);
  assert.equal(missingCheckout.status, 1);
  assert.match(missingCheckout.stderr, /full lowercase 40-hex revision/);
  assert.match(missingCheckout.stderr, /absolute checkout path/);

  fixture.manifest.items[0] = {
    ...fixture.manifest.items[0],
    state: 'PENDING_INTERNAL',
    evidence: [],
    blockers: ['INTERNAL_REAL_E2E'],
    failClosedEvidence: ['evidence.txt'],
  };
  fixture.manifest.status = 'BLOCKED';
  const integrity = run(fixture);
  assert.equal(integrity.status, 0, `${integrity.stdout}\n${integrity.stderr}`);
  const release = run(fixture, ['--release']);
  assert.equal(release.status, 2);
  assert.match(release.stderr, /PT-A01 PENDING_INTERNAL/);
});
