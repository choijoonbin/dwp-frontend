import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

import type { Page } from '@playwright/test';

const policy = {
  bookingWindowDays: 30,
  maximumActiveBookings: 20,
  minimumBookingMinutes: 30,
  maximumBookingMinutes: 480,
  maximumConsecutiveDays: 5,
  workingDayStart: '07:00:00',
  workingDayEnd: '20:00:00',
  allowRecurring: false,
  requireCheckIn: true,
  checkInLeadMinutes: 60,
  autoReleaseMinutes: 30,
  allowAssignedDeskLending: false,
  showColleagueNames: true,
  version: 2,
};

const site = {
  siteId: '10000000-0000-0000-0000-000000000001',
  code: 'PANGYO',
  name: 'Pangyo HQ',
  nameKo: '판교 본사',
  nameEn: 'Pangyo HQ',
  type: 'HEADQUARTERS',
  address: 'Bundang-gu, Seongnam',
  timeZone: 'Asia/Seoul',
  totalFloorCount: 20,
  configuredFloorCount: 1,
  resourceCount: 1,
  state: 'ACTIVE',
  version: 1,
};

const floor = {
  floorId: '20000000-0000-0000-0000-000000000012',
  siteId: site.siteId,
  siteName: site.name,
  floorNumber: 12,
  name: '12F',
  nameKo: '12층',
  nameEn: '12F',
  planWidth: 1200,
  planHeight: 760,
  backgroundAssetPath: null,
  state: 'ACTIVE',
  resourceCount: 1,
  version: 1,
};

const resource = {
  resourceId: '30000000-0000-0000-0000-000000000012',
  floorId: floor.floorId,
  siteId: site.siteId,
  calendarResourceId: null,
  code: 'D-1208',
  name: 'Focus desk 12',
  nameKo: '집중 좌석 12',
  nameEn: 'Focus desk 12',
  type: 'DESK',
  mode: 'RESERVABLE',
  state: 'AVAILABLE',
  neighborhood: 'Focus zone',
  capacity: 1,
  features: ['MONITOR', 'STANDING'],
  accessible: true,
  approvalRequired: false,
  positionX: 12,
  positionY: 18,
  widthPercent: 12,
  heightPercent: 10,
  rotationDegrees: 0,
  assignedToCurrentUser: false,
  assignedUserId: null,
  assignedPersonPublicId: null,
  assignedDisplayName: null,
  version: 1,
};

function booking(overrides: Record<string, unknown> = {}) {
  return {
    bookingId: '40000000-0000-0000-0000-000000000001',
    resourceId: resource.resourceId,
    resourceName: resource.name,
    resourceType: resource.type,
    siteName: site.name,
    floorName: floor.name,
    purpose: 'Architecture review',
    startsAt: '2026-08-19T00:30:00Z',
    endsAt: '2026-08-19T01:30:00Z',
    status: 'RESERVED',
    visibleToColleagues: true,
    checkedInAt: null,
    releasedAt: null,
    canCheckIn: true,
    canCancel: true,
    canRelease: false,
    checkInOpensAt: '2026-08-18T23:30:00Z',
    checkInClosesAt: '2026-08-19T01:00:00Z',
    version: 0,
    ...overrides,
  };
}

async function mockWorkplace(page: Page) {
  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/workplace/explore')) {
      return fulfillSuccess(route, {
        sites: [site],
        floors: [floor],
        selectedFloor: floor,
        resources: [resource],
        occupancy: [],
        policy,
        generatedAt: '2026-08-19T00:00:00Z',
      });
    }
    if (path.endsWith('/workplace/bookings')) {
      return fulfillSuccess(
        route,
        request.method() === 'GET' ? [booking()] : booking(request.postDataJSON())
      );
    }
    if (/\/workplace\/bookings\/[^/]+\/(check-in|cancel|release)$/u.test(path)) {
      return fulfillSuccess(route, booking({ version: 1 }));
    }
    return route.fallback();
  });

  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/admin/workplace/sites')) return fulfillSuccess(route, [site]);
    if (path.endsWith('/admin/workplace/floors')) return fulfillSuccess(route, [floor]);
    if (path.endsWith(`/admin/workplace/floors/${floor.floorId}/resources`)) {
      return fulfillSuccess(route, [resource]);
    }
    if (path.endsWith('/admin/workplace/policy')) {
      const value = request.method() === 'PUT'
        ? { ...request.postDataJSON(), version: policy.version + 1 }
        : policy;
      return fulfillSuccess(route, value);
    }
    return route.fallback();
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockWorkplace(page);
});

test('members discover and book a workspace using tenant policy and site time zone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/workplace/explore');

  await expect(page.getByRole('heading', { name: 'Find a space', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Start time')).toContainText('09:30');
  await page.getByRole('button', { name: 'Focus desk 12 · Available' }).click();

  const dialog = page.getByRole('dialog', { name: 'Book a workspace' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Asia/Seoul')).toBeVisible();
  await dialog.getByLabel('Purpose').fill('Workplace E2E review');
  await dialog.getByRole('button', { name: 'Book', exact: true }).click();
  await expect(dialog).toBeHidden();

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('members receive server-authoritative booking actions', async ({ page }) => {
  await page.goto('/workplace/my-bookings');
  await expect(page.getByRole('heading', { name: 'My space bookings', level: 1 })).toBeVisible();
  await expect(page.getByText('Focus desk 12', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel booking' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Release' })).toHaveCount(0);
});

test('administrators can distinguish lifecycle state and edit the spatial inventory', async ({
  page,
}) => {
  await page.goto('/workplace/admin/locations');
  await expect(
    page.getByRole('heading', { name: 'Sites and floor plans', level: 1 })
  ).toBeVisible();
  await expect(page.getByText('Pangyo HQ', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('workplace-layout-editor')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add space' })).toBeEnabled();
});

test('administrators can change and persist tenant booking governance', async ({ page }) => {
  await page.goto('/workplace/admin/policies');
  await expect(
    page.getByRole('heading', { name: 'Workplace operating policy', level: 1 })
  ).toBeVisible();

  const visibility = page.getByRole('switch', {
    name: 'Show member names on reserved spaces',
  });
  await expect(visibility).toBeChecked();
  await visibility.uncheck();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('The Workplace policy was saved.')).toBeVisible();
});

test('mobile discovery defaults to the complete list without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/workplace/explore');
  await expect(page.getByRole('heading', { name: 'Find a space', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Focus desk 12/u })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport);
});
