import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  detail,
  fulfill,
  mailAddressBook,
  mailOrganization,
  mockMailMember,
  thread,
} from './support/mail-fixtures';

test('mail workspace reflows at 320px and 200% text zoom without critical accessibility defects', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'The dedicated 320px audit runs once in Chromium.');
  await mockMailMember(page);
  const organization = mailOrganization();
  const item = thread('40000000-0000-0000-0000-000000000011', {
    subject: 'Narrow viewport review',
  });
  const narrowDetail = detail(item, 'SENT');
  narrowDetail.messages[0] = {
    ...narrowDetail.messages[0]!,
    bodyFormat: 'HTML',
    body: '<p><a href="https://outside.example.net/review?id=42">Review external guidance</a></p>',
  };
  await page.route('**/api/platform/v1/mail/organization', (route) => fulfill(route, organization));
  await page.route('**/api/platform/v1/mail/home', (route) =>
    fulfill(route, {
      accounts: organization.accounts,
      metrics: {
        unread: 6,
        urgent: 1,
        needsReply: 2,
        assigned: 1,
        snoozed: 1,
        activeProposals: 0,
      },
      focusQueue: [item],
      proposals: [],
      sharedInboxes: [],
      generatedAt: '2026-09-03T03:00:00Z',
    })
  );
  await page.route('**/api/platform/v1/mail/address-book**', (route) =>
    fulfill(
      route,
      mailAddressBook(
        [
          {
            contactId: '61000000-0000-0000-0000-000000000003',
            displayName: 'Long Contact Name For Reflow',
            emailAddress: 'long.contact@example.com',
            sourceKind: 'MANUAL',
            favorite: true,
            version: 0,
            updatedAt: '2026-09-03T03:00:00Z',
          },
        ],
        [
          {
            groupId: '62000000-0000-0000-0000-000000000003',
            displayName: 'Enterprise launch steering group',
            description: 'A long description that must reflow without hiding group actions.',
            members: [],
            version: 0,
            updatedAt: '2026-09-03T03:00:00Z',
          },
        ]
      )
    )
  );
  await page.route('**/api/platform/v1/mail/threads**', (route) => {
    const url = new URL(route.request().url());
    return url.pathname.endsWith('/v1/mail/threads')
      ? fulfill(route, { items: [item], total: 1, page: 0, pageSize: 30 })
      : fulfill(route, narrowDetail);
  });

  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/mail/organization');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.getByRole('button', { name: 'New folder' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.goto('/mail/inbox');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.getByRole('button', { name: /Narrow viewport review/ }).click();
  await expect(page.getByRole('heading', { name: 'Narrow viewport review' })).toBeVisible();
  const externalLink = page.getByRole('link', { name: 'Review external guidance' });
  await expect(externalLink).not.toHaveAttribute('target');
  await externalLink.click();
  const externalLinkDialog = page.getByRole('dialog', { name: 'Open an external website?' });
  await expect(externalLinkDialog).toContainText('outside.example.net');
  await expect(externalLinkDialog).toContainText('https://outside.example.net/review?id=42');
  await expect(
    externalLinkDialog.getByRole('button', { name: 'Open external link' })
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);
  await externalLinkDialog.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'New message' }).click();
  const compose = page.getByRole('dialog', { name: 'New message' });
  await expect(compose.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);
  await compose.getByRole('button', { name: 'Cancel' }).click();
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await page.goto('/mail/contacts');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect(page.getByRole('heading', { name: 'Contacts and mail groups' })).toBeVisible();
  await page.getByRole('tab', { name: 'My mail groups' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);

  await page.goto('/mail/home');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect(page.getByRole('heading', { name: 'Focus queue' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);
});
