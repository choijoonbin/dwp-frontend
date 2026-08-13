import { expect, test } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

test.beforeEach(async ({ page }) => {
  await mockShellSession(page, ['TENANT_ADMIN']);
});

test('member requests a managed setting exception and an administrator records a decision', async ({
  page,
}, testInfo) => {
  await page.goto('/account/settings/managed');

  await expect(page.getByRole('heading', { name: 'Managed settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Request exception' }).first().click();
  const requestDialog = page.getByRole('dialog', { name: 'Request a Product font exception' });
  await requestDialog.getByLabel('Requested value').fill('Inter');
  await requestDialog
    .getByLabel('Business justification')
    .fill('The design team must validate customer documents with the approved typeface.');
  await requestDialog
    .getByLabel('Business impact')
    .fill('Without this exception, customer-facing proof reviews cannot be completed accurately.');
  await requestDialog.getByRole('button', { name: 'Request review' }).click();

  await expect(page.getByText('Pending review', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Requested value: Inter/)).toBeVisible();

  await page.goto('/admin/experience/preference-exceptions');
  await expect(page.getByRole('heading', { name: 'Managed setting exceptions' })).toBeVisible();
  const queueRole = testInfo.project.name === 'mobile' ? 'list' : 'grid';
  await expect(
    page.getByRole(queueRole, { name: 'Managed setting exception review queue' })
  ).toBeVisible();
  await expect(page.getByText(/Tenant Admin/).last()).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();

  const decisionDialog = page.getByRole('dialog', { name: 'Approve exception request' });
  await decisionDialog
    .getByLabel('Decision reason')
    .fill('Approved for the documented design proof workflow and limited review scope.');
  await decisionDialog.getByLabel('Evidence reference').fill('CHG-2026-0813');
  await decisionDialog.getByRole('button', { name: 'Approve' }).click();

  await page.getByRole('button', { name: 'Approved' }).click();
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('CHG-2026-0813')).toBeVisible();

  await page.goto('/account/settings/managed');
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Decision reason: Approved for the documented/)).toBeVisible();
});
