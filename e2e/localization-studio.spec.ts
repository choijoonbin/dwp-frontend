import { expect, test } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

test('localization author edits a draft, verifies fallback quality, and submits for review', async ({
  page,
}) => {
  await mockShellSession(page, ['TENANT_ADMIN'], { localizationState: 'DRAFT' });
  await page.goto('/admin/experience/localization');

  await expect(page.getByRole('heading', { name: 'Localization studio' })).toBeVisible();
  await expect(page.getByText('Translation release workspace')).toBeVisible();
  await expect(page.getByText('shell', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('100% complete')).toBeVisible();

  const translation = page.getByRole('textbox', { name: 'Translation', exact: true }).first();
  await translation.fill('Welcome, {{name}}. Your workspace is ready.');
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save draft' }).click();

  await expect(
    page.getByText('Localization draft saved and quality checks refreshed.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit for review' })).toBeEnabled();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  const submitDialog = page.getByRole('dialog', { name: 'Submit revision for review' });
  await submitDialog
    .getByLabel('Decision reason')
    .fill('Language and placeholder quality checks are complete.');
  await submitDialog.getByRole('button', { name: 'Submit revision' }).click();

  await expect(page.getByText('In review', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Decision history' }).click();
  await expect(
    page.getByText('Language and placeholder quality checks are complete.')
  ).toBeVisible();
});

test('independent localization reviewer approves and publishes a ready revision', async ({
  page,
}) => {
  await mockShellSession(page, ['TENANT_ADMIN'], { localizationState: 'IN_REVIEW' });
  await page.goto('/admin/experience/localization');

  await expect(page.getByText('In review', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  const approvalDialog = page.getByRole('dialog', { name: 'Approve localization revision' });
  await approvalDialog
    .getByLabel('Decision reason')
    .fill('Reviewed against the tenant terminology and accessibility language guide.');
  await approvalDialog.getByRole('button', { name: 'Approve revision' }).click();

  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const publishDialog = page.getByRole('dialog', { name: 'Publish localization revision' });
  await publishDialog
    .getByLabel('Decision reason')
    .fill('Release approved for the current tenant language channel.');
  await publishDialog.getByRole('button', { name: 'Publish revision' }).click();

  await expect(page.getByText('Published', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Decision history' }).click();
  await expect(
    page.getByText('Release approved for the current tenant language channel.')
  ).toBeVisible();
});
