import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';
import { mockWorkforceAccess } from './support/workforce-access';

async function mockWorkforceAdminSession(page: Parameters<typeof mockShellSession>[0]) {
  await mockShellSession(page, ['ADMIN', 'HR_ADMIN', 'PEOPLE_ADMIN'], {
    locale: 'en',
    displayName: 'Workforce Administrator',
    email: 'workforce.admin@example.com',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
}

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
}

test('a 503 recovers explicitly and the compact mobile overview keeps work within reach', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockWorkforceAdminSession(page);
  const store = await mockWorkforceAccess(page, {
    failFirstPolicyList: true,
    failFirstBlankUserLookup: true,
    blankUserRetryDelayMs: 150,
    includeUnresolvedUserPolicy: true,
  });

  await page.goto('/admin/identity/workforce-access');
  await expect(
    page.getByRole('heading', { name: 'Workforce data access policies', level: 1 })
  ).toBeVisible();
  const error = page.getByRole('alert').filter({
    hasText: 'Workforce data access policies could not be loaded',
  });
  await expect(error).toBeVisible();
  await expect(error).not.toContainText('503');
  const summary = page.locator('summary').filter({ hasText: 'What this area controls' });
  await expect(summary).toContainText('Summary unavailable');
  await error.getByRole('button', { name: 'Try again' }).click();

  await expect(page.getByText('Unified administrator').first()).toBeVisible();
  await expect(summary).toContainText('2 currently in effect');
  expect(store.policyListAttempts).toBe(2);
  const identityAlert = page.getByRole('alert').filter({
    hasText: 'Some policy users could not be identified',
  });
  await expect(identityAlert).toContainText('Directory lookup failed');
  await expect(page.getByText('User 777').first()).toBeVisible();
  const identityRetry = identityAlert.getByRole('button', { name: 'Reload user identities' });
  await identityRetry.focus();
  await expect(identityRetry).toBeFocused();
  await identityRetry.press('Enter');
  await expect(identityRetry).toHaveAttribute('aria-disabled', 'true');
  await expect(identityRetry).toBeFocused();
  await expect(identityAlert).toContainText('outside the loaded directory page: 1');
  await expect(identityRetry).toBeFocused();
  expect(store.blankUserAttempts).toBe(2);
  await expect(page.getByText('Existing unified administrator policy').first()).toBeVisible();
  for (const label of [
    'Directory basics',
    'Worker and assignment identifiers',
    'Employment and assignment history',
    'Job grade and level',
  ]) {
    await expect(page.getByText(label).first()).toBeVisible();
  }

  await expect(summary).toBeVisible();
  const details = summary.locator('..');
  await expect(details).not.toHaveAttribute('open', '');
  await expect(page.getByRole('heading', { name: 'Access policies', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create access policy' })).toBeVisible();
  const summaryBox = await summary.boundingBox();
  const createBox = await page.getByRole('button', { name: 'Create access policy' }).boundingBox();
  expect(summaryBox).not.toBeNull();
  expect(createBox).not.toBeNull();
  expect(createBox!.y - summaryBox!.y).toBeLessThan(280);

  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(details).toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(details).not.toHaveAttribute('open', '');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
  await expectNoSeriousAccessibilityViolations(page);

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.reload();
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expect(page.getByRole('button', { name: 'Create access policy' })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
  await expectNoSeriousAccessibilityViolations(page);
});

test('an administrator searches the full directory, creates scheduled access, and revokes it', async ({
  page,
}) => {
  await mockWorkforceAdminSession(page);
  const store = await mockWorkforceAccess(page, {
    failFirstOrganizations: true,
    failSelectedUserRefresh: true,
  });
  await page.goto('/admin/identity/workforce-access');
  await page.getByRole('button', { name: 'Create access policy' }).click();

  const dialog = page.getByRole('dialog', { name: 'Create a workforce data access policy' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Organization choices could not be loaded')).toBeVisible();

  await dialog.getByRole('combobox', { name: 'Subject type' }).click();
  await page.getByRole('option', { name: 'User override' }).click();
  const userSearch = dialog.getByRole('combobox', { name: 'Search for a user' });
  await userSearch.fill('mina');
  await expect(page.getByRole('option', { name: /Mina Search Result/ })).toBeVisible();
  await page.getByRole('option', { name: /Mina Search Result/ }).click();
  await expect(userSearch).toHaveValue('Mina Search Result');
  expect(store.userQueries).toContain('mina');
  await expect(dialog.getByText('User search results could not be loaded')).toBeVisible();
  expect(store.selectedUserRefreshFailures).toBe(1);

  await dialog.getByRole('button', { name: 'Reload organizations' }).click();
  await expect(dialog.getByText('Organization choices could not be loaded')).toHaveCount(0);
  expect(store.organizationAttempts).toBe(2);
  await expect(userSearch).toHaveValue('Mina Search Result');

  await dialog.getByRole('combobox', { name: 'Root organization' }).click();
  await page.getByRole('option', { name: 'Digital Workplace (WORKPLACE)' }).click();
  await dialog.getByRole('checkbox', { name: 'Worker and assignment identifiers' }).check();
  await dialog.getByRole('checkbox', { name: 'Job grade and level' }).check();
  await dialog.getByRole('checkbox', { name: 'Export data' }).check();

  const start = dialog.getByRole('group', { name: 'Start date and time' });
  await start.getByRole('spinbutton', { name: 'Month' }).fill('08');
  await start.getByRole('spinbutton', { name: 'Day' }).fill('01');
  await start.getByRole('spinbutton', { name: 'Year' }).fill('2027');
  await start.getByRole('spinbutton', { name: 'Hours' }).fill('10');
  await start.getByRole('spinbutton', { name: 'Minutes' }).fill('30');
  await start.getByRole('spinbutton', { name: 'Meridiem' }).fill('AM');
  await start.getByRole('spinbutton', { name: 'Meridiem' }).press('Tab');
  await dialog
    .getByLabel('Business justification')
    .fill('Temporary least-privilege support for the approved workforce migration.');
  const applyPolicy = dialog.getByRole('button', { name: 'Apply policy' });
  await expect(applyPolicy).toBeEnabled();

  await dialog.getByRole('button', { name: 'Search users again' }).click();
  await expect(dialog.getByText('User search results could not be loaded')).toHaveCount(0);
  await userSearch.fill('different person');
  await expect(applyPolicy).toBeDisabled();
  await userSearch.fill('mina');
  await expect(page.getByRole('option', { name: /Mina Search Result/ })).toBeVisible();
  await page.getByRole('option', { name: /Mina Search Result/ }).click();
  await expect(applyPolicy).toBeEnabled();
  await applyPolicy.click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Scheduled').first()).toBeVisible();
  expect(store.createPayloads).toHaveLength(1);
  expect(store.createPayloads[0]).toMatchObject({
    subjectType: 'USER',
    subjectRef: '501',
    populationType: 'ORG_TREE',
    organizationId: 'org-workplace',
    actionCodes: ['READ', 'EXPORT'],
    justification: 'Temporary least-privilege support for the approved workforce migration.',
  });
  expect([...store.createPayloads[0].fieldGroups].sort()).toEqual(
    ['DIRECTORY', 'EMPLOYMENT', 'JOB_GRADE', 'WORKER_IDENTIFIERS'].sort()
  );
  expect(Date.parse(store.createPayloads[0].validFrom ?? '')).toBeGreaterThan(
    Date.parse('2027-01-01T00:00:00Z')
  );

  await expect
    .poll(() => store.userQueries.filter((query) => query === '').length)
    .toBeGreaterThanOrEqual(2);
  await expect(
    page.getByText('Mina Search Result · mina.search@example.com').first()
  ).toBeVisible();

  const revokeAction = page.getByRole('button', {
    name: /Revoke the workforce data access policy for Mina Search Result.*mina\.search@example\.com/,
  });
  await expect(revokeAction).toBeVisible();
  await revokeAction.click();
  const revoke = page.getByRole('dialog', { name: 'Revoke this access policy?' });
  await expect(revoke.getByRole('heading', { name: 'Access that will be revoked' })).toBeVisible();
  await expect(
    revoke.getByText('Mina Search Result · mina.search@example.com', { exact: true })
  ).toBeVisible();
  await expect(
    revoke.getByText('Digital Workplace · Selected organization and descendants')
  ).toBeVisible();
  for (const label of [
    'Directory basics',
    'Worker and assignment identifiers',
    'Employment and assignment history',
    'Job grade and level',
    'Read data',
    'Export data',
  ]) {
    await expect(revoke.getByText(label)).toBeVisible();
  }
  await expect(revoke.getByText(/Aug 1, 2027/)).toBeVisible();
  await expect(revoke.getByText('No expiration')).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  const reason = 'Approved access window was cancelled before its scheduled start.';
  await revoke.getByLabel('Revocation reason').fill(reason);
  await revoke.getByRole('button', { name: 'Revoke now' }).click();
  await expect(revoke).toHaveCount(0);
  await expect(page.getByText('Revoked').first()).toBeVisible();
  expect(store.revokePayloads).toEqual([{ version: 0, reason }]);
});
