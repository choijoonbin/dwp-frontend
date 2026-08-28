import { expect, test } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

import type { Page } from '@playwright/test';

const COMMAND_CENTER_GENERATED_AT = new Date('2026-08-11T00:00:00Z');

async function pauseCommandCenterClock(page: Page) {
  const currentTime = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(currentTime + 100);
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.clock.install({ time: COMMAND_CENTER_GENERATED_AT });
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

test('exposes operational scope, freshness, signals, and priority filtering', async ({ page }) => {
  await page.goto('/provider/overview');
  await expect(page.getByRole('heading', { name: 'Operations command center' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Operations command scope' })).toContainText(
    'All customer environments'
  );
  await expect(page.getByRole('region', { name: 'Operations command scope' })).toContainText(
    'Auto-refreshing'
  );
  await expect(page.getByRole('region', { name: 'Global operating metrics' })).toBeVisible();
  const openNavigation = page.getByRole('button', { name: 'Open provider navigation' });
  const mobileNavigation = await openNavigation.isVisible();
  if (mobileNavigation) {
    await openNavigation.focus();
    await openNavigation.press('Enter');
  }
  const providerNavigation = page.getByRole('navigation', { name: 'Provider navigation' });
  await expect(providerNavigation.getByRole('link', { name: 'Command center' })).toBeVisible();
  await expect(providerNavigation.getByRole('heading', { name: 'Command center' })).toHaveCount(0);
  if (mobileNavigation) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Provider navigation' })).toBeHidden();
  }
  await pauseCommandCenterClock(page);
  await expect(page.getByRole('meter', { name: /tenants active/i })).toHaveAttribute(
    'aria-valuenow',
    '94'
  );

  const severityFilter = page.getByRole('group', {
    name: 'Priority action severity filter',
  });
  await severityFilter.getByRole('button', { name: 'Immediate' }).click();
  await expect(page.getByText('No urgent actions in this scope')).toBeVisible();

  await severityFilter.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByText('TENANT_UPGRADE')).toBeVisible();
});

test('keeps the command center within the viewport', async ({ page }) => {
  await page.goto('/provider/overview');
  await expect(page.getByRole('region', { name: 'Global operating metrics' })).toBeVisible();
  await pauseCommandCenterClock(page);

  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
});
