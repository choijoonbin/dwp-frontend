import { expect, type Locator, type Page } from '@playwright/test';

export const NOTIFICATIONS_VIEW = {
  resourceType: 'APP',
  resourceKey: 'APP.NOTIFICATIONS',
  permissionCode: 'VIEW',
  effect: 'ALLOW' as const,
};

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', data });
}

export async function mockUnreadAppBadge(page: Page, appKey: string, totalUnread: number) {
  const generatedAt = new Date().toISOString();
  await page.route('**/api/notifications/v1/summary/by-app', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: success({
        partial: false,
        unavailableSources: [],
        apps: [
          {
            appKey,
            totalUnread,
            actionableUnread: 1,
            urgentUnread: 0,
            lastActivityAt: generatedAt,
          },
        ],
        changeVersion: '1',
        counterVersion: '1',
        generatedAt,
      }),
    })
  );
}

export async function expectApprovalsMobileHeader(
  page: Page
): Promise<{ applicationContext: Locator; managementLink: Locator }> {
  const header = page.getByTestId('approvals-header');
  const applicationContext = page.getByTestId('shell-application-context');
  const productLabel = applicationContext.getByText('전자결재', { exact: true });
  const managementLink = page
    .getByTestId('approvals-mobile-surface-switcher')
    .getByTestId('product-surface-management-entry');

  await expect(productLabel).toBeVisible();
  await expect(page.getByTestId('shell-notification-control')).toBeVisible();
  await expect(managementLink).toBeVisible();
  await expect(managementLink).toHaveAccessibleName('앱 관리: 전자결재');
  await expect(managementLink.getByText('관리', { exact: true })).toBeVisible();

  const [labelOverflow, headerOverflow, pageOverflow] = await Promise.all([
    productLabel.evaluate((element) => element.scrollWidth - element.clientWidth),
    header.evaluate((element) => element.scrollWidth - element.clientWidth),
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    ),
  ]);
  expect(labelOverflow).toBeLessThanOrEqual(1);
  expect(headerOverflow).toBeLessThanOrEqual(1);
  expect(pageOverflow).toBeLessThanOrEqual(1);

  return { applicationContext, managementLink };
}

export async function expectDialogViewportInset(page: Page, accessibleName: string, inset = 16) {
  const dialog = page.getByRole('dialog', { name: accessibleName });
  await expect(dialog).toHaveCSS('opacity', '1');
  const [bounds, viewport] = await Promise.all([
    dialog.boundingBox(),
    page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
  ]);
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  expect(bounds.x).toBeGreaterThanOrEqual(inset);
  expect(bounds.y).toBeGreaterThanOrEqual(inset);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - inset);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - inset);
}
