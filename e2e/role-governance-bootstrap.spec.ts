import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

import type {
  AppAdminAssignment,
  AppGovernanceDashboard,
} from '@dwp-frontend/shared-utils/api/app-governance-api';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

function envelope(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

function assignment(
  assignmentId: string,
  overrides: Partial<AppAdminAssignment> = {}
): AppAdminAssignment {
  return {
    assignmentId,
    principalType: 'USER',
    principalRef: '30',
    principalName: 'Mina First Approver',
    responsibilityCode: 'APP_ACCESS_APPROVER',
    resourceSetId: 'rs-approvals',
    resourceSetKey: 'RS_APPROVALS',
    resourceSetName: 'Approvals production',
    assignmentSource: 'MANUAL',
    lifecycleState: 'PENDING_APPROVAL',
    validFrom: null,
    validTo: '2027-08-27T00:00:00Z',
    reviewDueAt: '2027-02-27T00:00:00Z',
    justification: 'Establish the first independent access approver for this scope.',
    requestedBy: 11,
    requestedByName: 'Olivia App Owner',
    approvedBy: null,
    approvedByName: null,
    approvedAt: null,
    decisionReason: null,
    firstApproverBootstrapEligible: false,
    version: 0,
    createdAt: '2026-08-27T00:00:00Z',
    updatedAt: '2026-08-27T00:00:00Z',
    ...overrides,
  };
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  // Viewport capture avoids Playwright's fixed-dialog stitching artifacts while
  // retaining the exact responsive state exercised by each project.
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function mockGovernanceDashboard(page: Page) {
  let approved = false;
  let decisionPayload: unknown = null;
  const assignments = () => [
    assignment('owner-active', {
      principalRef: '11',
      principalName: 'Olivia App Owner',
      responsibilityCode: 'APP_OWNER',
      lifecycleState: 'ACTIVE',
      validFrom: '2026-08-01T00:00:00Z',
      requestedBy: 12,
      firstApproverBootstrapEligible: false,
    }),
    assignment('bootstrap-request', {
      lifecycleState: approved ? 'ACTIVE' : 'PENDING_APPROVAL',
      validFrom: approved ? '2026-08-27T01:00:00Z' : null,
      approvedBy: approved ? 1 : null,
      approvedByName: approved ? 'Independent Catalog Admin' : null,
      approvedAt: approved ? '2026-08-27T01:00:00Z' : null,
      decisionReason: approved ? 'Establish independent approval for production access.' : null,
      firstApproverBootstrapEligible: !approved,
      version: approved ? 1 : 0,
    }),
    assignment('later-request', {
      principalRef: '31',
      principalName: 'Joon Later Approver',
      resourceSetId: 'rs-collaboration',
      resourceSetKey: 'RS_COLLABORATION',
      resourceSetName: 'Collaboration production',
      firstApproverBootstrapEligible: false,
    }),
    assignment('self-request', {
      principalRef: '32',
      principalName: 'Self-request guard',
      requestedBy: 1,
      firstApproverBootstrapEligible: true,
    }),
  ];

  const dashboard = (): AppGovernanceDashboard => ({
    metrics: {
      activeAssignments: approved ? 2 : 1,
      pendingApprovals: approved ? 2 : 3,
      reviewsDueSoon: 0,
      resourcesWithoutOwner: 1,
    },
    responsibilities: [
      {
        code: 'APP_OWNER',
        displayName: 'App owner',
        description: 'Owns the governed application scope.',
        riskTier: 'L3',
        sortOrder: 10,
      },
      {
        code: 'APP_ACCESS_APPROVER',
        displayName: 'App access approver',
        description: 'Approves access independently for one app scope.',
        riskTier: 'L3',
        sortOrder: 20,
      },
    ],
    principals: [
      { type: 'USER', ref: '11', displayName: 'Olivia App Owner' },
      { type: 'USER', ref: '30', displayName: 'Mina First Approver' },
      { type: 'USER', ref: '31', displayName: 'Joon Later Approver' },
      { type: 'USER', ref: '32', displayName: 'Self-request guard' },
    ],
    resourceSets: [
      {
        resourceSetId: 'rs-approvals',
        key: 'RS_APPROVALS',
        name: 'Approvals production',
        description: 'Production approvals application boundary.',
        lifecycleState: 'ACTIVE',
        version: 0,
        resources: [
          {
            resourceType: 'APP',
            resourceKey: 'APP.APPROVALS',
            resourceName: 'Approvals',
          },
        ],
      },
      {
        resourceSetId: 'rs-collaboration',
        key: 'RS_COLLABORATION',
        name: 'Collaboration production',
        description: 'A scope that already has an effective approver.',
        lifecycleState: 'ACTIVE',
        version: 0,
        resources: [],
      },
    ],
    assignments: assignments(),
    presetCatalog: [],
    presetAssignments: [],
    presetReviews: [],
  });

  await page.route('**/api/auth/admin/access/app-governance**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/auth/admin/access/app-governance') {
      await route.fulfill({ contentType: 'application/json', body: envelope(dashboard()) });
      return;
    }
    if (
      request.method() === 'POST' &&
      path === '/api/auth/admin/access/app-governance/assignments/bootstrap-request/decision'
    ) {
      decisionPayload = request.postDataJSON();
      approved = true;
      await route.fulfill({
        contentType: 'application/json',
        body: envelope(assignments().find((item) => item.assignmentId === 'bootstrap-request')),
      });
      return;
    }
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'FORBIDDEN', message: 'Auth rejected this decision.' }),
    });
  });

  return { decisionPayload: () => decisionPayload };
}

test('independent catalog admin performs only the one-time first approver bootstrap', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['APP_CATALOG_ADMIN', 'WORKSPACE_MEMBER'], {
    userId: 1,
    displayName: 'Independent Catalog Admin',
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    resourceRoles: [],
  });
  const governance = await mockGovernanceDashboard(page);

  await page.goto('/admin/identity/app-governance');
  await expect(
    page.getByRole('heading', { level: 1, name: 'App responsibility governance' })
  ).toBeVisible();
  await page.getByRole('button', { name: /Responsibility assignments/ }).click();

  const bootstrapRow = page.getByTestId('app-governance-assignment-bootstrap-request');
  const laterRow = page.getByTestId('app-governance-assignment-later-request');
  const selfRow = page.getByTestId('app-governance-assignment-self-request');
  await expect(bootstrapRow.getByText('First approver setup', { exact: true })).toBeVisible();
  await expect(
    bootstrapRow.getByRole('button', { name: 'Approve first app access approver setup' })
  ).toBeVisible();
  await expect(laterRow.getByRole('button', { name: /Approve/ })).toHaveCount(0);
  await expect(selfRow.getByRole('button', { name: /Approve/ })).toHaveCount(0);

  const documentWidth = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(documentWidth.scroll).toBeLessThanOrEqual(documentWidth.client + 1);
  await bootstrapRow.scrollIntoViewIfNeeded();
  await capture(page, testInfo, `first-approver-bootstrap-${testInfo.project.name}`);

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? '')
    )
  ).toEqual([]);

  await bootstrapRow
    .getByRole('button', { name: 'Approve first app access approver setup' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Set up the first app access approver?' });
  await expect(dialog.getByText('One-time independent bootstrap', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Auth revalidates every condition/)).toBeVisible();
  await dialog
    .getByLabel('Decision rationale')
    .fill('Establish independent approval for production access.');
  await expect(page.locator('.MuiDialog-container')).toHaveCSS('opacity', '1');
  await capture(page, testInfo, `first-approver-bootstrap-dialog-${testInfo.project.name}`);
  await dialog.getByRole('button', { name: 'Approve' }).click();

  await expect(
    page.getByText('Responsibility assignment approved.', { exact: true })
  ).toBeVisible();
  await expect(bootstrapRow.getByText('First approver setup', { exact: true })).toHaveCount(0);
  expect(governance.decisionPayload()).toEqual({
    decision: 'APPROVED',
    reason: 'Establish independent approval for production access.',
    version: 0,
  });
});
