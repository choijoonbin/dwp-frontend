import { expect, test } from '@playwright/test';

import { fulfill, mockMailMember } from './support/mail-fixtures';

test('empty Mail home keeps account recovery as its only primary work path', async ({ page }) => {
  await mockMailMember(page);
  await page.route('**/api/platform/v1/mail/home**', (route) =>
    fulfill(route, {
      accounts: [],
      metrics: {
        unread: 0,
        urgent: 0,
        needsReply: 0,
        assigned: 0,
        snoozed: 0,
        activeProposals: 0,
      },
      focusQueue: [],
      proposals: [],
      sharedInboxes: [],
      generatedAt: '2026-10-28T10:00:00.000Z',
    })
  );

  await page.goto('/mail/home');
  await expect(page.getByText('No mail account connected')).toBeVisible();
  await expect(page.getByText('Connect mail to begin')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New message' })).toHaveCount(0);
  await expect(page.getByRole('searchbox', { name: 'Search my mail' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open inbox' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Focus queue' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Connect an account' }).click();
  await expect(page).toHaveURL(/\/mail\/accounts$/u);
});

test('direct inbox entry never requests mailbox data without an account', async ({ page }) => {
  await mockMailMember(page);
  let threadRequests = 0;
  await page.route('**/api/platform/v1/mail/home**', (route) =>
    fulfill(route, {
      accounts: [],
      metrics: {
        unread: 0,
        urgent: 0,
        needsReply: 0,
        assigned: 0,
        snoozed: 0,
        activeProposals: 0,
      },
      focusQueue: [],
      proposals: [],
      sharedInboxes: [],
      generatedAt: '2026-10-28T10:00:00.000Z',
    })
  );
  await page.route('**/api/platform/v1/mail/threads**', (route) => {
    threadRequests += 1;
    return fulfill(route, { items: [], total: 0, page: 0, pageSize: 30 });
  });

  await page.goto('/mail/inbox?compose=open');

  await expect(page.getByRole('heading', { name: 'Connect mail to begin' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New message' })).toHaveCount(0);
  await expect(page.locator('a[href="/mail/inbox"]')).toHaveCount(0);
  await expect(page.locator('a[href="/mail/search"]')).toHaveCount(0);
  await expect(page.locator('a[href="/mail/drafts"]')).toHaveCount(0);
  expect(threadRequests).toBe(0);

  await page.getByRole('button', { name: 'Connect an account' }).click();
  await expect(page).toHaveURL(/\/mail\/accounts$/u);
});
