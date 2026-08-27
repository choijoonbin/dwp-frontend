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

function emptyOverview() {
  return {
    generatedAt: '2026-08-12T09:30:00Z',
    dataBoundary: 'TENANT',
    fieldGroups: ['DIRECTORY'],
    domains: [],
  };
}

test('workforce operators see governed aggregate evidence by HR domain', async ({ page }) => {
  await mockShellSession(page, ['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN'], {
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.goto('/hr/operations');

  await expect(page.getByRole('heading', { name: 'Workforce operations', level: 1 })).toBeVisible();
  await expect(page.getByText(/workforce operations boundary.*TENANT/u)).toBeVisible();
  await expect(page.getByText('Allowed field groups')).toBeVisible();
  await expect(page.getByText('DIRECTORY', { exact: true })).toBeVisible();
  await expect(page.getByText('EMPLOYMENT', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Time operations summary' })).toBeVisible();
  await expect(page.getByText('7 items pending in the current boundary')).toBeVisible();
  await expect(page.getByText('Open exceptions')).toBeVisible();
  await expect(page.getByText('3', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('workforce overview exposes a retryable boundary when aggregate evidence fails', async ({
  page,
}) => {
  await mockShellSession(page, ['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN'], {
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  let attempts = 0;
  let recoveryAllowed = false;
  await page.route('**/api/people/v1/workforce/operations/overview**', (route) => {
    attempts += 1;
    if (!recoveryAllowed) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    }
    return route.fallback();
  });

  await page.goto('/hr/operations');

  await expect(
    page.getByRole('heading', { name: 'Information could not be loaded' })
  ).toBeVisible();
  const failedAttempts = attempts;
  recoveryAllowed = true;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'Time operations summary' })).toBeVisible();
  expect(attempts).toBeGreaterThan(failedAttempts);
  await expectNoHorizontalOverflow(page);
});

test('workforce overview presents an honest empty aggregate state', async ({ page }) => {
  await mockShellSession(page, ['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN'], {
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.route('**/api/people/v1/workforce/operations/overview**', (route) =>
    fulfillSuccess(route, emptyOverview())
  );

  await page.goto('/hr/operations');

  await expect(page.getByText('Allowed field groups')).toBeVisible();
  await expect(page.getByText('DIRECTORY', { exact: true })).toBeVisible();
  await expect(page.getByText('There is no operational metric to show')).toBeVisible();
  await expect(
    page.getByText('Readiness metrics appear when domain data is connected.')
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
