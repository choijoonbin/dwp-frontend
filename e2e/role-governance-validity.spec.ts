import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import type {
  EffectiveAccess,
  GovernanceResource,
  GovernanceRole,
  GroupRoleAssignment,
} from '@dwp-frontend/shared-utils';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

const FIXED_NOW = new Date('2026-08-28T00:00:00Z');

type RoleGovernanceOptions = {
  assignments?: GroupRoleAssignment[];
  groupsAvailable?: boolean;
  rolesAvailable?: boolean;
  resources?: GovernanceResource[];
  rolePermissions?: GovernanceRole['permissions'];
  effectiveAccess?: EffectiveAccess;
};

async function mockRoleGovernance(page: Page, options: RoleGovernanceOptions = {}) {
  const roles: GovernanceRole[] =
    options.rolesAvailable === false
      ? []
      : [
          {
            roleId: 100,
            code: 'SERVICE_AGENT',
            name: 'Service agent',
            description: 'Handles governed service requests.',
            roleType: 'CUSTOM',
            privileged: false,
            assignableToGroups: true,
            status: 'ACTIVE',
            version: 1,
            permissions: options.rolePermissions ?? [],
          },
        ];
  const resources = options.resources ?? [];
  const assignments = options.assignments ?? [];
  const createPayloads: Record<string, unknown>[] = [];
  const permissionPayloads: Record<string, unknown>[] = [];

  await page.route('**/api/auth/admin/access/governance/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/roles')) {
      return fulfillSuccess(route, roles);
    }
    if (request.method() === 'GET' && path.endsWith('/resources')) {
      return fulfillSuccess(route, resources);
    }
    if (
      request.method() === 'GET' &&
      path.endsWith('/users/42/effective-access') &&
      options.effectiveAccess
    ) {
      return fulfillSuccess(route, options.effectiveAccess);
    }
    if (request.method() === 'PUT' && path.endsWith('/roles/100/permissions')) {
      const payload = request.postDataJSON() as Record<string, unknown>;
      permissionPayloads.push(payload);
      return fulfillSuccess(route, {
        ...roles[0],
        permissions: payload.permissions,
        version: 2,
      });
    }
    if (request.method() === 'GET' && path.endsWith('/group-role-assignments')) {
      return fulfillSuccess(route, assignments);
    }
    if (request.method() === 'POST' && path.endsWith('/group-role-assignments')) {
      const payload = request.postDataJSON() as Record<string, unknown>;
      createPayloads.push(payload);
      assignments.push({
        assignmentId: 99,
        groupId: Number(payload.groupId),
        groupName: 'Service operators',
        roleId: Number(payload.roleId),
        roleCode: 'SERVICE_AGENT',
        assignmentType: 'ACTIVE',
        scopeType: payload.scopeType as GroupRoleAssignment['scopeType'],
        scopeRef: payload.scopeRef as string | undefined,
        validTo: payload.validTo as string | undefined,
        lifecycleState: 'ACTIVE',
        justification: String(payload.justification),
        version: 1,
      });
      return fulfillSuccess(route, assignments.at(-1));
    }
    return route.fulfill({ status: 404 });
  });

  await page.route('**/api/auth/admin/identity/roles', (route) =>
    fulfillSuccess(
      route,
      roles.map((role) => ({
        code: role.code,
        name: role.name,
        description: role.description,
        roleFamily: 'WORKSPACE',
        assignmentClass: 'DELEGATED',
        privileged: role.privileged,
        assignmentMode: 'DIRECT',
        conflictsWith: [],
        status: role.status,
      }))
    )
  );

  await page.route('**/api/auth/admin/identity/users**', (route) =>
    fulfillSuccess(route, {
      content: [
        {
          userId: 42,
          displayName: 'Jordan Auditor',
          email: 'jordan.auditor@example.com',
          status: 'ACTIVE',
          mfaEnabled: true,
          roles: [],
          roleManagement: { allowed: true, reason: 'ALLOWED' },
          accessRevision: 7,
          version: 1,
        },
      ],
      page: 0,
      size: 100,
      totalElements: 1,
      totalPages: 1,
    })
  );

  await page.route('**/api/auth/admin/directory/groups**', (route) =>
    fulfillSuccess(route, {
      content:
        options.groupsAvailable === false
          ? []
          : [
              {
                groupId: 10,
                groupKey: 'SERVICE_OPERATORS',
                displayName: 'Service operators',
                description: 'Operators for governed service requests.',
                sourceType: 'LOCAL',
                status: 'ACTIVE',
                memberCount: 8,
                revision: 4,
                version: 2,
              },
            ],
      page: 0,
      size: 100,
      totalElements: options.groupsAvailable === false ? 0 : 1,
      totalPages: options.groupsAvailable === false ? 0 : 1,
    })
  );

  return { createPayloads, permissionPayloads };
}

async function openRoleAssignments(page: Page) {
  await page.goto('/admin/identity/roles');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Roles and access management' })
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Roles by group' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Roles by group' })).toBeVisible();
}

async function expectNoBlockingAccessibilityViolations(page: Page, selector: string) {
  const accessibility = await new AxeBuilder({ page }).include(selector).analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? '')
    )
  ).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
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

test('effective validity drives role assignment status and the create form fails early', async ({
  page,
}) => {
  const store = await mockRoleGovernance(page, {
    assignments: [
      {
        assignmentId: 1,
        groupId: 10,
        groupName: 'Expired operators',
        roleId: 100,
        roleCode: 'SERVICE_AGENT',
        assignmentType: 'ACTIVE',
        scopeType: 'TENANT',
        validFrom: '2026-08-01T00:00:00Z',
        validTo: '2026-08-27T23:59:59Z',
        lifecycleState: 'ACTIVE',
        justification: 'Historical governed access.',
        version: 1,
      },
      {
        assignmentId: 2,
        groupId: 11,
        groupName: 'Scheduled operators',
        roleId: 100,
        roleCode: 'SERVICE_AGENT',
        assignmentType: 'ACTIVE',
        scopeType: 'TENANT',
        validFrom: '2026-09-01T00:00:00Z',
        validTo: '2026-10-01T00:00:00Z',
        lifecycleState: 'ACTIVE',
        justification: 'Approved future access.',
        version: 1,
      },
    ],
  });
  await openRoleAssignments(page);

  const expiredRow = page.getByRole('row').filter({ hasText: 'Expired operators' });
  await expect(expiredRow.getByText('Expired', { exact: true })).toHaveCount(2);
  await expect(expiredRow.getByRole('button', { name: /Revoke/ })).toHaveCount(0);
  const scheduledRow = page.getByRole('row').filter({ hasText: 'Scheduled operators' });
  await expect(scheduledRow.getByText('Scheduled', { exact: true })).toBeVisible();
  await expect(
    scheduledRow.getByRole('button', {
      name: 'Revoke the Service agent role assignment from Scheduled operators',
    })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Assign role to group' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Assign role to group' });
  await dialog.getByRole('combobox', { name: 'Group' }).click();
  await page.getByRole('option', { name: 'Service operators' }).click();
  await dialog.getByRole('combobox', { name: 'Role' }).click();
  await page.getByRole('option', { name: /Service agent/ }).click();
  await dialog
    .getByLabel('Justification')
    .fill('Approved least-privilege support for the service operations group.');
  const expiry = dialog.getByLabel('Expiry');
  await expiry.fill('2026-08-27T09:00');
  await expect(dialog.getByText('Expiry must be later than the current time.')).toBeVisible();
  const create = dialog.getByRole('button', { name: 'Create' });
  await expect(create).toBeDisabled();

  await expiry.fill('2026-09-10T09:00');
  await dialog.getByLabel('Scope type').click();
  await page.getByRole('option', { name: 'Organization' }).click();
  await dialog.getByLabel('Scope reference').fill(' org-42 ');
  await expect(create).toBeEnabled();
  await expectNoBlockingAccessibilityViolations(page, '[role="dialog"]');
  await expectNoHorizontalOverflow(page);
  await create.click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Group role assignment created.', { exact: true })).toBeVisible();
  expect(store.createPayloads).toHaveLength(1);
  expect(store.createPayloads[0]).toMatchObject({
    groupId: 10,
    roleId: 100,
    assignmentType: 'ACTIVE',
    scopeType: 'ORG_UNIT',
    scopeRef: 'org-42',
    justification: 'Approved least-privilege support for the service operations group.',
  });
  expect(Date.parse(String(store.createPayloads[0]?.validTo))).toBeGreaterThan(FIXED_NOW.getTime());
});

test('empty role assignment prerequisites explain the next action without a dead form', async ({
  page,
}) => {
  await mockRoleGovernance(page, {
    assignments: [],
    groupsAvailable: false,
    rolesAvailable: false,
  });
  await openRoleAssignments(page);

  await expect(page.getByText('No group role assignments yet', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Assign role to group' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Assign role to group' });
  await expect(
    dialog.getByText(/No active groups match this search/, { exact: false })
  ).toBeVisible();
  await expect(
    dialog.getByText(/No active roles can be assigned to groups/, { exact: false })
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Create' })).toBeDisabled();
  await expectNoBlockingAccessibilityViolations(page, '[role="dialog"]');
  await expectNoHorizontalOverflow(page);
});

test('the permission editor exposes every canonical Auth operation and saves advanced grants', async ({
  page,
}) => {
  const store = await mockRoleGovernance(page, {
    resources: [
      {
        resourceId: 500,
        type: 'APP',
        key: 'DWP.WORKSPACE',
        name: 'Workspace application',
        enabled: true,
      },
    ],
    rolePermissions: [
      {
        resourceId: 500,
        resourceType: 'APP',
        resourceKey: 'DWP.WORKSPACE',
        resourceName: 'Workspace application',
        permissionCode: 'APPROVE',
        effect: 'ALLOW',
      },
    ],
  });
  await page.goto('/admin/identity/roles');
  await page.getByRole('button', { name: 'Edit permissions for Service agent' }).click();

  const dialog = page.getByRole('dialog', { name: 'Permissions for Service agent' });
  for (const permission of ['Execute', 'Approve', 'Export', 'Publish']) {
    await expect(
      dialog.getByRole('combobox', {
        name: new RegExp(`Workspace application ${permission} \\([A-Z]+\\) effect`),
      })
    ).toBeVisible();
  }
  const exportEffect = dialog.getByRole('combobox', {
    name: 'Workspace application Export (EXPORT) effect',
  });
  await exportEffect.click();
  await page.getByRole('option', { name: 'Allow (ALLOW)' }).click();
  await expectNoBlockingAccessibilityViolations(page, '[role="dialog"]');
  await expectNoHorizontalOverflow(page);
  await dialog.getByRole('button', { name: 'Save permissions' }).click();

  await expect(dialog).toHaveCount(0);
  expect(store.permissionPayloads).toHaveLength(1);
  expect(store.permissionPayloads[0]?.permissions).toEqual(
    expect.arrayContaining([
      { resourceId: 500, permissionCode: 'APPROVE', effect: 'ALLOW' },
      { resourceId: 500, permissionCode: 'EXPORT', effect: 'ALLOW' },
    ])
  );
});

test('effective access keeps cross-scope roles and same-key resource types as separate evidence', async ({
  page,
}) => {
  await mockRoleGovernance(page, {
    effectiveAccess: {
      userId: 42,
      displayName: 'Jordan Auditor',
      accessRevision: 7,
      roles: [
        {
          roleId: 100,
          roleCode: 'SERVICE_AGENT',
          source: 'GROUP',
          sourceGroupId: 10,
          sourceGroupName: 'Service operators',
          scopeType: 'ORG_UNIT',
          scopeRef: 'org-42',
        },
        {
          roleId: 100,
          roleCode: 'SERVICE_AGENT',
          source: 'GROUP',
          sourceGroupId: 10,
          sourceGroupName: 'Service operators',
          scopeType: 'RESOURCE',
          scopeRef: 'service-42',
        },
      ],
      permissions: [
        {
          resourceType: 'APP',
          resourceKey: 'SHARED',
          permissionCode: 'VIEW',
          effect: 'ALLOW',
          grantedByRoles: ['SERVICE_AGENT'],
        },
        {
          resourceType: 'API',
          resourceKey: 'SHARED',
          permissionCode: 'VIEW',
          effect: 'ALLOW',
          grantedByRoles: ['SERVICE_AGENT'],
        },
      ],
    },
  });
  await page.goto('/admin/identity/roles');
  await page.getByRole('tab', { name: 'Access by user' }).click();
  await page.getByRole('combobox', { name: 'User' }).click();
  await page.getByRole('option', { name: 'Jordan Auditor / jordan.auditor@example.com' }).click();

  const roleGrid = page.getByRole('grid', { name: 'Effective roles' });
  const permissionGrid = page.getByRole('grid', { name: 'Effective permissions' });
  await expect(roleGrid.getByRole('row')).toHaveCount(3);
  await expect(roleGrid.getByText('ORG_UNIT / org-42', { exact: true })).toBeVisible();
  await expect(roleGrid.getByText('RESOURCE / service-42', { exact: true })).toBeVisible();
  await expect(permissionGrid.getByRole('row')).toHaveCount(3);
  await expect(permissionGrid.getByText('SHARED', { exact: true })).toHaveCount(2);
  await expect(permissionGrid.getByText('Application (APP)', { exact: true })).toBeVisible();
  await expect(permissionGrid.getByText('API', { exact: true })).toBeVisible();
  await expectNoBlockingAccessibilityViolations(page, '[role="tabpanel"]');
  await expectNoHorizontalOverflow(page);
});
