import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';

import type { PrivilegedAccessPolicy, PrivilegedAccessRequest } from '@dwp-frontend/shared-utils';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

const FIXED_NOW = new Date('2026-08-28T00:00:00Z');

function policy(): PrivilegedAccessPolicy {
  return {
    policyId: 1,
    roleId: 100,
    roleCode: 'PRIVILEGED_OPERATOR',
    roleName: 'Privileged operator',
    activationMode: 'APPROVAL',
    maximumDurationMinutes: 120,
    assuranceLevel: 'MFA',
    approvalQuorum: 1,
    emergencyMode: 'REGISTERED_PRINCIPAL',
    ticketRequired: true,
    lifecycleState: 'ACTIVE',
    version: 1,
  };
}

function pendingRequest(): PrivilegedAccessRequest {
  return {
    requestId: '61000000-0000-0000-0000-000000000001',
    requesterUserId: 42,
    requesterDisplayName: 'Minseo Requester',
    roleId: 100,
    roleCode: 'PRIVILEGED_OPERATOR',
    roleName: 'Privileged operator',
    eligibilityId: '62000000-0000-0000-0000-000000000001',
    requestType: 'JIT',
    scopeType: 'TENANT',
    durationMinutes: 60,
    justification: 'Restore a production service under an approved incident.',
    ticketReference: 'INC-2026-0828',
    assuranceLevel: 'MFA',
    approvalQuorum: 1,
    lifecycleState: 'PENDING_APPROVAL',
    requestedAt: '2026-08-27T23:30:00Z',
    version: 0,
    approvals: [],
  };
}

async function mockPrivilegedAccess(page: Page) {
  let decisionAttempts = 0;
  let delegatedAttempts = 0;
  let delegatedAvailable = false;

  await page.route('**/api/auth/admin/directory/groups**', (route) =>
    fulfillSuccess(route, {
      content: [
        {
          groupId: 10,
          groupKey: 'SECURITY_OPERATORS',
          displayName: 'Security operators',
          description: 'Security operations group',
          sourceType: 'LOCAL',
          status: 'ACTIVE',
          memberCount: 3,
          revision: 1,
          version: 1,
        },
      ],
      page: 0,
      size: 100,
      totalElements: 1,
      totalPages: 1,
    })
  );

  await page.route('**/api/auth/admin/access/privileged/**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/policies')) {
      return fulfillSuccess(route, [policy()]);
    }
    if (request.method() === 'GET' && path.endsWith('/eligibilities')) {
      return fulfillSuccess(route, []);
    }
    if (request.method() === 'GET' && path.endsWith('/requests')) {
      return fulfillSuccess(route, [pendingRequest()]);
    }
    if (request.method() === 'GET' && path.endsWith('/emergency-principals')) {
      return fulfillSuccess(route, []);
    }
    if (request.method() === 'GET' && path.endsWith('/delegated-scopes')) {
      delegatedAttempts += 1;
      if (!delegatedAvailable) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Delegation registry is temporarily unavailable.' }),
        });
      }
      return fulfillSuccess(route, [
        {
          scopeId: '63000000-0000-0000-0000-000000000001',
          administratorUserId: 43,
          administratorDisplayName: 'Scoped administrator',
          scopeType: 'ORG_UNIT',
          scopeRef: 'org-security',
          actionCode: 'ACCESS.ASSIGNMENT.MANAGE',
          validFrom: '2026-08-01T00:00:00Z',
          validTo: '2026-12-31T00:00:00Z',
          lifecycleState: 'ACTIVE',
          justification: 'Operate role assignments for the security organization.',
          version: 1,
        },
      ]);
    }
    if (request.method() === 'POST' && path.endsWith('/decision')) {
      decisionAttempts += 1;
      if (decisionAttempts === 1) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Approval service is temporarily unavailable.' }),
        });
      }
      return fulfillSuccess(route, {
        ...pendingRequest(),
        lifecycleState: 'ACTIVE',
        activatedAt: '2026-08-28T00:01:00Z',
        expiresAt: '2026-08-28T01:01:00Z',
        version: 1,
      });
    }
    return route.fulfill({ status: 404 });
  });

  return {
    decisionAttempts: () => decisionAttempts,
    delegatedAttempts: () => delegatedAttempts,
    allowDelegatedSuccess: () => {
      delegatedAvailable = true;
    },
  };
}

async function openPrivilegedAccess(page: Page) {
  await page.goto('/admin/identity/roles');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Roles and access management' })
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Manage privileged roles' }).click();
  await expect(page.getByRole('tab', { name: 'Approvals & active grants' })).toBeVisible();
}

async function expectNoBlockingAccessibilityViolations(page: Page, selector: string) {
  const accessibility = await new AxeBuilder({ page }).include(selector).analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? '')
    )
  ).toEqual([]);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}-${testInfo.project.name}.png`);
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
}

async function fillDateTimeSections(field: Locator, values: string[]) {
  const sections = field.getByRole('spinbutton');
  await expect(sections).toHaveCount(values.length);
  for (const [index, value] of values.entries()) {
    await sections.nth(index).fill(value);
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 320, height: 720 } : { width: 1280, height: 900 }
  );
  await page.clock.setFixedTime(FIXED_NOW);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['TENANT_ADMIN', 'WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
});

test('a failed privileged decision preserves the dialog and entered audit reason for retry', async ({
  page,
}, testInfo) => {
  const service = await mockPrivilegedAccess(page);
  await openPrivilegedAccess(page);

  await page.getByRole('button', { name: 'Approve' }).click();
  const dialog = page.getByRole('dialog', { name: 'Approve temporary privileged access' });
  const reason = dialog.getByLabel('Decision reason');
  await reason.fill('Approve incident-scoped access after independent review.');
  await dialog.getByRole('button', { name: 'Approve' }).click();

  await expect.poll(service.decisionAttempts).toBe(1);
  await expect(dialog).toBeVisible();
  await expect(reason).toHaveValue('Approve incident-scoped access after independent review.');
  await expectNoBlockingAccessibilityViolations(page, '[role="dialog"]');
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, 'privileged-decision-retry');

  await dialog.getByRole('button', { name: 'Approve' }).click();
  await expect.poll(service.decisionAttempts).toBe(2);
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText('Privileged access request approved.', { exact: true })
  ).toBeVisible();
});

test('delegated-boundary load failure is explicit and retry restores the governed register', async ({
  page,
}, testInfo) => {
  const service = await mockPrivilegedAccess(page);
  await openPrivilegedAccess(page);
  await page.getByRole('tab', { name: 'Delegation & emergency' }).click();

  const alert = page.getByRole('alert').filter({ hasText: 'Delegated administrator boundaries' });
  await expect(alert).toContainText('Delegation registry is temporarily unavailable.');
  await expect.poll(service.delegatedAttempts).toBeGreaterThanOrEqual(2);
  await expectNoBlockingAccessibilityViolations(page, 'main');
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, 'privileged-boundary-load-error');

  service.allowDelegatedSuccess();
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect.poll(service.delegatedAttempts).toBeGreaterThanOrEqual(3);
  await expect(alert).toHaveCount(0);
  await expect(page.getByText('Scoped administrator', { exact: true })).toBeVisible();
});

test('past eligibility and emergency review times are rejected before submission', async ({
  page,
}, testInfo) => {
  await mockPrivilegedAccess(page);
  await openPrivilegedAccess(page);

  await page.getByRole('tab', { name: 'Eligibilities' }).click();
  await page.getByRole('button', { name: 'Grant eligibility' }).click();
  const eligibility = page.getByRole('dialog', { name: 'Grant privileged-role eligibility' });
  await eligibility.getByRole('combobox', { name: 'User or group' }).click();
  await page.getByRole('option', { name: 'Tenant Admin' }).click();
  await eligibility.getByRole('combobox', { name: 'Role' }).click();
  await page.getByRole('option', { name: /Privileged operator/ }).click();
  await eligibility
    .getByLabel('Justification')
    .fill('Time-bound production eligibility approved by the security owner.');
  await fillDateTimeSections(eligibility.getByRole('group', { name: 'Expiry' }), [
    '08',
    '27',
    '2026',
    '09',
    '00',
    'AM',
  ]);
  await expect(
    eligibility.getByText('Choose a date and time later than the current time.')
  ).toBeVisible();
  await expect(eligibility.getByRole('button', { name: 'Grant eligibility' })).toBeDisabled();
  await eligibility.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('tab', { name: 'Delegation & emergency' }).click();
  await page.getByRole('button', { name: 'Register emergency account' }).click();
  const emergency = page.getByRole('dialog', { name: 'Register emergency access account' });
  await emergency.getByRole('combobox', { name: 'User or group' }).click();
  await page.getByRole('option', { name: 'Tenant Admin' }).click();
  await emergency
    .getByLabel('Justification')
    .fill('Register a dedicated emergency account for independently reviewed incidents.');
  await fillDateTimeSections(
    emergency.getByRole('group', { name: 'Next emergency-account review' }),
    ['08', '27', '2026', '09', '00', 'AM']
  );
  await expect(
    emergency.getByText('Choose a date and time later than the current time.')
  ).toBeVisible();
  await expect(emergency.getByRole('button', { name: 'Create' })).toBeDisabled();
  await expectNoBlockingAccessibilityViolations(page, '[role="dialog"]');
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, 'privileged-future-time-validation');
});
