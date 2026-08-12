import { expect, test } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

test.beforeEach(async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 320, height: 720 } : { width: 1280, height: 800 }
  );
  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    locale: 'en',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
});

test('service operations connects customer impact, service exceptions, and incident action', async ({
  page,
}) => {
  await page.goto('/provider/health');

  await expect(
    page.getByRole('heading', { name: 'Service operations', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Service operating scope' })).toContainText(
    'All customer services'
  );
  await expect(
    page.getByRole('heading', { name: 'Service operations review is required' })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Service operating signals' })).toContainText(
    '35 / 36'
  );
  await expect(page.getByText('Workspace latency elevated in Seoul cell')).toBeVisible();
  await expect(page.getByText('Workspace service', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Update state' }).click();
  await expect(page.getByRole('dialog', { name: /Update INC-2026-0811/ })).toBeVisible();
});

test('service operations stays within the viewport', async ({ page }) => {
  await page.goto('/provider/health');
  await expect(page.getByRole('region', { name: 'Service operating signals' })).toBeVisible();

  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
});

test('change control connects approval, execution ledger, and auditable evidence', async ({
  page,
}) => {
  await page.goto('/provider/operations');

  await expect(page.getByRole('heading', { name: 'Change control', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Change control scope' })).toContainText(
    'All customer environments'
  );
  await expect(
    page.getByRole('heading', { name: 'Changes are awaiting independent approval' })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Change control key signals' })).toContainText('1');
  await expect(page.getByText('Apply the reviewed platform schema release.')).toBeVisible();

  await page.getByRole('row', { name: /operation-1/ }).click();
  const review = page.getByRole('dialog', { name: 'Review change plan' });
  await expect(review).toBeVisible();
  await expect(review.getByText('Approval gates')).toBeVisible();
  await expect(review.getByText('Execution evidence')).toBeVisible();
  await expect(review.getByText('Execution steps')).toBeVisible();
  await review.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('dialog', { name: 'Approve change' })).toBeVisible();
});

test('change control stays within the viewport', async ({ page }) => {
  await page.goto('/provider/operations');
  await expect(page.getByRole('region', { name: 'Change control key signals' })).toBeVisible();

  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
});
