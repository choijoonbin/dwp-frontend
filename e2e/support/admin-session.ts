import { mockAuthenticatedRuntime } from './runtime-access';
import { FULL_PRODUCT_PERMISSIONS } from './shell-session';

import type { Page } from '@playwright/test';

type AdminSessionOptions = {
  roles?: string[];
  permissions?: Array<{
    resourceType: string;
    resourceKey: string;
    permissionCode: string;
    effect: 'ALLOW' | 'DENY';
  }>;
};

export function adminEnvelope(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

export const DEFAULT_ADMIN_PERMISSIONS = FULL_PRODUCT_PERMISSIONS.filter(({ resourceKey }) =>
  [
    'APP.ADMINISTRATION',
    'ADMIN.API_MONITORING',
    'ADMIN.AUDIT_VIEW',
    'ADMIN.HOME_EXPERIENCE',
    'ADMIN.HOME_TEMPLATE',
    'ADMIN.HOME_WIDGET_POLICY',
  ].includes(resourceKey)
);

export async function mockAdminSession(page: Page, options: AdminSessionOptions = {}) {
  await mockAuthenticatedRuntime(page);
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: adminEnvelope({
        userId: 1,
        displayName: 'Admin User',
        jobTitle: 'Platform administrator',
        email: 'admin@dwp.local',
        tenantId: 1,
        tenantCode: 'default',
        identityPlane: 'TENANT',
        roles: options.roles ?? ['ADMIN'],
        resourceRoles: [],
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: adminEnvelope(options.permissions ?? DEFAULT_ADMIN_PERMISSIONS),
    })
  );
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: adminEnvelope({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }),
    })
  );
  await page.route('**/api/platform/v1/tenant-branding', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: adminEnvelope({ organizationName: null, logoUrl: null, version: 0 }),
    })
  );
  await page.route('**/api/platform/v1/personal-preferences**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: adminEnvelope({
        schemaVersion: 1,
        customized: false,
        preferences: {
          appearance: { mode: 'system', density: 'standard' },
          accessibility: { highContrast: false, reduceMotion: false },
        },
        version: 0,
        updatedAt: null,
      }),
    })
  );
}
