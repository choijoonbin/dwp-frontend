import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  fulfillSuccess,
  FULL_PRODUCT_PERMISSIONS,
  mockShellSession,
} from './support/shell-session';

import type { Page } from '@playwright/test';

test.describe.configure({ mode: 'parallel' });

async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
}

function emptyChart(asOf: string) {
  return {
    asOf,
    company: { organizationId: 'org-skax', organizationKey: 'SKAX', name: 'SKAX' },
    scenario: null,
    metrics: {
      headcount: 0,
      activeHeadcount: 0,
      onLeaveHeadcount: 0,
      contingentHeadcount: 0,
      organizationCount: 0,
      managerCount: 0,
      openPositionCount: 0,
      locationCount: 0,
      plannedFte: 0,
      workforceCostAmount: 0,
      costCurrency: 'KRW',
    },
    analysis: {
      healthScore: 100,
      dataQualityScore: 100,
      averageManagerSpan: 0,
      maximumLayers: 0,
      managerRatioPercent: 0,
      contingentRatioPercent: 0,
      narrowSpanManagerCount: 0,
      wideSpanManagerCount: 0,
      singleReportManagerCount: 0,
      missingManagerCount: 0,
      missingGradeCount: 0,
      orphanOrganizationCount: 0,
      policy: {
        minimumManagerSpan: 3,
        maximumManagerSpan: 12,
        maximumLayers: 8,
        maximumContingentPercent: 20,
        maximumVacancyPercent: 15,
      },
      signals: [],
    },
    organizations: [],
    people: [],
    positions: [],
    relationships: [],
    openPositions: [],
  };
}

test('workforce operators move from operating signals to the affected organization', async ({
  page,
}) => {
  await mockShellSession(page, ['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN'], {
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.goto('/workforce/overview');

  await expect(page.getByRole('heading', { name: 'Workforce operations', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Workforce operating context' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Saved views:/ })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Critical workforce action is required', level: 2 })
  ).toBeVisible();
  await expect(page.getByText('+7 since', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Priority workforce actions' })).toBeVisible();
  await expect(page.getByText('Review AI Platform organization design')).toBeVisible();
  await expect(page.getByText(/^WORKDAY_PRODUCTION ·/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="workforce-overview"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole('button', { name: /Saved views:/ }).click();
  await page.getByRole('menuitem', { name: /Year-over-year comparison/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('compareTo')).toBe('2025-08-12');

  await page.getByRole('button', { name: 'Open AI Platform organization' }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get('organization'))
    .toBe('org-ai-platform');
});

test('workforce overview isolates comparison and planning evidence failures', async ({ page }) => {
  await mockShellSession(page, ['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN'], {
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.route('**/api/people/v1/workforce/organization/chart**', (route) => {
    const url = new URL(route.request().url());
    const asOf = url.searchParams.get('asOf');
    if (url.searchParams.get('depth') === '12' && asOf && asOf < '2026-08-01') {
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    }
    return route.fallback();
  });
  await page.route('**/api/people/v1/workforce/organization/scenarios', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
  );

  await page.goto('/workforce/overview');

  await expect(page.getByText('178', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Comparison is unavailable').first()).toBeVisible();
  await expect(page.getByText('Workforce evidence is partially available')).toBeVisible();
  await expect(page.getByText('Period comparison is unavailable')).toBeVisible();
  await expect(page.getByText('Evidence source unavailable')).toBeVisible();
  await expect(page.getByText('Workforce operations data could not be loaded.')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('workforce overview presents a healthy empty state without invented trends', async ({
  page,
}) => {
  await mockShellSession(page, ['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN'], {
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.route('**/api/people/v1/workforce/organization/chart**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('depth') === '12') {
      return fulfillSuccess(route, emptyChart(url.searchParams.get('asOf') ?? '2026-08-12'));
    }
    return route.fallback();
  });
  await page.route('**/api/people/v1/workforce/organization/scenarios', (route) =>
    fulfillSuccess(route, [])
  );
  await page.route('**/api/people/v1/workforce/data-operations/hris/sync-runs**', (route) =>
    fulfillSuccess(route, [])
  );

  await page.goto('/workforce/overview');

  await expect(
    page.getByRole('heading', { name: 'Workforce operations are within policy', level: 2 })
  ).toBeVisible();
  await expect(page.getByText('No workforce action is currently required')).toBeVisible();
  await expect(
    page.getByText('No organization is outside the current health policy.')
  ).toBeVisible();
  await expect(page.getByText(/^0 since/).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
