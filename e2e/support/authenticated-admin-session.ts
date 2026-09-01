import { DEFAULT_APP_PERMISSIONS } from './runtime-access';

import type { Page } from '@playwright/test';

export async function mockAuthenticatedAdminSession(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          userId: 1,
          personPublicId: 'person-session-user',
          displayName: 'Admin',
          jobTitle: 'Platform administrator',
          email: 'admin@dwp.local',
          tenantId: 1,
          tenantCode: 'default',
          tenantName: 'SKAX',
          identityPlane: 'TENANT',
          preferredLocale: 'en',
          tenantDefaultLocale: 'en',
          roles: ['ADMIN'],
          groups: [],
          resourceRoles: [],
        },
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: DEFAULT_APP_PERMISSIONS,
      }),
    })
  );
}
