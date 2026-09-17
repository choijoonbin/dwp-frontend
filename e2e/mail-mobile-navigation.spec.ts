import { expect, test, type Page } from '@playwright/test';

import { fulfill, MEMBER_PERMISSIONS, mockMailMember } from './support/mail-fixtures';
import { mockShellSession } from './support/shell-session';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mail bottom navigation is a mobile contract.');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('user Mail pages keep one common bottom navigation and open the complete drawer', async ({
  page,
}) => {
  await mockMailMember(page);
  await page.route('**/api/platform/v1/mail/threads**', (route) =>
    fulfill(route, { items: [], total: 0, page: 0, pageSize: 50 })
  );

  await page.goto('/mail/search');

  const navigation = page.getByTestId('mail-mobile-bottom-navigation');
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link')).toHaveCount(3);
  await expect(navigation.getByRole('link', { name: 'Mail home', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Inbox', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Shared inboxes', exact: true })).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'More', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expectContentClearance(page);

  await navigation.getByRole('button', { name: 'More', exact: true }).click();
  const drawer = page.getByTestId('mail-mobile-sidebar');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('link', { name: 'Search', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );

  await page.keyboard.press('Escape');
  await navigation.getByRole('link', { name: 'Inbox', exact: true }).click();
  await expect(page).toHaveURL(/\/mail\/inbox$/u);
});

test('Mail administration uses the same permission-aware bottom navigation', async ({ page }) => {
  await mockMailAdministrator(page);

  await page.goto('/mail/admin/delivery-audit');

  const navigation = page.getByTestId('mail-mobile-bottom-navigation');
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link')).toHaveCount(4);
  await expect(
    navigation.getByRole('link', { name: 'Operations overview', exact: true })
  ).toBeVisible();
  await expect(
    navigation.getByRole('link', { name: 'Mail connections', exact: true })
  ).toBeVisible();
  await expect(
    navigation.getByRole('link', { name: 'Shared inbox operations', exact: true })
  ).toBeVisible();
  await expect(
    navigation.getByRole('link', { name: 'Security and AI policies', exact: true })
  ).toBeVisible();

  const retentionAndAudit = navigation.getByRole('button', {
    name: 'Retention & audit',
    exact: true,
  });
  await expect(retentionAndAudit).toHaveAttribute('aria-current', 'page');
  await retentionAndAudit.click();

  const drawer = page.getByTestId('mail-mobile-sidebar');
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole('link', { name: 'Retention and legal hold', exact: true })
  ).toBeVisible();
  await expect(drawer.getByRole('link', { name: 'Delivery audit', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expectContentClearance(page);
});

async function expectContentClearance(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const main = document.querySelector<HTMLElement>('#dwp-main-content');
        const navigation = document.querySelector<HTMLElement>(
          '[data-testid="mail-mobile-bottom-navigation"]'
        );
        if (!main || !navigation) return false;
        const navigationHeight = navigation.getBoundingClientRect().height;
        return Number.parseFloat(getComputedStyle(main).paddingBottom) + 1 >= navigationHeight;
      })
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);
}

async function mockMailAdministrator(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MAIL_ADMIN'], {
    locale: 'en',
    displayName: 'Mail Admin',
    permissions: [
      ...MEMBER_PERMISSIONS,
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.MAIL',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
    ],
  });
  await page.route('**/api/platform/v1/admin/mail/overview', (route) =>
    fulfill(route, {
      personalAccounts: 0,
      sharedAccounts: 0,
      activeConnections: 0,
      degradedConnections: 0,
      openSharedThreads: 0,
      pendingAiProposals: 0,
      queuedDeliveries: 0,
      failedDeliveries: 0,
      policy: {
        externalSenderBanner: true,
        blockRemoteImages: true,
        allowSharedInboxes: true,
        aiAssistanceEnabled: false,
        aiCrossAppActionsEnabled: false,
        aiAutoExecuteEnabled: false,
        retentionDays: 365,
        maximumAttachmentMb: 25,
        version: 1,
      },
      connections: [],
      sharedInboxes: [],
      providerCatalog: [],
      generatedAt: '2026-09-16T09:00:00Z',
    })
  );
}
