import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { mockTenantWidgetRegistry } from './support/widget-registry';

import type { Page } from '@playwright/test';

test.setTimeout(90_000);

const NOW = '2026-09-16T02:00:00Z';

function homeExperience(version = 1) {
  return {
    headline: 'One workspace',
    subheadline: 'Everything ready for action.',
    localizedContent: {
      en: { headline: 'One workspace', subheadline: 'Everything ready for action.' },
      ko: { headline: '하나의 업무 공간', subheadline: '실행할 업무를 한곳에서 확인하세요.' },
    },
    defaultLocale: 'en',
    backgroundPosition: 'RIGHT',
    desktopBackgroundFocalX: 78,
    desktopBackgroundFocalY: 46,
    mobileBackgroundFocalX: 78,
    mobileBackgroundFocalY: 64,
    contentAlignment: 'LEFT',
    overlayOpacity: 18,
    backgroundUrl: null,
    backgroundOriginalName: null,
    backgroundContentType: null,
    backgroundSizeBytes: null,
    backgroundWidth: null,
    backgroundHeight: null,
    launchpadConfiguration: { schemaVersion: 1, groups: [], placements: [] },
    compositionPolicy: {
      schemaVersion: 4,
      experienceVariant: 'FLOW_V1',
      personalCustomizationEnabled: true,
      governedZones: [],
      modeLayouts: {
        CLASSIC: {
          layoutScope: 'MODE_SCOPED_VIEW',
          deviceClasses: ['DESKTOP_WIDE', 'DESKTOP_STANDARD', 'MOBILE_STANDARD', 'MOBILE_COMPACT'],
        },
        FLOW_V1: {
          layoutScope: 'MODE_SCOPED_VIEW',
          deviceClasses: ['DESKTOP_WIDE', 'DESKTOP_STANDARD', 'MOBILE_STANDARD', 'MOBILE_COMPACT'],
        },
      },
    },
    version,
  };
}

function revision(
  revisionId: number,
  sourceVersion: number,
  changeType: 'BASELINE' | 'EXPERIENCE_PUBLISHED' | 'ROLLBACK',
  current: boolean
) {
  return {
    revisionId,
    sourceVersion,
    changeType,
    headline: changeType === 'BASELINE' ? 'Prior tenant home' : 'Wave 5 tenant home',
    backgroundOriginalName: null,
    backgroundWidth: null,
    backgroundHeight: null,
    localeCount: 2,
    affectedScopes: ['PRESENTATION', 'LAUNCHPAD', 'COMPOSITION'],
    current,
    createdAt: NOW,
  };
}

async function mockAdminHomeStudio(page: Page) {
  let experience = homeExperience();
  let revisions = [revision(10, 1, 'BASELINE', false)];
  const auditEvents: Array<{
    auditEventId: string;
    actorType: 'USER';
    actorId: number;
    action: string;
    targetType: string;
    targetId: string;
    outcome: 'SUCCESS';
    correlationId: string;
    occurredAt: string;
  }> = Array.from({ length: 99 }, (_, index) => ({
    auditEventId: `audit-history-${index}`,
    actorType: 'USER' as const,
    actorId: 42,
    action: index === 98 ? 'HOME_EXPERIENCE_ARCHIVE_BOUNDARY' : 'HOME_EXPERIENCE_PUBLISHED',
    targetType: 'HOME_EXPERIENCE',
    targetId: `tenant-home-${index}`,
    outcome: 'SUCCESS' as const,
    correlationId: `corr-history-${index}`,
    occurredAt: NOW,
  }));
  const requests = { publish: 0, rollback: 0, scopedAudit: 0, auditPages: [] as number[] };

  await page.route('**/api/platform/v1/admin/home-experience**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/audit-events')) {
      const search = new URL(request.url()).searchParams;
      const page = Number(search.get('page') ?? 0);
      const size = Number(search.get('size') ?? 100);
      requests.scopedAudit += 1;
      requests.auditPages.push(page);
      return fulfillSuccess(route, {
        content: auditEvents.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: auditEvents.length,
        totalPages: Math.ceil(auditEvents.length / size),
      });
    }
    if (request.method() === 'GET' && path.endsWith('/revisions')) {
      return fulfillSuccess(route, revisions);
    }
    if (request.method() === 'GET' && path.endsWith('/home-experience')) {
      return fulfillSuccess(route, experience);
    }
    if (request.method() === 'POST' && path.endsWith('/publish')) {
      requests.publish += 1;
      expect(request.headers()['content-type']).toContain('multipart/form-data; boundary=');
      experience = { ...experience, version: 2 };
      revisions = [revision(11, 2, 'EXPERIENCE_PUBLISHED', true), ...revisions];
      auditEvents.unshift({
        auditEventId: 'audit-publish',
        actorType: 'USER',
        actorId: 42,
        action: 'HOME_EXPERIENCE_PUBLISHED',
        targetType: 'HOME_EXPERIENCE',
        targetId: 'tenant-home',
        outcome: 'SUCCESS',
        correlationId: 'corr-wave5-publish',
        occurredAt: NOW,
      });
      return fulfillSuccess(route, experience);
    }
    const rollbackMatch = path.match(
      /^\/api\/platform\/v1\/admin\/home-experience\/revisions\/(\d+)\/rollback$/u
    );
    if (request.method() === 'POST' && rollbackMatch) {
      expect(request.postDataJSON()).toEqual({ version: 2 });
      expect(rollbackMatch[1]).toBe('10');
      requests.rollback += 1;
      experience = { ...experience, version: 3 };
      revisions = [
        revision(12, 3, 'ROLLBACK', true),
        ...revisions.map((item) => ({ ...item, current: false })),
      ];
      auditEvents.unshift({
        auditEventId: 'audit-rollback',
        actorType: 'USER',
        actorId: 42,
        action: 'HOME_EXPERIENCE_ROLLED_BACK',
        targetType: 'HOME_EXPERIENCE',
        targetId: 'tenant-home',
        outcome: 'SUCCESS',
        correlationId: 'corr-wave5-rollback',
        occurredAt: NOW,
      });
      return fulfillSuccess(route, experience);
    }
    return route.fallback();
  });
  return requests;
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Wave 5 Admin evidence runs once on desktop.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('draft impact, preview, publish, rollback, and scoped audit form one continuous journey', async ({
  page,
}) => {
  await mockShellSession(page, ['ADMIN'], { locale: 'en', permissions: FULL_PRODUCT_PERMISSIONS });
  await mockTenantWidgetRegistry(page);
  const requests = await mockAdminHomeStudio(page);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto('/admin/experience/home/widgets');
  await expect(page.getByRole('heading', { name: 'Home Studio', level: 1 })).toBeVisible();
  await expect(page.getByText('DRAFT · revision 1')).toBeVisible();
  await expect(page.getByText('2 tenants and 12 existing instances are affected.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish policy' })).toBeDisabled();

  await page.getByRole('tab', { name: 'Content & preview' }).press('Enter');
  await expect(page).toHaveURL(/\/admin\/experience\/home\/content$/u);
  const headline = page.getByLabel('Headline');
  await headline.press('Control+a');
  await headline.pressSequentially('Wave 5 tenant home');
  await expect(page.getByTestId('home-experience-preview')).toContainText('Wave 5 tenant home');
  await page.getByRole('button', { name: 'Publish complete change set' }).press('Enter');
  await expect.poll(() => requests.publish).toBe(1);
  await expect(page.getByText('Home presentation published.')).toBeVisible();

  await page.getByRole('tab', { name: 'Releases' }).press('Enter');
  await expect(page).toHaveURL(/\/admin\/experience\/home\/releases$/u);
  await expect(page.getByText('Current release v2')).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).press('Enter');
  const rollback = page.getByRole('alertdialog', {
    name: 'Restore this complete home revision?',
  });
  await rollback.getByRole('button', { name: 'Restore complete home' }).press('Enter');
  await expect.poll(() => requests.rollback).toBe(1);
  await expect(page.getByText('Current release v3')).toBeVisible();

  await page.getByRole('tab', { name: 'Audit' }).press('Enter');
  await expect(page).toHaveURL(/\/admin\/experience\/home\/audit$/u);
  await expect(page.getByText('HOME_EXPERIENCE_PUBLISHED').first()).toBeVisible();
  await expect(page.getByText('HOME_EXPERIENCE_ROLLED_BACK')).toBeVisible();
  await expect(page.getByText(/corr-wave5-publish/u)).toBeVisible();
  await expect(page.getByText(/corr-wave5-rollback/u)).toBeVisible();
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).press('Enter');
  await expect(page.getByText('HOME_EXPERIENCE_ARCHIVE_BOUNDARY')).toBeVisible();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  expect(requests.auditPages).toContain(1);
  expect(requests.scopedAudit).toBeGreaterThan(0);
});

test('direct entry requires Home Experience VIEW and keeps VIEW-only controls read-only', async ({
  page,
}) => {
  const viewOnly = FULL_PRODUCT_PERMISSIONS.filter(
    (permission) =>
      permission.resourceKey !== 'ADMIN.HOME_EXPERIENCE' || permission.permissionCode === 'VIEW'
  );
  await mockShellSession(page, ['ADMIN'], { locale: 'en', permissions: viewOnly });
  await mockAdminHomeStudio(page);
  await page.goto('/admin/experience/home/content');
  await expect(page.getByText('View-only access')).toBeVisible();
  await expect(page.getByLabel('Headline')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Publish complete change set' })).toBeDisabled();
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/experience\/home\/content$/u);
});

test('MANAGE-only, missing widget policy, and Provider identities fail closed', async ({
  page,
}) => {
  const manageOnly = FULL_PRODUCT_PERMISSIONS.filter(
    (permission) =>
      permission.resourceKey !== 'ADMIN.HOME_EXPERIENCE' || permission.permissionCode === 'MANAGE'
  );
  let tenantHomeRequests = 0;
  await page.route('**/api/platform/v1/admin/home-experience**', (route) => {
    tenantHomeRequests += 1;
    return route.abort();
  });
  await mockShellSession(page, ['ADMIN'], { locale: 'en', permissions: manageOnly });
  await page.goto('/admin/experience/home/content');
  await expect(page).toHaveURL(/\/403$/u);
  expect(tenantHomeRequests).toBe(0);

  const withoutWidgetPolicy = FULL_PRODUCT_PERMISSIONS.filter(
    (permission) => permission.resourceKey !== 'ADMIN.HOME_WIDGET_POLICY'
  );
  await mockShellSession(page, ['ADMIN'], { locale: 'en', permissions: withoutWidgetPolicy });
  await page.goto('/admin/experience/home/widgets');
  await expect(page.getByText('Widget policy access required')).toBeVisible();

  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    identityPlane: 'PROVIDER',
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.goto('/admin/experience/home/content');
  await expect(page).toHaveURL(/\/provider\/overview$/u);
});
