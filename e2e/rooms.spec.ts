import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import {
  CALENDAR_EVENT_FIXTURE,
  CALENDAR_FOCUS_FIXTURE,
  CALENDAR_RESOURCES_FIXTURE,
  ROOM_BOOKING_EVENT_FIXTURE,
} from './support/product-area-fixtures';

import type { CalendarHome } from '@dwp-frontend/shared-utils';
import type { Page } from '@playwright/test';

const policy = {
  bookingWindowDays: 30,
  bookingRetentionDays: 365,
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

const campus = {
  campusId: '50000000-0000-0000-0000-000000000001',
  code: 'PANGYO',
  nameKo: '판교 캠퍼스',
  nameEn: 'Pangyo Campus',
  state: 'ACTIVE',
  buildingCount: 1,
  version: 1,
};

const site = {
  siteId: '10000000-0000-0000-0000-000000000001',
  campusId: campus.campusId,
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

const zone = {
  zoneId: '60000000-0000-0000-0000-000000000001',
  floorId: floor.floorId,
  code: 'FOCUS',
  nameKo: '집중 구역',
  nameEn: 'Focus zone',
  type: 'QUIET',
  boundary: {},
  state: 'ACTIVE',
  sectionCount: 0,
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

const unplacedResource = {
  ...resource,
  resourceId: '30000000-0000-0000-0000-000000000013',
  code: 'D-1209',
  name: 'Focus desk 13',
  nameKo: '집중 좌석 13',
  nameEn: 'Focus desk 13',
  positionX: 0,
  positionY: 0,
  version: 2,
};

const publishedRevision = {
  revisionId: '70000000-0000-0000-0000-000000000001',
  floorId: floor.floorId,
  revisionNumber: 1,
  basedOnRevisionId: null,
  restoreSourceRevisionId: null,
  state: 'PUBLISHED',
  planWidth: floor.planWidth,
  planHeight: floor.planHeight,
  backgroundAssetPath: null,
  backgroundAssetKey: null,
  backgroundContentType: null,
  backgroundSizeBytes: null,
  backgroundSha256: null,
  changeSummary: 'Initial published layout',
  contentHash: 'published-layout',
  placementCount: 1,
  submittedAt: '2026-08-18T00:00:00Z',
  submittedBy: 900018,
  publishedAt: '2026-08-18T01:00:00Z',
  publishedBy: 900018,
  version: 1,
};

const draftRevision = {
  ...publishedRevision,
  revisionId: '70000000-0000-0000-0000-000000000002',
  revisionNumber: 2,
  basedOnRevisionId: publishedRevision.revisionId,
  state: 'DRAFT',
  changeSummary: 'Resume persisted floor-plan draft',
  contentHash: 'draft-layout',
  submittedAt: null,
  submittedBy: null,
  publishedAt: null,
  publishedBy: null,
  version: 0,
};

const placement = {
  placementId: '80000000-0000-0000-0000-000000000001',
  resourceId: resource.resourceId,
  resourceVersion: resource.version,
  zoneId: zone.zoneId,
  sectionId: null,
  positionX: resource.positionX,
  positionY: resource.positionY,
  widthPercent: resource.widthPercent,
  heightPercent: resource.heightPercent,
  rotationDegrees: resource.rotationDegrees,
  metadata: {},
  version: 0,
};

const READ_ONLY_WORKPLACE_PERMISSIONS = FULL_PRODUCT_PERMISSIONS.filter((permission) => {
  if (
    !['APP.WORKPLACE', 'APP.ROOMS', 'ADMIN.WORKPLACE', 'ADMIN.ROOMS'].includes(
      permission.resourceKey
    )
  ) {
    return true;
  }
  return permission.permissionCode === 'VIEW';
});

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

const workplaceCalendarHome = {
  date: '2026-08-19',
  timeZone: 'Asia/Seoul',
  nextEvent: {
    ...CALENDAR_EVENT_FIXTURE,
    eventId: 'calendar-event-workplace-sync',
    title: 'Workplace launch alignment',
    startsAt: '2026-08-19T02:00:00Z',
    endsAt: '2026-08-19T03:00:00Z',
    location: null,
  },
  today: [
    {
      ...CALENDAR_EVENT_FIXTURE,
      eventId: 'calendar-event-workplace-sync',
      title: 'Workplace launch alignment',
      startsAt: '2026-08-19T02:00:00Z',
      endsAt: '2026-08-19T03:00:00Z',
      location: null,
    },
    {
      ...CALENDAR_FOCUS_FIXTURE,
      eventId: 'calendar-event-workplace-focus',
      title: 'Workplace design focus',
      startsAt: '2026-08-19T07:00:00Z',
      endsAt: '2026-08-19T08:30:00Z',
    },
  ],
  metrics: {
    eventCount: 4,
    meetingMinutes: 120,
    focusMinutes: 150,
    focusTargetMinutes: 240,
    conflictCount: 0,
    awaitingResponseCount: 1,
    availableRoomCount: 7,
  },
  weekLoad: [
    ['2026-08-17', 180, 90, 5, 0, 62],
    ['2026-08-18', 135, 150, 4, 0, 55],
    ['2026-08-19', 120, 150, 4, 0, 58],
    ['2026-08-20', 120, 180, 4, 0, 50],
    ['2026-08-21', 90, 120, 3, 0, 38],
  ].map(([date, meetingMinutes, focusMinutes, eventCount, conflictCount, loadPercent]) => ({
    date: String(date),
    meetingMinutes: Number(meetingMinutes),
    focusMinutes: Number(focusMinutes),
    eventCount: Number(eventCount),
    conflictCount: Number(conflictCount),
    loadPercent: Number(loadPercent),
  })),
  attention: [],
  generatedAt: '2026-08-19T00:00:00Z',
} satisfies CalendarHome;

const workplaceExploreFixture = {
  sites: [site],
  floors: [floor],
  selectedFloor: floor,
  resources: [resource, unplacedResource],
  occupancy: [],
  policy,
  generatedAt: '2026-08-19T00:00:00Z',
};

async function mockWorkplace(page: Page) {
  let draftPlacements = [{ ...placement }];
  let draftVersion = draftRevision.version;
  let draftBackgroundAssetPath: string | null = null;
  let draftBackgroundAssetKey: string | null = null;
  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/workplace/explore')) {
      return fulfillSuccess(route, workplaceExploreFixture);
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
    if (/\/workplace\/bookings\/[^/]+\/relocate$/u.test(path)) {
      const input = request.postDataJSON() as Record<string, unknown>;
      return fulfillSuccess(
        route,
        booking({ ...input, resourceName: unplacedResource.name, version: 1 })
      );
    }
    return route.fallback();
  });

  await page.route('**/api/platform/v1/calendar/home**', (route) =>
    fulfillSuccess(route, workplaceCalendarHome)
  );

  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/admin/workplace/sites')) return fulfillSuccess(route, [site]);
    if (path.endsWith('/admin/workplace/floors')) return fulfillSuccess(route, [floor]);
    if (path.endsWith(`/admin/workplace/floors/${floor.floorId}/resources`)) {
      return fulfillSuccess(route, [resource, unplacedResource]);
    }
    if (path.endsWith('/admin/workplace/governance/campuses')) {
      return fulfillSuccess(route, [campus]);
    }
    if (path.endsWith(`/admin/workplace/governance/floors/${floor.floorId}/zones`)) {
      return fulfillSuccess(route, [zone]);
    }
    if (path.endsWith(`/admin/workplace/governance/zones/${zone.zoneId}/sections`)) {
      return fulfillSuccess(route, []);
    }
    if (path.endsWith(`/admin/workplace/governance/sites/${site.siteId}/access-rules`)) {
      return fulfillSuccess(route, []);
    }
    if (path.endsWith(`/admin/workplace/governance/sites/${site.siteId}/access-preview`)) {
      return fulfillSuccess(route, {
        siteId: site.siteId,
        userId: 900018,
        requestedPermission: 'VIEW',
        allowed: false,
        decision: 'DENY_NOT_CONFIGURED',
        matchedRuleIds: [],
        evaluatedAt: '2026-08-19T00:00:00Z',
      });
    }
    if (path.endsWith('/admin/workplace/governance/policy-overrides')) {
      return fulfillSuccess(route, []);
    }
    if (path.endsWith('/admin/workplace/governance/policy-preview')) {
      return fulfillSuccess(route, {
        targetScopeType: 'TENANT',
        targetScopeId: null,
        effectivePolicy: policy,
        fieldSources: {},
        appliedOverrideIds: [],
        generatedAt: '2026-08-19T00:00:00Z',
      });
    }
    if (path.endsWith(`/admin/workplace/governance/floors/${floor.floorId}/floor-plan-revisions`)) {
      return fulfillSuccess(route, [draftRevision, publishedRevision]);
    }
    if (path.endsWith(`/admin/workplace/governance/floors/${floor.floorId}/projection`)) {
      return fulfillSuccess(route, {
        floorId: floor.floorId,
        publishedRevisionId: publishedRevision.revisionId,
        revisionNumber: publishedRevision.revisionNumber,
        planWidth: floor.planWidth,
        planHeight: floor.planHeight,
        backgroundAssetPath: null,
        placements: [placement],
        publishedAt: publishedRevision.publishedAt,
      });
    }
    if (
      path.endsWith(
        `/admin/workplace/governance/floor-plan-revisions/${draftRevision.revisionId}/snapshot`
      )
    ) {
      return fulfillSuccess(route, {
        revision: {
          ...draftRevision,
          version: draftVersion,
          backgroundAssetPath: draftBackgroundAssetPath,
          backgroundAssetKey: draftBackgroundAssetKey,
          backgroundContentType: draftBackgroundAssetKey ? 'image/png' : null,
          backgroundSizeBytes: draftBackgroundAssetKey ? 68 : null,
          backgroundSha256: draftBackgroundAssetKey ? 'a'.repeat(64) : null,
        },
        placements: draftPlacements,
      });
    }
    if (
      path.endsWith(
        `/admin/workplace/governance/floor-plan-revisions/${draftRevision.revisionId}/background`
      ) &&
      request.method() === 'POST'
    ) {
      draftVersion += 1;
      draftBackgroundAssetPath =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      draftBackgroundAssetKey = `900018/workplace/floor-plan-revisions/${draftRevision.revisionId}/plan.png`;
      return fulfillSuccess(route, {
        ...draftRevision,
        version: draftVersion,
        backgroundAssetPath: draftBackgroundAssetPath,
        backgroundAssetKey: draftBackgroundAssetKey,
        backgroundContentType: 'image/png',
        backgroundSizeBytes: 68,
        backgroundSha256: 'a'.repeat(64),
      });
    }
    if (
      path.endsWith(
        `/admin/workplace/governance/floor-plan-revisions/${draftRevision.revisionId}`
      ) &&
      request.method() === 'PUT'
    ) {
      const input = request.postDataJSON() as {
        placements: Array<typeof placement>;
      };
      draftPlacements = input.placements.map((candidate, index) => ({
        ...candidate,
        placementId: `80000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
        version: draftVersion + 1,
      }));
      draftVersion += 1;
      return fulfillSuccess(route, {
        ...draftRevision,
        version: draftVersion,
        placementCount: input.placements.length,
      });
    }
    if (path.endsWith('/admin/workplace/governance/delegated-admin-scopes/effective')) {
      return fulfillSuccess(route, []);
    }
    if (path.endsWith('/admin/workplace/governance/delegated-admin-scopes')) {
      return fulfillSuccess(route, []);
    }
    if (path.endsWith('/admin/workplace/policy')) {
      const value =
        request.method() === 'PUT'
          ? { ...request.postDataJSON(), version: policy.version + 1 }
          : policy;
      return fulfillSuccess(route, value);
    }
    return route.fallback();
  });
}

async function clickWorkplaceNavigationLink(page: Page, name: string) {
  const link = page.getByRole('link', { name });
  if (!(await link.isVisible())) {
    await page.getByRole('button', { name: 'Open Workplace navigation' }).click();
    await expect(link).toBeVisible();
  }
  await link.click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockWorkplace(page);
});

test('workplace home prioritizes the next action and reflows with accessible visual context', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/workplace');

  await expect(
    page.getByRole('heading', { name: 'Set up the flow of your workday' })
  ).toBeVisible();
  await expect(page.getByTestId('workplace-day-brief')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check in now' })).toBeVisible();
  await expect(page.getByRole('heading', { name: "Today's flow" })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Spaces open for the next 60 minutes' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your workweek rhythm' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Worth your attention' })).toBeVisible();
  await expect(page.getByText('Workplace launch alignment still needs a room')).toHaveCount(0);
  await expect(page.getByText('Active sites', { exact: true })).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('workplace-home-1440.png'),
    fullPage: true,
  });

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    await expect(page.getByTestId('workplace-day-brief')).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.documentWidth, `${viewport.width}px home width`).toBeLessThanOrEqual(
      dimensions.viewport
    );
    if (viewport.width === 390) {
      const mobileAccessibility = await new AxeBuilder({ page }).include('main').analyze();
      expect(
        mobileAccessibility.violations.filter(
          (violation) => violation.impact === 'critical' || violation.impact === 'serious'
        )
      ).toEqual([]);
    }
    await page.screenshot({
      path: testInfo.outputPath(`workplace-home-${viewport.width}.png`),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const baseDayBriefFontSize = await page
    .locator('#workplace-day-brief')
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const resized = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    dayBriefFontSize: Number.parseFloat(
      getComputedStyle(document.querySelector('#workplace-day-brief')!).fontSize
    ),
    clippedAgendaTitles: [...document.querySelectorAll('[data-testid="workplace-agenda-title"]')]
      .filter((element) => element.scrollWidth > element.clientWidth)
      .map((element) => element.textContent),
    clippedAvailabilityLabels: [
      ...document.querySelectorAll('[data-testid="workplace-availability-label"]'),
    ]
      .filter((element) => element.scrollWidth > element.clientWidth)
      .map((element) => element.textContent),
  }));
  expect(resized.documentWidth, '390px home at 200% text').toBeLessThanOrEqual(resized.viewport);
  expect(resized.dayBriefFontSize).toBeGreaterThanOrEqual(baseDayBriefFontSize * 1.9);
  expect(resized.clippedAgendaTitles).toEqual([]);
  expect(resized.clippedAvailabilityLabels).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('workplace-home-390-text-200.png'),
    fullPage: true,
  });
});

test('workplace home distinguishes an unconfigured or inaccessible site from an empty day', async ({
  page,
}) => {
  await page.route('**/api/platform/v1/workplace/explore**', (route) =>
    fulfillSuccess(route, {
      sites: [],
      floors: [],
      selectedFloor: null,
      resources: [],
      occupancy: [],
      policy,
      generatedAt: '2026-08-19T00:00:00Z',
    })
  );
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
  await page.goto('/workplace');

  await expect(page.getByText('No workplace site is available to you')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Configure sites' })).toHaveCount(1);
  await expect(page.getByText('No site selected')).toBeVisible();
});

test('workplace home distinguishes missing floors from an empty resource catalog', async ({
  page,
}) => {
  let scope: 'NO_FLOOR' | 'NO_RESOURCE' = 'NO_FLOOR';
  await page.route('**/api/platform/v1/workplace/explore**', (route) =>
    fulfillSuccess(route, {
      sites: [site],
      floors: scope === 'NO_FLOOR' ? [] : [floor],
      selectedFloor: scope === 'NO_FLOOR' ? null : floor,
      resources: [],
      occupancy: [],
      policy,
      generatedAt: '2026-08-19T00:00:00Z',
    })
  );
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));

  await page.goto('/workplace');
  await expect(page.getByText('No active floor is available at this site').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Configure floors' })).toHaveCount(1);

  scope = 'NO_RESOURCE';
  await page.reload();
  await expect(
    page.getByText('No reservable spaces are registered on this floor').first()
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add spaces' })).toHaveCount(1);
});

test('workplace home includes earlier local-week reservations in its query scope', async ({
  page,
}) => {
  const bookingRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === '/api/platform/v1/workplace/bookings' && request.method() === 'GET';
  });

  await page.goto('/workplace');
  const request = await bookingRequest;
  const url = new URL(request.url());

  expect(url.searchParams.get('from')).toBe('2026-08-16T15:00:00Z');
  expect(url.searchParams.get('to')).toBe('2026-08-23T15:00:00Z');
});

test('workplace home executes check-in through the authoritative Workplace command', async ({
  page,
}) => {
  const boundaryBooking = booking({
    bookingId: '40000000-0000-0000-0000-000000000029',
    resourceName: 'Submitted check-in desk',
    startsAt: '2026-08-18T23:45:00Z',
    endsAt: '2026-08-19T00:00:30Z',
    checkInOpensAt: '2026-08-18T23:30:00Z',
    checkInClosesAt: '2026-08-19T00:10:00Z',
    canCheckIn: true,
    canRelease: false,
  });
  let checkInWrites = 0;
  let checkInPayload: unknown;
  let releaseCheckIn: (() => void) | undefined;
  const checkInGate = new Promise<void>((resolve) => {
    releaseCheckIn = resolve;
  });
  await page.route('**/api/platform/v1/workplace/bookings**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/platform/v1/workplace/bookings') {
      return fulfillSuccess(route, [boundaryBooking]);
    }
    if (request.method() === 'POST' && path.endsWith(`/${boundaryBooking.bookingId}/check-in`)) {
      checkInWrites += 1;
      checkInPayload = request.postDataJSON();
      await checkInGate;
      return fulfillSuccess(route, {
        ...boundaryBooking,
        status: 'CHECKED_IN',
        canCheckIn: false,
        version: boundaryBooking.version + 1,
      });
    }
    return route.fallback();
  });

  await page.goto('/workplace');
  await page.getByRole('button', { name: 'Check in now' }).click();
  await expect.poll(() => checkInWrites).toBe(1);

  await page.clock.setFixedTime(new Date('2026-08-19T00:00:30.050Z'));
  await page.clock.fastForward(30_050);
  await expect(page.getByRole('button', { name: 'Check in now' })).toHaveCount(0);
  await expect(page.getByTestId('workplace-decision-status')).toHaveText('');
  await expect(page.getByText(/no action was sent/u)).toHaveCount(0);
  expect(checkInWrites).toBe(1);

  expect(checkInPayload).toEqual({ version: 0 });
  releaseCheckIn?.();
  await expect(page.getByText('You checked in to the space.')).toBeVisible();
  expect(checkInWrites).toBe(1);
});

test('workplace home does not query Calendar without Calendar view permission', async ({
  page,
}) => {
  const permissions = FULL_PRODUCT_PERMISSIONS.filter(
    (permission) => permission.resourceKey !== 'APP.CALENDAR'
  );
  let calendarHomeCalls = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/platform/v1/calendar/home') {
      calendarHomeCalls += 1;
    }
  });
  await page.route('**/api/auth/permissions', (route) => fulfillSuccess(route, permissions));

  await page.goto('/workplace');
  await expect(page.getByRole('heading', { name: "Today's flow" })).toBeVisible();
  expect(calendarHomeCalls).toBe(0);
});

test('workplace home waits for every required source before announcing a live or empty state', async ({
  page,
}) => {
  let releaseCalendar: (() => void) | undefined;
  const calendarGate = new Promise<void>((resolve) => {
    releaseCalendar = resolve;
  });
  await page.route('**/api/platform/v1/calendar/home**', async (route) => {
    await calendarGate;
    return fulfillSuccess(route, workplaceCalendarHome);
  });

  await page.goto('/workplace');
  await expect(page.getByText('Preparing your workplace overview').first()).toBeVisible();
  await expect(page.getByText('No workplace events are scheduled today')).toHaveCount(0);
  await expect(page.getByText('Workplace information')).toHaveCount(0);

  releaseCalendar?.();
  await expect(page.getByRole('heading', { name: "Today's flow" })).toBeVisible();
  await expect(page.getByText('Workplace information')).toBeVisible();
});

test('workplace home does not confirm a next action or an empty week from partial sources', async ({
  page,
}) => {
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/rooms/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/calendar/home**', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Calendar projection unavailable' }),
    })
  );

  await page.goto('/workplace');

  await expect(page.getByRole('button', { name: 'Verify current data' }).first()).toBeVisible();
  await expect(
    page.getByText('Some reservation sources are unavailable. Only verified activity is shown.')
  ).toBeVisible();
  await expect(page.getByText('Reservation status not fully verified').first()).toBeVisible();
  await expect(page.getByText('No space reservation')).toHaveCount(0);
  await expect(page.getByText('No workplace events are scheduled today')).toHaveCount(0);
  await expect(page.getByText("Today's complete workplace flow is not yet verified")).toBeVisible();
  await expect(page.getByText('Your workplace plan is in good shape')).toHaveCount(0);
  await expect(page.getByText('Items needing attention are not fully verified')).toBeVisible();
});

test('workplace home discards cached availability after an authoritative access denial', async ({
  page,
}) => {
  let denied = false;
  await page.route('**/api/platform/v1/workplace/explore**', (route) =>
    denied
      ? route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Access denied' }),
        })
      : fulfillSuccess(route, workplaceExploreFixture)
  );

  await page.goto('/workplace');
  await expect(page.getByText('2 physically open · 2 initial checks passed').first()).toBeVisible();
  denied = true;
  await page.getByRole('button', { name: 'Try again' }).first().click();

  await expect(page.getByText('Availability could not be verified').first()).toBeVisible();
  await expect(page.getByText('2 physically open · 2 initial checks passed')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Desk spaces physically open/u })).toHaveCount(0);
});

test('workplace home disables stale check-in commands until booking data is verified again', async ({
  page,
}) => {
  let bookingCalls = 0;
  let checkInWrites = 0;
  let releaseRefresh: (() => void) | undefined;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/check-in')) checkInWrites += 1;
  });
  await page.route('**/api/platform/v1/workplace/bookings**', async (route) => {
    bookingCalls += 1;
    if (bookingCalls === 1) return fulfillSuccess(route, [booking()]);
    await refreshGate;
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'Temporary failure' }),
    });
  });

  await page.goto('/workplace');
  const checkIn = page.getByRole('button', { name: 'Check in now' });
  await expect(checkIn).toBeVisible();
  await checkIn.focus();
  await expect(checkIn).toBeFocused();

  await page.clock.fastForward(60_010);
  await expect.poll(() => bookingCalls).toBeGreaterThanOrEqual(2);
  await expect(checkIn).toBeVisible();

  const unavailable = page.waitForResponse(
    (response) =>
      response.status() === 503 &&
      new URL(response.url()).pathname === '/api/platform/v1/workplace/bookings'
  );
  releaseRefresh?.();
  await unavailable;

  await expect(page.getByRole('button', { name: 'Check in now' })).toHaveCount(0);
  const decisionStatus = page.getByTestId('workplace-decision-status');
  await expect(decisionStatus).toHaveText(
    'The current reservation state could not be verified. Check-in is closed and no action was sent.'
  );
  await expect(decisionStatus).toBeFocused();
  expect(checkInWrites).toBe(0);

  const verifyData = page.getByRole('button', { name: 'Verify current data' }).first();
  await verifyData.focus();
  await expect(verifyData).toBeFocused();
  await page.clock.fastForward(300);
  await expect(verifyData).toBeFocused();

  await page.clock.setFixedTime(new Date('2026-08-18T23:59:00Z'));
  await page.clock.fastForward(60_000);
  await expect(page.getByRole('button', { name: 'Check in now' })).toHaveCount(0);
  expect(checkInWrites).toBe(0);
});

test('workplace home replaces an unverified check-in notice after authoritative recovery', async ({
  page,
}) => {
  const recoverableBooking = booking({
    bookingId: '40000000-0000-0000-0000-000000000030',
    resourceName: 'Recoverable check-in desk',
    startsAt: '2026-08-19T00:30:00Z',
    endsAt: '2026-08-19T02:00:00Z',
    checkInOpensAt: '2026-08-18T23:30:00Z',
    checkInClosesAt: '2026-08-19T01:00:00Z',
    canCheckIn: true,
    canRelease: false,
  });
  let source: 'READY' | 'UNAVAILABLE' | 'RECOVERING' = 'READY';
  let checkInWrites = 0;
  let releaseRecovery: (() => void) | undefined;
  let markRecoveryStarted: (() => void) | undefined;
  const recoveryGate = new Promise<void>((resolve) => {
    releaseRecovery = resolve;
  });
  const recoveryStarted = new Promise<void>((resolve) => {
    markRecoveryStarted = resolve;
  });
  await page.route('**/api/platform/v1/workplace/bookings**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST' && path.endsWith('/check-in')) {
      checkInWrites += 1;
      return route.fallback();
    }
    if (request.method() !== 'GET' || path !== '/api/platform/v1/workplace/bookings') {
      return route.fallback();
    }
    if (source === 'UNAVAILABLE') {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'UPSTREAM_UNAVAILABLE', message: 'Retry later.' }),
      });
    }
    if (source === 'RECOVERING') {
      markRecoveryStarted?.();
      await recoveryGate;
    }
    return fulfillSuccess(route, [recoverableBooking]);
  });

  await page.goto('/workplace');
  const actionId = `check-in:${recoverableBooking.bookingId}`;
  const checkIn = page
    .getByRole('button', { name: 'Check in now' })
    .and(page.locator(`[data-workplace-decision-action="${actionId}"]`));
  await expect(checkIn).toBeVisible();
  await checkIn.focus();

  source = 'UNAVAILABLE';
  const firstFailure = page.waitForResponse(
    (response) =>
      response.status() === 503 &&
      new URL(response.url()).pathname === '/api/platform/v1/workplace/bookings'
  );
  await page.clock.fastForward(60_010);
  await firstFailure;
  await page.clock.fastForward(1_100);

  const decisionStatus = page.getByTestId('workplace-decision-status');
  await expect(checkIn).toHaveCount(0);
  await expect(decisionStatus).toHaveText(
    'The current reservation state could not be verified. Check-in is closed and no action was sent.'
  );
  await expect(decisionStatus).toBeFocused();

  source = 'RECOVERING';
  await page
    .getByRole('alert')
    .filter({ hasText: 'The latest data could not be refreshed' })
    .getByRole('button', { name: 'Try again' })
    .click();
  await recoveryStarted;
  const stableFocus = page
    .getByTestId('workplace-day-brief')
    .getByRole('link', { name: 'Find a space' });
  await stableFocus.focus();
  await expect(stableFocus).toBeFocused();
  releaseRecovery?.();

  await expect(checkIn).toBeVisible();
  await expect(decisionStatus).toHaveText(
    'The current reservation state is verified again. Check-in is available.'
  );
  await expect(stableFocus).toBeFocused();
  await expect(decisionStatus).not.toBeFocused();
  expect(checkInWrites).toBe(0);

  source = 'UNAVAILABLE';
  const secondFailure = page.waitForResponse(
    (response) =>
      response.status() === 503 &&
      new URL(response.url()).pathname === '/api/platform/v1/workplace/bookings'
  );
  await page.clock.fastForward(60_010);
  await secondFailure;
  await page.clock.fastForward(1_100);

  await expect(checkIn).toHaveCount(0);
  await expect(decisionStatus).toHaveText(
    'The current reservation state could not be verified. Check-in is closed and no action was sent.'
  );
  await expect(stableFocus).toBeFocused();
  await expect(decisionStatus).not.toBeFocused();
  expect(checkInWrites).toBe(0);

  source = 'READY';
  await page
    .getByRole('alert')
    .filter({ hasText: 'The latest data could not be refreshed' })
    .getByRole('button', { name: 'Try again' })
    .click();
  await expect(checkIn).toBeVisible();
  await expect(decisionStatus).toHaveText(
    'The current reservation state is verified again. Check-in is available.'
  );
  await expect(decisionStatus).not.toBeFocused();

  await checkIn.click();
  await expect(page.getByText('You checked in to the space.')).toBeVisible();
  await expect(decisionStatus).toHaveText('');
  expect(checkInWrites).toBe(1);
});

test('workplace home uses an accurate read-only booking action', async ({ page }) => {
  await page.route('**/api/auth/permissions', (route) =>
    fulfillSuccess(route, READ_ONLY_WORKPLACE_PERMISSIONS)
  );

  await page.goto('/workplace');
  await expect(page.getByRole('button', { name: 'Check in now' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'View booking' })).toBeVisible();
  await expect(
    page.getByText('This account can view the booking but does not have permission to check in.')
  ).toBeVisible();
});

test('workplace home separates open spaces from booking eligibility for read-only members', async ({
  page,
}) => {
  await page.route('**/api/auth/permissions', (route) =>
    fulfillSuccess(route, READ_ONLY_WORKPLACE_PERMISSIONS)
  );
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/rooms/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/calendar/home**', (route) =>
    fulfillSuccess(route, {
      ...workplaceCalendarHome,
      nextEvent: null,
      today: [],
      attention: [],
    })
  );

  await page.goto('/workplace');

  await expect(
    page.getByRole('heading', { name: 'Browse the floor before choosing your next space' })
  ).toBeVisible();
  await expect(page.getByText('2 spaces are physically open.')).toBeVisible();
  await expect(page.getByText('2 physically open · 0 initial checks passed').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Find a space' }).first()).toBeVisible();
});

test('workplace home preserves its verified 60-minute scope when opening discovery', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:38.500Z'));
  const ranges: Array<{ from: string | null; to: string | null }> = [];
  await page.route('**/api/platform/v1/workplace/explore**', (route) => {
    const url = new URL(route.request().url());
    ranges.push({ from: url.searchParams.get('from'), to: url.searchParams.get('to') });
    return fulfillSuccess(route, workplaceExploreFixture);
  });
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/rooms/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/calendar/home**', (route) =>
    fulfillSuccess(route, {
      ...workplaceCalendarHome,
      nextEvent: null,
      today: [],
      attention: [],
    })
  );

  await page.goto('/workplace');
  const link = page.getByTestId('workplace-day-brief').getByRole('link', { name: 'Find a space' });
  await expect(link).toHaveAttribute(
    'href',
    `/workplace/explore?site=${site.siteId}&floor=${floor.floorId}&date=2026-08-19&time=09%3A01&duration=60&type=DESK`
  );
  const exploreRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === '/api/platform/v1/workplace/explore' && url.searchParams.has('from');
  });
  await link.click();
  const request = await exploreRequest;
  const url = new URL(request.url());

  expect(ranges[0]).toEqual({
    from: '2026-08-19T00:01:00Z',
    to: '2026-08-19T01:01:00Z',
  });
  expect(url.searchParams.get('from')).toBe(ranges[0]?.from);
  expect(url.searchParams.get('to')).toBe(ranges[0]?.to);
  await expect(page).toHaveURL(/site=10000000-0000-0000-0000-000000000001/u);
  await expect(page).toHaveURL(/floor=20000000-0000-0000-0000-000000000012/u);
  await expect(page).toHaveURL(/duration=60/u);
  await expect(page).toHaveURL(/type=DESK/u);
});

test('workplace home keeps eligibility attached to the verified range during a delayed rollover', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:38.500Z'));
  let exploreCalls = 0;
  let refreshedFrom: string | null = null;
  let releaseRefresh: (() => void) | undefined;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  await page.route('**/api/platform/v1/workplace/explore**', async (route) => {
    exploreCalls += 1;
    if (exploreCalls > 1) {
      refreshedFrom = new URL(route.request().url()).searchParams.get('from');
      await refreshGate;
      return fulfillSuccess(route, {
        ...workplaceExploreFixture,
        occupancy: [
          {
            resourceId: resource.resourceId,
            bookingId: '40000000-0000-0000-0000-000000000099',
            startsAt: '2026-08-19T01:00:00Z',
            endsAt: '2026-08-19T01:30:00Z',
            status: 'RESERVED',
            bookedByDisplayName: null,
            currentUser: false,
          },
          {
            resourceId: unplacedResource.resourceId,
            bookingId: '40000000-0000-0000-0000-000000000100',
            startsAt: '2026-08-19T01:00:00Z',
            endsAt: '2026-08-19T01:30:00Z',
            status: 'RESERVED',
            bookedByDisplayName: null,
            currentUser: false,
          },
        ],
        generatedAt: '2026-08-19T00:01:00Z',
      });
    }
    return fulfillSuccess(route, workplaceExploreFixture);
  });
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/rooms/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/calendar/home**', (route) =>
    fulfillSuccess(route, {
      ...workplaceCalendarHome,
      nextEvent: null,
      today: [],
      attention: [],
    })
  );

  await page.goto('/workplace');
  const discovery = page
    .getByTestId('workplace-day-brief')
    .getByRole('link', { name: 'Find a space' });
  await expect(discovery).toHaveAttribute('href', /time=09%3A01/u);

  await page.clock.setFixedTime(new Date('2026-08-19T00:01:00.100Z'));
  await page.clock.fastForward(21_600);
  await expect.poll(() => exploreCalls).toBeGreaterThanOrEqual(2);
  expect(refreshedFrom).toBe('2026-08-19T00:02:00Z');
  await expect(discovery).not.toHaveAttribute('href', /time=/u);
  await expect(page.getByText('2 physically open · 0 initial checks passed')).toBeVisible();

  const refreshed = page.waitForResponse(
    (response) =>
      response.ok() && new URL(response.url()).pathname === '/api/platform/v1/workplace/explore'
  );
  releaseRefresh?.();
  await refreshed;
  await expect(discovery).toHaveAttribute('href', /time=09%3A02/u);
  await expect(page.getByText('0 physically open · 0 initial checks passed')).toBeVisible();
});

test('workplace home only raises room-needed attention for actionable full-detail meetings', async ({
  page,
}) => {
  const actionable = {
    ...CALENDAR_EVENT_FIXTURE,
    eventId: 'room-needed-actionable',
    title: 'Actionable planning',
    startsAt: '2026-08-19T02:00:00Z',
    endsAt: '2026-08-19T03:00:00Z',
    location: null,
    conferenceUrl: null,
    recurrence: 'NONE',
    recurrenceUntil: null,
    detailLevel: 'FULL',
    redacted: false,
    allDay: false,
    myResponse: 'ACCEPTED',
    capabilities: { ...CALENDAR_EVENT_FIXTURE.capabilities, canEdit: true },
  } as const;
  const events = [
    {
      ...actionable,
      eventId: 'room-needed-free-busy',
      title: 'Busy',
      detailLevel: 'FREE_BUSY',
      redacted: true,
      capabilities: {
        canViewDetails: false,
        canEdit: false,
        canDelete: false,
        canRestore: false,
        canRespond: false,
        canStar: false,
      },
    },
    {
      ...actionable,
      eventId: 'room-needed-read-only',
      title: 'Read-only planning',
      capabilities: { ...actionable.capabilities, canEdit: false },
    },
    {
      ...actionable,
      eventId: 'room-needed-declined',
      title: 'Declined planning',
      myResponse: 'DECLINED',
    },
    {
      ...actionable,
      eventId: 'room-needed-all-day',
      title: 'All-day planning',
      allDay: true,
    },
    {
      ...actionable,
      eventId: 'room-needed-ongoing',
      title: 'Ongoing planning',
      startsAt: '2026-08-18T23:45:00Z',
      endsAt: '2026-08-19T00:15:00Z',
    },
    {
      ...actionable,
      eventId: 'room-needed-starting-now',
      title: 'Starting now planning',
      startsAt: '2026-08-19T00:00:00Z',
      endsAt: '2026-08-19T01:00:00Z',
    },
    actionable,
  ];
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/rooms/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/calendar/home**', (route) =>
    fulfillSuccess(route, {
      ...workplaceCalendarHome,
      nextEvent: events[0],
      today: events,
      attention: [],
    })
  );

  await page.goto('/workplace');
  await expect(page.getByText('Actionable planning still needs a room')).toBeVisible();
  await expect(page.getByText('Busy still needs a room')).toHaveCount(0);
  await expect(page.getByText('Read-only planning still needs a room')).toHaveCount(0);
  await expect(page.getByText('Declined planning still needs a room')).toHaveCount(0);
  await expect(page.getByText('All-day planning still needs a room')).toHaveCount(0);
  await expect(page.getByText('Ongoing planning still needs a room')).toHaveCount(0);
  await expect(page.getByText('Starting now planning still needs a room')).toHaveCount(0);
});

test('workplace home removes room-needed attention at the meeting start boundary', async ({
  page,
}) => {
  const boundaryMeeting = {
    ...CALENDAR_EVENT_FIXTURE,
    eventId: 'room-needed-boundary',
    title: 'Boundary planning',
    startsAt: '2026-08-19T00:00:30Z',
    endsAt: '2026-08-19T01:00:00Z',
    location: null,
    conferenceUrl: null,
    detailLevel: 'FULL',
    redacted: false,
    allDay: false,
    myResponse: 'ACCEPTED',
    capabilities: { ...CALENDAR_EVENT_FIXTURE.capabilities, canEdit: true },
  } as const;
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/rooms/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/calendar/home**', (route) =>
    fulfillSuccess(route, {
      ...workplaceCalendarHome,
      nextEvent: boundaryMeeting,
      today: [boundaryMeeting],
      attention: [],
    })
  );

  await page.goto('/workplace');
  await expect(page.getByText('Boundary planning still needs a room')).toBeVisible();

  await page.clock.setFixedTime(new Date('2026-08-19T00:00:30.050Z'));
  await page.clock.fastForward(30_050);
  await expect(page.getByText('Boundary planning still needs a room')).toHaveCount(0);
});

test('workplace home transfers focused release attention at the reservation end boundary', async ({
  page,
}) => {
  const checkInBooking = booking({
    bookingId: '40000000-0000-0000-0000-000000000031',
    resourceName: 'Boundary check-in desk',
    startsAt: '2026-08-18T23:45:00Z',
    endsAt: '2026-08-19T00:00:30Z',
    canCheckIn: true,
    canRelease: false,
    checkInOpensAt: '2026-08-18T23:30:00Z',
    checkInClosesAt: '2026-08-19T00:10:00Z',
  });
  const releaseBooking = booking({
    bookingId: '40000000-0000-0000-0000-000000000032',
    resourceName: 'Boundary release desk',
    startsAt: '2026-08-18T23:30:00Z',
    endsAt: '2026-08-19T00:00:30Z',
    canCheckIn: false,
    canRelease: true,
  });
  let bookingCalls = 0;
  let checkInWrites = 0;
  let releaseWrites = 0;
  let recoverBookings = false;
  let releaseRefresh: (() => void) | undefined;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  await page.route('**/api/platform/v1/workplace/bookings**', async (route) => {
    bookingCalls += 1;
    if (bookingCalls === 1) {
      return fulfillSuccess(route, [checkInBooking, releaseBooking]);
    }
    if (recoverBookings) return fulfillSuccess(route, [checkInBooking, releaseBooking]);
    await refreshGate;
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'UPSTREAM_UNAVAILABLE', message: 'Retry later.' }),
    });
  });
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/check-in')) checkInWrites += 1;
    if (request.method() === 'POST' && request.url().endsWith('/release')) releaseWrites += 1;
  });
  await page.route('**/api/platform/v1/rooms/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/calendar/home**', (route) =>
    fulfillSuccess(route, { ...workplaceCalendarHome, nextEvent: null, today: [], attention: [] })
  );

  await page.goto('/workplace');
  await expect(page.getByRole('button', { name: 'Check in now' })).toBeVisible();
  await expect(page.getByText('You can release Boundary release desk')).toBeVisible();
  const releaseAttention = page.locator(
    `[data-workplace-decision-action="release:${releaseBooking.bookingId}"]`
  );
  await releaseAttention.focus();
  await expect(releaseAttention).toBeFocused();

  await page.clock.setFixedTime(new Date('2026-08-19T00:00:30.050Z'));
  await page.clock.fastForward(30_050);
  await expect.poll(() => bookingCalls).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('button', { name: 'Check in now' })).toHaveCount(0);
  await expect(page.getByText('You can release Boundary release desk')).toHaveCount(0);
  const decisionStatus = page.getByTestId('workplace-decision-status');
  await expect(decisionStatus).toHaveText(
    'The reservation has ended. Release is closed and no action was sent.'
  );
  await expect(decisionStatus).toBeFocused();
  expect(checkInWrites).toBe(0);
  expect(releaseWrites).toBe(0);

  const unavailable = page.waitForResponse(
    (response) =>
      response.status() === 503 &&
      new URL(response.url()).pathname === '/api/platform/v1/workplace/bookings'
  );
  releaseRefresh?.();
  await unavailable;
  await page.clock.fastForward(2_000);
  await expect(page.getByRole('button', { name: 'Check in now' })).toHaveCount(0);
  await expect(page.getByText('You can release Boundary release desk')).toHaveCount(0);
  await expect(decisionStatus).toBeFocused();
  expect(checkInWrites).toBe(0);
  expect(releaseWrites).toBe(0);

  recoverBookings = true;
  const recovered = page.waitForResponse(
    (response) =>
      response.status() === 200 &&
      new URL(response.url()).pathname === '/api/platform/v1/workplace/bookings'
  );
  await page.clock.setFixedTime(new Date('2026-08-18T23:59:00Z'));
  await page.clock.fastForward(60_000);
  await recovered;
  await expect(page.getByRole('button', { name: 'Check in now' })).toHaveCount(0);
  await expect(page.getByText('You can release Boundary release desk')).toHaveCount(0);
  expect(checkInWrites).toBe(0);
  expect(releaseWrites).toBe(0);
});

test('workplace home closes cached room-policy eligibility until recovery', async ({ page }) => {
  const mappedRoom = {
    ...resource,
    resourceId: '30000000-0000-0000-0000-000000000023',
    calendarResourceId: CALENDAR_RESOURCES_FIXTURE[0].resourceId,
    code: 'R-HOME',
    name: 'Home mapped room',
    nameKo: '홈 연결 회의실',
    nameEn: 'Home mapped room',
    type: 'ROOM',
    capacity: 8,
  };
  let policyUnavailable = false;
  let failedPolicyCalls = 0;
  await page.route('**/api/platform/v1/workplace/explore**', (route) =>
    fulfillSuccess(route, {
      ...workplaceExploreFixture,
      resources: [mappedRoom],
    })
  );
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/rooms/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/calendar/home**', (route) =>
    fulfillSuccess(route, {
      ...workplaceCalendarHome,
      nextEvent: null,
      today: [],
      attention: [],
    })
  );
  await page.route('**/api/platform/v1/rooms/policy', (route) => {
    if (!policyUnavailable) return route.fallback();
    failedPolicyCalls += 1;
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/workplace');
  await expect(
    page.getByRole('heading', { name: 'Choose the space that fits the work' })
  ).toBeVisible();
  await expect(page.getByText('1 physically open · 1 initial checks passed').first()).toBeVisible();

  policyUnavailable = true;
  await page.clock.fastForward(60_500);
  await expect.poll(() => failedPolicyCalls).toBeGreaterThanOrEqual(1);
  await page.clock.fastForward(2_000);
  await expect(
    page.getByRole('heading', { name: 'Refresh availability before choosing a space' })
  ).toBeVisible();
  await expect(page.getByText('1 physically open · 0 initial checks passed').first()).toBeVisible();

  policyUnavailable = false;
  await page.getByRole('button', { name: 'Verify current data' }).click();
  await expect(
    page.getByRole('heading', { name: 'Choose the space that fits the work' })
  ).toBeVisible();
  await expect(page.getByText('1 physically open · 1 initial checks passed').first()).toBeVisible();
});

test('Workplace booking deep links focus the requested personal and meeting reservation', async ({
  page,
}) => {
  await page.goto(`/workplace/my-bookings?booking=${booking().bookingId}`);
  await expect(page.getByTestId(`workplace-booking-${booking().bookingId}`)).toBeFocused();

  await page.goto(`/workplace/my-meetings?event=${ROOM_BOOKING_EVENT_FIXTURE.eventId}`);
  await expect(
    page.getByTestId(`room-booking-${ROOM_BOOKING_EVENT_FIXTURE.eventId}`)
  ).toBeFocused();
});

test('members discover and book a workspace using tenant policy and site time zone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/workplace/explore');

  await expect(page.getByRole('heading', { name: 'Find a space', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Start time')).toContainText('09:30');
  await page
    .getByRole('button', {
      name: /^Focus desk 12.*Physically open.*Initial booking checks passed$/u,
    })
    .click();
  await expect(page).toHaveURL(/resource=30000000-0000-0000-0000-000000000012/u);
  await page.getByRole('button', { name: 'Book this space' }).click();

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

test('discovery routes create permission to the resource booking owner', async ({ page }) => {
  const mixedPermissions = FULL_PRODUCT_PERMISSIONS.filter(
    (permission) =>
      permission.resourceKey !== 'APP.WORKPLACE' || permission.permissionCode === 'VIEW'
  );
  const mappedRoom = {
    ...resource,
    resourceId: '30000000-0000-0000-0000-000000000024',
    calendarResourceId: CALENDAR_RESOURCES_FIXTURE[0].resourceId,
    code: 'R-MIXED',
    name: 'Rooms-owned space',
    nameKo: '회의실 소유 공간',
    nameEn: 'Rooms-owned space',
    type: 'ROOM',
    capacity: 8,
  };
  await page.route('**/api/auth/permissions', (route) => fulfillSuccess(route, mixedPermissions));
  await page.route('**/api/platform/v1/workplace/explore**', (route) =>
    fulfillSuccess(route, {
      ...workplaceExploreFixture,
      resources: [resource, mappedRoom],
    })
  );

  await page.goto(
    `/workplace/explore?site=${site.siteId}&floor=${floor.floorId}&date=2026-08-19&time=09%3A30`
  );
  await expect(page.getByText('1 pass initial booking checks')).toBeVisible();
  await page
    .getByRole('button', {
      name: /^Rooms-owned space.*Physically open.*Initial booking checks passed$/u,
    })
    .click();
  await expect(page.getByRole('button', { name: 'Book this space' })).toBeEnabled();
  await page.getByRole('button', { name: 'Close' }).click();
  await page
    .getByRole('button', { name: /^Focus desk 12.*Physically open.*Booking unavailable$/u })
    .click();
  await expect(page.getByRole('button', { name: 'Book this space' })).toBeDisabled();
  await expect(
    page.getByText('Your current role can view availability but cannot create Workplace bookings.')
  ).toBeVisible();
});

test('discovery applies the Workplace owner policy before enabling a booking action', async ({
  page,
}) => {
  await page.goto(
    `/workplace/explore?site=${site.siteId}&floor=${floor.floorId}&date=2026-08-19&time=13%3A00&duration=480`
  );

  await expect(page.getByText('0 pass initial booking checks')).toBeVisible();
  await page
    .getByRole('button', { name: /^Focus desk 12.*Physically open.*Booking unavailable$/u })
    .click();
  await expect(page.getByRole('button', { name: 'Book this space' })).toBeDisabled();
  await expect(
    page.getByText(
      'The selected time is outside the booking policy for this space. Adjust the date, time, or duration.'
    )
  ).toBeVisible();
});

for (const failure of [
  { label: 'forbidden', status: 403, errorCode: 'FORBIDDEN' },
  { label: 'expired scope', status: 409, errorCode: 'SCOPE_CONTEXT_EXPIRED' },
  {
    label: 'authority resolution unavailable',
    status: 503,
    errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
  },
]) {
  test(`discovery discards the same-query snapshot after ${failure.label}`, async ({ page }) => {
    let failed = false;
    await page.route('**/api/platform/v1/workplace/explore**', (route) =>
      failed
        ? route.fulfill({
            status: failure.status,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Authority could not be verified',
              errorCode: failure.errorCode,
            }),
          })
        : fulfillSuccess(route, workplaceExploreFixture)
    );

    await page.goto(
      `/workplace/explore?site=${site.siteId}&floor=${floor.floorId}&date=2026-08-19&time=09%3A30`
    );
    await page
      .getByRole('button', {
        name: /^Focus desk 12.*Physically open.*Initial booking checks passed$/u,
      })
      .click();
    await expect(page.getByRole('button', { name: 'Book this space' })).toBeEnabled();

    failed = true;
    const deniedResponse = page.waitForResponse(
      (response) =>
        response.status() === failure.status &&
        new URL(response.url()).pathname === '/api/platform/v1/workplace/explore'
    );
    await page.clock.fastForward(60_500);
    await deniedResponse;

    await expect(page.getByText('Workplace availability could not be loaded.')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Focus desk 12/u })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Book this space' })).toHaveCount(0);
    await expect(page.getByText('2 pass initial booking checks')).toHaveCount(0);
  });
}

test('discovery keeps booking closed until a cross-time-zone query is freshly verified', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    timezoneId: 'America/Los_Angeles',
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockWorkplace(page);
  let calls = 0;
  let releaseSiteTimeZone: (() => void) | undefined;
  const siteTimeZoneGate = new Promise<void>((resolve) => {
    releaseSiteTimeZone = resolve;
  });
  await page.route('**/api/platform/v1/workplace/explore**', async (route) => {
    calls += 1;
    if (calls > 1) await siteTimeZoneGate;
    return fulfillSuccess(route, workplaceExploreFixture);
  });

  await page.goto(
    `/workplace/explore?site=${site.siteId}&floor=${floor.floorId}&date=2026-08-19&time=09%3A30`
  );
  await page
    .getByRole('button', { name: /^Focus desk 12.*Physically open.*Booking unavailable$/u })
    .click();

  await expect(page.getByRole('button', { name: 'Book this space' })).toBeDisabled();
  await expect(
    page.getByText(
      'Availability for the new search criteria is still loading. Booking will be enabled after verification.'
    )
  ).toBeVisible();

  releaseSiteTimeZone?.();
  await expect(page.getByRole('button', { name: 'Book this space' })).toBeEnabled();
  await context.close();
});

test('discovery uses one eligibility contract for count, order, and booking actions', async ({
  page,
}) => {
  const assignedResource = {
    ...resource,
    resourceId: '30000000-0000-0000-0000-000000000020',
    code: 'D-ASSIGNED',
    name: 'Assigned desk',
    nameKo: '고정 좌석',
    nameEn: 'Assigned desk',
    mode: 'ASSIGNED',
    assignedUserId: 22,
    assignedDisplayName: 'Confidential colleague',
  };
  const unmappedRoom = {
    ...resource,
    resourceId: '30000000-0000-0000-0000-000000000021',
    code: 'R-UNMAPPED',
    name: 'Unmapped room',
    nameKo: '미연결 회의실',
    nameEn: 'Unmapped room',
    type: 'ROOM',
    capacity: 8,
  };
  await page.route('**/api/platform/v1/workplace/explore**', (route) =>
    fulfillSuccess(route, {
      ...workplaceExploreFixture,
      resources: [assignedResource, unmappedRoom, resource],
    })
  );

  await page.goto(
    `/workplace/explore?site=${site.siteId}&floor=${floor.floorId}&date=2026-08-19&time=09%3A30`
  );
  await expect(page.getByText('1 pass initial booking checks')).toBeVisible();
  const results = page.locator('[aria-labelledby="workplace-discovery-results"]');
  await expect(results.getByRole('button').first()).toContainText('Focus desk 12');

  await page
    .getByRole('button', { name: /^Assigned desk.*Assigned.*Booking unavailable$/u })
    .click();
  await expect(page.getByText('Assigned desk is assigned and cannot be reserved')).toBeVisible();
  await expect(page.getByText('Confidential colleague')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();

  await page
    .getByRole('button', { name: /^Unmapped room.*Physically open.*Booking unavailable$/u })
    .click();
  await expect(
    page.getByText('This room is not yet linked to its calendar resource and cannot be booked.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book this space' })).toBeDisabled();
});

test('cached room policy refresh failures close Explore booking until recovery', async ({
  page,
}) => {
  const mappedRoom = {
    ...resource,
    resourceId: '30000000-0000-0000-0000-000000000022',
    calendarResourceId: CALENDAR_RESOURCES_FIXTURE[0].resourceId,
    code: 'R-MAPPED',
    name: 'Mapped room',
    nameKo: '연결 회의실',
    nameEn: 'Mapped room',
    type: 'ROOM',
    capacity: 8,
  };
  let policyUnavailable = false;
  let failedPolicyCalls = 0;
  await page.route('**/api/platform/v1/workplace/explore**', (route) =>
    fulfillSuccess(route, {
      ...workplaceExploreFixture,
      resources: [mappedRoom],
    })
  );
  await page.route('**/api/platform/v1/rooms/policy', (route) => {
    if (!policyUnavailable) return route.fallback();
    failedPolicyCalls += 1;
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });

  await page.goto(
    `/workplace/explore?site=${site.siteId}&floor=${floor.floorId}&date=2026-08-19&time=09%3A30`
  );
  await expect(page.getByText('1 pass initial booking checks')).toBeVisible();
  await page
    .getByRole('button', {
      name: /^Mapped room.*Physically open.*Initial booking checks passed$/u,
    })
    .click();
  await expect(page.getByRole('button', { name: 'Book this space' })).toBeEnabled();
  await page.getByRole('button', { name: 'Close' }).click();

  policyUnavailable = true;
  await page.clock.fastForward(60_500);
  await expect.poll(() => failedPolicyCalls).toBeGreaterThanOrEqual(1);
  await page.clock.fastForward(2_000);

  await expect(
    page.getByText(
      'The latest meeting-room policy could not be refreshed. The last verified policy is shown for reference, and room booking remains paused until recovery.'
    )
  ).toBeVisible();
  await expect(page.getByText('0 pass initial booking checks')).toBeVisible();
  await page
    .getByRole('button', { name: /^Mapped room.*Physically open.*Booking unavailable$/u })
    .click();
  await expect(page.getByRole('button', { name: 'Book this space' })).toBeDisabled();
  await expect(
    page.getByText(
      'The meeting-room booking policy is unavailable. Room booking is disabled until it is restored.'
    )
  ).toBeVisible();

  policyUnavailable = false;
  await page.getByRole('button', { name: 'Try again' }).first().click();
  await expect(page.getByText('1 pass initial booking checks')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book this space' })).toBeEnabled();
});

test('Korean discovery reflows at 200 percent text and preserves keyboard access', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockWorkplace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/workplace/explore');

  await expect(page.getByRole('heading', { name: '공간 찾기', level: 1 })).toBeVisible();
  const search = page.getByLabel('공간, 구역 또는 설비 검색');
  await search.focus();
  await page.keyboard.press('Tab');
  const dateGroup = page.getByRole('group', { name: '날짜' });
  await expect
    .poll(() => dateGroup.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport);

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('workplace-explore-ko-390-text-200.png'),
    fullPage: true,
  });
});

test('discovery preserves filter context and never fabricates an unregistered floor plan', async ({
  page,
}) => {
  const runtimeProblems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      runtimeProblems.push(message.text());
    }
  });
  page.on('pageerror', (error) => runtimeProblems.push(error.message));
  await page.goto('/workplace/explore?q=Focus&type=DESK&accessible=true&view=map');

  await expect(page.getByLabel('Search spaces, neighborhoods, or amenities')).toHaveValue('Focus');
  await expect(page.getByRole('checkbox', { name: 'Accessible spaces only' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Map view' })).toBeDisabled();
  await expect(page.getByText('A floor plan has not been registered for this floor')).toBeVisible();
  await expect(page.getByRole('button', { name: /Focus desk 12/u })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Search spaces, neighborhoods, or amenities')).toHaveValue('Focus');
  await expect(page.getByRole('checkbox', { name: 'Accessible spaces only' })).toBeChecked();
  expect(runtimeProblems).toEqual([]);
});

test('registered floor plans keep map selection and keyboard focus synchronized', async ({
  page,
}, testInfo) => {
  const floorPlanMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760">
      <rect width="1200" height="760" fill="#f4f7f8"/>
      <path d="M80 90h1040v580H80z" fill="#ffffff" stroke="#b8c6cc" stroke-width="6"/>
      <path d="M390 90v580M780 90v580M80 380h1040" fill="none" stroke="#d5dfe3" stroke-width="4"/>
      <path d="M570 90v36M570 344v72M570 634v36" stroke="#188174" stroke-width="12"/>
    </svg>`;
  const mappedFloor = {
    ...floor,
    backgroundAssetPath: `data:image/svg+xml,${encodeURIComponent(floorPlanMarkup)}`,
  };
  await page.route('**/api/platform/v1/workplace/explore**', (route) =>
    fulfillSuccess(route, {
      sites: [site],
      floors: [mappedFloor],
      selectedFloor: mappedFloor,
      resources: [resource, unplacedResource],
      occupancy: [],
      policy,
      generatedAt: '2026-08-19T00:00:00Z',
    })
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/workplace/explore?view=map');

  const floorPlan = page.getByTestId('workplace-floor-plan');
  await expect(floorPlan).toBeVisible();
  const floorPlanBox = await floorPlan.boundingBox();
  expect(floorPlanBox).not.toBeNull();
  expect(
    Math.abs(floorPlanBox!.width / floorPlanBox!.height - floor.planWidth / floor.planHeight)
  ).toBeLessThan(0.03);
  const mapOptions = floorPlan.getByRole('option');
  await expect(mapOptions).toHaveCount(2);
  await expect(floorPlan.locator('[tabindex="0"]')).toHaveCount(1);

  await mapOptions.first().focus();
  await mapOptions.first().press('ArrowRight');
  await expect(mapOptions.nth(1)).toBeFocused();
  await mapOptions.nth(1).click();
  await expect(page).toHaveURL(new RegExp(`resource=${unplacedResource.resourceId}`, 'u'));

  await page.screenshot({
    path: testInfo.outputPath('workplace-map-1440.png'),
    fullPage: true,
  });
});

test('booking retries preserve the idempotency key for the same user intent', async ({ page }) => {
  const keys: string[] = [];
  let attempts = 0;
  await page.route('**/api/platform/v1/workplace/bookings', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.fallback();
    keys.push(request.headers()['idempotency-key'] ?? '');
    attempts += 1;
    if (attempts === 1) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    }
    return fulfillSuccess(route, booking(request.postDataJSON()));
  });

  await page.goto('/workplace/explore');
  await page
    .getByRole('button', {
      name: /^Focus desk 12.*Physically open.*Initial booking checks passed$/u,
    })
    .click();
  await page.getByRole('button', { name: 'Book this space' }).click();
  const dialog = page.getByRole('dialog', { name: 'Book a workspace' });
  await dialog.getByLabel('Purpose').fill('Retry-safe booking');
  const submit = dialog.getByRole('button', { name: 'Book', exact: true });
  await submit.click();
  await expect.poll(() => keys.length).toBe(1);
  await expect(dialog).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(() => keys.length).toBe(2);

  await expect(dialog).toBeHidden();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});

test('changed search criteria keep previous results read-only until availability is verified', async ({
  page,
}) => {
  await page.goto('/workplace/explore');
  await page
    .getByRole('button', {
      name: /^Focus desk 12.*Physically open.*Initial booking checks passed$/u,
    })
    .click();
  await expect(page.getByRole('button', { name: 'Book this space' })).toBeEnabled();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.route('**/api/platform/v1/workplace/explore**', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
  );
  await page.getByLabel('Duration').click();
  await page.getByRole('option', { name: '90 min' }).click();
  await page.getByRole('button', { name: /^Focus desk 12.*Physically open/u }).click();

  await expect(page.getByRole('button', { name: 'Book this space' })).toBeDisabled();
  await expect(
    page.getByText(
      'Live availability could not be refreshed. Review is available, but booking is disabled until the connection is restored.'
    )
  ).toBeVisible();
});

test('authoritative access rejection discards previously visible Workplace data', async ({
  page,
}) => {
  await page.goto('/workplace/explore');
  await expect(page.getByText('Focus desk 12', { exact: true })).toBeVisible();

  await page.route('**/api/platform/v1/workplace/explore**', (route) =>
    route.fulfill({ status: 403, contentType: 'application/json', body: '{}' })
  );
  await page.getByLabel('Duration').click();
  await page.getByRole('option', { name: '90 min' }).click();

  await expect(page.getByText('Workplace availability could not be loaded.')).toBeVisible();
  await expect(page.getByText('Focus desk 12', { exact: true })).toHaveCount(0);
});

test('background refresh failures keep the last successful Workplace data visible', async ({
  page,
}) => {
  await page.goto('/workplace');
  await expect(page.getByText(/Focus desk 12/u).first()).toBeVisible();
  await page.route('**/api/platform/v1/workplace/explore**', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
  );

  await page.getByRole('button', { name: 'Try again' }).click();

  await expect(
    page
      .getByRole('alert')
      .getByText(
        'The latest data could not be refreshed. The last successful results remain visible.'
      )
  ).toBeVisible();
  await expect(page.getByText(/Focus desk 12/u).first()).toBeVisible();
});

test('members receive server-authoritative booking actions', async ({ page }) => {
  const releaseBooking = booking({
    bookingId: '40000000-0000-0000-0000-000000000041',
    resourceName: 'My bookings release desk',
    startsAt: '2026-08-18T23:30:00Z',
    endsAt: '2026-08-19T00:00:30Z',
    canCheckIn: false,
    canCancel: false,
    canRelease: true,
  });
  let bookingCalls = 0;
  let releaseWrites = 0;
  let releaseRefresh: (() => void) | undefined;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/release')) releaseWrites += 1;
  });
  await page.route('**/api/platform/v1/workplace/bookings**', async (route) => {
    const request = route.request();
    if (
      request.method() !== 'GET' ||
      new URL(request.url()).pathname !== '/api/platform/v1/workplace/bookings'
    ) {
      return route.fallback();
    }
    bookingCalls += 1;
    if (bookingCalls === 1) return fulfillSuccess(route, [booking(), releaseBooking]);
    await refreshGate;
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'UPSTREAM_UNAVAILABLE', message: 'Retry later.' }),
    });
  });

  await page.goto('/workplace/my-bookings');
  await expect(page.getByRole('heading', { name: 'My space bookings', level: 1 })).toBeVisible();
  await expect(page.getByText('Focus desk 12', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel booking' })).toBeVisible();
  await page.getByRole('button', { name: 'Release' }).click();
  const releaseDialog = page.getByRole('dialog', { name: 'Release this space?' });
  await expect(releaseDialog).toBeVisible();

  await page.clock.setFixedTime(new Date('2026-08-19T00:00:30.050Z'));
  await page.clock.fastForward(30_050);
  await expect.poll(() => bookingCalls).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('dialog', { name: 'Release this space?' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Release' })).toHaveCount(0);
  const decisionStatus = page.getByTestId('workplace-booking-decision-status');
  await expect(decisionStatus).toHaveText(
    'The reservation has ended. Release is closed and no action was sent.'
  );
  await expect(decisionStatus).toBeFocused();
  expect(releaseWrites).toBe(0);

  const unavailable = page.waitForResponse(
    (response) =>
      response.status() === 503 &&
      new URL(response.url()).pathname === '/api/platform/v1/workplace/bookings'
  );
  releaseRefresh?.();
  await unavailable;
  await page.clock.setFixedTime(new Date('2026-08-18T23:59:00Z'));
  await page.clock.fastForward(60_000);
  await expect(page.getByRole('button', { name: 'Release' })).toHaveCount(0);
  expect(releaseWrites).toBe(0);
});

test('my bookings replaces an unverified release notice after authoritative recovery', async ({
  page,
}) => {
  const recoverableBooking = booking({
    bookingId: '40000000-0000-0000-0000-000000000042',
    resourceName: 'Recoverable release desk',
    startsAt: '2026-08-18T23:30:00Z',
    endsAt: '2026-08-19T01:30:00Z',
    canCheckIn: false,
    canCancel: false,
    canRelease: true,
  });
  let source: 'READY' | 'UNAVAILABLE' | 'RECOVERING' = 'READY';
  let releaseWrites = 0;
  let releaseRecovery: (() => void) | undefined;
  let markRecoveryStarted: (() => void) | undefined;
  const recoveryGate = new Promise<void>((resolve) => {
    releaseRecovery = resolve;
  });
  const recoveryStarted = new Promise<void>((resolve) => {
    markRecoveryStarted = resolve;
  });
  await page.route('**/api/platform/v1/workplace/bookings**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST' && path.endsWith('/release')) {
      releaseWrites += 1;
      return route.fallback();
    }
    if (request.method() !== 'GET' || path !== '/api/platform/v1/workplace/bookings') {
      return route.fallback();
    }
    if (source === 'UNAVAILABLE') {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'UPSTREAM_UNAVAILABLE', message: 'Retry later.' }),
      });
    }
    if (source === 'RECOVERING') {
      markRecoveryStarted?.();
      await recoveryGate;
    }
    return fulfillSuccess(route, [recoverableBooking]);
  });

  await page.goto('/workplace/my-bookings');
  const actionId = `release:${recoverableBooking.bookingId}`;
  const release = page.locator(`[data-workplace-decision-action="${actionId}"]`);
  await expect(release).toBeVisible();
  await release.focus();

  source = 'UNAVAILABLE';
  const firstFailure = page.waitForResponse(
    (response) =>
      response.status() === 503 &&
      new URL(response.url()).pathname === '/api/platform/v1/workplace/bookings'
  );
  await page.clock.fastForward(60_010);
  await firstFailure;
  await page.clock.fastForward(1_100);

  const decisionStatus = page.getByTestId('workplace-booking-decision-status');
  await expect(release).toHaveCount(0);
  await expect(decisionStatus).toHaveText(
    'The current reservation state could not be verified. Release is closed and no action was sent.'
  );
  await expect(decisionStatus).toBeFocused();

  source = 'RECOVERING';
  await page
    .getByRole('alert')
    .filter({ hasText: 'The latest data could not be refreshed' })
    .getByRole('button', { name: 'Try again' })
    .click();
  await recoveryStarted;
  const stableFocus = page.getByRole('tab', { name: 'Upcoming' });
  await stableFocus.focus();
  await expect(stableFocus).toBeFocused();
  releaseRecovery?.();

  await expect(release).toBeVisible();
  await expect(decisionStatus).toHaveText(
    'The current reservation state is verified again. Release is available.'
  );
  await expect(stableFocus).toBeFocused();
  await expect(decisionStatus).not.toBeFocused();
  expect(releaseWrites).toBe(0);

  source = 'UNAVAILABLE';
  const secondFailure = page.waitForResponse(
    (response) =>
      response.status() === 503 &&
      new URL(response.url()).pathname === '/api/platform/v1/workplace/bookings'
  );
  await page.clock.fastForward(60_010);
  await secondFailure;
  await page.clock.fastForward(1_100);

  await expect(release).toHaveCount(0);
  await expect(decisionStatus).toHaveText(
    'The current reservation state could not be verified. Release is closed and no action was sent.'
  );
  await expect(stableFocus).toBeFocused();
  await expect(decisionStatus).not.toBeFocused();
  expect(releaseWrites).toBe(0);

  source = 'READY';
  await page
    .getByRole('alert')
    .filter({ hasText: 'The latest data could not be refreshed' })
    .getByRole('button', { name: 'Try again' })
    .click();
  await expect(release).toBeVisible();
  await expect(decisionStatus).toHaveText(
    'The current reservation state is verified again. Release is available.'
  );
  await expect(decisionStatus).not.toBeFocused();

  await release.click();
  const releaseDialog = page.getByRole('dialog', { name: 'Release this space?' });
  await releaseDialog.getByRole('button', { name: 'Release' }).click();
  await expect(page.getByText('The space was released.')).toBeVisible();
  await expect(decisionStatus).toHaveText('');
  expect(releaseWrites).toBe(1);
});

test('a recovered release notice becomes terminal at the reservation boundary without stealing focus', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({ baseURL: String(testInfo.project.use.baseURL) });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-08-19T00:00:00Z') });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockWorkplace(page);
  const recoverableBooking = booking({
    bookingId: '40000000-0000-0000-0000-000000000043',
    resourceName: 'Boundary recovery desk',
    startsAt: '2026-08-18T23:30:00Z',
    endsAt: '2026-08-19T00:01:10Z',
    canCheckIn: false,
    canCancel: false,
    canRelease: true,
  });
  let source: 'READY' | 'UNAVAILABLE' = 'READY';
  let releaseWrites = 0;
  await page.route('**/api/platform/v1/workplace/bookings**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST' && path.endsWith('/release')) {
      releaseWrites += 1;
      return route.fallback();
    }
    if (request.method() !== 'GET' || path !== '/api/platform/v1/workplace/bookings') {
      return route.fallback();
    }
    return source === 'READY'
      ? fulfillSuccess(route, [recoverableBooking])
      : route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'UPSTREAM_UNAVAILABLE', message: 'Retry later.' }),
        });
  });

  await page.goto('/workplace/my-bookings');
  const actionId = `release:${recoverableBooking.bookingId}`;
  const release = page.locator(`[data-workplace-decision-action="${actionId}"]`);
  await release.focus();

  source = 'UNAVAILABLE';
  const failure = page.waitForResponse(
    (response) =>
      response.status() === 503 &&
      new URL(response.url()).pathname === '/api/platform/v1/workplace/bookings'
  );
  await page.clock.fastForward(60_010);
  await failure;
  await page.clock.fastForward(2_000);
  await expect(
    page.getByRole('alert').filter({ hasText: 'The latest data could not be refreshed' })
  ).toBeVisible();

  source = 'READY';
  await page
    .getByRole('alert')
    .filter({ hasText: 'The latest data could not be refreshed' })
    .getByRole('button', { name: 'Try again' })
    .click();
  const decisionStatus = page.getByTestId('workplace-booking-decision-status');
  await expect(decisionStatus).toHaveText(
    'The current reservation state is verified again. Release is available.'
  );
  const stableFocus = page.getByRole('tab', { name: 'Upcoming' });
  await stableFocus.focus();

  await page.waitForTimeout(100);
  await page.clock.runFor(15_000);
  await expect(release).toHaveCount(0);
  await expect(decisionStatus).toHaveText(
    'The reservation has ended. Release is closed and no action was sent.'
  );
  await expect(stableFocus).toBeFocused();
  await expect(decisionStatus).not.toBeFocused();
  expect(releaseWrites).toBe(0);
  await context.close();
});

test('submitted release and cancel commands keep truthful state and preserve version contracts', async ({
  page,
}) => {
  const checkInBooking = booking({
    bookingId: '40000000-0000-0000-0000-000000000050',
    resourceName: 'Single-flight check-in desk',
    canCancel: false,
    version: 3,
  });
  const releaseBooking = booking({
    bookingId: '40000000-0000-0000-0000-000000000051',
    resourceName: 'Submitted release desk',
    startsAt: '2026-08-18T23:30:00Z',
    endsAt: '2026-08-19T00:00:30Z',
    canCheckIn: false,
    canCancel: false,
    canRelease: true,
    version: 7,
  });
  const cancelBooking = booking({
    bookingId: '40000000-0000-0000-0000-000000000052',
    resourceName: 'Cancelable future desk',
    startsAt: '2026-08-19T00:30:00Z',
    endsAt: '2026-08-19T01:30:00Z',
    canCheckIn: false,
    canCancel: true,
    canRelease: false,
    version: 11,
  });
  let activeBookings = [checkInBooking, releaseBooking, cancelBooking];
  let checkInWrites = 0;
  let releaseWrites = 0;
  let cancelWrites = 0;
  let checkInPayload: unknown;
  let releasePayload: unknown;
  let cancelPayload: unknown;
  let releaseCheckIn: (() => void) | undefined;
  const checkInGate = new Promise<void>((resolve) => {
    releaseCheckIn = resolve;
  });
  let releaseSubmitted: (() => void) | undefined;
  const releaseGate = new Promise<void>((resolve) => {
    releaseSubmitted = resolve;
  });
  await page.route('**/api/platform/v1/workplace/bookings**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/platform/v1/workplace/bookings') {
      return fulfillSuccess(route, activeBookings);
    }
    if (request.method() === 'POST' && path.endsWith(`/${checkInBooking.bookingId}/check-in`)) {
      checkInWrites += 1;
      checkInPayload = request.postDataJSON();
      await checkInGate;
      activeBookings = activeBookings.filter(
        (candidate) => candidate.bookingId !== checkInBooking.bookingId
      );
      return fulfillSuccess(route, {
        ...checkInBooking,
        status: 'CHECKED_IN',
        canCheckIn: false,
        version: checkInBooking.version + 1,
      });
    }
    if (request.method() === 'POST' && path.endsWith(`/${releaseBooking.bookingId}/release`)) {
      releaseWrites += 1;
      releasePayload = request.postDataJSON();
      await releaseGate;
      activeBookings = activeBookings.filter(
        (candidate) => candidate.bookingId !== releaseBooking.bookingId
      );
      return fulfillSuccess(route, {
        ...releaseBooking,
        status: 'RELEASED',
        canRelease: false,
        version: releaseBooking.version + 1,
      });
    }
    if (request.method() === 'POST' && path.endsWith(`/${cancelBooking.bookingId}/cancel`)) {
      cancelWrites += 1;
      cancelPayload = request.postDataJSON();
      activeBookings = activeBookings.filter(
        (candidate) => candidate.bookingId !== cancelBooking.bookingId
      );
      return fulfillSuccess(route, {
        ...cancelBooking,
        status: 'CANCELLED',
        canCancel: false,
        version: cancelBooking.version + 1,
      });
    }
    return route.fallback();
  });

  await page.goto('/workplace/my-bookings');
  const checkIn = page.getByRole('button', { name: 'Check in' });
  await checkIn.dblclick();
  await expect.poll(() => checkInWrites).toBe(1);
  await expect(checkIn).toBeDisabled();
  expect(checkInPayload).toEqual({ version: 3 });
  releaseCheckIn?.();
  await expect(page.getByText('You checked in to the space.')).toBeVisible();
  expect(checkInWrites).toBe(1);

  await page.getByRole('button', { name: 'Release' }).click();
  const releaseDialog = page.getByRole('dialog', { name: 'Release this space?' });
  await releaseDialog.getByRole('button', { name: 'Release' }).click();
  await expect.poll(() => releaseWrites).toBe(1);

  await page.clock.setFixedTime(new Date('2026-08-19T00:00:30.050Z'));
  await page.clock.fastForward(30_050);
  await expect(releaseDialog).toBeVisible();
  await expect(page.getByTestId('workplace-booking-decision-status')).toHaveText('');
  await expect(page.getByText(/no action was sent/u)).toHaveCount(0);
  expect(releasePayload).toEqual({ version: 7 });
  expect(releaseWrites).toBe(1);

  releaseSubmitted?.();
  await expect(page.getByText('The space was released.')).toBeVisible();
  await expect(releaseDialog).toHaveCount(0);
  expect(releaseWrites).toBe(1);

  await page.getByRole('button', { name: 'Cancel booking' }).click();
  const cancelDialog = page.getByRole('alertdialog', { name: 'Cancel this space booking?' });
  await cancelDialog.getByRole('button', { name: 'Cancel booking' }).click();
  await expect(page.getByText('The space booking was cancelled.')).toBeVisible();
  expect(cancelPayload).toEqual({ version: 11 });
  expect(cancelWrites).toBe(1);
});

test('identity changes clear prior decision state and block cross-account booking commands', async ({
  page,
}) => {
  const identityBookings = new Map([
    [
      1,
      booking({
        bookingId: '40000000-0000-0000-0000-000000000061',
        resourceName: 'Identity A desk',
        startsAt: '2026-08-18T23:30:00Z',
        endsAt: '2026-08-19T01:30:00Z',
        canCheckIn: false,
        canCancel: false,
        canRelease: true,
      }),
    ],
    [
      2,
      booking({
        bookingId: '40000000-0000-0000-0000-000000000062',
        resourceName: 'Identity B desk',
        startsAt: '2026-08-17T23:30:00Z',
        endsAt: '2026-08-18T01:30:00Z',
        canCheckIn: false,
        canCancel: false,
        canRelease: true,
      }),
    ],
    [
      3,
      booking({
        bookingId: '40000000-0000-0000-0000-000000000063',
        resourceName: 'Identity C desk',
        startsAt: '2026-08-17T23:30:00Z',
        endsAt: '2026-08-18T01:30:00Z',
        canCheckIn: false,
        canCancel: false,
        canRelease: true,
      }),
    ],
  ]);
  let activeUserId = 1;
  let meCalls = 0;
  let bookingUnavailable = false;
  let actionWrites = 0;
  await page.route('**/api/auth/me', (route) => {
    meCalls += 1;
    return fulfillSuccess(route, {
      userId: activeUserId,
      personPublicId: `person-${activeUserId}`,
      displayName: `Identity ${activeUserId}`,
      jobTitle: 'Tenant administrator',
      email: `identity.${activeUserId}@dwp.local`,
      tenantId: 1,
      tenantCode: 'default',
      tenantName: 'SKAX',
      identityPlane: 'TENANT',
      preferredLocale: 'en',
      tenantDefaultLocale: 'en',
      roles: ['TENANT_ADMIN'],
      groups: [],
      resourceRoles: [],
    });
  });
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST') {
      actionWrites += 1;
      return route.fallback();
    }
    if (request.method() !== 'GET' || path !== '/api/platform/v1/workplace/bookings') {
      return route.fallback();
    }
    if (bookingUnavailable) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'UPSTREAM_UNAVAILABLE', message: 'Retry later.' }),
      });
    }
    const currentBooking = identityBookings.get(activeUserId);
    return fulfillSuccess(route, currentBooking ? [currentBooking] : []);
  });

  await page.goto('/workplace/my-bookings');
  await expect(page.getByText('Identity A desk')).toBeVisible();
  await page.getByRole('button', { name: 'Release' }).click();
  const staleVersionDialog = page.getByRole('dialog', { name: 'Release this space?' });
  await expect(staleVersionDialog).toBeVisible();
  identityBookings.set(1, { ...identityBookings.get(1)!, version: 1 });
  const refreshedVersion = page.waitForResponse(
    (response) =>
      response.status() === 200 &&
      new URL(response.url()).pathname === '/api/platform/v1/workplace/bookings'
  );
  await page.clock.fastForward(60_010);
  await refreshedVersion;
  await expect(staleVersionDialog).toHaveCount(0);
  expect(actionWrites).toBe(0);

  const identityARelease = page.getByRole('button', { name: 'Release' });
  await identityARelease.focus();
  bookingUnavailable = true;
  await page.clock.fastForward(60_010);
  const priorDecisionStatus = page.getByTestId('workplace-booking-decision-status');
  await expect(priorDecisionStatus).toHaveText(
    'The current reservation state could not be verified. Release is closed and no action was sent.'
  );

  bookingUnavailable = false;
  activeUserId = 2;
  await page.clock.setFixedTime(new Date('2026-08-18T00:00:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => meCalls).toBeGreaterThanOrEqual(2);
  await expect(page.getByText('Identity B desk')).toBeVisible();
  await expect(priorDecisionStatus).toHaveText('');

  await page.getByRole('button', { name: 'Release' }).click();
  await expect(page.getByRole('dialog', { name: 'Release this space?' })).toBeVisible();
  activeUserId = 3;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => meCalls).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole('dialog', { name: 'Release this space?' })).toHaveCount(0);
  await expect(page.getByText('Identity B desk')).toHaveCount(0);
  await expect(page.getByText('Identity C desk')).toBeVisible();
  expect(actionWrites).toBe(0);
});

test('relocation is bound to the current identity and booking snapshot', async ({ page }) => {
  const identityBookings = new Map(
    [1, 2, 3].map((userId) => [
      userId,
      booking({
        bookingId: `40000000-0000-0000-0000-${String(70 + userId).padStart(12, '0')}`,
        resourceName: `Relocate identity ${userId} desk`,
        version: userId === 2 ? 5 : 0,
      }),
    ])
  );
  const bookingGets = new Map<number, number>();
  let activeUserId = 1;
  let meCalls = 0;
  let relocateWrites = 0;
  let relocatePayload: unknown;
  let releaseRelocate: (() => void) | undefined;
  const relocateGate = new Promise<void>((resolve) => {
    releaseRelocate = resolve;
  });
  await page.route('**/api/auth/me', (route) => {
    meCalls += 1;
    return fulfillSuccess(route, {
      userId: activeUserId,
      personPublicId: `relocate-person-${activeUserId}`,
      displayName: `Relocate identity ${activeUserId}`,
      jobTitle: 'Tenant administrator',
      email: `relocate.${activeUserId}@dwp.local`,
      tenantId: 1,
      tenantCode: 'default',
      tenantName: 'SKAX',
      identityPlane: 'TENANT',
      preferredLocale: 'en',
      tenantDefaultLocale: 'en',
      roles: ['TENANT_ADMIN'],
      groups: [],
      resourceRoles: [],
    });
  });
  await page.route('**/api/platform/v1/workplace/bookings**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/platform/v1/workplace/bookings') {
      bookingGets.set(activeUserId, (bookingGets.get(activeUserId) ?? 0) + 1);
      const currentBooking = identityBookings.get(activeUserId);
      return fulfillSuccess(route, currentBooking ? [currentBooking] : []);
    }
    if (request.method() === 'POST' && path.endsWith('/relocate')) {
      relocateWrites += 1;
      relocatePayload = request.postDataJSON();
      await relocateGate;
      return fulfillSuccess(route, {
        ...identityBookings.get(2)!,
        ...request.postDataJSON(),
        version: 6,
      });
    }
    return route.fallback();
  });

  const switchIdentity = async (userId: number) => {
    const expectedCalls = meCalls + 1;
    activeUserId = userId;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => meCalls).toBeGreaterThanOrEqual(expectedCalls);
    await expect(page.getByText(`Relocate identity ${userId} desk`)).toBeVisible();
  };

  await page.goto('/workplace/my-bookings');
  await page.getByRole('button', { name: 'Change reservation' }).click();
  const relocateDialog = page.getByRole('dialog', { name: 'Change space or time' });
  await expect(relocateDialog).toBeVisible();
  await switchIdentity(2);
  await expect(relocateDialog).toHaveCount(0);
  expect(relocateWrites).toBe(0);

  await page.getByRole('button', { name: 'Change reservation' }).click();
  await relocateDialog.getByLabel('Available space').click();
  await page.getByRole('option', { name: /Focus desk 13/u }).click();
  await relocateDialog.getByLabel('Reason for change').fill('Move under the active identity');
  await relocateDialog.getByRole('button', { name: 'Save reservation change' }).click();
  await expect.poll(() => relocateWrites).toBe(1);
  expect(relocatePayload).toMatchObject({ version: 5 });

  await switchIdentity(3);
  await expect(relocateDialog).toHaveCount(0);
  await page.waitForTimeout(300);
  const identityThreeGets = bookingGets.get(3) ?? 0;
  const relocateResponse = page.waitForResponse(
    (response) =>
      response.status() === 200 && new URL(response.url()).pathname.endsWith('/relocate')
  );
  releaseRelocate?.();
  await relocateResponse;
  await page.waitForTimeout(300);
  await expect(page.getByText('The space reservation was changed.')).toHaveCount(0);
  expect(bookingGets.get(3) ?? 0).toBe(identityThreeGets);
  expect(relocateWrites).toBe(1);
});

test('members can move a future reservation to an available space of the same type', async ({
  page,
}) => {
  let currentBooking = booking();
  let bookingGets = 0;
  let relocationWrites = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/relocate')) {
      relocationWrites += 1;
    }
  });
  await page.route('**/api/platform/v1/workplace/bookings**', (route) => {
    const request = route.request();
    if (
      request.method() === 'GET' &&
      new URL(request.url()).pathname === '/api/platform/v1/workplace/bookings'
    ) {
      bookingGets += 1;
      return fulfillSuccess(route, [currentBooking]);
    }
    return route.fallback();
  });

  await page.goto('/workplace/my-bookings');
  await page.getByRole('button', { name: 'Change reservation' }).click();

  const dialog = page.getByRole('dialog', { name: 'Change space or time' });
  await expect(dialog).toBeVisible();
  currentBooking = booking({ version: 1 });
  await page.clock.fastForward(60_010);
  await expect.poll(() => bookingGets).toBeGreaterThanOrEqual(2);
  await expect(dialog).toHaveCount(0);
  expect(relocationWrites).toBe(0);

  await page.getByRole('button', { name: 'Change reservation' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Available space').click();
  await page.getByRole('option', { name: /Focus desk 13/u }).click();
  await dialog.getByLabel('Reason for change').fill('Move closer to the project team');

  const relocation = page.waitForRequest(
    (request) => request.url().endsWith('/relocate') && request.method() === 'POST'
  );
  await dialog.getByRole('button', { name: 'Save reservation change' }).click();
  const request = await relocation;
  expect(request.postDataJSON()).toMatchObject({
    resourceId: unplacedResource.resourceId,
    reason: 'Move closer to the project team',
    version: 1,
  });
  expect(relocationWrites).toBe(1);
  await expect(dialog).toBeHidden();
});

test('relocation requires a fresh authoritative target snapshot before saving', async ({
  page,
}) => {
  type HeldExploreFailure = {
    gate: Promise<void>;
    release: () => void;
    started: Promise<void>;
    status: 403 | 503;
  };
  let heldFailure: HeldExploreFailure | null = null;
  let freshSequence = 0;
  let exploreCalls = 0;
  let relocationWrites = 0;
  let holdFreshRecovery = false;
  let releaseFreshRecovery: (() => void) | undefined;
  let markFreshRecoveryStarted: (() => void) | undefined;
  const freshRecoveryGate = new Promise<void>((resolve) => {
    releaseFreshRecovery = resolve;
  });
  const freshRecoveryStarted = new Promise<void>((resolve) => {
    markFreshRecoveryStarted = resolve;
  });

  const holdExploreFailure = (status: 403 | 503) => {
    let release: (() => void) | undefined;
    let markStarted: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    heldFailure = {
      gate,
      release: () => release?.(),
      started,
      status,
    };
    return { markStarted: () => markStarted?.(), value: heldFailure };
  };

  let markHeldRequestStarted: (() => void) | undefined;
  await page.route('**/api/platform/v1/workplace/explore**', async (route) => {
    exploreCalls += 1;
    if (heldFailure) {
      markHeldRequestStarted?.();
      await heldFailure.gate;
      return route.fulfill({
        status: heldFailure.status,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Target lookup unavailable.' }),
      });
    }
    if (holdFreshRecovery) {
      markFreshRecoveryStarted?.();
      await freshRecoveryGate;
    }
    freshSequence += 1;
    return fulfillSuccess(route, {
      ...workplaceExploreFixture,
      resources: [resource, { ...unplacedResource, version: freshSequence + 1 }],
      generatedAt: `2026-08-19T00:00:${String(freshSequence).padStart(2, '0')}Z`,
    });
  });
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/relocate')) {
      relocationWrites += 1;
    }
  });

  await page.goto('/workplace/my-bookings');
  const relocateTrigger = page.getByRole('button', { name: 'Change reservation', exact: true });
  await relocateTrigger.click();
  const dialog = page.getByRole('dialog', { name: 'Change space or time' });
  const save = dialog.getByRole('button', { name: 'Save reservation change' });
  await dialog.getByLabel('Available space').click();
  await page.getByRole('option', { name: /Focus desk 13/u }).click();
  await dialog.getByLabel('Reason for change').fill('Use a verified target');
  await expect(save).toBeEnabled();

  const staleFailure = holdExploreFailure(503);
  markHeldRequestStarted = staleFailure.markStarted;
  await dialog.getByRole('button', { name: 'Refresh target options' }).click();
  await staleFailure.value.started;
  await save.focus();
  await expect(save).toBeFocused();
  staleFailure.value.release();
  await page.clock.fastForward(1_100);

  await expect(
    dialog.getByText(
      'Available spaces could not be refreshed. The last verified options are read-only, and saving remains disabled until recovery.'
    )
  ).toBeVisible();
  await expect(save).toBeDisabled();
  expect(relocationWrites).toBe(0);

  heldFailure = null;
  const callsBeforeRecovery = exploreCalls;
  await dialog.getByRole('button', { name: 'Try again' }).click();
  await expect.poll(() => exploreCalls).toBeGreaterThan(callsBeforeRecovery);
  await expect(save).toBeEnabled();
  await expect(dialog.getByText(/last verified options are read-only/u)).toHaveCount(0);

  const deniedFailure = holdExploreFailure(403);
  markHeldRequestStarted = deniedFailure.markStarted;
  await dialog.getByRole('button', { name: 'Refresh target options' }).click();
  await deniedFailure.value.started;
  await save.focus();
  await expect(save).toBeFocused();
  deniedFailure.value.release();

  await expect(dialog).toHaveCount(0);
  const deniedNotice = page.getByTestId('workplace-relocate-denied-alert');
  await expect(deniedNotice).toHaveText(
    'You no longer have permission to view available spaces. The reservation change was closed and no update was sent.'
  );
  await expect(deniedNotice).toHaveAttribute('role', 'alert');
  await expect(deniedNotice).toHaveAttribute('aria-live', 'assertive');
  await expect(deniedNotice).toHaveAttribute('aria-atomic', 'true');
  await expect(relocateTrigger).toBeFocused();
  expect(relocationWrites).toBe(0);

  heldFailure = null;
  holdFreshRecovery = true;
  await relocateTrigger.click();
  await freshRecoveryStarted;
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Available space')).toHaveCount(0);
  await expect(save).toBeDisabled();
  await expect(deniedNotice).toHaveCount(0);
  releaseFreshRecovery?.();
  await dialog.getByLabel('Available space').click();
  await page.getByRole('option', { name: /Focus desk 13/u }).click();
  await dialog.getByLabel('Reason for change').fill('Use a newly authorized target');
  await expect(save).toBeEnabled();
  expect(relocationWrites).toBe(0);
});

test('Korean relocation denial persists outside the dialog and restores its trigger', async ({
  page,
}) => {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockWorkplace(page);
  let denyTargets = false;
  let relocationWrites = 0;
  let releaseDenied: (() => void) | undefined;
  let markDeniedStarted: (() => void) | undefined;
  const deniedGate = new Promise<void>((resolve) => {
    releaseDenied = resolve;
  });
  const deniedStarted = new Promise<void>((resolve) => {
    markDeniedStarted = resolve;
  });
  await page.route('**/api/platform/v1/workplace/explore**', async (route) => {
    if (!denyTargets) return fulfillSuccess(route, workplaceExploreFixture);
    markDeniedStarted?.();
    await deniedGate;
    return route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ errorCode: 'FORBIDDEN', message: 'Access denied.' }),
    });
  });
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      /\/workplace\/bookings\/[^/]+\/relocate$/u.test(new URL(request.url()).pathname)
    ) {
      relocationWrites += 1;
    }
  });

  await page.goto('/workplace/my-bookings');
  const relocateTrigger = page.getByRole('button', { name: '예약 변경', exact: true });
  await relocateTrigger.click();
  const dialog = page.getByRole('dialog', { name: '공간 또는 시간 변경', exact: true });
  const save = dialog.getByRole('button', { name: '예약 변경 저장', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('예약 가능한 공간').click();
  await page.getByRole('option', { name: /(?:집중 좌석 13|Focus desk 13)/u }).click();
  await dialog.getByLabel('변경 사유').fill('권한 거부 시 안전한 복귀 확인');
  await expect(save).toBeEnabled();

  denyTargets = true;
  await dialog.getByRole('button', { name: '이동 대상 새로고침', exact: true }).click();
  await deniedStarted;
  await save.focus();
  await expect(save).toBeFocused();
  releaseDenied?.();

  await expect(dialog).toHaveCount(0);
  const deniedNotice = page.getByTestId('workplace-relocate-denied-alert');
  await expect(deniedNotice).toHaveText(
    '예약 가능한 공간을 볼 권한이 없습니다. 예약 변경 창을 닫았으며 변경 요청은 전송되지 않았습니다.'
  );
  await expect(deniedNotice).toHaveAttribute('role', 'alert');
  await expect(deniedNotice).toHaveAttribute('aria-live', 'assertive');
  await expect(relocateTrigger).toBeFocused();
  expect(relocationWrites).toBe(0);
});

test('room booking fails closed when the tenant meeting policy is unavailable', async ({
  page,
}) => {
  await page.route('**/api/platform/v1/rooms/policy', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
  );
  await page.goto('/workplace/rooms');

  await expect(
    page.getByText(
      'The meeting-room booking policy could not be loaded. Booking is temporarily disabled.'
    )
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Focus 08 is unavailable at 09:00 AM/u })
  ).toHaveAttribute('aria-disabled', 'true');
});

test('room timelines use Calendar policy hours and each resource IANA time zone', async ({
  page,
}) => {
  await page.goto('/workplace/rooms');

  await expect(page.getByRole('heading', { name: 'Find a room', level: 1 })).toBeVisible();
  await expect(page.getByText('Local time · Asia/Seoul').first()).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Focus 08 is unavailable at 09:00 AM/u })
  ).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: /Book Focus 08 at 09:30 AM/u })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Focus 08 at 08:00 AM/u })).toHaveCount(0);
  const timeline = page.getByRole('toolbar', { name: 'Availability for Focus 08' });
  await expect(timeline.locator('button[tabindex="0"]')).toHaveCount(1);
  const firstSlot = timeline.locator('button[tabindex="0"]');
  await firstSlot.focus();
  await firstSlot.press('ArrowRight');
  await expect(timeline.locator('button').nth(1)).toBeFocused();
});

test('read-only roles see accessible reasons and cannot invoke booking or administration writes', async ({
  page,
}) => {
  await page.route('**/api/auth/permissions', (route) =>
    fulfillSuccess(route, READ_ONLY_WORKPLACE_PERMISSIONS)
  );

  await page.goto('/workplace/explore');
  await expect(page.getByTestId('rooms-permission-notice')).toContainText(
    'cannot create Workplace bookings'
  );
  await page
    .getByRole('button', { name: /^Focus desk 12.*Physically open.*Booking unavailable$/u })
    .click();
  await expect(page.getByRole('dialog', { name: 'Book a workspace' })).toHaveCount(0);
  await expect(page.getByText('cannot create Workplace bookings').last()).toBeVisible();

  await page.goto('/workplace/my-bookings');
  await expect(page.getByTestId('rooms-permission-notice')).toContainText(
    'cannot cancel, check in, or release'
  );
  await expect(page.getByRole('button', { name: 'Check in' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0);

  await page.goto('/workplace/admin/locations');
  await expect(page.getByTestId('rooms-permission-notice')).toContainText('read only');
  await expect(page.getByRole('button', { name: 'Add site' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add floor' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add space' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save layout' })).toBeDisabled();

  await page.goto('/workplace/admin/policies');
  await expect(page.getByTestId('rooms-permission-notice')).toContainText(
    'policy management permission is required'
  );
  await expect(
    page.getByRole('switch', { name: 'Show member names on reserved spaces' })
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
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

test('workplace governance remains complete on mobile and resumes persisted floor-plan drafts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/workplace/admin/governance');

  await expect(page.getByRole('heading', { name: 'Workplace governance', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Campuses', level: 2 })).toBeVisible();

  await page.getByRole('tab', { name: 'Access control' }).click();
  await expect(
    page.getByRole('heading', { name: 'Building access rules', level: 2 })
  ).toBeVisible();
  await expect(page.getByText(/closed by default/u).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Policy inheritance' }).click();
  await expect(
    page.getByRole('heading', { name: 'Partial policies', level: 2, exact: true })
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Floor-plan releases' }).click();
  await expect(page.getByRole('heading', { name: 'Revision history', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Edit draft' }).click();
  await expect(
    page.getByRole('heading', { name: 'Edit floor-plan draft', level: 2 })
  ).toBeVisible();
  await expect(page.getByTestId('workplace-layout-editor')).toBeVisible();

  await page.getByLabel('Floor-plan background image file').setInputFiles({
    name: 'floor-plan.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    ),
  });
  await page.getByRole('button', { name: 'Upload to draft' }).click();
  await expect(
    page.getByText('The verified background image was attached to the floor-plan draft.')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Add to layout' }).click();
  const placedResource = page.getByTestId(`layout-resource-${resource.resourceId}`);
  const bounds = await placedResource.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds) {
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 36, bounds.y + bounds.height / 2 + 12, {
      steps: 6,
    });
    await page.mouse.up();
  }
  await placedResource.click({ force: true });
  const horizontalPosition = page.getByLabel('Horizontal position (%)');
  await horizontalPosition.fill('36');
  await expect(horizontalPosition).toHaveValue('36');
  const persistedHorizontalPosition = await horizontalPosition.inputValue();
  await expect(page.getByText('2 unsaved')).toBeVisible();

  await page.getByRole('tab', { name: 'Admin delegation' }).click();
  const unsavedDialog = page.getByRole('alertdialog', {
    name: 'Discard unsaved floor-plan changes?',
  });
  await expect(unsavedDialog).toBeVisible();
  await unsavedDialog.getByRole('button', { name: 'Keep' }).click();
  await expect(
    page.getByRole('heading', { name: 'Edit floor-plan draft', level: 2 })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Save layout' }).click();
  await expect(page.getByText('The floor-plan draft was saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.getByRole('button', { name: 'Edit draft' }).click();
  await page.getByTestId(`layout-resource-${resource.resourceId}`).click();
  await expect(page.getByLabel('Horizontal position (%)')).toHaveValue(persistedHorizontalPosition);
  await expect(page.getByText('2 resources')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/area=floorPlans/u);
  await expect(page.getByRole('heading', { name: 'Revision history', level: 2 })).toBeVisible();

  await page.getByRole('tab', { name: 'Admin delegation' }).click();
  await expect(page).toHaveURL(/area=delegation/u);
  await expect(
    page.getByRole('heading', { name: 'Administrative delegations', level: 2 })
  ).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport);

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('administrators are warned before discarding unsaved Workplace policy changes', async ({
  page,
}) => {
  await page.goto('/workplace/admin/policies');
  const visibility = page.getByRole('switch', {
    name: 'Show member names on reserved spaces',
  });
  await visibility.uncheck();

  await clickWorkplaceNavigationLink(page, 'Operations overview');
  const dialog = page.getByRole('alertdialog', {
    name: 'Discard unsaved Workplace policy changes?',
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep' }).click();
  await expect(
    page.getByRole('heading', { name: 'Workplace operating policy', level: 1 })
  ).toBeVisible();

  await clickWorkplaceNavigationLink(page, 'Operations overview');
  await dialog.getByRole('button', { name: 'Discard changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Workplace operations overview', level: 1 })
  ).toBeVisible();
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

test('workplace discovery reflows without page overflow across compact viewports', async ({
  page,
}, testInfo) => {
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/workplace/explore');
    await expect(page.getByRole('heading', { name: 'Find a space', level: 1 })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport);
    if (viewport.width === 320 || viewport.width === 1280) {
      await page.screenshot({
        path: testInfo.outputPath(`workplace-list-${viewport.width}.png`),
        fullPage: true,
      });
    }
  }
});

test('every member Workplace surface reflows at mobile and tablet widths', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 768, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of [
      '/workplace',
      '/workplace/rooms',
      '/workplace/my-bookings',
      '/workplace/my-meetings',
    ]) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.documentWidth, `${path} at ${viewport.width}px`).toBeLessThanOrEqual(
        dimensions.viewport
      );
    }
  }
});
