import { expect, test } from '@playwright/test';

import { fulfillSuccess } from './support/shell-session';
import { mockWorkHubFoundation, WORK_HUB_FIXTURE } from './support/work-hub-foundation-fixtures';

import type { Page } from '@playwright/test';

type AccessCase = 'allow' | 'deny' | 'empty' | 'provider';

const accessCases: readonly AccessCase[] = ['empty', 'allow', 'deny', 'provider'];
const viewports = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
] as const;

function permissions(access: AccessCase) {
  if (access === 'allow') {
    return [
      {
        resourceType: 'APP',
        resourceKey: 'APP.WORK',
        permissionCode: 'VIEW',
        effect: 'ALLOW' as const,
      },
    ];
  }
  if (access === 'deny') {
    return [
      {
        resourceType: 'APP',
        resourceKey: 'APP.WORK',
        permissionCode: 'VIEW',
        effect: 'DENY' as const,
      },
      {
        resourceType: 'APP',
        resourceKey: 'APP.CALENDAR',
        permissionCode: 'VIEW',
        effect: 'ALLOW' as const,
      },
    ];
  }
  return [];
}

async function mockExactWorkAccess(page: Page, access: AccessCase) {
  await page.route('**/api/auth/permissions', (route) =>
    fulfillSuccess(route, permissions(access))
  );
  if (access === 'provider') {
    await page.route('**/api/auth/me', (route) =>
      fulfillSuccess(route, {
        userId: 77,
        personPublicId: null,
        displayName: 'Provider Admin',
        jobTitle: 'Platform operations lead',
        email: 'provider.admin@dwp.local',
        tenantId: 1,
        tenantCode: 'default',
        tenantName: 'SKAX',
        identityPlane: 'PROVIDER',
        preferredLocale: 'en',
        tenantDefaultLocale: 'en',
        roles: ['PROVIDER_ADMIN'],
        groups: [],
        resourceRoles: [],
      })
    );
  }
}

for (const viewport of viewports) {
  for (const access of accessCases) {
    test(`${viewport.width}px Work route is fail-closed for ${access} access`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await mockWorkHubFoundation(page, { nativeWorkspace: true });
      await mockExactWorkAccess(page, access);
      const workReads: string[] = [];
      page.on('request', (request) => {
        const path = new URL(request.url()).pathname;
        if (
          path === '/api/platform/v1/workspace/work-items' ||
          path === '/api/platform/v1/workspace/work-hub/personal-tasks'
        ) {
          workReads.push(path);
        }
      });

      await page.goto('/work/queue');

      if (access === 'allow') {
        await expect(page).toHaveURL((url) => url.pathname === '/work/queue');
        await expect(
          page.getByText(WORK_HUB_FIXTURE.personalTitle, { exact: true }).first()
        ).toBeVisible();
        expect(workReads.length).toBeGreaterThan(0);
      } else {
        await expect(page).toHaveURL((url) =>
          access === 'provider' ? url.pathname.startsWith('/provider') : url.pathname === '/403'
        );
        if (access !== 'provider') {
          await expect(
            page.getByRole('heading', { name: 'Access denied', exact: true })
          ).toBeVisible();
        }
        await expect(page.getByRole('article')).toHaveCount(0);
        expect(workReads).toEqual([]);
      }

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      ).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: testInfo.outputPath(`work-route-${access}-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
}
