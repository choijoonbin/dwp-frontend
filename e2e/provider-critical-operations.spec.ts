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

test('privileged support separates request approval, sessions, and post-access review', async ({
  page,
}) => {
  await page.goto('/provider/support');

  await expect(
    page.getByRole('heading', { name: 'Support access lifecycle', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Awaiting approval').locator('../..')).toContainText('1');
  await expect(page.getByText('Post-reviews due').locator('../..')).toContainText('1');
  await expect(
    page.getByText('Investigate the customer-approved workspace latency case.')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Approve' }).click();
  const approval = page.getByRole('dialog', { name: 'Approve support access' });
  await expect(approval).toContainText('You cannot approve your own request');
  await approval.getByLabel('Justification').fill('Customer evidence and scope verified.');

  await approval.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Complete review' }).click();
  await expect(page.getByRole('dialog', { name: 'Complete post-access review' })).toContainText(
    'Confirm the session ended'
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  await expect(
    page.getByRole('heading', { name: 'Active and historical sessions', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Approved standard access')).toBeVisible();
});

test('privileged support remains usable when the request ledger partially fails', async ({
  page,
}) => {
  await page.route('**/api/provider/v1/admin/support-access-requests*', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, code: 'E5000', message: 'Unavailable' }),
    });
  });
  await page.goto('/provider/support');

  await expect(page.getByText('The request ledger is temporarily unavailable.')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Active and historical sessions', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Approved standard access')).toBeVisible();
});

test('commercial governance connects renewal impact, independent approval, and locked delivery', async ({
  page,
}) => {
  await page.goto('/provider/commercial');

  await expect(page.getByRole('region', { name: 'Commercial governance context' })).toContainText(
    'Independent approval'
  );
  await expect(
    page.getByRole('heading', { name: 'Renewal decision queue', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Enterprise → Regulated enterprise').first()).toBeVisible();
  await expect(page.getByText('Add premium-audit')).toBeVisible();

  await page.getByRole('button', { name: 'Approve' }).click();
  const approval = page.getByRole('dialog', { name: 'Approve renewal proposal' });
  await approval
    .getByLabel('Decision reason')
    .fill(
      'Customer contract, entitlement impact, and security evidence were independently reviewed.'
    );
  await approval.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Propose renewal' }).click();
  const proposal = page.getByRole('dialog', { name: 'Propose renewal for SKAX' });
  await expect(proposal).toContainText('immutable impact snapshot');
  await proposal
    .getByLabel('Renewal reason and evidence')
    .fill('Renew the customer contract after commercial evidence review.');
  await expect(proposal.getByRole('button', { name: 'Submit for approval' })).toBeEnabled();
});

test('commercial governance keeps subscriptions usable when renewal queue fails', async ({
  page,
}) => {
  await page.route('**/api/provider/v1/admin/subscription-renewals*', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, code: 'E5000', message: 'Unavailable' }),
    });
  });
  await page.goto('/provider/commercial');

  await expect(
    page.getByText('Subscription data remains available, but the renewal decision queue')
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Customer subscriptions & renewals', exact: true })
  ).toBeVisible();
  await expect(page.getByText('SKAX-2026-001')).toBeVisible();
});

test('provider audit restores relationship query and tenant scope from the URL', async ({
  page,
}) => {
  await page.goto('/provider/audit?query=support-session-1&tenantId=tenant-skax');

  await expect(page.getByLabel('Search action, target, operator, or correlation')).toHaveValue(
    'support-session-1'
  );
  await expect(page.getByRole('combobox', { name: 'Tenant' })).toContainText('SKAX Production');
  await expect(page.getByText('Support session started')).toBeVisible();
});
