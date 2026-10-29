import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.resolve(
  process.env.DWP_BACKEND_CHECKOUT ?? path.join(root, '..', 'dwp-backend')
);

async function source(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('live workflow keeps the real cross-service Notification gate fail-closed', async () => {
  const workflow = await source('.github/workflows/notification-live-vertical.yml');

  const requiredTriggerPaths = [
    "'.node-version'",
    "'libs/shared-utils/src/axios-instance*.ts'",
    "'libs/shared-utils/src/api/auth-api.ts'",
    "'libs/shared-utils/src/http-error.ts'",
    "'package.json'",
    "'vite.config.ts'",
    "'playwright.config.ts'",
    "'playwright.notification-live.config.ts'",
    "'e2e/support/notification-live-*.ts'",
  ];
  for (const trigger of ['pull_request', 'push']) {
    const marker = trigger === 'pull_request' ? '  pull_request:\n' : '  push:\n';
    const start = workflow.indexOf(marker);
    assert.notEqual(start, -1, `${trigger} trigger must exist`);
    const remaining = workflow.slice(start + marker.length);
    const nextSection = remaining.search(/^ {2}[a-z_]+:\n/mu);
    const triggerSource = nextSection === -1 ? remaining : remaining.slice(0, nextSection);
    for (const requiredPath of requiredTriggerPaths) {
      assert.ok(triggerSource.includes(`- ${requiredPath}`), `${trigger} ${requiredPath}`);
    }
  }

  assert.match(workflow, /repository: choijoonbin\/dwp-backend/u);
  assert.match(
    workflow,
    /python3 scripts\/devctl\.py up auth platform people provider notification gateway/u
  );
  assert.match(workflow, /exec -T -e REDISCLI_AUTH redis redis-cli --raw PING/u);
  assert.match(workflow, /to_regclass\('public\.ntf_user_notifications'\)/u);
  assert.match(workflow, /--topic dwp\.notification\.outbox\.v1/u);
  assert.match(workflow, /corepack yarn vite build/u);
  assert.match(workflow, /frontend_sha="\$\(git -C dwp-frontend rev-parse HEAD\)"/u);
  assert.match(workflow, /backend_sha="\$\(git -C dwp-backend rev-parse HEAD\)"/u);
  assert.match(
    workflow,
    /NOTIFICATION_LIVE_FRONTEND_SHA: \$\{\{ steps\.source-revisions\.outputs\.frontend_sha \}\}/u
  );
  assert.match(
    workflow,
    /NOTIFICATION_LIVE_BACKEND_SHA: \$\{\{ steps\.source-revisions\.outputs\.backend_sha \}\}/u
  );
  assert.match(
    workflow,
    /corepack yarn playwright test --config playwright\.notification-live\.config\.ts/u
  );
  const setupIndex = workflow.indexOf('      - name: Set up Node.js\n');
  const corepackIndex = workflow.indexOf('      - name: Enable Corepack and activate Yarn\n');
  const cacheIndex = workflow.indexOf('      - name: Restore Yarn cache\n');
  const evidenceStepIndex = workflow.indexOf(
    '      - name: Verify the live gate cannot degrade to a mock or no-op\n'
  );
  const dependencyInstallIndex = workflow.indexOf('Install frontend dependencies');
  assert.ok(
    setupIndex >= 0 &&
      setupIndex < corepackIndex &&
      corepackIndex < cacheIndex &&
      cacheIndex < evidenceStepIndex &&
      evidenceStepIndex < dependencyInstallIndex,
    'live CI must set up Node, activate Corepack, restore Yarn cache, run dependency-free tests, then install'
  );

  const initialSetup = workflow.slice(setupIndex, corepackIndex);
  assert.match(initialSetup, /node-version-file: dwp-frontend\/\.node-version/u);
  assert.doesNotMatch(initialSetup, /cache: yarn|cache-dependency-path:/u);

  const corepack = workflow.slice(corepackIndex, cacheIndex);
  assert.match(corepack, /working-directory: dwp-frontend/u);
  assert.match(corepack, /corepack enable/u);
  assert.match(corepack, /corepack prepare yarn@4\.17\.1 --activate/u);

  const cache = workflow.slice(cacheIndex, evidenceStepIndex);
  assert.match(cache, /uses: actions\/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6/u);
  assert.match(cache, /node-version-file: dwp-frontend\/\.node-version/u);
  assert.match(cache, /cache: yarn/u);
  assert.match(cache, /cache-dependency-path: dwp-frontend\/yarn\.lock/u);

  const evidenceTestIndex = workflow.indexOf(
    'e2e/support/notification-live-evidence.test.ts',
    evidenceStepIndex
  );
  assert.ok(evidenceTestIndex > evidenceStepIndex && evidenceTestIndex < dependencyInstallIndex);
  const dependencyInstallEnd = workflow.indexOf(
    '      - name: Lint the live gate source and evidence helpers\n',
    dependencyInstallIndex
  );
  const dependencyInstall = workflow.slice(dependencyInstallIndex, dependencyInstallEnd);
  assert.match(dependencyInstall, /working-directory: dwp-frontend/u);
  assert.doesNotMatch(dependencyInstall, /corepack enable|corepack prepare/u);
  assert.equal(
    [...workflow.matchAll(/corepack prepare yarn@4\.17\.1 --activate/gu)].length,
    1,
    'live CI must activate the pinned Yarn version exactly once'
  );
  assert.match(workflow, /corepack yarn eslint/u);
  assert.match(workflow, /e2e\/support\/notification-live-\*\.ts/u);
  assert.match(workflow, /name: Stop disposable runtime\s+if: \$\{\{ always\(\) \}\}/u);
  assert.match(
    workflow,
    /name: Upload vertical evidence and service logs\s+if: \$\{\{ always\(\) \}\}/u
  );
  assert.doesNotMatch(workflow, /continue-on-error|--pass-with-no-tests|\|\| true/u);
});

test('browser spec cannot silently replace live boundaries with mocks or skips', async () => {
  const [spec, config, evidenceHelper] = await Promise.all([
    source('e2e/live-notification-vertical.spec.ts'),
    source('playwright.notification-live.config.ts'),
    source('e2e/support/notification-live-evidence.ts'),
  ]);

  assert.match(config, /testMatch: 'live-notification-vertical\.spec\.ts'/u);
  assert.match(config, /workers: 1/u);
  assert.match(config, /retries: 0/u);
  assert.match(config, /trace: 'retain-on-failure'/u);
  assert.match(config, /NOTIFICATION_LIVE_ARTIFACT_DIR/u);
  assert.match(config, /artifactRoot\.startsWith/u);
  assert.match(spec, /\/api\/auth\/product-surface-contexts/u);
  assert.match(spec, /response\.request\(\)\.method\(\) === 'GET'/u);
  assert.match(spec, /candidate\.productKey === 'notifications'/u);
  assert.match(spec, /notificationRollout\?\.state.*toBe\('100'\)/u);
  assert.match(spec, /notificationRollout\?\.authorityStatus/u);
  assert.match(spec, /contextShadow: true/u);
  assert.match(spec, /capabilityEnforcement: false/u);
  assert.match(spec, /surfaceUi: false/u);
  assert.doesNotMatch(spec, /\/api\/auth\/product-surface-access\/evaluate/u);
  assert.match(spec, /normalizeGatewayCorrelationHeader/u);
  assert.match(spec, /isExpectedGatewayMutationSuccess\(response\.status\(\)\)/u);
  assert.match(spec, /isExpectedGatewayMutationSequence/u);
  assert.match(spec, /summarizeGatewayMutationAttempts/u);
  assert.match(spec, /unexpectedLiveApiFailures/u);
  assert.match(spec, /page\.on\('requestfailed'/u);
  assert.match(spec, /unexpectedLiveApiTransportFailures/u);
  assert.match(spec, /Notification saved views/u);
  assert.match(spec, /Notification attention contexts/u);
  assert.match(spec, /url\.searchParams\.get\('limit'\) === '50'/u);
  assert.match(spec, /!url\.searchParams\.has\('query'\)/u);
  assert.match(spec, /notification attention controls/u);
  assert.match(spec, /\/api\/notifications\/v1\/stream/u);
  assert.match(spec, /data-notification-focus-id/u);
  assert.match(spec, /\/internal\/v1\/intents\/direct/u);
  assert.match(spec, /FROM ntf_user_notifications/u);
  assert.match(spec, /FROM ntf_outbox_events/u);
  assert.match(spec, /intentId = String\(materializedData\.intentId\)/u);
  assert.match(spec, /event_key='\$\{materializedEventKey\}'/u);
  assert.match(spec, /matchingKafkaMaterializationEnvelope/u);
  assert.match(spec, /dwp\.notification\.outbox\.v1/u);
  assert.match(spec, /gitSourceEvidence\(process\.cwd\(\)\)/u);
  assert.match(spec, /gitSourceEvidence\(runtime\.backendRoot\)/u);
  assert.match(spec, /toBe\(runtime\.frontendRevision\)/u);
  assert.match(spec, /toBe\(runtime\.backendRevision\)/u);
  assert.match(spec, /31n \* BigInt\(runtime\.tenantId\) \+ BigInt\(userId\)/u);
  assert.match(spec, /% 32n/u);
  assert.match(evidenceHelper, /new Set\(correlationIds\)\.size !== 1/u);
  assert.match(evidenceHelper, /observation\.status === 403/u);
  assert.match(evidenceHelper, /observation\.phase === 'PRE_AUTH'/u);
  assert.match(evidenceHelper, /observation\.status <= 0 \|\| observation\.status >= 400/u);
  assert.match(evidenceHelper, /Processed a total of \\d\+ messages/u);
  assert.match(evidenceHelper, /eventkey/u);
  assert.match(evidenceHelper, /eventKey === expectedEventKey/u);
  assert.match(evidenceHelper, /data\?\.notificationId/u);
  assert.doesNotMatch(
    spec,
    /\b(?:page|context)\.route\s*\(|route\.fulfill\s*\(|test\.(?:skip|fixme)\s*\(/u
  );
});

test('local Kafka bootstrap declares the exact Notification outbox contract', async () => {
  const compose = await readFile(path.join(backendRoot, 'docker-compose.yml'), 'utf8');
  const topicOffset = compose.indexOf(
    '--create --if-not-exists --topic dwp.notification.outbox.v1'
  );
  assert.notEqual(topicOffset, -1, 'Notification outbox topic must be declared by docker compose');
  const topicContract = compose.slice(topicOffset, topicOffset + 320);
  assert.match(topicContract, /--partitions 6 --replication-factor 1/u);
  assert.match(topicContract, /--config cleanup\.policy=delete/u);
  assert.match(topicContract, /--config min\.insync\.replicas=1/u);
  assert.match(topicContract, /--config retention\.ms=604800000/u);
});
