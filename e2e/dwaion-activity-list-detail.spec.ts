import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

const COMPLETED_RUN = '41000000-0000-4000-8000-000000000001';
const RUNNING_RUN = '41000000-0000-4000-8000-000000000002';
const FAILED_RUN = '41000000-0000-4000-8000-000000000003';
const OUTSIDE_WINDOW_RUN = '41000000-0000-4000-8000-000000000099';
const CONVERSATION = '51000000-0000-4000-8000-000000000001';

const runs = [
  run(COMPLETED_RUN, 'COMPLETED', 'ALLOW', 'COMPLETED', CONVERSATION),
  run(RUNNING_RUN, 'RUNNING', 'HANDOFF', null, null),
  run(FAILED_RUN, 'FAILED', 'DENY', 'CONFIGURATION_REQUIRED', null),
];

test('one recent-window request powers URL-preserved client filtering and exact selection', async ({
  page,
}) => {
  const requests = await mockActivity(page);
  await page.goto('/dwaion/activity');

  await expect(page.getByText(/Up to 100 recent runs are retrieved/)).toBeVisible();
  await expect(page.getByText(/3 of 3 retrieved runs/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'AI run status summary' })).toContainText(
    'Retrieved runs'
  );

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
  expect(requests.detailRequests.length).toBeGreaterThan(0);
  expect(new Set(requests.detailRequests)).toEqual(new Set([COMPLETED_RUN]));

  const audit = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    audit.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))
  ).toEqual([]);
});

test('390 and 320 layouts use a drawer that closes with Escape and restores row focus', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockActivity(page);
  await page.goto('/dwaion/activity');
  const selected = page.getByTestId(`dwaion-run-${COMPLETED_RUN}`);
  await selected.focus();
  await selected.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Selected run details' })).toBeVisible();

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`dwaion-activity-detail-${width}.png`),
      fullPage: false,
    });
  }

  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary', { name: 'Selected run details' })).toHaveCount(0);
  await expect(page).toHaveURL((url) => !url.searchParams.has('run'));
  await expect(selected).toBeFocused();
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
  await page.getByRole('button', { name: 'Refresh AI run activity' }).click();
  await expect(inspector.getByText('This run record cannot be displayed')).toBeVisible();
  await expect(inspector.getByText('Recent run response')).toHaveCount(0);
  await expect(inspector.getByRole('button', { name: 'Open conversation' })).toHaveCount(0);
  expect(requests.exactRunRequests.length).toBeGreaterThan(initialRequestCount);
  expect(new Set(requests.exactRunRequests)).toEqual(new Set([OUTSIDE_WINDOW_RUN]));
});

test('a failed recent-window access revalidation removes cached run metadata', async ({ page }) => {
  const requests = await mockActivity(page);
  await page.goto('/dwaion/activity');
  await page.getByTestId(`dwaion-run-${COMPLETED_RUN}`).click();

  const inspector = page.getByRole('complementary', { name: 'Selected run details' });
  await expect(inspector.getByText('Recent run response')).toBeVisible();
  requests.revokeRunList();
  await page.getByRole('button', { name: 'Refresh AI run activity' }).click();
  await expect(page.getByTestId(`dwaion-run-${COMPLETED_RUN}`)).toHaveCount(0);
  await expect(inspector.getByText('Recent run response')).toHaveCount(0);
  await expect(inspector.getByRole('button', { name: 'Open conversation' })).toHaveCount(0);
});

async function mockActivity(
  page: Page,
  options: {
    askOnly?: boolean;
    blockList?: boolean;
    missingDetail?: boolean;
    missingRun?: boolean;
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
    return route.fulfill({ json: { data: runs } });
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
  return {
    runRequests,
    exactRunRequests,
    detailRequests,
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
    eventKind: 'EXECUTION_SNAPSHOT',
    executionId: runId,
    executionVersion: 4,
    attempt: 1,
    workStatus: null,
    dataProvenance: 'LIVE',
    auditStatus: 'NOT_LINKED',
    auditRecordId: null,
    auditId: null,
  };
}
