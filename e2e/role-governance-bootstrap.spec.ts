import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

import type {
  AppAdminAssignment,
  AppAdminPresetAssignment,
  AppAdminPresetCatalogItem,
  AppGovernanceDashboard,
} from '@dwp-frontend/shared-utils/api/app-governance-api';

import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
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

function presetCatalogItem(): AppAdminPresetCatalogItem {
  return {
    presetCode: 'APPROVALS_ADMIN',
    productKey: 'approvals',
    appResourceKey: 'APP.APPROVALS',
    displayName: 'Approvals administrator',
    description: 'Administers the Approvals application.',
    responsibilityCode: 'APP_CONFIG_ADMIN',
    riskTier: 'HIGH',
    catalogVersion: 1,
    duties: [
      {
        dutyCode: 'APPROVALS_CONFIGURATION',
        resourceKey: 'APP.APPROVALS',
        riskTier: 'HIGH',
        auditPolicyException: false,
        capabilityContractKeys: ['approvals.management.configure'],
      },
    ],
    requestable: true,
  };
}

function activePresetAssignment(): AppAdminPresetAssignment {
  return {
    presetAssignmentId: 'preset-active',
    presetCode: 'APPROVALS_ADMIN',
    productKey: 'approvals',
    presetName: 'Approvals administrator',
    principalType: 'USER',
    principalRef: '30',
    principalName: 'Mina Preset Administrator',
    resourceSetId: 'rs-approvals',
    resourceSetKey: 'RS_APPROVALS',
    resourceSetName: 'Approvals production',
    responsibilityAssignmentId: 'preset-responsibility-active',
    assignmentSource: 'APP_ADMIN_PRESET',
    requestChannel: 'GOVERNANCE',
    lifecycleState: 'ACTIVE',
    validFrom: '2026-08-27T00:00:00Z',
    validTo: '2027-08-27T00:00:00Z',
    reviewDueAt: '2027-02-27T00:00:00Z',
    justification: 'Administer the Approvals application.',
    requestedBy: 11,
    requestedByName: 'Olivia App Owner',
    approvedBy: 12,
    approvedByName: 'Alex Access Approver',
    approvedAt: '2026-08-27T00:30:00Z',
    activatedBy: 13,
    activatedByName: 'Morgan Access Manager',
    activatedAt: '2026-08-27T01:00:00Z',
    version: 3,
    catalogVersion: 1,
    createdAt: '2026-08-27T00:00:00Z',
    updatedAt: '2026-08-27T01:00:00Z',
    duties: [
      {
        assignmentId: 'preset-duty-active',
        dutyCode: 'APPROVALS_CONFIGURATION',
        lifecycleState: 'ACTIVE',
        version: 1,
      },
    ],
  };
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  // Viewport capture avoids Playwright's fixed-dialog stitching artifacts while
  // retaining the exact responsive state exercised by each project.
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function mockGovernanceDashboard(
  page: Page,
  {
    duplicateApprovals = false,
    emptyResourceSets = false,
    failFirstDashboard = false,
    includeRequestablePreset = false,
    includeActivePresetAssignment = false,
  }: {
    duplicateApprovals?: boolean;
    emptyResourceSets?: boolean;
    failFirstDashboard?: boolean;
    includeRequestablePreset?: boolean;
    includeActivePresetAssignment?: boolean;
  } = {}
) {
  let approved = false;
  let decisionPayload: unknown = null;
  let dashboardRequests = 0;
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
    resourceSets: emptyResourceSets
      ? []
      : [
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
            resources: duplicateApprovals
              ? [
                  {
                    resourceType: 'APP',
                    resourceKey: 'APP.APPROVALS',
                    resourceName: 'Approvals',
                  },
                ]
              : [],
          },
        ],
    assignments: assignments(),
    presetCatalog:
      includeRequestablePreset || includeActivePresetAssignment ? [presetCatalogItem()] : [],
    presetAssignments: includeActivePresetAssignment ? [activePresetAssignment()] : [],
    presetReviews: [],
  });

  await page.route('**/api/auth/admin/access/app-governance**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/auth/admin/access/app-governance') {
      dashboardRequests += 1;
      // The app QueryClient retries once before rendering its explicit recovery state.
      if (failFirstDashboard && dashboardRequests <= 2) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'SERVICE_UNAVAILABLE',
            message: 'dial tcp auth-db.internal:5432: connection refused',
          }),
        });
        return;
      }
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

  return {
    decisionPayload: () => decisionPayload,
    dashboardRequests: () => dashboardRequests,
  };
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

test('company governance opens the canonical product management workbench without mixing planes', async ({
  page,
}) => {
  await mockShellSession(page, ['APP_CATALOG_ADMIN', 'WORKSPACE_MEMBER'], {
    userId: 1,
    displayName: 'Independent Catalog Admin',
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    resourceRoles: [],
  });
  await mockGovernanceDashboard(page);
  await mockApprovalProductSurfaceAuthority(page);

  await page.goto('/admin/identity/app-governance');
  const governanceHeading = page.getByRole('heading', {
    level: 1,
    name: 'App responsibility governance',
  });
  await expect(governanceHeading).toBeVisible();
  await page.getByRole('button', { name: /App resource sets/u }).click();

  const workbench = page.getByRole('link', {
    name: 'Open Approvals management workbench for Approvals production',
  });
  await expect(workbench).toBeVisible();
  await expect(workbench).toHaveAttribute('href', '/approvals/admin');
  await workbench.focus();
  await expect(workbench).toBeFocused();
  await workbench.click();

  await expect(page).toHaveURL(/\/approvals\/admin\/overview(?:\?.*)?$/u);
  await expect(page.getByRole('heading', { level: 1, name: 'Approval operations' })).toBeFocused();
  await expect(
    page.locator('[data-testid="product-surface-management-mode"]:visible')
  ).toBeVisible();
  await expect(page.locator('[data-testid="product-surface-work-return"]:visible')).toBeVisible();
  await expect(
    page.getByTestId('approvals-desktop-sidebar').getByRole('link', { name: 'My approvals' })
  ).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/identity\/app-governance$/u);
  await expect(governanceHeading).toBeVisible();
  await expect(governanceHeading).toBeFocused();
});

test('company governance workbench fails closed before product data without an exact capability', async ({
  page,
}) => {
  await mockShellSession(page, ['APP_CATALOG_ADMIN', 'WORKSPACE_MEMBER'], {
    userId: 1,
    displayName: 'Independent Catalog Admin',
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    resourceRoles: [],
  });
  await mockGovernanceDashboard(page);
  await mockApprovalProductSurfaceAuthority(page, { managementCapabilityKeys: [] });
  let managementPayloadRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/approvals/v1/admin/overview') {
      managementPayloadRequests += 1;
    }
  });

  await page.goto('/admin/identity/app-governance');
  await page.getByRole('button', { name: /App resource sets/u }).click();
  await page
    .getByRole('link', {
      name: 'Open Approvals management workbench for Approvals production',
    })
    .click();

  const accessState = page.getByTestId('product-surface-access-state');
  await expect(accessState).toBeVisible();
  await expect(accessState).toHaveAttribute('data-product-access-state', 'route-denied');
  await expect(accessState.getByText('This page is outside your access')).toBeVisible();
  expect(managementPayloadRequests).toBe(0);
});

test('company governance gives repeated app workbenches unique scope-aware names', async ({
  page,
}) => {
  await mockShellSession(page, ['APP_CATALOG_ADMIN', 'WORKSPACE_MEMBER'], {
    userId: 1,
    displayName: 'Independent Catalog Admin',
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    resourceRoles: [],
  });
  await mockGovernanceDashboard(page, { duplicateApprovals: true });

  await page.goto('/admin/identity/app-governance');
  await page.getByRole('button', { name: /App resource sets/u }).click();

  const approvalsScope = page.getByRole('region', { name: 'Approvals production' });
  const collaborationScope = page.getByRole('region', { name: 'Collaboration production' });
  await expect(
    approvalsScope.getByRole('link', {
      name: 'Open Approvals management workbench for Approvals production',
    })
  ).toBeVisible();
  await expect(
    collaborationScope.getByRole('link', {
      name: 'Open Approvals management workbench for Collaboration production',
    })
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Open Approvals management workbench for/u })
  ).toHaveCount(2);
});

test('app governance hides service diagnostics and recovers through a localized retry', async ({
  page,
}) => {
  await mockShellSession(page, ['APP_CATALOG_ADMIN', 'WORKSPACE_MEMBER'], {
    userId: 1,
    displayName: 'Independent Catalog Admin',
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
    resourceRoles: [],
  });
  const governance = await mockGovernanceDashboard(page, { failFirstDashboard: true });

  await page.goto('/admin/identity/app-governance');

  const errorState = page.getByRole('alert');
  await expect(
    errorState.getByRole('heading', { level: 2, name: '요청한 데이터를 불러오지 못했습니다.' })
  ).toBeVisible();
  await expect(
    errorState.getByText(
      '앱 관리 책임 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요. 문제가 계속되면 지원팀에 문의하세요.',
      { exact: true }
    )
  ).toBeVisible();
  await expect(page.getByText(/auth-db\.internal|connection refused|dial tcp/u)).toHaveCount(0);

  await errorState.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('button', { name: /앱 리소스 범위/u })).toBeVisible();
  expect(governance.dashboardRequests()).toBe(3);
});

test('app governance explains an empty resource-set catalog without a dead-end create action', async ({
  page,
}) => {
  await mockShellSession(page, ['APP_CATALOG_ADMIN', 'WORKSPACE_MEMBER'], {
    userId: 1,
    displayName: 'Independent Catalog Admin',
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    resourceRoles: [],
  });
  await mockGovernanceDashboard(page, {
    emptyResourceSets: true,
    includeRequestablePreset: true,
  });

  await page.goto('/admin/identity/app-governance');
  await expect(page.getByRole('button', { name: 'Request app admin preset' })).toHaveCount(0);
  await page.getByRole('button', { name: /App resource sets/u }).click();

  const emptyState = page.getByTestId('app-governance-resource-set-empty');
  await expect(
    emptyState.getByRole('heading', { level: 2, name: 'No app resource sets are available' })
  ).toBeVisible();
  await expect(emptyState.getByRole('button', { name: 'Refresh' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create app scope' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Request assignment' })).toHaveCount(0);
});

test('app governance never exposes owner-service diagnostics from a failed mutation', async ({
  page,
}) => {
  await mockShellSession(page, ['APP_CATALOG_ADMIN', 'WORKSPACE_MEMBER'], {
    userId: 1,
    displayName: 'Independent Catalog Admin',
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    resourceRoles: [],
  });
  await mockGovernanceDashboard(page);

  await page.goto('/admin/identity/app-governance');
  await page.getByRole('button', { name: /Responsibility assignments/u }).click();
  await page
    .getByTestId('app-governance-assignment-owner-active')
    .getByRole('button', { name: 'Revoke' })
    .click();

  const dialog = page.getByRole('dialog', { name: 'Revoke this active responsibility?' });
  await dialog
    .getByLabel('Decision rationale')
    .fill('Remove this assignment after the scheduled access review.');
  await dialog.getByRole('button', { name: 'Revoke' }).click();

  await expect(
    page.getByText('The operation could not be completed.', { exact: true })
  ).toBeVisible();
  await expect(page.getByText(/Auth rejected this decision|FORBIDDEN/u)).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page
    .getByTestId('app-governance-assignment-owner-active')
    .getByRole('button', { name: 'Revoke' })
    .click();
  await expect(dialog.getByLabel('Decision rationale')).toHaveValue('');
  await expect(dialog.getByRole('button', { name: 'Revoke' })).toBeDisabled();
});

test('app governance sanitizes preset failures and resets preset audit rationale', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['APP_CATALOG_ADMIN', 'WORKSPACE_MEMBER'], {
    userId: 1,
    displayName: 'Independent Catalog Admin',
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    resourceRoles: [
      {
        responsibilityCode: 'APP_ACCESS_MANAGER',
        resourceType: 'APP',
        resourceKey: 'APP.APPROVALS',
        resourceSetId: 'rs-approvals',
        resourceSetKey: 'RS_APPROVALS',
      },
    ],
  });
  await mockGovernanceDashboard(page, { includeActivePresetAssignment: true });

  await page.goto('/admin/identity/app-governance');
  const presetRow = page.getByRole('row').filter({ hasText: 'Mina Preset Administrator' });
  const revokeButton = presetRow.getByRole('button', { name: 'Revoke' });
  if (testInfo.project.name === 'chromium') {
    await expect
      .poll(() =>
        revokeButton.evaluate((button) => {
          const rect = button.getBoundingClientRect();
          const hitTarget = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          );
          return hitTarget === button || button.contains(hitTarget);
        })
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
  }
  await revokeButton.click();

  const dialog = page.getByRole('dialog', {
    name: 'Revoke this app administrator preset?',
  });
  await dialog
    .getByLabel('Decision rationale')
    .fill('Remove the preset after the scheduled access review.');
  await dialog.getByRole('button', { name: 'Confirm' }).click();

  await expect(
    page.getByText('The operation could not be completed.', { exact: true })
  ).toBeVisible();
  await expect(page.getByText(/Auth rejected this decision|FORBIDDEN/u)).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(revokeButton).toBeFocused();
  await revokeButton.click();
  await expect(dialog.getByLabel('Decision rationale')).toHaveValue('');
  await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeDisabled();
});

test('app governance remains operable at 320px and 200% text', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.setViewportSize({ width: 320, height: 720 });
  await mockShellSession(page, ['APP_CATALOG_ADMIN', 'WORKSPACE_MEMBER'], {
    userId: 1,
    displayName: 'Independent Catalog Admin',
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    resourceRoles: [],
  });
  await mockGovernanceDashboard(page);

  await page.goto('/admin/identity/app-governance');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expect(
    page.getByRole('heading', { level: 1, name: 'App responsibility governance' })
  ).toBeVisible();
  await page.getByRole('button', { name: /App resource sets/u }).click();
  await expect(
    page.getByRole('link', {
      name: 'Open Approvals management workbench for Approvals production',
    })
  ).toBeVisible();

  const width = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(width.content).toBeLessThanOrEqual(width.viewport + 1);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? '')
    )
  ).toEqual([]);
});

test('app catalog exposes product-specific native management links', async ({ page }) => {
  await mockShellSession(page, ['APP_CATALOG_ADMIN', 'WORKSPACE_MEMBER'], {
    userId: 1,
    displayName: 'Independent Catalog Admin',
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    resourceRoles: [],
  });
  await mockApprovalProductSurfaceAuthority(page, { work: false, management: true });

  await page.goto('/apps');
  const managementLink = page.getByRole('link', { name: 'Manage Approvals' });
  await expect(managementLink).toBeVisible();
  await expect(managementLink).toHaveAttribute(
    'href',
    '/approvals/admin?scope=scope%3Aapprovals%3Atenant'
  );
  await expect(page.getByRole('link', { name: 'Manage', exact: true })).toHaveCount(0);
});

test('app catalog preserves its shell when the management request module cannot load', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 1,
    displayName: 'Workspace Member',
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
    resourceRoles: [],
  });
  let abortedModuleRequests = 0;
  await page.route('**/src/components/app-management-request-dialog.tsx*', async (route) => {
    abortedModuleRequests += 1;
    await route.abort('failed');
  });

  await page.goto('/apps?requestManagement=APP.APPROVALS&requestSurface=approvals.admin');

  await expect(page.locator('#dwp-main-content')).toBeVisible();
  const appsHeading = page.getByRole('heading', { level: 1, name: '앱' });
  await expect(appsHeading).toBeVisible();
  const loadError = page.getByTestId('app-management-request-load-error');
  await expect(loadError).toBeVisible();
  await expect(loadError).toBeInViewport();
  await expect(
    loadError.getByRole('heading', { level: 2, name: '앱 관리 요청 화면을 열지 못했습니다' })
  ).toBeVisible();
  await expect(loadError.getByRole('button', { name: '페이지 새로고침' })).toBeVisible();
  await expect(page.getByText(/Failed to fetch dynamically imported module/u)).toHaveCount(0);
  expect(abortedModuleRequests).toBeGreaterThan(0);

  await loadError.getByRole('button', { name: '닫기' }).click();
  await expect(loadError).toHaveCount(0);
  await expect(appsHeading).toBeFocused();
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return [url.searchParams.has('requestManagement'), url.searchParams.has('requestSurface')];
    })
    .toEqual([false, false]);
});

test('app catalog cleans up its dialog when a nested management request module cannot load', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 1,
    displayName: 'Workspace Member',
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
    resourceRoles: [],
  });
  await page.route(
    '**/api/auth/admin/access/app-governance/presets/self-service-options?*',
    async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: envelope([
          {
            preset: {
              presetCode: 'APPROVAL_DESIGNER',
              productKey: 'approvals',
              appResourceKey: 'APP.APPROVALS',
              displayName: 'Approval designer',
              description: 'Configure approval forms and workflows.',
              responsibilityCode: 'APP_CONFIG_ADMIN',
              riskTier: 'MEDIUM',
              catalogVersion: 1,
              duties: [],
              requestable: true,
              unavailableReason: null,
            },
            resourceSets: [
              {
                resourceSetId: 'rs-approvals',
                resourceSetKey: 'RS_APPROVALS',
                resourceSetName: 'Approvals production',
              },
            ],
          },
        ]),
      });
    }
  );
  let abortedModuleRequests = 0;
  await page.route(
    '**/src/components/app-management-request-schedule-fields.tsx*',
    async (route) => {
      abortedModuleRequests += 1;
      await route.abort('failed');
    }
  );

  await page.goto('/apps?requestManagement=APP.APPROVALS&requestSurface=approvals.admin');

  const appsHeading = page.getByRole('heading', { level: 1, name: '앱' });
  const loadError = page.getByTestId('app-management-request-load-error');
  await expect(loadError).toBeVisible();
  await expect(loadError).toBeInViewport();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(() => page.locator('body').evaluate((body) => body.style.overflow))
    .not.toBe('hidden');
  await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden', 'true');
  expect(abortedModuleRequests).toBeGreaterThan(0);

  await loadError.getByRole('button', { name: '닫기' }).click();
  await expect(loadError).toHaveCount(0);
  await expect(appsHeading).toBeFocused();
});

test('company administration preserves its shell when a management page module cannot load', async ({
  page,
}) => {
  await mockShellSession(page, ['ADMIN', 'APP_CATALOG_ADMIN'], {
    userId: 1,
    displayName: '회사 관리자',
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
    resourceRoles: [],
  });
  let abortedModuleRequests = 0;
  await page.route('**/src/features/admin/app-governance-manager.tsx*', async (route) => {
    abortedModuleRequests += 1;
    await route.abort('failed');
  });

  await page.goto('/admin/identity/app-governance');

  await expect(page.getByTestId('admin-shell')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: '앱 책임 및 위임' })).toBeVisible();
  const loadError = page.getByTestId('admin-content-load-error');
  await expect(loadError).toBeVisible();
  await expect(loadError.getByText('관리 화면을 열지 못했습니다', { exact: true })).toBeVisible();
  await expect(
    loadError.getByText(
      '관리 셸은 계속 사용할 수 있습니다. 페이지를 새로고침해 이 화면을 다시 불러오세요.',
      { exact: true }
    )
  ).toBeVisible();
  await expect(loadError.getByRole('button', { name: '페이지 새로고침' })).toBeVisible();
  await expect(page.getByText(/^contentLoadError\./u)).toHaveCount(0);
  await expect(page.getByText(/Failed to fetch dynamically imported module/u)).toHaveCount(0);
  expect(abortedModuleRequests).toBeGreaterThan(0);
});
