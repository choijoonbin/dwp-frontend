import { expect, test } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('workspace member shell reflows at the intermediate desktop boundary', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.setViewportSize({ width: 1024, height: 800 });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    jobTitle: 'Service designer',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });

  await page.goto('/work');
  await expect(page.getByTestId('app-header')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Work', level: 1 })).toBeVisible();
  await expect(page).toHaveScreenshot('shell-workspace-member-en-1024.png', {
    animations: 'disabled',
    caret: 'hide',
    clip: { x: 0, y: 0, width: 1024, height: 320 },
    maxDiffPixelRatio: 0.001,
    timeout: 10_000,
  });
});

test('tenant administration shell preserves Korean context in dark mode', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'ko',
    displayName: '박현우',
    jobTitle: '플랫폼 관리자',
    appearance: {
      mode: 'dark',
      density: 'comfortable',
      highContrast: false,
      reduceMotion: true,
    },
  });

  await page.goto('/admin/experience/branding');
  await expect(page.getByTestId('admin-header')).toBeVisible();
  await expect(page.locator('#tenant-branding-heading')).toBeVisible();
  await expect(page).toHaveScreenshot('shell-admin-ko-dark.png', {
    animations: 'disabled',
    caret: 'hide',
    clip: { x: 0, y: 0, width: 1280, height: 360 },
    maxDiffPixelRatio: 0.001,
    timeout: 10_000,
  });
});

test('provider control plane keeps global scope visually distinct', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    locale: 'en',
    appearance: {
      mode: 'light',
      density: 'compact',
      highContrast: false,
      reduceMotion: true,
    },
  });

  await page.goto('/provider/overview');
  await expect(page.getByTestId('provider-header')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Global operating metrics' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Auto-refreshing', { timeout: 15_000 });
  await expect(page).toHaveScreenshot('shell-provider-en-compact.png', {
    animations: 'disabled',
    caret: 'hide',
    clip: { x: 0, y: 0, width: 1280, height: 360 },
    maxDiffPixelRatio: 0.001,
    timeout: 10_000,
  });
});

test('mobile product-area shell keeps navigation usable in Korean high contrast', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'ko',
    displayName: '박현우',
    jobTitle: '플랫폼 관리자',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: true,
      reduceMotion: true,
    },
  });

  await page.goto('/people/directory');
  const header = page.getByTestId('people-header');
  await expect(header).toBeVisible();
  await expect(page.getByRole('grid', { name: '구성원 디렉터리' })).toBeVisible();
  await header.locator('button').first().click();
  await expect(page.getByTestId('people-mobile-sidebar')).toBeVisible();
  await expect(page).toHaveScreenshot('shell-people-ko-mobile-drawer.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixelRatio: 0.001,
    timeout: 10_000,
  });
});
