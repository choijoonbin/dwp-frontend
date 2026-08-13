import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

import type { Page } from '@playwright/test';

const viewports = [
  { name: 'minimum-supported', width: 320, height: 720 },
  { name: 'compact', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'wide', width: 1920, height: 1080 },
] as const;

async function expectNoHorizontalOverflow(page: Page, path: string) {
  const overflow = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
  );
  expect(overflow, `${path} must not overflow the viewport`).toBeLessThanOrEqual(1);
}

for (const viewport of viewports) {
  test(`workspace resource views reflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockShellSession(page, ['WORKSPACE_MEMBER']);

    for (const path of ['/', '/work', '/activity', '/apps']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page, path);
    }
  });
}

test('Wave 1 provider command surfaces reflow at the 320px release boundary', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['PROVIDER_ADMIN'], { locale: 'en' });

  for (const path of [
    '/provider/overview',
    '/provider/health',
    '/provider/operations',
    '/provider/tenants',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page, path);
  }
});

test('Wave 1 tenant and workforce command surfaces reflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  for (const path of [
    '/admin/governance/api-monitoring',
    '/admin/governance/audit-overview',
    '/admin/governance/audit-investigations',
    '/hr/operations',
    '/hr/design/organization',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page, path);
  }
});

test('Wave 1 representative command surfaces pass 200 percent text and accessibility gates', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: true,
      reduceMotion: true,
    },
  });

  for (const path of [
    '/admin/governance/api-monitoring',
    '/admin/governance/audit-investigations',
    '/hr/operations',
  ]) {
    await page.goto(path);
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page, path);
    const results = await new AxeBuilder({ page }).include('main').analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    );
    expect(blocking, `${path} must pass serious accessibility checks`).toEqual([]);
  }
});

test('provider command center passes the 200 percent text release gate', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    locale: 'en',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: true,
      reduceMotion: true,
    },
  });

  await page.goto('/provider/overview');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, '/provider/overview');
  const results = await new AxeBuilder({ page }).include('main').analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  );
  expect(blocking).toEqual([]);
});

test('work view passes serious accessibility checks at 200 percent text size', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: true,
      reduceMotion: true,
    },
  });
  await page.goto('/work');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expect(page.getByRole('heading', { level: 1, name: /work|업무/i })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  );
  expect(blocking).toEqual([]);
});
