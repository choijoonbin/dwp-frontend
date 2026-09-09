import { expect, test } from '@playwright/test';

import { DEFAULT_APP_PERMISSIONS } from './support/runtime-access';
import { fulfillSuccess } from './support/shell-session';
import {
  mockWorkHubFoundation,
  WORK_HUB_FIXTURE as fixture,
} from './support/work-hub-foundation-fixtures';

for (const { article, transition } of [
  { article: 'a', transition: 'user' },
  { article: 'a', transition: 'tenant' },
  { article: 'an', transition: 'access' },
] as const) {
  test(`${article} ${transition} transition during revalidation prevents the reviewed workspace command`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'The owner-transition contract runs once.');
    test.setTimeout(60_000);
    const runtime = await mockWorkHubFoundation(page, {
      personal: false,
      sourceOwned: false,
      nativeWorkspace: true,
    });
    let userId = 1;
    let tenantId = 1;
    let canUpdate = true;
    let meRequests = 0;
    let permissionRequests = 0;
    await page.route('**/api/auth/me', (route) => {
      meRequests += 1;
      return fulfillSuccess(route, {
        userId,
        personPublicId: `person-${userId}`,
        displayName: `Owner ${userId}`,
        jobTitle: 'Workspace member',
        email: `owner-${userId}@example.test`,
        tenantId,
        tenantCode: `tenant-${tenantId}`,
        tenantName: `Tenant ${tenantId}`,
        identityPlane: 'TENANT',
        preferredLocale: 'en',
        tenantDefaultLocale: 'en',
        roles: ['WORKSPACE_MEMBER'],
        groups: [],
        resourceRoles: [],
      });
    });
    const permissions = [
      ...DEFAULT_APP_PERMISSIONS,
      ...['APP.APPROVALS', 'APP.EMPLOYEE_SERVICES'].map((resourceKey) => ({
        resourceType: 'APP',
        resourceKey,
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      })),
      ...['ACTION.APPROVAL_TASK', 'ACTION.APPROVAL_REQUEST'].map((resourceKey) => ({
        resourceType: 'ACTION',
        resourceKey,
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      })),
      {
        resourceType: 'APP',
        resourceKey: 'APP.WORK',
        permissionCode: 'UPDATE',
        effect: 'ALLOW',
      },
    ];
    await page.route('**/api/auth/permissions', (route) => {
      permissionRequests += 1;
      return fulfillSuccess(
        route,
        permissions.filter(
          (permission) =>
            canUpdate ||
            permission.resourceKey !== 'APP.WORK' ||
            permission.permissionCode !== 'UPDATE'
        )
      );
    });

    let holdRevalidation = false;
    let blockedRevalidations = 0;
    let completedRevalidations = 0;
    let directMutationAttempts = 0;
    let release!: () => void;
    const revalidationGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/platform/v1/workspace/work-items', async (route) => {
      if (route.request().method() === 'GET' && holdRevalidation) {
        blockedRevalidations += 1;
        await revalidationGate;
      }
      await route.fallback();
      if (holdRevalidation) completedRevalidations += 1;
    });
    await page.route('**/api/platform/v1/workspace/work-items/**', async (route) => {
      if (route.request().method() !== 'GET') directMutationAttempts += 1;
      await route.fallback();
    });

    try {
      await page.goto('/work/queue');
      await page
        .getByRole('button', {
          name: `Open details for ${fixture.workspaceTitle}`,
          exact: true,
        })
        .click();
      const detail = page.getByRole('article');
      await expect(
        detail.getByRole('heading', { name: fixture.workspaceTitle, exact: true })
      ).toBeVisible({ timeout: 30_000 });

      holdRevalidation = true;
      await detail.getByRole('button', { name: 'Mark complete', exact: true }).click();
      await expect.poll(() => blockedRevalidations).toBe(1);

      const beforeMe = meRequests;
      const beforePermissions = permissionRequests;
      if (transition === 'user') userId = 2;
      if (transition === 'tenant') tenantId = 2;
      if (transition === 'access') canUpdate = false;
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await expect
        .poll(() => (transition === 'access' ? permissionRequests : meRequests))
        .toBeGreaterThan(transition === 'access' ? beforePermissions : beforeMe);
      await expect.poll(() => blockedRevalidations).toBeGreaterThan(1);
      release();

      await expect.poll(() => completedRevalidations).toBeGreaterThanOrEqual(2);
      await expect(
        page.getByRole('heading', { name: fixture.workspaceTitle, exact: true })
      ).toBeVisible();
      expect(directMutationAttempts).toBe(0);
      expect(runtime.forbiddenWorkspaceMutations).toEqual([]);
      expect(runtime.batchMutations).toEqual([]);
      await expect(page.getByText('The source confirmed the change', { exact: true })).toHaveCount(
        0
      );
    } finally {
      release();
    }
  });
}
