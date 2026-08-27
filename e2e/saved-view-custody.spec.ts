import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';
import {
  fillOrphanEvidence,
  mockCustodyWorkspace,
  openOrphanAction,
} from './support/saved-view-custody';

test('administrators preview and execute a verified saved-view custody transfer', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    displayName: 'Tenant Admin',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  const store = await mockCustodyWorkspace(page);

  await page.goto('/admin/identity/saved-view-custody');
  await expect(
    page.getByRole('heading', {
      name: 'Resolve saved views after a move or departure',
      level: 1,
    })
  ).toBeVisible();
  await expect(page.getByText(/Last successful refresh/)).toBeVisible();

  const formBox = await page.locator('main form').boundingBox();
  const previewHeadingBox = await page
    .getByRole('heading', { name: 'Review the saved views that will change' })
    .boundingBox();
  expect(formBox).not.toBeNull();
  expect(previewHeadingBox).not.toBeNull();
  expect(previewHeadingBox!.x).toBeGreaterThan(formBox!.x + formBox!.width);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);

  await page.getByLabel('User to resolve').click();
  await page.getByRole('option', { name: /Alex Former/ }).click();
  await page.getByRole('combobox', { name: 'New steward' }).click();
  await expect(page.getByRole('option', { name: /Tenant Admin/ })).toHaveCount(0);
  await page.getByRole('option', { name: /Jordan Owner/ }).click();
  await page.getByLabel('Source document or request').fill('HR-EVT-2026-0813-11');
  await page
    .getByLabel('Administrator note')
    .fill('Transfer governed views after the approved workforce offboarding event.');

  await page.getByRole('button', { name: 'Review saved views' }).click();
  await expect(
    page.getByText('Transfer all 2 active saved views owned by Alex Former to Jordan Owner.')
  ).toBeVisible();
  await expect(page.getByText('Former owner approvals')).toBeVisible();
  await expect(page.getByText('Team: finance-operations')).toBeVisible();
  expect(store.previewPayload).toMatchObject({
    sourceOwnerUserId: 11,
    targetOwnerUserId: 12,
    disposition: 'TRANSFER',
    sourceReference: 'HR-EVT-2026-0813-11',
  });

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);
  await testInfo.attach(`saved-view-ownership-preview-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });

  await page.getByRole('button', { name: 'Transfer 2 to Jordan Owner' }).click();
  const confirmation = page.getByRole('dialog');
  await expect(confirmation.getByText('Offboarding or transfer')).toBeVisible();
  await expect(confirmation.getByText('HR-EVT-2026-0813-11')).toBeVisible();
  await expect(
    confirmation.getByText(
      'Transfer governed views after the approved workforce offboarding event.'
    )
  ).toBeVisible();
  await expect(confirmation.getByText('finance-operations')).toBeVisible();
  await testInfo.attach(`saved-view-ownership-confirm-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await confirmation.getByRole('button', { name: 'Transfer 2 to Jordan Owner' }).click();
  await expect(page.getByText('Ownership processing completed for 2 saved views.')).toBeVisible();
  await expect(page.getByText('Alex Former')).toBeVisible();
  await expect(page.getByText('Jordan Owner')).toBeVisible();
  expect(store.executionPayload).toMatchObject({
    expectedCount: 2,
    ownershipFingerprint: 'f'.repeat(64),
    sourceOwnerUserId: 11,
    targetOwnerUserId: 12,
  });
  expect(String(store.executionPayload?.idempotencyKey)).toMatch(/^saved-view-ownership-/);
});

test('a stale execution closes confirmation and requires a fresh reviewed plan', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const store = await mockCustodyWorkspace(page, { conflictOnFirstExecution: true });

  await page.goto('/admin/identity/saved-view-custody');
  await page.getByLabel('User to resolve').click();
  await page.getByRole('option', { name: /Alex Former/ }).click();
  await page.getByRole('combobox', { name: 'New steward' }).click();
  await page.getByRole('option', { name: /Jordan Owner/ }).click();
  await page.getByLabel('Source document or request').fill('CASE-409-RECOVERY');
  await page
    .getByLabel('Administrator note')
    .fill('Revalidate the exact ownership set before applying this approved change.');
  await page.getByRole('button', { name: 'Review saved views' }).click();
  await page.getByRole('button', { name: 'Transfer 2 to Jordan Owner' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Transfer 2 to Jordan Owner' })
    .click();

  const conflictAlert = page
    .getByRole('alert')
    .filter({ hasText: 'The reviewed plan no longer matches the current saved-view state' });
  await expect(conflictAlert).toBeVisible();
  await expect(conflictAlert).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Former owner approvals')).toHaveCount(0);
  await expect(conflictAlert.getByRole('button', { name: 'Review current impact' })).toBeVisible();
  await testInfo.attach(`saved-view-ownership-conflict-recovery-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  await conflictAlert.getByRole('button', { name: 'Review current impact' }).click();
  await expect(page.getByText('Former owner approvals')).toBeVisible();
  await page.getByRole('button', { name: 'Transfer 2 to Jordan Owner' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Transfer 2 to Jordan Owner' })
    .click();
  await expect(page.getByText('Ownership processing completed for 2 saved views.')).toBeVisible();
  expect(store.executionPayloads).toHaveLength(2);
  expect(store.executionPayloads[0].idempotencyKey).not.toBe(
    store.executionPayloads[1].idempotencyKey
  );
});

test('a late transfer eligibility rejection returns to steward selection without retrying the command', async ({
  page,
}) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const store = await mockCustodyWorkspace(page, {
    transferEligibilityFailureOnFirstExecution: true,
  });

  await page.goto('/admin/identity/saved-view-custody');
  await page.getByLabel('User to resolve').click();
  await page.getByRole('option', { name: /Alex Former/ }).click();
  const target = page.getByRole('combobox', { name: 'New steward' });
  await target.click();
  await page.getByRole('option', { name: /Jordan Owner/ }).click();
  await page.getByLabel('Source document or request').fill('CASE-LATE-TARGET');
  await page
    .getByLabel('Administrator note')
    .fill('Preserve the approved evidence while selecting a newly eligible steward.');
  await page.getByRole('button', { name: 'Review saved views' }).click();
  await page.getByRole('button', { name: 'Transfer 2 to Jordan Owner' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Transfer 2 to Jordan Owner' })
    .click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Former owner approvals')).toHaveCount(0);
  await expect(target).toBeFocused();
  await expect(
    page.getByText(
      "The selected user's eligibility changed during review and must be checked again."
    )
  ).toBeVisible();
  await expect(page.getByLabel('Source document or request')).toHaveValue('CASE-LATE-TARGET');
  expect(store.executionPayloads).toHaveLength(1);

  await expect(page.getByRole('option', { name: /Casey Steward/ })).toBeVisible();
  await page.getByRole('option', { name: /Casey Steward/ }).click();
  await page.getByRole('button', { name: 'Review saved views' }).click();
  await page.getByRole('button', { name: 'Transfer 2 to Casey Steward' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Transfer 2 to Casey Steward' })
    .click();

  await expect(page.getByText('Ownership processing completed for 2 saved views.')).toBeVisible();
  expect(store.executionPayloads).toHaveLength(2);
  expect(store.executionPayloads[1].targetOwnerUserId).toBe(14);
  expect(store.executionPayloads[0].idempotencyKey).not.toBe(
    store.executionPayloads[1].idempotencyKey
  );
});

test('a preview blocks execution when the target has same-named personal views', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockCustodyWorkspace(page, { previewNameConflict: true });

  await page.goto('/admin/identity/saved-view-custody');
  await page.getByLabel('User to resolve').click();
  await page.getByRole('option', { name: /Alex Former/ }).click();
  await page.getByRole('combobox', { name: 'New steward' }).click();
  await page.getByRole('option', { name: /Jordan Owner/ }).click();
  await page.getByLabel('Source document or request').fill('CASE-DUPLICATE-NAME');
  await page
    .getByLabel('Administrator note')
    .fill('Review and resolve duplicate personal saved-view names before ownership transfer.');
  await page.getByRole('button', { name: 'Review saved views' }).click();

  const conflict = page
    .getByRole('alert')
    .filter({ hasText: 'cannot be transferred to Jordan Owner because of a duplicate name' });
  await expect(conflict).toBeVisible();
  await expect(conflict.getByText(/Former owner approvals/)).toBeVisible();
  await expect(conflict.getByText(/My work/)).toBeVisible();
  await expect(conflict.getByText(/Choose another steward/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Transfer 2 to Jordan Owner' })).toBeDisabled();
});

test('the successor picker explains plan-specific eligibility before review', async ({ page }) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockCustodyWorkspace(page, {
    candidateIneligibilityReason: 'MISSING_TEAM_MEMBERSHIP',
  });

  await page.goto('/admin/identity/saved-view-custody');
  await page.getByLabel('User to resolve').click();
  await page.getByRole('option', { name: /Alex Former/ }).click();
  const target = page.getByRole('combobox', { name: 'New steward' });
  await target.click();

  const ineligible = page.getByRole('option', {
    name: /Jordan Owner.*does not belong to every team/i,
  });
  await expect(ineligible).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('Eligible for every affected saved view')).toBeVisible();
  await page.getByRole('option', { name: /Casey Steward/ }).click();
  await expect(target).toHaveValue(/Casey Steward/);
});

test('administrators explicitly confirm the recoverable suspend and scheduled archive path', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  const store = await mockCustodyWorkspace(page);

  await page.goto('/admin/identity/saved-view-custody');
  await page.getByLabel('User to resolve').click();
  await expect(page.getByRole('option', { name: /Taylor Invited.*Invited/ })).toBeVisible();
  await page.getByRole('option', { name: /Alex Former/ }).click();
  await page.getByRole('radio', { name: /Suspend now and archive automatically/ }).check();
  const archiveDate = page.getByRole('group', { name: 'Automatic archive date and time' });
  await archiveDate.getByRole('spinbutton', { name: 'Month' }).fill('08');
  await archiveDate.getByRole('spinbutton', { name: 'Day' }).fill('01');
  await archiveDate.getByRole('spinbutton', { name: 'Year' }).fill('2027');
  await archiveDate.getByRole('spinbutton', { name: 'Hours' }).fill('10');
  await archiveDate.getByRole('spinbutton', { name: 'Minutes' }).fill('30');
  await archiveDate.getByRole('spinbutton', { name: 'Meridiem' }).fill('AM');
  await archiveDate.getByRole('spinbutton', { name: 'Meridiem' }).press('Tab');
  await page.getByLabel('Source document or request').fill('LEGAL-HOLD-2027');
  await page
    .getByLabel('Administrator note')
    .fill('Suspend access now and preserve the saved views until the approved archive date.');

  await page.getByRole('button', { name: 'Review saved views' }).click();
  await expect(
    page.getByText(/Suspend all 2 active saved views owned by Alex Former/)
  ).toBeVisible();
  await page.getByRole('button', { name: 'Suspend 2 views' }).click();
  const confirmation = page.getByRole('dialog', { name: /Suspend 2 saved views/ });
  await expect(confirmation).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(confirmation.getByText('Offboarding or transfer')).toBeVisible();
  await expect(confirmation.getByText('LEGAL-HOLD-2027')).toBeVisible();
  await expect(
    confirmation.getByText(
      'Suspend access now and preserve the saved views until the approved archive date.'
    )
  ).toBeVisible();
  await testInfo.attach(`saved-view-ownership-suspend-confirm-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await confirmation.getByRole('button', { name: 'Suspend 2 views' }).click();
  await expect(page.getByText('Ownership processing completed for 2 saved views.')).toBeVisible();
  expect(store.executionPayload).toMatchObject({
    disposition: 'RETAIN_ORPHANED',
    targetOwnerUserId: null,
    sourceReference: 'LEGAL-HOLD-2027',
  });
  expect(String(store.executionPayload?.retentionUntil)).toContain('2027-08-01');
});

test('an awaiting-archive view can be reassigned to an active tenant steward', async ({
  page,
}, testInfo) => {
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 1000 }
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const store = await mockCustodyWorkspace(page);

  await page.goto('/admin/identity/saved-view-custody');
  const editor = await openOrphanAction(page);
  await editor.getByRole('combobox', { name: 'New steward' }).click();
  await expect(page.getByRole('option', { name: /Tenant Admin/ })).toHaveCount(0);
  await page.getByRole('option', { name: /Jordan Owner/ }).click();
  await fillOrphanEvidence(
    editor,
    'CASE-ORPHAN-REASSIGN',
    'Restore this governed saved view to the approved active team steward.'
  );
  await editor.getByRole('button', { name: 'Review final change' }).click();

  const confirmation = page.getByRole('dialog', {
    name: /Reassign ‘Quarterly leadership review’/,
  });
  await expect(confirmation.getByText(/Jordan Owner \(jordan.owner@example.com\)/)).toBeVisible();
  await expect(confirmation.getByText('CASE-ORPHAN-REASSIGN')).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  );
  expect(blocking).toEqual([]);
  await testInfo.attach(`saved-view-orphan-reassign-confirm-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await confirmation.getByRole('button', { name: 'Reassign to new steward' }).click();

  await expect(page.getByText('The saved view was reassigned to its new steward.')).toBeVisible();
  await expect(page.getByText('No saved views are awaiting archive')).toBeVisible();
  expect(store.orphanExecutionPayloads).toHaveLength(1);
  expect(store.orphanExecutionPayloads[0]).toMatchObject({
    endpoint: 'reassign',
    targetOwnerUserId: 12,
    version: 4,
    sourceReference: 'CASE-ORPHAN-REASSIGN',
  });
  expect(String(store.orphanExecutionPayloads[0].idempotencyKey)).toMatch(/^saved-view-orphan-/);

  await page.getByRole('tab', { name: 'Action history' }).click();
  const followUpHistory = page.getByRole('region', {
    name: 'Waiting-list follow-up history',
  });
  await expect(followUpHistory.getByText('Reassigned')).toBeVisible();
  await expect(followUpHistory.getByText('New steward: Jordan Owner')).toBeVisible();
  await expect(followUpHistory.getByText('CASE-ORPHAN-REASSIGN')).toBeVisible();
  await expect(
    followUpHistory.getByText(
      'Restore this governed saved view to the approved active team steward.'
    )
  ).toBeVisible();
  await expect(followUpHistory.getByText('Tenant Admin')).toBeVisible();
});

test('an orphan reassignment name conflict keeps inputs and requires another steward', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const store = await mockCustodyWorkspace(page, {
    orphanNameConflictOnFirstExecution: true,
  });

  await page.goto('/admin/identity/saved-view-custody');
  const editor = await openOrphanAction(page);
  await editor.getByRole('combobox', { name: 'New steward' }).click();
  await page.getByRole('option', { name: /Jordan Owner/ }).click();
  await fillOrphanEvidence(
    editor,
    'CASE-ORPHAN-DUPLICATE',
    'Reassign this retained view only after resolving the personal name collision.'
  );
  await editor.getByRole('button', { name: 'Review final change' }).click();
  await page
    .getByRole('dialog', { name: /Reassign ‘Quarterly leadership review’/ })
    .getByRole('button', { name: 'Reassign to new steward' })
    .click();

  const conflict = editor
    .getByRole('alert')
    .filter({ hasText: 'already has a personal saved view with the same name' });
  await expect(conflict).toBeVisible();
  await expect(conflict).toBeFocused();
  await expect(conflict.getByText(/Quarterly leadership review/)).toBeVisible();
  await expect(editor.getByLabel('Source document or request')).toHaveValue(
    'CASE-ORPHAN-DUPLICATE'
  );
  await editor.getByRole('combobox', { name: 'New steward' }).click();
  await page.getByRole('option', { name: /Casey Steward/ }).click();
  await editor.getByRole('button', { name: 'Review final change' }).click();
  const confirmation = page.getByRole('dialog', {
    name: /Reassign ‘Quarterly leadership review’/,
  });
  await expect(confirmation.getByText(/Casey Steward \(casey.steward@example.com\)/)).toBeVisible();
  await confirmation.getByRole('button', { name: 'Reassign to new steward' }).click();

  await expect(page.getByText('The saved view was reassigned to its new steward.')).toBeVisible();
  expect(store.orphanExecutionPayloads).toHaveLength(2);
  expect(store.orphanExecutionPayloads[1]).toMatchObject({
    targetOwnerUserId: 14,
    sourceReference: 'CASE-ORPHAN-DUPLICATE',
  });
  expect(store.orphanExecutionPayloads[0].idempotencyKey).not.toBe(
    store.orphanExecutionPayloads[1].idempotencyKey
  );
});

test('a shared-name conflict disables reassignment before a steward is queried', async ({
  page,
}) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockCustodyWorkspace(page, { sharedOrphanNameConflict: true });

  await page.goto('/admin/identity/saved-view-custody');
  const editor = await openOrphanAction(page);
  const reassign = editor.getByRole('radio', { name: /Reassign to a new steward/ });
  const extend = editor.getByRole('radio', { name: /Extend the archive deadline/ });

  await expect(reassign).toBeDisabled();
  await expect(extend).toBeChecked();
  await expect(
    editor.getByRole('alert').filter({
      hasText: 'This view cannot be reassigned while an active shared view has the same name',
    })
  ).toContainText('choosing another person will not resolve it');
  await expect(editor.getByRole('combobox', { name: 'New steward' })).toHaveCount(0);
});

test('a personal-name conflict disables only the affected steward candidate', async ({ page }) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockCustodyWorkspace(page, {
    orphanCandidateIneligibilityReason: 'PERSONAL_NAME_CONFLICT',
  });

  await page.goto('/admin/identity/saved-view-custody');
  const editor = await openOrphanAction(page);
  const target = editor.getByRole('combobox', { name: 'New steward' });
  await target.click();
  await expect(
    page.getByRole('option', { name: /Jordan Owner.*same name on this product surface/i })
  ).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('option', { name: /Casey Steward/ }).click();
  await expect(target).toHaveValue(/Casey Steward/);
});

test('a late shared-name conflict preserves evidence and switches to safe follow-up actions', async ({
  page,
}) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const store = await mockCustodyWorkspace(page, {
    orphanSharedNameConflictOnFirstExecution: true,
  });

  await page.goto('/admin/identity/saved-view-custody');
  const editor = await openOrphanAction(page);
  await editor.getByRole('combobox', { name: 'New steward' }).click();
  await page.getByRole('option', { name: /Jordan Owner/ }).click();
  await fillOrphanEvidence(
    editor,
    'CASE-SHARED-DUPLICATE',
    'Preserve this evidence while resolving the shared saved-view name collision.'
  );
  await editor.getByRole('button', { name: 'Review final change' }).click();
  await page
    .getByRole('dialog', { name: /Reassign ‘Quarterly leadership review’/ })
    .getByRole('button', { name: 'Reassign to new steward' })
    .click();

  const conflict = editor.getByRole('alert').filter({
    hasText: 'This view cannot be reassigned while an active shared view has the same name',
  });
  await expect(conflict).toBeVisible();
  await expect(conflict).toBeFocused();
  await expect(editor.getByRole('radio', { name: /Reassign to a new steward/ })).toBeDisabled();
  await expect(editor.getByRole('radio', { name: /Extend the archive deadline/ })).toBeChecked();
  await expect(editor.getByLabel('Source document or request')).toHaveValue(
    'CASE-SHARED-DUPLICATE'
  );
  await expect(editor.getByLabel('Administrator note')).toHaveValue(
    'Preserve this evidence while resolving the shared saved-view name collision.'
  );
  expect(store.orphanExecutionPayloads).toHaveLength(1);
});

test('a late eligibility rejection preserves evidence and returns focus to steward selection', async ({
  page,
}) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const store = await mockCustodyWorkspace(page, {
    orphanEligibilityFailureOnFirstExecution: 'MISSING_TEAM_MEMBERSHIP',
  });

  await page.goto('/admin/identity/saved-view-custody');
  const editor = await openOrphanAction(page);
  const target = editor.getByRole('combobox', { name: 'New steward' });
  await target.click();
  await page.getByRole('option', { name: /Jordan Owner/ }).click();
  await fillOrphanEvidence(
    editor,
    'CASE-LATE-ELIGIBILITY',
    'Preserve this evidence while selecting a steward who belongs to the owning team.'
  );
  await editor.getByRole('button', { name: 'Review final change' }).click();
  await page
    .getByRole('dialog', { name: /Reassign ‘Quarterly leadership review’/ })
    .getByRole('button', { name: 'Reassign to new steward' })
    .click();

  await expect(target).toBeFocused();
  await expect(
    editor.getByText(
      "The selected user's eligibility changed during review and must be checked again."
    )
  ).toBeVisible();
  await expect(editor.getByLabel('Source document or request')).toHaveValue(
    'CASE-LATE-ELIGIBILITY'
  );
  await target.press('ArrowDown');
  await page.getByRole('option', { name: /Casey Steward/ }).click();
  await editor.getByRole('button', { name: 'Review final change' }).click();
  await page
    .getByRole('dialog', { name: /Reassign ‘Quarterly leadership review’/ })
    .getByRole('button', { name: 'Reassign to new steward' })
    .click();

  await expect(page.getByText('The saved view was reassigned to its new steward.')).toBeVisible();
  expect(store.orphanExecutionPayloads).toHaveLength(2);
  expect(store.orphanExecutionPayloads[0].idempotencyKey).not.toBe(
    store.orphanExecutionPayloads[1].idempotencyKey
  );
});

test('an awaiting-archive view can retain its hidden state with a later deadline', async ({
  page,
}, testInfo) => {
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 1000 }
  );
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const store = await mockCustodyWorkspace(page);

  await page.goto('/admin/identity/saved-view-custody');
  const editor = await openOrphanAction(page);
  await editor.getByRole('radio', { name: /Extend the archive deadline/ }).check();
  const deadline = editor.getByRole('group', {
    name: 'New automatic archive date and time',
  });
  await deadline.getByRole('spinbutton', { name: 'Month' }).fill('08');
  await deadline.getByRole('spinbutton', { name: 'Day' }).fill('01');
  await deadline.getByRole('spinbutton', { name: 'Year' }).fill('2027');
  await deadline.getByRole('spinbutton', { name: 'Hours' }).fill('11');
  await deadline.getByRole('spinbutton', { name: 'Minutes' }).fill('45');
  await deadline.getByRole('spinbutton', { name: 'Meridiem' }).fill('AM');
  await deadline.getByRole('spinbutton', { name: 'Meridiem' }).press('Tab');
  await fillOrphanEvidence(
    editor,
    'LEGAL-RETENTION-2027',
    'Extend the retention window while the legal and operating review remains active.'
  );
  await editor.getByRole('button', { name: 'Review final change' }).click();
  const confirmation = page.getByRole('dialog', {
    name: /Extend the deadline for ‘Quarterly leadership review’/,
  });
  await expect(confirmation.getByText(/Keep suspended until Aug 1, 2027/)).toBeVisible();
  await confirmation.getByRole('button', { name: 'Extend archive deadline' }).click();

  await expect(page.getByText('The automatic archive deadline was extended.')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Awaiting automatic archive' }).getByText(/Aug 1, 2027/)
  ).toBeVisible();
  expect(store.orphanExecutionPayloads[0]).toMatchObject({
    endpoint: 'extend-retention',
    version: 4,
    sourceReference: 'LEGAL-RETENTION-2027',
  });
  expect(String(store.orphanExecutionPayloads[0].retentionUntil)).toContain('2027-08-01');
});

test('archive-now is destructive and safely recovers from a stale row version', async ({
  page,
}, testInfo) => {
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 1000 }
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const store = await mockCustodyWorkspace(page, { orphanConflictOnFirstExecution: true });

  await page.goto('/admin/identity/saved-view-custody');
  let editor = await openOrphanAction(page);
  await editor.getByRole('radio', { name: /Archive now/ }).check();
  await fillOrphanEvidence(
    editor,
    'CASE-ARCHIVE-NOW',
    'Archive the saved view now because the approved retention review is complete.'
  );
  await editor.getByRole('button', { name: 'Review final change' }).click();
  let confirmation = page.getByRole('alertdialog', {
    name: /Archive ‘Quarterly leadership review’ now/,
  });
  await expect(confirmation).toBeVisible();
  await testInfo.attach(`saved-view-orphan-archive-confirm-${testInfo.project.name}`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await confirmation.getByRole('button', { name: 'Archive now' }).click();

  const conflict = page
    .getByRole('alert')
    .filter({ hasText: 'changed in another action, so nothing was applied' });
  await expect(conflict).toBeVisible();
  await expect(conflict).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  editor = await openOrphanAction(page);
  await editor.getByRole('radio', { name: /Archive now/ }).check();
  await fillOrphanEvidence(
    editor,
    'CASE-ARCHIVE-NOW',
    'Archive the saved view now because the approved retention review is complete.'
  );
  await editor.getByRole('button', { name: 'Review final change' }).click();
  confirmation = page.getByRole('alertdialog', {
    name: /Archive ‘Quarterly leadership review’ now/,
  });
  await confirmation.getByRole('button', { name: 'Archive now' }).click();
  await expect(page.getByText('The saved view was archived immediately.')).toBeVisible();
  await expect(page.getByText('No saved views are awaiting archive')).toBeVisible();

  expect(store.orphanExecutionPayloads).toHaveLength(2);
  expect(store.orphanExecutionPayloads[0].version).toBe(4);
  expect(store.orphanExecutionPayloads[1].version).toBe(5);
  expect(store.orphanExecutionPayloads[0].idempotencyKey).not.toBe(
    store.orphanExecutionPayloads[1].idempotencyKey
  );
});

test('a no-longer-retained conflict closes the dialog and never repeats the stale command', async ({
  page,
}) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const store = await mockCustodyWorkspace(page, {
    orphanNoLongerRetainedOnFirstExecution: true,
  });

  await page.goto('/admin/identity/saved-view-custody');
  const editor = await openOrphanAction(page);
  await editor.getByRole('radio', { name: /Archive now/ }).check();
  await fillOrphanEvidence(
    editor,
    'CASE-ALREADY-RESOLVED',
    'Attempt immediate archive only while this retained saved view still exists.'
  );
  await editor.getByRole('button', { name: 'Review final change' }).click();
  await page
    .getByRole('alertdialog', { name: /Archive ‘Quarterly leadership review’ now/ })
    .getByRole('button', { name: 'Archive now' })
    .click();

  const warning = page
    .getByRole('alert')
    .filter({ hasText: 'changed in another action, so nothing was applied' });
  await expect(warning).toBeVisible();
  await expect(warning).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByText('No saved views are awaiting archive')).toBeVisible();
  expect(store.orphanExecutionPayloads).toHaveLength(1);
});

test('workspace tabs expose linked panels and support keyboard activation', async ({ page }) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockCustodyWorkspace(page);

  await page.goto('/admin/identity/saved-view-custody');
  const planTab = page.getByRole('tab', { name: 'Resolve ownership' });
  const orphanedTab = page.getByRole('tab', { name: /Awaiting archive/ });
  const historyTab = page.getByRole('tab', { name: 'Action history' });
  await expect(planTab).toHaveAttribute('aria-controls', 'saved-view-custody-panel-PLAN');
  await expect(orphanedTab).toHaveAttribute('aria-controls', 'saved-view-custody-panel-ORPHANED');
  await expect(historyTab).toHaveAttribute('aria-controls', 'saved-view-custody-panel-HISTORY');
  await expect(page.getByRole('tabpanel')).toHaveAttribute(
    'aria-labelledby',
    'saved-view-custody-tab-PLAN'
  );

  await planTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(orphanedTab).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(orphanedTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute(
    'aria-labelledby',
    'saved-view-custody-tab-ORPHANED'
  );
  await page.keyboard.press('ArrowRight');
  await expect(historyTab).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(historyTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute(
    'aria-labelledby',
    'saved-view-custody-tab-HISTORY'
  );
});

test('history feeds remain independently usable when lifecycle history is unavailable', async ({
  page,
}) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockCustodyWorkspace(page, {
    failLifecycleHistory: true,
    seedOwnershipHistory: true,
  });

  await page.goto('/admin/identity/saved-view-custody');
  await page.getByRole('tab', { name: 'Action history' }).click();
  const ownershipHistory = page.getByRole('region', { name: 'Bulk ownership changes' });
  await expect(ownershipHistory.getByText('Alex Former')).toBeVisible();
  await expect(ownershipHistory.getByText('Jordan Owner')).toBeVisible();
  await expect(ownershipHistory.getByText('HR-SEED-TRANSFER')).toBeVisible();
  await expect(
    page.getByText(
      'We could not load waiting-list follow-up history. Other action records remain available.'
    )
  ).toBeVisible();
});

test('the ownership workflow stays usable when auxiliary registers fail', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'dark',
      density: 'standard',
      highContrast: true,
      reduceMotion: true,
    },
  });
  await mockCustodyWorkspace(page, { failRegisters: true });

  await page.goto('/admin/identity/saved-view-custody');
  await expect(page.getByRole('combobox', { name: 'User to resolve' })).toBeVisible();

  await page.getByRole('tab', { name: 'Awaiting archive' }).click();
  await expect(page.getByText('We could not load views awaiting archive.')).toBeVisible();
  await page.getByRole('tab', { name: 'Action history' }).click();
  await expect(page.getByText('We could not load bulk ownership change history.')).toBeVisible();
  await page.getByRole('tab', { name: 'Resolve ownership' }).click();
  await expect(page.getByRole('combobox', { name: 'User to resolve' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  );
  expect(blocking).toEqual([]);
  await testInfo.attach('saved-view-ownership-partial-failure-dark-high-contrast', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('the ownership workflow reflows at 320px and 200 percent text', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: true,
      reduceMotion: true,
    },
  });
  await mockCustodyWorkspace(page);

  await page.goto('/admin/identity/saved-view-custody');
  await expect(page.getByRole('heading', { name: '퇴직·이동 사용자 저장 뷰 정리' })).toBeVisible();
  if (testInfo.project.name === 'chromium') {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '본문으로 건너뛰기' })).toBeFocused();
  }
  let horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.reload();
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expect(page.getByRole('heading', { name: '퇴직·이동 사용자 저장 뷰 정리' })).toBeVisible();
  horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  );
  expect(blocking).toEqual([]);
});
