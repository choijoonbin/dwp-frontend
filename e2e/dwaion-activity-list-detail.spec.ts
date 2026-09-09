import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

const COMPLETED_RUN = '41000000-0000-4000-8000-000000000001';
const RUNNING_RUN = '41000000-0000-4000-8000-000000000002';
const FAILED_RUN = '41000000-0000-4000-8000-000000000003';
const POLICY_BLOCKED_RUN = '41000000-0000-4000-8000-000000000004';
const CONFIGURATION_RUN = '41000000-0000-4000-8000-000000000005';
const OUTSIDE_WINDOW_RUN = '41000000-0000-4000-8000-000000000099';
const CONVERSATION = '51000000-0000-4000-8000-000000000001';
const AUDIT_RECORD = '61000000-0000-5000-8000-000000000001';

const runs = [
  run(COMPLETED_RUN, 'COMPLETED', 'ALLOW', 'COMPLETED', CONVERSATION),
  run(RUNNING_RUN, 'RUNNING', 'HANDOFF', null, null),
  run(FAILED_RUN, 'FAILED', 'DENY', 'CONFIGURATION_REQUIRED', null),
];

test('one recent-window request powers URL-preserved client filtering and exact selection', async ({
  page,
}, testInfo) => {
  const requests = await mockActivity(page);
  await page.goto('/dwaion/activity');

  await expect(
    page.getByText(
      /(?:Up to 100 recent runs are retrieved|Counts and filters use up to 100 recently retrieved runs)/
    )
  ).toBeVisible();
  await expect(page.getByText(/3 of 3 retrieved runs/)).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'AI run status summary' })
      .getByRole('button', { name: /Retrieved runs:/ })
  ).toBeVisible();

  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: testInfo.outputPath('U09-activity-list-only-1440.png'),
    fullPage: false,
  });

  await page.getByRole('button', { name: 'In progress', exact: true }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('state') === 'RUNNING');
  await expect(page.getByText(/1 of 3 retrieved runs/)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Recently retrieved AI runs' })).toContainText(
    'Connected to owning workflow'
  );
  expect(requests.runRequests).toHaveLength(1);
  expect(requests.runRequests[0]?.searchParams.get('limit')).toBe('100');
  expect(requests.runRequests[0]?.searchParams.has('state')).toBe(false);

  await page.getByRole('button', { name: 'All', exact: true }).click();
  const selected = page.getByTestId(`dwaion-run-${COMPLETED_RUN}`);
  await selected.click();
  await expect(page).toHaveURL((url) => url.searchParams.get('run') === COMPLETED_RUN);
  await expect(selected).toHaveAttribute('aria-current', 'true');

  const inspector = page.getByRole('complementary', { name: 'Selected run details' });
  await expect(inspector).toContainText(COMPLETED_RUN);
  await expect(inspector.getByRole('button', { name: 'Open conversation' })).toBeVisible();
  await expect(
    inspector.getByRole('complementary', { name: 'Signal detail' }).getByText('Verified run detail')
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('U09-activity-selected-1440.png'),
    fullPage: false,
  });
  await expect(
    inspector.getByRole('complementary', { name: 'Signal detail' }).getByText('Agent run', {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    inspector.getByRole('complementary', { name: 'Signal detail' }).getByText('AGENT_RUN', {
      exact: true,
    })
  ).toHaveCount(0);
  expect(requests.detailRequests.length).toBeGreaterThan(0);
  expect(new Set(requests.detailRequests)).toEqual(new Set([COMPLETED_RUN]));
  const receipt = inspector.getByRole('region', { name: 'Recent run response' });
  const metadata = receipt.getByRole('button', { name: 'Additional run metadata' });
  await expect(metadata).toHaveAttribute('aria-expanded', 'false');
  await metadata.click();
  await expect(metadata).toHaveAttribute('aria-expanded', 'true');
  await expect(receipt.getByText('Risk tier', { exact: true })).toBeVisible();
  await expect(receipt.getByText('Started', { exact: true })).toBeVisible();
  await metadata.click();
  await expect(
    inspector.getByRole('heading', { name: 'Run stages and processing time' })
  ).toBeVisible();
  await expect(
    inspector.getByRole('progressbar', { name: 'Server-reported progress' })
  ).toHaveAttribute('aria-valuenow', '100');
  await expect(inspector.locator('[data-stage-key="RETRIEVING"]')).toContainText(
    'Retrieving evidence'
  );
  const sourceAndAudit = inspector.getByRole('button', {
    name: 'Source and audit linkage details',
  });
  await expect(sourceAndAudit).toHaveAttribute('aria-expanded', 'false');
  await sourceAndAudit.click();
  await expect(sourceAndAudit).toHaveAttribute('aria-expanded', 'true');
  await expect(inspector.getByRole('heading', { name: 'Run source status' })).toBeVisible();
  await expect(inspector.getByText('WORK_ITEM', { exact: true })).toBeVisible();
  await expect(inspector.getByText('Linked to a Platform audit record')).toBeVisible();
  await expect(inspector.getByRole('heading', { name: 'Audit integrity evidence' })).toBeVisible();
  await expect(inspector.getByText('Matches the reported daily checkpoint')).toBeVisible();
  expect(requests.evidenceRequests.length).toBeGreaterThan(0);
  expect(new Set(requests.evidenceRequests)).toEqual(new Set([AUDIT_RECORD]));

  const audit = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    audit.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))
  ).toEqual([]);
  if (originalViewport) await page.setViewportSize(originalViewport);
});

test('390 and 320 layouts keep the inspector inline and restore row focus on Escape', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = await mockActivity(page);
  await page.goto('/dwaion/activity');
  const mobileHeader = page.getByTestId('dwaion-header');
  await expect(mobileHeader.getByText('U09', { exact: true })).toBeVisible();
  await expect(mobileHeader.getByText('Execution History', { exact: true })).toBeVisible();
  const mobileNavigation = page.getByTestId('dwaion-mobile-navigation');
  await expect(mobileNavigation.getByRole('link', { name: 'Activity' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expect(mobileNavigation.getByRole('button', { name: 'More' })).toHaveCount(0);
  await expect(page.locator('#dwaion-activity-filters')).toHaveCount(1);
  await mobileHeader.getByRole('button', { name: 'Move to run state filters' }).click();
  await expect(page.getByRole('button', { name: 'All', exact: true })).toBeFocused();
  const requestCountBeforeRefresh = requests.runRequests.length;
  await mobileHeader.getByRole('button', { name: 'Refresh run activity' }).click();
  await expect.poll(() => requests.runRequests.length).toBeGreaterThan(requestCountBeforeRefresh);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.mouse.move(1, 300);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.evaluate(() => globalThis.scrollTo(0, 0));
  const selected = page.getByTestId(`dwaion-run-${COMPLETED_RUN}`);
  await expect(selected).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const metrics = page.getByRole('region', { name: 'AI run status summary' }).getByRole('button');
    await expect(metrics).toHaveCount(4);
    const metricBounds = await metrics.evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { top: rect.top, width: rect.width, height: rect.height };
      })
    );
    expect(new Set(metricBounds.map((rect) => Math.round(rect.top))).size).toBe(1);
    expect(metricBounds.every((rect) => rect.width >= 44 && rect.height >= 44)).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true);
    await expect(selected.getByText('DWAI·ON work agent', { exact: true }).last()).toBeInViewport({
      ratio: 1,
    });
    await expect(selected).toHaveAttribute('aria-label', new RegExp(COMPLETED_RUN));
    await page.screenshot({
      path: testInfo.outputPath(`dwaion-activity-list-${width}.png`),
      fullPage: false,
    });
    const listAudit = await new AxeBuilder({ page }).include('main').analyze();
    expect(
      listAudit.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await selected.focus();
  await selected.press('Enter');
  const inspector = page.getByRole('complementary', { name: 'Selected run details' });
  await expect(inspector).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Selected run details' })).toHaveCount(0);

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true);
    await inspector.scrollIntoViewIfNeeded();
    const inspectorBounds = await inspector.boundingBox();
    expect(inspectorBounds?.x).toBeGreaterThanOrEqual(0);
    expect(inspectorBounds?.width).toBeLessThanOrEqual(width);
    await expect(inspector.getByTitle(COMPLETED_RUN)).toBeVisible();
    await page.evaluate(() => globalThis.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`dwaion-activity-inline-detail-${width}.png`),
      fullPage: true,
    });
    const detailAudit = await new AxeBuilder({ page }).analyze();
    expect(
      detailAudit.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))
    ).toEqual([]);
  }

  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary', { name: 'Selected run details' })).toHaveCount(0);
  await expect(page).toHaveURL((url) => !url.searchParams.has('run'));
  await expect(selected).toBeFocused();
});

test('summary metrics drill into the exact attention evidence set and preserve inline selection', async ({
  page,
}) => {
  const requests = await mockActivity(page, { attentionEvidence: true });
  await page.goto(`/dwaion/activity?run=${COMPLETED_RUN}`);
  await expect(page.getByRole('complementary', { name: 'Selected run details' })).toBeVisible();
  const summary = page.getByRole('region', { name: 'AI run status summary' });
  await summary.getByRole('button', { name: /Attention signals/ }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get('state') === 'ATTENTION' && url.searchParams.get('run') === COMPLETED_RUN
  );
  await expect(page.getByText(/3 of 5 retrieved runs/)).toBeVisible();
  const list = page.getByRole('list', { name: 'Recently retrieved AI runs' });
  await expect(list.getByTestId(`dwaion-run-${FAILED_RUN}`)).toBeVisible();
  await expect(list.getByTestId(`dwaion-run-${POLICY_BLOCKED_RUN}`)).toBeVisible();
  await expect(list.getByTestId(`dwaion-run-${POLICY_BLOCKED_RUN}`)).toHaveAttribute(
    'aria-label',
    /Blocked by policy/
  );
  await expect(list.getByTestId(`dwaion-run-${CONFIGURATION_RUN}`)).toBeVisible();
  await expect(list.getByTestId(`dwaion-run-${COMPLETED_RUN}`)).toHaveCount(0);
  await expect(list.getByTestId(`dwaion-run-${RUNNING_RUN}`)).toHaveCount(0);
  expect(requests.runRequests).toHaveLength(1);

  await summary.getByRole('button', { name: /Retrieved runs/ }).click();
  await expect(page).toHaveURL((url) => !url.searchParams.has('state'));
  await expect(page.getByTestId(`dwaion-run-${COMPLETED_RUN}`)).toHaveAttribute(
    'aria-current',
    'true'
  );
});

test('a short mobile viewport keeps compact summary filters and exposes the first run', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockActivity(page);
  await page.goto('/dwaion/activity');
  const summary = page.getByRole('region', { name: 'AI run status summary' });
  await expect(summary.getByRole('button')).toHaveCount(4);
  await expect(
    page
      .getByTestId(`dwaion-run-${COMPLETED_RUN}`)
      .getByRole('heading', { name: 'Governed answer execution' })
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: testInfo.outputPath('dwaion-activity-list-320x568.png'),
    fullPage: false,
  });

  await summary.getByRole('button', { name: /Attention signals:/ }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('state') === 'ATTENTION');
  await expect(page.getByText(/1 of 3 retrieved runs/)).toBeVisible();
  await expect(summary.getByRole('button', { name: /Attention signals:/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('APP.ASK-only access shows list receipt but never requests common activity detail', async ({
  page,
}) => {
  const requests = await mockActivity(page, { askOnly: true });
  await page.goto('/dwaion/activity');
  await page.getByTestId(`dwaion-run-${COMPLETED_RUN}`).click();

  const inspector = page.getByRole('complementary', { name: 'Selected run details' });
  await expect(inspector).toContainText(COMPLETED_RUN);
  await expect(inspector.getByText('Common activity detail is not available')).toBeVisible();
  await expect(inspector.getByText(/no common-detail request was sent/)).toBeVisible();
  expect(requests.detailRequests).toEqual([]);
});

test('a deep link outside the recent window resolves the exact run without substituting a row', async ({
  page,
}) => {
  const requests = await mockActivity(page);
  await page.goto(`/dwaion/activity?state=FAILED&run=${OUTSIDE_WINDOW_RUN}`);

  const inspector = page.getByRole('complementary', { name: 'Selected run details' });
  await expect(inspector.getByText('Recent run response')).toBeVisible();
  await expect(inspector).toContainText(OUTSIDE_WINDOW_RUN);
  await expect(inspector.getByText('Verified run detail')).toBeVisible();
  await expect(page).toHaveURL((url) => url.searchParams.get('state') === 'FAILED');
  expect(requests.exactRunRequests.length).toBeGreaterThan(0);
  expect(new Set(requests.exactRunRequests)).toEqual(new Set([OUTSIDE_WINDOW_RUN]));
  expect(requests.detailRequests.length).toBeGreaterThan(0);
  expect(new Set(requests.detailRequests)).toEqual(new Set([OUTSIDE_WINDOW_RUN]));
});

test('an exact deep link does not wait for a stalled recent-window request', async ({ page }) => {
  const requests = await mockActivity(page, { blockList: true });
  await page.goto(`/dwaion/activity?run=${OUTSIDE_WINDOW_RUN}`);

  const inspector = page.getByRole('complementary', { name: 'Selected run details' });
  await expect(inspector.getByText('Recent run response')).toBeVisible();
  expect(requests.exactRunRequests.length).toBeGreaterThan(0);
  expect(new Set(requests.exactRunRequests)).toEqual(new Set([OUTSIDE_WINDOW_RUN]));
  requests.releaseList();
  await expect(page.getByText(/3 of 3 retrieved runs/)).toBeVisible();
});

test('a failed exact-run revalidation removes the stale receipt and conversation action', async ({
  page,
}) => {
  const requests = await mockActivity(page);
  await page.goto(`/dwaion/activity?run=${OUTSIDE_WINDOW_RUN}`);

  const inspector = page.getByRole('complementary', { name: 'Selected run details' });
  await expect(inspector.getByText('Recent run response')).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Open conversation' })).toBeVisible();
  const initialRequestCount = requests.exactRunRequests.length;
  requests.revokeExactRun();
  await inspector.getByRole('button', { name: 'Refresh AI run activity' }).click();
  await expect(inspector.getByText('This run record cannot be displayed')).toBeVisible();
  await expect(inspector.getByText('Recent run response')).toHaveCount(0);
  await expect(inspector.getByRole('button', { name: 'Open conversation' })).toHaveCount(0);
  expect(requests.exactRunRequests.length).toBeGreaterThan(initialRequestCount);
  expect(new Set(requests.exactRunRequests)).toEqual(new Set([OUTSIDE_WINDOW_RUN]));
  await expect(inspector.getByText('Verified run detail')).toHaveCount(0);
});

test('a failed recent-window access revalidation removes cached run metadata', async ({ page }) => {
  const requests = await mockActivity(page);
  await page.goto('/dwaion/activity');
  await page.getByTestId(`dwaion-run-${COMPLETED_RUN}`).click();

  const inspector = page.getByRole('complementary', { name: 'Selected run details' });
  await expect(inspector.getByText('Recent run response')).toBeVisible();
  requests.revokeRunList();
  await inspector.getByRole('button', { name: 'Refresh AI run activity' }).click();
  await expect(page.getByTestId(`dwaion-run-${COMPLETED_RUN}`)).toHaveCount(0);
  await expect(inspector.getByText('Recent run response')).toHaveCount(0);
  await expect(inspector.getByRole('button', { name: 'Open conversation' })).toHaveCount(0);
  await expect(inspector.getByText('Verified run detail')).toHaveCount(0);
  await expect(page.getByText('Run activity is not available', { exact: true })).toBeVisible();
  await expect(page.getByText(/0 of 0 retrieved runs/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'All', exact: true })).toBeDisabled();
  await expect(page.getByText('There is no AI run activity to show', { exact: true })).toHaveCount(
    0
  );
});

async function mockActivity(
  page: Page,
  options: {
    askOnly?: boolean;
    blockList?: boolean;
    missingDetail?: boolean;
    missingRun?: boolean;
    attentionEvidence?: boolean;
  } = {}
) {
  const askPermission = {
    resourceType: 'APP',
    resourceKey: 'APP.ASK',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  };
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    ...(options.askOnly ? { permissions: [askPermission] } : {}),
  });
  const runRequests: URL[] = [];
  const exactRunRequests: string[] = [];
  const detailRequests: string[] = [];
  const evidenceRequests: string[] = [];
  let exactRunRevoked = false;
  let runListRevoked = false;
  let releaseList: () => void = () => undefined;
  const listGate = options.blockList
    ? new Promise<void>((resolve) => {
        releaseList = resolve;
      })
    : Promise.resolve();
  await page.route('**/api/agent/v1/runs?**', async (route) => {
    runRequests.push(new URL(route.request().url()));
    await listGate;
    if (runListRevoked) {
      return route.fulfill({ status: 403, json: { data: null } });
    }
    return route.fulfill({
      json: {
        data: options.attentionEvidence
          ? [
              ...runs,
              run(POLICY_BLOCKED_RUN, 'COMPLETED', 'DENY', 'COMPLETED', null),
              run(CONFIGURATION_RUN, 'COMPLETED', 'ALLOW', 'CONFIGURATION_REQUIRED', null),
            ]
          : runs,
      },
    });
  });
  await page.route('**/api/agent/v1/runs/*', (route) => {
    const runId = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
    exactRunRequests.push(runId);
    if (options.missingRun || exactRunRevoked) {
      return route.fulfill({ status: options.missingRun ? 404 : 403, json: { data: null } });
    }
    return route.fulfill({
      json: { data: run(runId, 'COMPLETED', 'ALLOW', 'COMPLETED', CONVERSATION) },
    });
  });
  await page.route('**/api/agent/v1/activity/events/**', (route) => {
    const runId = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
    detailRequests.push(runId);
    if (options.missingDetail) {
      return route.fulfill({ status: 404, json: { errorCode: 'RESOURCE_NOT_FOUND' } });
    }
    return route.fulfill({ json: { data: activityEvent(runId) } });
  });
  await page.route('**/api/platform/v1/workspace/activity/audit/evidence/*', (route) => {
    const auditRecordId = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
    evidenceRequests.push(auditRecordId);
    return route.fulfill({
      json: {
        data: {
          eventId: COMPLETED_RUN,
          auditRecordId,
          linkStatus: 'LINKED',
          auditAccess: 'AVAILABLE',
          recordHash: 'a'.repeat(64),
          hashAlgorithm: 'SHA-256',
          integrityStatus: 'VERIFIED',
          integrityScope: 'DAILY_CHECKPOINT_REPORTED',
          verifiedAt: '2026-09-04T00:01:00Z',
          observedAt: '2026-09-04T00:02:00Z',
        },
      },
    });
  });
  return {
    runRequests,
    exactRunRequests,
    detailRequests,
    evidenceRequests,
    releaseList,
    revokeExactRun: () => {
      exactRunRevoked = true;
    },
    revokeRunList: () => {
      runListRevoked = true;
    },
  };
}

function run(
  runId: string,
  runState: 'RUNNING' | 'COMPLETED' | 'FAILED',
  policyOutcome: 'ALLOW' | 'HANDOFF' | 'DENY',
  answerState: 'COMPLETED' | 'CONFIGURATION_REQUIRED' | null,
  conversationId: string | null
) {
  return {
    runId,
    agentKey: 'DWP_ASSISTANT',
    agentRevision: 4,
    runState,
    answerState,
    riskTier: 'L1',
    policyOutcome,
    statusCode: runState === 'FAILED' ? 'POLICY_DENIED' : null,
    sourceCount: runState === 'RUNNING' ? 1 : 3,
    latencyMs: runState === 'RUNNING' ? 180 : 420,
    conversationId,
    createdAt: '2026-09-04T00:00:00Z',
    completedAt: runState === 'RUNNING' ? null : '2026-09-04T00:00:01Z',
    dataProvenance: 'LIVE',
    activityTitle:
      runState === 'RUNNING' ? 'Evidence retrieval in progress' : 'Governed answer execution',
    attempt: 1,
    lease: {
      status: runState === 'RUNNING' ? 'ACTIVE' : 'RELEASED',
      expiresAt: runState === 'RUNNING' ? '2026-09-04T00:02:00Z' : null,
    },
    currentStage:
      runState === 'RUNNING' ? 'RETRIEVING' : runState === 'FAILED' ? 'FAILED' : 'COMPLETED',
    progressPercent: runState === 'RUNNING' ? 40 : 100,
    measurementStatus: runState === 'RUNNING' ? 'PARTIAL' : 'MEASURED',
    stages:
      runState === 'COMPLETED'
        ? [
            stage('AUTHORIZING', 'COMPLETED', 10, 40),
            stage('RETRIEVING', 'COMPLETED', 20, 100),
            stage('REASONING', 'COMPLETED', 30, 200),
            stage('VERIFYING', 'COMPLETED', 40, 60),
            stage('PERSISTING', 'COMPLETED', 50, 20),
            stage('COMPLETED', 'COMPLETED', 60, 0),
          ]
        : runState === 'RUNNING'
          ? [stage('AUTHORIZING', 'COMPLETED', 10, 40), stage('RETRIEVING', 'ACTIVE', 20, null)]
          : [stage('AUTHORIZING', 'COMPLETED', 10, 40), stage('FAILED', 'FAILED', 60, 0)],
    auditEvidence: {
      auditId: '61000000-0000-4000-8000-000000000002',
      auditRecordId: AUDIT_RECORD,
      status: 'LINKED',
    },
    sourceHealth: [
      {
        sourceType: 'WORK_ITEM',
        status: runState === 'FAILED' ? 'UNAVAILABLE' : 'SUCCESS',
        latencyMs: runState === 'FAILED' ? null : 100,
        lastAttemptAt: '2026-09-04T00:00:00.040Z',
        lastSuccessAt: runState === 'FAILED' ? null : '2026-09-04T00:00:00.040Z',
      },
    ],
  };
}

function stage(key: string, state: string, sequence: number, durationMs: number | null) {
  return {
    key,
    state,
    sequence,
    startedAt: '2026-09-04T00:00:00Z',
    completedAt: state === 'ACTIVE' ? null : '2026-09-04T00:00:01Z',
    durationMs,
  };
}

function activityEvent(runId: string) {
  return {
    id: runId,
    occurredAt: '2026-09-04T00:00:01Z',
    sourceObservedAt: '2026-09-04T00:00:02Z',
    actor: 'AGENT',
    actorName: 'DWAI·ON',
    state: 'COMPLETED',
    title: 'Verified run detail',
    summary: 'Exact common activity detail for this run.',
    objectType: 'AGENT_RUN',
    objectId: runId,
    objectLabel: 'AI execution',
    source: 'DWAI_ON',
    sourceAccess: 'AVAILABLE',
    sourceRoute: `/dwaion/activity?run=${runId}`,
    sourceEventId: runId,
    eventKind: 'EXECUTION_SNAPSHOT',
    executionId: runId,
    executionVersion: 4,
    attempt: 1,
    workStatus: null,
    dataProvenance: 'LIVE',
    auditStatus: 'VERIFIED',
    auditRecordId: AUDIT_RECORD,
    auditId: '61000000-0000-4000-8000-000000000002',
    auditAccess: 'RESTRICTED',
  };
}
