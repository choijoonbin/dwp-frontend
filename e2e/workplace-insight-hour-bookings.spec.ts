import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';
import type { Page } from '@playwright/test';
import type { WorkplaceResource } from '@dwp-frontend/shared-utils';

const siteId = '10000000-0000-4000-8000-000000000001';
const floorId = '20000000-0000-4000-8000-000000000001';
const resourceId = '30000000-0000-4000-8000-000000000001';
const bookingId = '40000000-0000-4000-8000-000000000001';
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

async function setupHourReader(page: Page, restricted = false) {
  await isolateWorkplaceDevelopmentUpdates(page);
  await mockShellSession(page, restricted ? ['USER'] : ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const state = {
    restricted,
    requestReads: [] as Record<string, string>[],
    scopeMismatch: false,
    requestScopeMismatch: false,
    reads: [] as Record<string, string>[],
    detailReads: [] as string[],
    failure: false,
    malformed: null as 'floor' | 'ids' | 'boundary' | 'page' | 'shape' | null,
    gate: null as Promise<void> | null,
  };
  const rows = Array.from({ length: 21 }, (_, index) => ({
    ...booking,
    bookingId: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    resourceName: index === 20 ? 'Second page real desk' : `Overlap desk ${index + 1}`,
    status: index === 0 ? 'NO_SHOW' : 'CANCELLED',
    updatedAt: '2026-09-14T02:30:00Z',
    userId: 1234,
    bookedForDisplayName: 'Protected employee name',
    purpose: 'Protected purpose',
    resourceType: index === 2 ? 'ROOM' : 'DESK',
    resourceId: index === 2 ? '30000000-0000-4000-8000-000000000002' : resourceId,
  }));
  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/sites'))
      return fulfillSuccess(route, [
        {
          ...site,
          ...(state.restricted
            ? { totalFloorCount: null, countsScope: 'FLOORS', allowedFloorIds: [floorId] }
            : {}),
        },
      ]);
    if (path.endsWith('/floors')) return fulfillSuccess(route, [floor]);
    if (path.endsWith('/resources')) return fulfillSuccess(route, [resource]);
    if (path.endsWith('/photo') || path.endsWith('/photo/metadata'))
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'NOT_FOUND', message: 'Fixture no registered photo' }),
      });
    if (path.endsWith('/experience/facilities/closures'))
      return fulfillSuccess(
        route,
        pageData([
          {
            closureId: '60000000-0000-4000-8000-000000000001',
            resourceId,
            siteId,
            floorId,
            resourceName: resource.name,
            timeZone: site.timeZone,
            startsAt: url.searchParams.get('from'),
            endsAt: url.searchParams.get('to'),
            status: 'ACTIVE',
            reason: 'Fixture scheduled ventilation repair',
            cancellationReason: null,
            resourceVersionAtCreate: 1,
            version: 0,
            createdAt: metadata.generatedAt,
            updatedAt: metadata.generatedAt,
            affectedBookingsPath: '',
          },
        ])
      );
    if (path.endsWith('/experience/facilities/requests')) {
      state.requestReads.push(Object.fromEntries(url.searchParams));
      return fulfillSuccess(route, {
        ...pageData([
          {
            requestId: '50000000-0000-4000-8000-000000000001',
            resourceId,
            siteId,
            floorId,
            resourceName: resource.name,
            category: 'REPAIR',
            description: 'Fixture desk light needs repair',
            status: 'OPEN',
            statusReason: null,
            version: 0,
            createdAt: metadata.generatedAt,
            updatedAt: metadata.generatedAt,
            owner: 'WORKPLACE_NATIVE',
          },
        ]),
        ...(state.restricted
          ? {
              countsScope: 'FLOORS',
              allowedFloorIds: [
                state.requestScopeMismatch ? '20000000-0000-4000-8000-000000000099' : floorId,
              ],
            }
          : {}),
      });
    }
    if (path.endsWith('/governance/delegated-admin-scopes/effective'))
      return fulfillSuccess(
        route,
        state.restricted
          ? [
              {
                scopeType: 'SITE',
                scopeId: siteId,
                permissions: ['CATALOG_VIEW', 'CATALOG_MANAGE'],
                floorIds: [floorId],
                validUntil: null,
              },
            ]
          : []
      );
    if (path.endsWith('/experience-report'))
      return fulfillSuccess(route, {
        ...report,
        scope: {
          ...report.scope,
          floorId: url.searchParams.get('floorId'),
          ...(state.restricted
            ? {
                countsScope: 'FLOORS',
                allowedFloorIds: [
                  state.scopeMismatch ? '20000000-0000-4000-8000-000000000099' : floorId,
                ],
              }
            : {}),
        },
      });
    if (path.endsWith('/workplace/bookings')) {
      const params = Object.fromEntries(url.searchParams);
      state.reads.push(params);
      if (state.gate) await state.gate;
      if (state.failure)
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'FORBIDDEN',
            message: 'Fixture global operations reader denied',
          }),
        });
      const pageNumber = Number(params.page);
      const matches = rows.filter(
        (row) =>
          Date.parse(row.startsAt) < Date.parse(params.to) &&
          Date.parse(row.endsAt) > Date.parse(params.from)
      );
      const content = matches
        .slice(pageNumber * 20, (pageNumber + 1) * 20)
        .map((row) => ({ ...row }));
      if (state.malformed === 'floor' && content[0])
        content[0].floorId = '20000000-0000-4000-8000-000000000099';
      if (state.malformed === 'ids' && content[0]) content[0].siteId = '';
      if (state.malformed === 'boundary' && content[0]) content[0].endsAt = params.from;
      return fulfillSuccess(route, {
        content: state.malformed === 'shape' ? null : content,
        page: state.malformed === 'page' ? 8 : pageNumber,
        size: 20,
        totalElements: matches.length,
        totalPages: Math.ceil(matches.length / 20),
      });
    }
    if (path.includes('/experience-report/bookings/')) {
      state.detailReads.push(url.toString());
      return fulfillSuccess(
        route,
        rows.find((row) => row.bookingId === path.split('/').at(-1))
      );
    }
    if (path.endsWith('/future-booking-impact'))
      return fulfillSuccess(route, {
        resourceId,
        siteId,
        resourceName: resource.name,
        owner: 'WP_BOOKINGS',
        resourceState: 'AVAILABLE',
        from: metadata.generatedAt,
        to: '2026-10-14T02:00:00Z',
        metadata,
        affectedBookings: { ...pageData([]), generatedAt: metadata.generatedAt },
        mutatesBookings: false,
        notificationScheduled: false,
        replacementScheduled: false,
      });
    return route.fallback();
  });
  return state;
}
async function selectHour(page: Page, hour: number) {
  const cell = page
    .getByRole('button', { name: new RegExp(`2026-09-14 ${hour}:00`, 'u') })
    .filter({ visible: true });
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  return page.getByRole('region', { name: 'Bookings overlapping this hour', exact: true });
}
async function stableLayout(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await expect
    .poll(async () =>
      page
        .locator('main')
        .first()
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const expected = window.innerWidth >= 1200 ? 248 : 0;
          return Math.abs(rect.x - expected) < 1 && Math.abs(rect.right - window.innerWidth) < 1;
        })
    )
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.scrollY === 0 && (document.querySelector('main')?.scrollTop ?? 0) === 0
      )
    )
    .toBe(true);
}

test('hour drilldown preserves exact offsets, canonical location, source paging and native actual detail IDs', async ({
  page,
}) => {
  const state = await setupHourReader(page);
  await page.goto(`/workplace/admin/overview?view=insights&site=${siteId}&floor=${floorId}`);
  const list = await selectHour(page, 9);
  await expect(list).toContainText('All-status bookings in this time and location: 21');
  expect(state.reads.at(-1)).toEqual({
    from: '2026-09-14T09:00:00+09:00',
    to: '2026-09-14T10:00:00+09:00',
    siteId,
    floorId,
    page: '0',
    size: '20',
  });
  await expect(list).toContainText('not a count of contributing bookings or actual presence');
  await expect(list.getByRole('listitem')).toHaveCount(19);
  await expect(list).not.toContainText('Protected employee name');
  await expect(list).not.toContainText('Protected purpose');
  await expect(list).toContainText('does not contribute booked minutes');
  await list.getByRole('button', { name: 'Review', exact: true }).first().click();
  await expect(
    page.getByRole('dialog', { name: 'Booking detail and action review' })
  ).toContainText('Overlap desk 1');
  expect(new URL(state.detailReads.at(-1)!).searchParams.get('siteId')).toBe(siteId);
  expect(new URL(state.detailReads.at(-1)!).pathname).toContain(`/bookings/${bookingId}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await list.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(list).toContainText('Second page real desk');
  await expect(list).toContainText('Page 2 of 2');
  expect(state.reads.at(-1)?.page).toBe('1');
  await list.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Second page real desk');
  expect(new URL(state.detailReads.at(-1)!).pathname).toContain(
    '40000000-0000-4000-8000-000000000021'
  );
});

test('403 and malformed source pages close protected counts, rows and detail while preserving the scoped report', async ({
  page,
}) => {
  const state = await setupHourReader(page);
  await page.goto(`/workplace/admin/overview?view=insights&floor=${floorId}`);
  const list = await selectHour(page, 9);
  await expect(list.getByRole('listitem')).toHaveCount(19);
  await list.getByRole('button', { name: 'Review', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  state.failure = true;
  await page.evaluate(() =>
    (document.querySelector('#workplace-insight-hour-bookings button') as HTMLButtonElement).click()
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(list).not.toContainText('Overlap desk');
  await expect(list).not.toContainText('All-status bookings');
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
  state.failure = false;
  for (const malformed of ['floor', 'ids', 'boundary', 'page', 'shape'] as const) {
    state.malformed = malformed;
    await list.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(list.getByRole('listitem')).toHaveCount(0);
    await expect(list).not.toContainText('All-status bookings');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  state.malformed = null;
  await list.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(list.getByRole('listitem')).toHaveCount(19);
});

test('changing the hour resets paging and hides late results from the previous interval', async ({
  page,
}) => {
  const state = await setupHourReader(page);
  let release: () => void = () => {};
  state.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.goto(`/workplace/admin/overview?view=insights&floor=${floorId}`);
  await selectHour(page, 9);
  await expect.poll(() => state.reads.length).toBe(1);
  state.gate = null;
  const list = await selectHour(page, 10);
  await expect(list).toContainText('All-status bookings in this time and location: 0');
  release();
  await expect(list.getByRole('listitem')).toHaveCount(0);
  await expect(list).not.toContainText('Overlap desk');
  expect(state.reads.at(-1)?.from).toBe('2026-09-14T10:00:00+09:00');
  await selectHour(page, 9);
  await expect(list.getByRole('listitem')).toHaveCount(19);
  await expect(list).toContainText('Page 1 of 2');
  await list.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(list).toContainText('Page 2 of 2');
  await selectHour(page, 10);
  await expect(list).toContainText('All-status bookings in this time and location: 0');
  await selectHour(page, 9);
  await expect(list).toContainText('Page 1 of 2');
  expect(state.reads.at(-1)?.page).toBe('0');
});

test('loaded selected-hour drilldown remains readable at 1440 1280 390 and 320', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await setupHourReader(page);
  await page.goto(`/workplace/admin/overview?view=insights&floor=${floorId}`);
  const list = await selectHour(page, 9);
  await list.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(list).toContainText('Second page real desk');
  for (const width of [1440, 1280, 390, 320]) {
    await stableLayout(page, width);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector('main')?.scrollTo(0, 0);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.screenshot({
      path: testInfo.outputPath(`workplace-insights-hour-${width}-loaded.png`),
      fullPage: true,
    });
    const result = await new AxeBuilder({ page }).include('main').analyze();
    expect(
      result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
    ).toEqual([]);
  }
});

test('facilities loaded desktop capture waits for the mobile to desktop layout to settle', async ({
  page,
}, testInfo) => {
  await setupHourReader(page);
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/workplace/admin/operations?view=facilities');
  await page
    .getByRole('region', { name: 'Spaces to work on' })
    .getByRole('button', { name: /QA desk/u })
    .click();
  await expect(page.getByRole('region', { name: 'Scheduled space closure' })).toContainText(
    'Fixture scheduled ventilation repair'
  );
  await stableLayout(page, 1440);
  await expect(
    page.getByRole('heading', { name: 'Bookings and facility operations' })
  ).toBeVisible();
  const heading = await page
    .getByRole('heading', { name: 'Bookings and facility operations' })
    .boundingBox();
  expect(heading?.x).toBeGreaterThanOrEqual(248);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.screenshot({
    path: testInfo.outputPath('workplace-facilities-1440-stable-loaded.png'),
    fullPage: true,
  });
  const result = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
  ).toEqual([]);
});

test('restricted insight report labels its native floor union and never reads GLOBAL_ONLY hourly bookings', async ({
  page,
}) => {
  const state = await setupHourReader(page, true);
  await page.goto(`/workplace/admin/overview?view=insights&site=${siteId}`);
  await expect(
    page.getByText('Counts include only your 1 authorized floors.', { exact: true })
  ).toBeVisible();
  const floorSelector = page.getByRole('combobox', { name: /^Floor/u });
  await expect(floorSelector).toHaveText('All authorized floors');
  const selected = await selectHour(page, 9);
  await expect(
    selected.getByText(/Hourly booking lists require tenant-wide operations authority/u)
  ).toBeVisible();
  await expect(selected.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled();
  expect(state.reads).toHaveLength(0);
  expect(state.detailReads).toHaveLength(0);
  for (const width of [1440, 1280, 390, 320]) {
    await stableLayout(page, width);
    await page.screenshot({
      path: test.info().outputPath(`workplace-insights-restricted-${width}.png`),
      fullPage: true,
    });
    const result = await new AxeBuilder({ page }).include('main').analyze();
    expect(
      result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
    ).toEqual([]);
  }
});

test('restricted insights close metrics when report and catalog floor scope disagree', async ({
  page,
}) => {
  const state = await setupHourReader(page, true);
  state.scopeMismatch = true;
  await page.goto(`/workplace/admin/overview?view=insights&site=${siteId}`);
  await expect(
    page.getByText('The authorized floor scope could not be verified. Reload current sources.', {
      exact: true,
    })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /2026-09-14 9:00/u })).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Bookings overlapping this hour', exact: true })
  ).toHaveCount(0);
  expect(state.reads).toHaveLength(0);
  expect(state.detailReads).toHaveLength(0);
});

test('facilities distinguish authorized union from selected floor and close a mismatched request cohort', async ({
  page,
}) => {
  const state = await setupHourReader(page, true);
  await page.goto(`/workplace/admin/operations?view=facilities&site=${siteId}&floor=${floorId}`);
  await expect(page.getByRole('button', { name: /QA desk/u }).first()).toBeVisible();
  await expect.poll(() => state.requestReads.length).toBeGreaterThan(0);
  expect(state.requestReads.at(-1)?.floorId).toBe(floorId);
  const selector = page.getByRole('combobox', { name: /^Floor/u });
  await selector.click();
  await page.getByRole('option', { name: 'All authorized floors', exact: true }).click();
  await expect(page.getByRole('listbox', { includeHidden: true })).toHaveCount(0);
  await expect.poll(() => state.requestReads.at(-1)?.floorId ?? null).toBeNull();
  await expect(page.getByText('Choose a floor to view its spaces.', { exact: true })).toBeVisible();
  for (const width of [1440, 1280, 390, 320]) {
    await stableLayout(page, width);
    await page.screenshot({
      path: test.info().outputPath(`workplace-facilities-restricted-${width}.png`),
      fullPage: true,
    });
    const result = await new AxeBuilder({ page }).include('main').analyze();
    expect(
      result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
    ).toEqual([]);
  }
  state.requestScopeMismatch = true;
  await page.reload();
  await expect(
    page.getByText('The authorized floor scope could not be verified. Reload current sources.', {
      exact: true,
    })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /QA desk.*Repair/u })).toHaveCount(0);
  const before = state.requestReads.length;
  await page.goto(
    `/workplace/admin/operations?view=facilities&site=${siteId}&floor=20000000-0000-4000-8000-000000000099`
  );
  await expect(
    page.getByText('The authorized floor scope could not be verified. Reload current sources.', {
      exact: true,
    })
  ).toBeVisible();
  expect(state.requestReads.length).toBe(before);
  await expect(page.getByText('Fixture desk light needs repair', { exact: true })).toHaveCount(0);
});
