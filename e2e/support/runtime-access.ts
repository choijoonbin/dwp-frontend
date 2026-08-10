import type { Page } from '@playwright/test';

const DEFAULT_APP_RESOURCE_KEYS = [
  'APP.WORK',
  'APP.ASK',
  'APP.ACTIVITY',
  'APP.APPS',
  'APP.MAIL_CALENDAR',
  'APP.COLLABORATION',
  'APP.EMPLOYEE_SERVICES',
  'APP.PEOPLE_DIRECTORY',
  'APP.KNOWLEDGE',
  'APP.BUSINESS_ERP',
  'APP.LEGACY_OPERATIONS',
  'APP.ADMINISTRATION',
] as const;

export const DEFAULT_APP_PERMISSIONS = DEFAULT_APP_RESOURCE_KEYS.map((resourceKey) => ({
  resourceType: 'APP',
  resourceKey,
  permissionCode: 'VIEW',
  effect: 'ALLOW',
}));

export async function mockRuntimeNavigation(page: Page): Promise<void> {
  await page.route('**/api/platform/v1/navigation?*', (route) => {
    const locale = new URL(route.request().url()).searchParams.get('locale') ?? 'en';
    const korean = locale.toLowerCase().startsWith('ko');
    const apps = [
      ['work', korean ? '업무' : 'Work', '/work', 'APP.WORK'],
      ['ask', korean ? 'DWP에게 묻기' : 'Ask', '/ask', 'APP.ASK'],
      ['activity', korean ? '활동' : 'Activity', '/activity', 'APP.ACTIVITY'],
      ['apps', korean ? '앱' : 'Apps', '/apps', 'APP.APPS'],
    ].map(([navigationKey, label, routePath, resourceKey]) => ({
      navigationKey,
      itemType: 'APP',
      label,
      registryEntryKey: `DWP_${navigationKey.toUpperCase()}`,
      route: routePath,
      iconKey: navigationKey,
      requiredResourceKey: resourceKey,
      requiredPermissionCode: 'VIEW',
      children: [],
    }));

    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: [
          {
            navigationKey: 'workspace',
            itemType: 'GROUP',
            label: korean ? '업무' : 'Workspace',
            requiredPermissionCode: 'VIEW',
            children: apps,
          },
        ],
      }),
    });
  });
}
