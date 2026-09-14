import { expect, test } from '@playwright/test';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';
import type { Page } from '@playwright/test';
import type {
  CalendarBooking,
  CalendarPolicy,
  CalendarResource,
  WorkplaceResource,
} from '@dwp-frontend/shared-utils';

const siteId = '10000000-0000-0000-0000-000000000001';
const floorId = '20000000-0000-0000-0000-000000000001';
const resourceId = '30000000-0000-0000-0000-000000000001';
const bookingId = '40000000-0000-0000-0000-000000000001';
const site = {
  siteId,
  code: 'QA',
  name: 'QA site',
  nameKo: 'QA 사이트',
  nameEn: 'QA site',
  type: 'HEADQUARTERS',
  timeZone: 'Asia/Seoul',
  state: 'ACTIVE',
  configuredFloorCount: 1,
  resourceCount: 1,
  version: 1,
};
const floor = {
  floorId,
  siteId,
  siteName: site.name,
  floorNumber: 1,
  name: 'QA floor',
  nameKo: 'QA 층',
  nameEn: 'QA floor',
  planWidth: 1200,
  planHeight: 800,
  backgroundAssetPath: null,
  resourceCount: 1,
  state: 'ACTIVE',
  version: 1,
};
const resource = {
  resourceId,
  siteId,
  floorId,
  code: 'QA-DESK',
  name: 'QA desk',
  nameKo: 'QA 좌석',
  nameEn: 'QA desk',
  type: 'DESK',
  capacity: 1,
  features: [],
  neighborhood: null,
  assignedUserId: null,
  calendarResourceId: null,
  approvalRequired: false,
  accessible: true,
  mode: 'RESERVABLE',
  positionX: 12,
  positionY: 20,
  widthPercent: 8,
  heightPercent: 6,
  rotationDegrees: 0,
  assignedToCurrentUser: false,
  assignedPersonPublicId: null,
  assignedDisplayName: null,
  state: 'AVAILABLE',
  version: 1,
} satisfies WorkplaceResource;
const initialPolicy = {
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
  showColleagueNames: false,
  bookingRetentionDays: 365,
  version: 2,
};
const booking = {
  bookingId,
  resourceId,
  siteId,
  floorId,
  resourceName: resource.name,
  resourceType: 'DESK',
  floorName: floor.name,
  status: 'NO_SHOW',
  startsAt: '2026-09-14T00:00:00Z',
  endsAt: '2026-09-14T01:00:00Z',
  checkedInAt: null,
  releasedAt: null,
  legalHold: false,
  version: 1,
  updatedAt: '2026-09-14T01:30:00Z',
  detailHref: '/workplace/admin/operations',
  exceptionReasons: ['NO_SHOW'],
};
const metadata = {
  generatedAt: '2026-09-14T02:00:00Z',
  sourceUpdatedAt: '2026-09-14T01:30:00Z',
  availability: 'AVAILABLE' as const,
  owner: 'WP_BOOKINGS',
  denominatorBasis: 'current roster resource minutes across 24-hour local days',
  historicalRosterAvailable: false,
  recurringOccurrencesIncluded: true,
};
const summary = {
  bookingCount: 2,
  cancelledCount: 0,
  bookedMinutes: 60,
  denominatorResourceMinutes: 7 * 1440,
  utilizationPercent: (60 / (7 * 1440)) * 100,
  noShowEligibleCount: 2,
  noShowCount: 1,
  noShowPercent: 50,
  peakUtilizationPercent: 100,
  unresolvedPastBookings: 0,
};
const pageData = <T>(content: T[]) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
  generatedAt: metadata.generatedAt,
});
const report = {
  scope: {
    siteId,
    floorId: null,
    siteName: site.name,
    timeZone: site.timeZone,
    from: '2026-09-08',
    to: '2026-09-15',
    startsAt: '2026-09-07T15:00:00Z',
    endsAt: '2026-09-14T15:00:00Z',
  },
  metadata,
  current: {
    activeSites: 1,
    configuredFloors: 1,
    reservableResources: 1,
    assignedResources: 0,
    bookingsThisWeek: 2,
    checkedInToday: 1,
    utilizationPercent: (60 / 1440) * 100,
    policy: initialPolicy,
  },
  summary,
  floors: [{ floorId, floorName: floor.name, resourceCount: 1, summary }],
  hourlyHeatmap: Array.from({ length: 7 }, (_, dayIndex) =>
    Array.from({ length: 24 }, (_, hour) => {
      const date = `2026-09-${String(8 + dayIndex).padStart(2, '0')}`;
      const nextDate = `2026-09-${String(9 + dayIndex).padStart(2, '0')}`;
      const bookedMinutes = dayIndex === 6 && hour === 8 ? 60 : 0;
      return {
        date,
        dayOfWeek: (2 + dayIndex) % 7,
        hour,
        offset: '+09:00',
        startsAt: `${date}T${String(hour).padStart(2, '0')}:00:00+09:00`,
        endsAt: `${hour === 23 ? nextDate : date}T${String((hour + 1) % 24).padStart(2, '0')}:00:00+09:00`,
        bookedMinutes,
        denominatorResourceMinutes: 60,
        utilizationPercent:
          dayIndex === 6 && (hour === 8 || hour === 9) ? (bookedMinutes / 60) * 100 : null,
      };
    })
  ).flat(),
  dailyTrend: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-09-${String(8 + index).padStart(2, '0')}`,
    bookingCount: index === 6 ? 2 : 0,
    bookedMinutes: index === 6 ? 60 : 0,
    denominatorResourceMinutes: 1440,
    utilizationPercent: index === 6 ? (60 / 1440) * 100 : null,
    noShowCount: index === 6 ? 1 : 0,
    noShowPercent: index === 6 ? 50 : null,
  })),
  comparison: {
    previousFrom: '2026-09-01',
    previousTo: '2026-09-08',
    previous: summary,
    utilizationChangePercentagePoints: 0,
    noShowChangePercentagePoints: 0,
  },
  exceptions: pageData([booking]),
  externalSources: [
    {
      kind: 'SENSOR_OCCUPANCY',
      availability: 'UNAVAILABLE',
      reason: 'No verified sensor producer is installed.',
      owner: 'EXTERNAL_ADAPTER',
      integrationPath: '/workplace/admin/governance?area=experience',
    },
  ],
  definitions: ['This is persisted planned occupancy, not actual live presence.'],
};

const room = {
  resourceId: '91000000-0000-0000-0000-000000000001',
  code: 'QA-ROOM',
  name: 'Native meeting approval room',
  nameKo: 'QA room',
  nameEn: 'Native meeting approval room',
  type: 'ROOM',
  site: 'Tenant-wide Rooms site',
  floor: '12',
  capacity: 18,
  features: ['VIDEO'],
  timeZone: 'Asia/Seoul',
  approvalRequired: true,
  state: 'AVAILABLE',
  available: true,
  version: 3,
} satisfies CalendarResource;
const roomPolicy = {
  weekStart: 1,
  workingDayStart: '08:00:00',
  workingDayEnd: '20:00:00',
  defaultEventMinutes: 30,
  minimumEventMinutes: 15,
  maximumEventMinutes: 240,
  maximumAdvanceDays: 30,
  defaultBufferMinutes: 10,
  weeklyFocusTargetMinutes: 300,
  dailyMeetingLimitMinutes: 240,
  enforceMeetingAgenda: true,
  allowExternalAttendees: false,
  version: 2,
} satisfies CalendarPolicy;
const pendingBooking = {
  bookingId: '92000000-0000-0000-0000-000000000001',
  eventId: '93000000-0000-0000-0000-000000000001',
  resourceId: room.resourceId,
  resourceName: room.name,
  eventTitle: 'Native meeting awaiting operator approval',
  startsAt: '2026-09-18T05:00:00Z',
  endsAt: '2026-09-18T08:30:00Z',
  organizerName: 'Operator QA',
  organizerEmail: 'operator@example.test',
  status: 'PENDING',
  requestedBy: 900018,
  version: 4,
} satisfies CalendarBooking;

async function setup(page: Page) {
  await isolateWorkplaceDevelopmentUpdates(page);
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const reads: string[] = [];
  await page.route('**/api/platform/v1/admin/workplace/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/sites')) return fulfillSuccess(route, [site]);
    if (path.endsWith('/floors')) return fulfillSuccess(route, [floor]);
    if (path.endsWith('/resources')) return fulfillSuccess(route, [resource]);
    if (path.endsWith('/experience-report')) {
      reads.push(url.pathname);
      return fulfillSuccess(route, report);
    }
    if (path.endsWith('/experience/facilities/requests'))
      return fulfillSuccess(route, { ...pageData([]), size: 1 });
    if (path.endsWith('/governance/delegated-admin-scopes/effective'))
      return fulfillSuccess(route, []);
    return route.fallback();
  });
  await page.route('**/api/platform/v1/admin/rooms/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    reads.push(path);
    if (path.endsWith('/overview'))
      return fulfillSuccess(route, {
        activeResources: 1,
        resourcesInMaintenance: 0,
        bookingsThisWeek: 1,
        pendingBookings: 1,
        eventsThisWeek: 1,
        conflictedUsers: 0,
        policy: roomPolicy,
        resources: [room],
        generatedAt: metadata.generatedAt,
      });
    if (path.endsWith('/bookings/pending')) return fulfillSuccess(route, [pendingBooking]);
    return route.fallback();
  });
  return reads;
}

test('08 pending approvals opens canonical meeting operations and its actual Rooms queue', async ({
  page,
}) => {
  const reads = await setup(page);
  await page.goto(`/workplace/admin/overview?site=${siteId}&from=2026-09-08&to=2026-09-15`);
  const card = page.getByText('Pending room approvals', { exact: true }).locator('../..');
  await expect(card.getByText('1', { exact: true })).toBeVisible();
  await expect(page.getByText(site.name, { exact: false }).first()).toBeVisible();
  await expect
    .poll(() => reads.includes('/api/platform/v1/admin/workplace/experience-report'))
    .toBe(true);
  await card.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page).toHaveURL(/\/workplace\/admin\/meeting-operations$/u);
  await expect(page.getByRole('heading', { name: 'Pending approvals', exact: true })).toBeVisible();
  await expect(page.getByText(pendingBooking.eventTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(pendingBooking.organizerEmail, { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
  expect(reads).toContain('/api/platform/v1/admin/rooms/bookings/pending');
  await expect(
    page.getByRole('heading', { name: 'Workplace booking operations', exact: true })
  ).toHaveCount(0);
});
