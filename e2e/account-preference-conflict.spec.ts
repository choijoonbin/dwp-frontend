import { expect, test, type Page, type Route } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

type PreferenceState = {
  schemaVersion: 2;
  customized: boolean;
  preferences: {
    appearance: { mode: 'system' | 'light' | 'dark'; density: 'standard' };
    accessibility: {
      highContrast: boolean;
      reduceMotion: boolean;
      underlineLinks: boolean;
      reduceTransparency: boolean;
    };
    regional: {
      timeZone: 'system';
      dateFormat: 'locale';
      timeFormat: 'locale';
      firstDayOfWeek: 'locale';
      numberFormat: 'locale';
    };
  };
  managedPolicy: {
    policyId: string;
    scope: 'TENANT';
    source: 'TENANT_EXPERIENCE_POLICY';
    ownerType: 'ROLE';
    ownerRef: string;
    ownerDisplayName: string;
    managedPaths: string[];
    rules: [];
    version: number;
  };
  version: number;
  updatedAt: string;
};

async function prepare(page: Page) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '김민서',
    email: 'minseo.kim@example.com',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
}

async function routeConflict(page: Page) {
  let preference: PreferenceState = {
    schemaVersion: 2,
    customized: false,
    preferences: {
      appearance: { mode: 'system', density: 'standard' },
      accessibility: {
        highContrast: false,
        reduceMotion: false,
        underlineLinks: false,
        reduceTransparency: false,
      },
      regional: {
        timeZone: 'system',
        dateFormat: 'locale',
        timeFormat: 'locale',
        firstDayOfWeek: 'locale',
        numberFormat: 'locale',
      },
    },
    managedPolicy: {
      policyId: 'tenant-experience',
      scope: 'TENANT',
      source: 'TENANT_EXPERIENCE_POLICY',
      ownerType: 'ROLE',
      ownerRef: 'TENANT_ADMIN',
      ownerDisplayName: 'Tenant administrator',
      managedPaths: [],
      rules: [],
      version: 1,
    },
    version: 1,
    updatedAt: '2026-09-17T09:00:00Z',
  };
  const writes: Array<{ patch: { appearance?: { mode?: string } }; version: number }> = [];
  let conflictInjected = false;

  await page.route('**/api/platform/v1/personal-preferences', async (route: Route) => {
    const request = route.request();
    if (request.method() === 'GET') return fulfillSuccess(route, preference);
    if (request.method() !== 'PATCH') return route.fallback();

    const body = request.postDataJSON() as (typeof writes)[number];
    writes.push(body);
    if (!conflictInjected) {
      conflictInjected = true;
      preference = {
        ...preference,
        preferences: {
          ...preference.preferences,
          appearance: { ...preference.preferences.appearance, mode: 'dark' },
        },
        version: 2,
        updatedAt: '2026-09-17T09:01:00Z',
      };
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', errorCode: 'OPTIMISTIC_LOCK_FAILED' }),
      });
    }

    expect(body.version).toBe(preference.version);
    preference = {
      ...preference,
      customized: true,
      preferences: {
        ...preference.preferences,
        appearance: { ...preference.preferences.appearance, ...body.patch.appearance },
      },
      version: preference.version + 1,
      updatedAt: '2026-09-17T09:02:00Z',
    };
    return fulfillSuccess(route, preference);
  });

  return {
    current: () => preference,
    writes: () => writes,
  };
}

test('S05 reviews a same-field 409 conflict and supports one saved-change undo', async ({
  page,
}) => {
  await prepare(page);
  const owner = await routeConflict(page);
  await page.goto('/account/settings/appearance');

  const colorMode = page.getByRole('group', { name: '색상 모드' });
  await expect(colorMode).toBeVisible();
  await colorMode.getByRole('button', { name: '라이트' }).click();

  const conflict = page.getByRole('dialog', { name: '유지할 변경 사항 선택' });
  await expect(conflict).toBeVisible();
  await expect(conflict.getByText('이전 값: 시스템')).toBeVisible();
  await expect(conflict.getByRole('radio', { name: '내 변경 유지 — 라이트' })).toBeChecked();
  await expect(conflict.getByRole('radio', { name: '최신 값 사용 — 다크' })).toBeVisible();
  await conflict.getByRole('button', { name: '선택한 값 저장' }).click();

  await expect.poll(() => owner.writes().length).toBe(2);
  await expect.poll(() => owner.current().preferences.appearance.mode).toBe('light');
  const undo = page.getByRole('button', { name: '마지막 저장 되돌리기' });
  await expect(undo).toBeVisible();
  await undo.click();

  await expect.poll(() => owner.writes().length).toBe(3);
  await expect.poll(() => owner.current().preferences.appearance.mode).toBe('dark');
  await expect(undo).toHaveCount(0);
  expect(owner.writes().map((write) => write.version)).toEqual([1, 2, 3]);
  expect(owner.writes().map((write) => write.patch.appearance?.mode)).toEqual([
    'light',
    'light',
    'dark',
  ]);
});
