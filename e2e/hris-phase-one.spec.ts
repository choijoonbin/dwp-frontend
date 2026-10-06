import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  people360ListSnapshot,
  people360Page,
  people360Snapshot,
} from '../apps/dwp/src/features/hris/people/testing/people-360.test-support';
import {
  HR_HOME_FIXTURE,
  HR_PAY_FIXTURE,
  HR_TALENT_FIXTURE,
  HR_TIME_FIXTURE,
} from './support/product-area-fixtures';
import { mockHcmProductSurfaceAuthority } from './support/product-surface-authority';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

const DATA_ANCHORS = [
  {
    module: 'HRM',
    path: '/hr/operations/people',
    apiPath: '/api/people/v1/workforce/people',
    contextScopeKey: 'scope:hcm:operations',
    heading: 'Workforce people',
    marker: 'input[data-testid="hris-people360-search"]',
  },
  {
    module: 'TIM',
    path: '/hr/time',
    apiPath: '/api/people/v1/hr/time',
    contextScopeKey: 'scope:hcm:self',
    heading: 'My time',
    marker: '[data-testid="hris-query-state"][data-query-state="ready"]',
  },
  {
    module: 'PAY',
    path: '/hr/pay',
    apiPath: '/api/people/v1/hr/pay',
    contextScopeKey: 'scope:hcm:self',
    heading: 'Pay statements',
    marker: '[data-testid="hris-payroll-workspace"]',
  },
  {
    module: 'PER',
    path: '/hr/talent',
    apiPath: '/api/people/v1/hr/talent',
    contextScopeKey: 'scope:hcm:self',
    heading: 'Growth and career',
    marker: '[data-route="/hr/talent"][data-scope="personal-goal-progress"]',
  },
] as const;

const HRIS_TIME_ANCHOR_FIXTURE = {
  ...HR_TIME_FIXTURE,
  card: {
    ...HR_TIME_FIXTURE.card,
    dataOrigin: 'SOURCE',
  },
  entries: HR_TIME_FIXTURE.entries.map((entry) => ({
    ...entry,
    entryType: 'WORK',
  })),
} as const;

const PEOPLE_IDENTITY = {
  personId: '11111111-1111-4111-8111-111111111111',
  displayName: 'Phase One Person',
} as const;

async function expectNoDocumentOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport + 1);
}

async function captureEvidence(page: Page, projectName: string, name: string) {
  const directory = process.env.HRIS_PHASE_ONE_EVIDENCE_DIR;
  if (!directory) return;
  await page.screenshot({ path: `${directory}/${projectName}-${name}.png`, fullPage: true });
}

async function mockHrisOperator(page: Page) {
  await mockShellSession(page, ['HR_ADMIN'], {
    locale: 'en',
    displayName: 'HRIS Operator',
    jobTitle: 'People operations lead',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
}

async function mockGovernedHrisOperator(page: Page) {
  await mockHrisOperator(page);
  await mockHcmProductSurfaceAuthority(page);
}

function fixtureMarker(module: (typeof DATA_ANCHORS)[number]['module']) {
  if (module === 'TIM') return HR_TIME_FIXTURE.exceptions[0].message;
  if (module === 'PAY') return HR_PAY_FIXTURE.nextCycle.name;
  if (module === 'PER') return HR_TALENT_FIXTURE.goals[0].title;
  return null;
}

test('employee enters a widget-only HRIS home instead of a menu catalog', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'HRIS Employee',
    jobTitle: 'Product designer',
  });
  await page.goto('/hr/home');

  await expect(page.getByTestId('hcm-home-overview')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: new RegExp(HR_HOME_FIXTURE.employee.displayName, 'u') })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'HR work that needs attention' })).toBeVisible();
  await expect(page.locator('[data-workspace-widget="people-signals"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="quick-actions"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="profile"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="team"]')).toHaveCount(0);
  await expect(page.getByTestId('hris-product-map')).toHaveCount(0);
  await captureEvidence(page, testInfo.project.name, 'hris-home');

  const accessibility = await new AxeBuilder({ page }).include('[data-dwp-page-canvas]').analyze();
  expect(accessibility.violations).toEqual([]);
  await expectNoDocumentOverflow(page);
});

test('HR administrator receives the same widget home contract without the legacy product map', async ({
  page,
}, testInfo) => {
  await mockHrisOperator(page);
  await page.goto('/hr/home');

  await expect(page.getByTestId('hcm-home-overview')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="people-signals"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="quick-actions"]')).toBeVisible();
  await expect(page.locator('[data-workspace-widget="profile"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'My team', exact: true })).toBeVisible();
  await expect(page.getByTestId('hris-product-map')).toHaveCount(0);
  await captureEvidence(page, testInfo.project.name, 'hris-administrator-home');
  await expectNoDocumentOverflow(page);
});

test('HRIS home fails explicitly when the aggregate is unavailable instead of falling back to a menu catalog', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'HRIS Employee',
    jobTitle: 'Product designer',
  });
  await page.route('**/api/people/v1/hr/home', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'Overview temporarily unavailable' }),
    })
  );

  await page.goto('/hr/home');

  await expect(
    page.getByRole('heading', { level: 2, name: 'Information could not be loaded' })
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('The home aggregate could not be loaded');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByTestId('hcm-home-overview')).toHaveCount(0);
  await expect(page.getByTestId('hris-product-map')).toHaveCount(0);
  await expectNoDocumentOverflow(page);
});

test.fixme('planned /hr/explore work explorer remains pending until its governed G3 route is implemented', async ({
  page,
}) => {
  // The 98-node IA catalog belongs on this separate route. Keeping this test
  // explicitly fixme prevents the unimplemented explorer from being reported
  // as a passing Phase-1 capability or moved back onto the HRIS home.
  await mockHrisOperator(page);
  await page.goto('/hr/explore');

  const explorer = page.getByTestId('hris-work-explorer');
  await expect(explorer).toBeVisible();
  await expect(explorer.getByRole('searchbox')).toBeVisible();
  await expect(explorer.getByTestId('hris-work-explorer-favorites')).toBeVisible();
  await expect(explorer.getByTestId('hris-work-explorer-recent')).toBeVisible();
  await expect(page.getByTestId('hcm-home-overview')).toHaveCount(0);
});

for (const anchor of DATA_ANCHORS) {
  test(`${anchor.module} data anchor opens directly with its governed scope`, async ({
    page,
  }, testInfo) => {
    await mockGovernedHrisOperator(page);
    if (anchor.module === 'TIM') {
      await page.route('**/api/people/v1/hr/time**', (route) =>
        fulfillSuccess(route, HRIS_TIME_ANCHOR_FIXTURE)
      );
    }
    const dataRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === anchor.apiPath
    );

    await page.goto(anchor.path);

    const requestUrl = new URL((await dataRequest).url());
    expect(requestUrl.searchParams.getAll('contextScopeKey')).toEqual([anchor.contextScopeKey]);
    await expect(page).toHaveURL(new RegExp(`${anchor.path.replaceAll('/', '\\/')}(?:\\?|$)`, 'u'));
    await expect(page.getByRole('heading', { level: 1, name: anchor.heading })).toBeVisible();
    await expect(page.locator(anchor.marker)).toBeVisible();
    const markerText = fixtureMarker(anchor.module);
    if (markerText) await expect(page.getByText(markerText, { exact: true }).first()).toBeVisible();
    await captureEvidence(page, testInfo.project.name, `${anchor.module.toLowerCase()}-anchor`);
    await expectNoDocumentOverflow(page);
  });
}

test('People 360 search keeps the operations scope and opens detail from the keyboard', async ({
  page,
}, testInfo) => {
  await mockGovernedHrisOperator(page);
  const listRequests: URL[] = [];
  const detailRequests: URL[] = [];
  const peoplePath = '/api/people/v1/workforce/people';
  const detailPath = `${peoplePath}/${PEOPLE_IDENTITY.personId}`;
  await page.route('**/api/people/v1/workforce/people**', (route) => {
    const url = new URL(route.request().url());
    const asOf = url.searchParams.get('asOf') ?? '2026-09-10';
    if (url.pathname === detailPath) {
      detailRequests.push(url);
      return fulfillSuccess(route, people360Snapshot({ ...PEOPLE_IDENTITY, asOf }));
    }
    if (url.pathname !== peoplePath) return route.fallback();
    listRequests.push(url);
    const items = url.searchParams.get('query')
      ? [people360ListSnapshot({ ...PEOPLE_IDENTITY, asOf })]
      : [];
    return fulfillSuccess(route, people360Page(items, { asOf }));
  });

  await page.goto('/hr/operations/people');
  const search = page.getByTestId('hris-people360-search');
  await expect(search).toBeVisible();
  await search.fill('Phase One');
  await expect
    .poll(() =>
      listRequests.some(
        (url) =>
          url.searchParams.get('query') === 'Phase One' &&
          url.searchParams.get('contextScopeKey') === 'scope:hcm:operations'
      )
    )
    .toBe(true);

  await expect(page.getByText(PEOPLE_IDENTITY.displayName, { exact: true }).first()).toBeVisible();
  const detailAction = page.getByRole('button', { name: /Phase One Person/u }).last();
  await expect(detailAction).toBeVisible();
  await detailAction.focus();
  await expect(detailAction).toBeFocused();
  await detailAction.press('Enter');

  const inspector = page.getByRole('complementary', { name: PEOPLE_IDENTITY.displayName });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByText('Synthetic People Operations', { exact: true })).toBeVisible();
  await expect
    .poll(() => new URL(page.url()).searchParams.get('person'))
    .toBe(PEOPLE_IDENTITY.personId);
  await expect.poll(() => detailRequests.length).toBe(1);
  expect(detailRequests[0]?.searchParams.getAll('contextScopeKey')).toEqual([
    'scope:hcm:operations',
  ]);
  await captureEvidence(page, testInfo.project.name, 'hrm-search-detail');
  await expectNoDocumentOverflow(page);
});
