import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

import type { APIRequestContext, Page, TestInfo } from '@playwright/test';

const FIXTURE_URL = 'http://127.0.0.1:8919/api/__hrm009-gate';
const PERSONAL_PATH = '/hr/me/requests?tab=overview&focus=request:1001';
const OPERATIONS_PATH = '/hr/operations/people/certificates-documents?tab=overview';
const PERSONAL_PAGE_KEY = 'route.hcm.personal.requests.page';
const PERSONAL_DATA_KEY = 'route.hcm.personal.requests.data';
const OPERATIONS_PAGE_KEY = 'route.hcm.operations.certificates-documents.page';
const OPERATIONS_DATA_KEY = 'route.hcm.operations.certificates-documents.data';
const PERSONAL_OWNER_PATH = '/api/people/v1/hris/workbench/self-service/requests';
const OPERATIONS_OWNER_PATH = '/api/people/v1/hris/workbench/operations/certificates/documents';

type Scenario = 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';
type Surface = 'personal' | 'operations';
type GateEvent = Readonly<{
  sequence: number;
  type: string;
  routeContractKey?: string;
  path?: string;
  surface?: string;
}>;
type GateLog = Readonly<{
  schemaVersion: '1';
  decisionRevision: 'decision:hrm-009:52';
  counters: Readonly<{
    pageEvaluations: Readonly<Record<string, number>>;
    dataEvaluations: Readonly<Record<string, number>>;
    ownerGets: Readonly<Record<string, number>>;
    mutations: Readonly<Record<string, number>>;
    unexpectedAuthorityEvaluations: number;
    stepUpRequests: number;
  }>;
  events: readonly GateEvent[];
}>;

const fixtureTransportPatterns = [
  '**/api/auth/product-surface-contexts',
  '**/api/auth/product-surface-access/evaluate',
  '**/api/people/v1/hris/workbench/self-service/requests**',
  '**/api/people/v1/hris/workbench/operations/certificates/documents**',
] as const;

async function resetFixture(
  request: APIRequestContext,
  scenarios: Readonly<{ personal?: Scenario; operations?: Scenario }> = {}
) {
  const reset = await request.post(`${FIXTURE_URL}/reset`);
  expect(reset.ok()).toBeTruthy();
  if (scenarios.personal || scenarios.operations) {
    const configured = await request.post(`${FIXTURE_URL}/scenario`, { data: scenarios });
    expect(configured.ok()).toBeTruthy();
  }
}

async function readGateLog(request: APIRequestContext): Promise<GateLog> {
  const response = await request.get(`${FIXTURE_URL}/log`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as GateLog;
}

async function passThroughFixtureTransport(page: Page) {
  for (const pattern of fixtureTransportPatterns) {
    await page.route(pattern, (route) => route.continue());
  }
}

async function preparePage(
  page: Page,
  request: APIRequestContext,
  options: Readonly<{
    locale?: 'en' | 'ko';
    mode?: 'light' | 'dark';
    reduceMotion?: boolean;
    personalScenario?: Scenario;
    operationsScenario?: Scenario;
  }> = {}
) {
  await resetFixture(request, {
    personal: options.personalScenario,
    operations: options.operationsScenario,
  });
  await mockShellSession(page, ['HR_ADMIN'], {
    locale: options.locale ?? 'en',
    displayName: 'HRM-009 Browser Gate',
    jobTitle: 'HR operations verifier',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: options.mode ?? 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: options.reduceMotion ?? false,
    },
  });
  // Registered after the broad authenticated shell fixture so these exact four transports reach
  // the localhost gate server. All ordinary shell requests remain synthetic and isolated.
  await passThroughFixtureTransport(page);
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth, label).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

async function expectAccessible(page: Page) {
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
}

async function expectReadOnlyStageA(page: Page, expectedState: 'complete' | 'partial') {
  const workbench = page.getByTestId('hrm-009-certificate-workbench');
  await expect(workbench).toBeVisible();
  await expect(workbench).toHaveAttribute('data-runtime-state', expectedState);
  await expect(page.getByText('Stage-A is read only', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Certificate submission is disabled.', { exact: false })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review and send request' })).toBeDisabled();
  await expect(page.locator('form input:not(:disabled), form button:not(:disabled)')).toHaveCount(
    0
  );
  await expect(
    page.locator('button, a').filter({
      hasText: /download|revoke|verification|expiry|access-audit|download-audit/iu,
    })
  ).toHaveCount(0);
  await expect(page.getByText('a'.repeat(64), { exact: true })).toHaveCount(0);
}

function evidenceContract(surface: Surface) {
  return surface === 'personal'
    ? {
        pageKey: PERSONAL_PAGE_KEY,
        dataKey: PERSONAL_DATA_KEY,
        ownerPath: PERSONAL_OWNER_PATH,
      }
    : {
        pageKey: OPERATIONS_PAGE_KEY,
        dataKey: OPERATIONS_DATA_KEY,
        ownerPath: OPERATIONS_OWNER_PATH,
      };
}

function firstSequence(log: GateLog, type: string, selector: (event: GateEvent) => boolean) {
  return log.events.find((event) => event.type === type && selector(event))?.sequence ?? 0;
}

function expectGateEvidence(log: GateLog, surface: Surface) {
  const contract = evidenceContract(surface);
  expect(log.schemaVersion).toBe('1');
  expect(log.decisionRevision).toBe('decision:hrm-009:52');
  expect(log.counters.pageEvaluations[contract.pageKey]).toBeGreaterThanOrEqual(1);
  expect(log.counters.dataEvaluations[contract.dataKey]).toBeGreaterThanOrEqual(1);
  expect(log.counters.ownerGets[contract.ownerPath]).toBeGreaterThanOrEqual(1);
  expect(log.counters.unexpectedAuthorityEvaluations).toBe(0);
  expect(log.counters.stepUpRequests).toBe(0);
  expect(Object.values(log.counters.mutations).reduce((sum, count) => sum + count, 0)).toBe(0);

  const pageSequence = firstSequence(
    log,
    'PAGE_EVALUATION_ALLOWED',
    (event) => event.routeContractKey === contract.pageKey
  );
  const dataSequence = firstSequence(
    log,
    'DATA_EVALUATION_ALLOWED',
    (event) => event.routeContractKey === contract.dataKey
  );
  const ownerSequence = firstSequence(
    log,
    'OWNER_GET_ALLOWED',
    (event) => event.path === contract.ownerPath
  );
  expect(pageSequence).toBeGreaterThan(0);
  expect(dataSequence).toBeGreaterThan(pageSequence);
  expect(ownerSequence).toBeGreaterThan(dataSequence);
}

async function attachEvidence(
  page: Page,
  request: APIRequestContext,
  testInfo: TestInfo,
  name: string,
  surface: Surface
) {
  const log = await readGateLog(request);
  expectGateEvidence(log, surface);
  await testInfo.attach(`${name}-request-log.json`, {
    body: Buffer.from(`${JSON.stringify(log, null, 2)}\n`),
    contentType: 'application/json',
  });
  await testInfo.attach(`${name}.png`, {
    body: await page.screenshot({ animations: 'disabled', fullPage: true }),
    contentType: 'image/png',
  });
}

test.describe.configure({ mode: 'serial' });

test('1440 light personal route preserves PAGE-DATA-GET order and keyboard focus', async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await preparePage(page, request);

  await page.goto(PERSONAL_PATH, { waitUntil: 'domcontentloaded' });
  await expectReadOnlyStageA(page, 'complete');
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === '/hr/me/requests' &&
      url.searchParams.get('tab') === 'overview' &&
      url.searchParams.get('focus') === 'request:1001'
    );
  });
  await expect(page.getByText('request:1001', { exact: true }).first()).toBeVisible();

  const refresh = page.getByRole('button', { name: 'Refresh' });
  await refresh.focus();
  await expect(refresh).toBeFocused();
  await page.keyboard.press('Tab');
  const selectedRequest = page.getByTestId('hrm-009-work-list').getByRole('button').first();
  await expect(selectedRequest).toBeFocused();
  await expect(selectedRequest).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(':focus-visible')).toContainText('globally mobile employee');
  await expectNoHorizontalOverflow(page, '1440 personal read-only gate must not overflow');
  await expectAccessible(page);
  await attachEvidence(page, request, testInfo, '1440-light-personal', 'personal');
});

test('1280 dark operations route is metadata-only with every action disabled', async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
  await preparePage(page, request, { mode: 'dark' });

  await page.goto(OPERATIONS_PATH, { waitUntil: 'domcontentloaded' });
  await expectReadOnlyStageA(page, 'complete');
  const workbench = page.getByTestId('hrm-009-certificate-workbench');
  await expect(workbench).toHaveAttribute('data-page-archetype', 'focus-form');
  await expect(workbench).toHaveAttribute('data-color-scheme', 'dark');
  await expect(page.getByTestId('hrm-009-operations-focus-form')).toBeVisible();
  await expect(page.getByText('digest recorded', { exact: false })).toBeVisible();
  await expectNoHorizontalOverflow(page, '1280 operations read-only gate must not overflow');
  await expectAccessible(page);
  await attachEvidence(page, request, testInfo, '1280-dark-operations', 'operations');
});

test('390 Korean reduced-motion route preserves the long bilingual request label', async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await preparePage(page, request, { locale: 'ko', reduceMotion: true });

  await page.goto(PERSONAL_PATH, { waitUntil: 'domcontentloaded' });
  await expectReadOnlyStageA(page, 'complete');
  const workbench = page.getByTestId('hrm-009-certificate-workbench');
  await expect(workbench).toHaveAttribute('data-layout-density', 'compact');
  await expect(workbench).toHaveAttribute('data-reduced-motion', 'active');
  await expect(page.getByText('증명서 요청', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('globally mobile employee', { exact: false }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, '390 Korean personal gate must not overflow');
  await expectAccessible(page);
  await attachEvidence(page, request, testInfo, '390-ko-reduced-personal', 'personal');
});

test('320 forced-colors operations route reports partial owner data without enabling actions', async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({
    colorScheme: 'light',
    forcedColors: 'active',
    reducedMotion: 'reduce',
  });
  await preparePage(page, request, { operationsScenario: 'PARTIAL', reduceMotion: true });

  await page.goto(OPERATIONS_PATH, { waitUntil: 'domcontentloaded' });
  await expectReadOnlyStageA(page, 'partial');
  const workbench = page.getByTestId('hrm-009-certificate-workbench');
  await expect(workbench).toHaveAttribute('data-forced-colors', 'active');
  await expect(
    page.getByText('Some governed metadata is unavailable', { exact: true })
  ).toBeVisible();
  const refresh = page.getByRole('button', { name: 'Refresh' });
  await refresh.focus();
  await expect(refresh).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Certificate metadata focus' })).toBeFocused();
  await expectNoHorizontalOverflow(page, '320 forced-colors operations gate must not overflow');
  await expectAccessible(page);
  await attachEvidence(page, request, testInfo, '320-forced-partial-operations', 'operations');
});

test('1280 physical pixels at 200 percent zoom preserves semantic reading order', async ({
  browser,
  request,
}, testInfo) => {
  // 640 CSS pixels at deviceScaleFactor 2 represents a 1280-pixel display at 200% zoom while
  // exercising the same responsive breakpoints delivered to an actual zoomed browser.
  const context = await browser.newContext({
    viewport: { width: 640, height: 450 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  try {
    await preparePage(page, request, { reduceMotion: true });
    await page.goto(PERSONAL_PATH, { waitUntil: 'domcontentloaded' });
    await expectReadOnlyStageA(page, 'complete');
    const headings = page.locator('main h1, main h2, main h3');
    await expect(headings.first()).toContainText('My HR requests and certificates');
    await expect(page.getByTestId('hrm-009-work-list')).toBeVisible();
    await expect(page.getByTestId('hrm-009-work-detail')).toBeVisible();
    const semanticOrder = await page.evaluate(() => {
      const heading = document.querySelector('main h1');
      const list = document.querySelector('[data-testid="hrm-009-work-list"]');
      const detail = document.querySelector('[data-testid="hrm-009-work-detail"]');
      if (!heading || !list || !detail) return false;
      return (
        Boolean(heading.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        Boolean(list.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
    });
    expect(semanticOrder).toBe(true);
    await expectNoHorizontalOverflow(page, '200 percent zoom personal gate must not overflow');
    await expectAccessible(page);
    await attachEvidence(page, request, testInfo, '1280-physical-200-percent-personal', 'personal');
  } finally {
    await context.close();
  }
});
