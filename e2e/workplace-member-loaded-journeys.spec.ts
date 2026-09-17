import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import {
  locationFloor,
  locationResource,
  locationSite,
} from './support/workplace-location-fixtures';
import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';
import type {
  WorkplaceBooking,
  WorkplaceBookingInput,
  WorkplacePolicy,
} from '@dwp-frontend/shared-utils';
import type { Page } from '@playwright/test';

async function waitForDialogPaint(page: Page) {
  await expect
    .poll(async () =>
      page.locator('[role="dialog"], [role="alertdialog"]').evaluateAll((dialogs) =>
        dialogs.every((dialog) => {
          for (let element: Element | null = dialog; element; element = element.parentElement) {
            if (Number(getComputedStyle(element).opacity) < 1) return false;
          }
          const background = getComputedStyle(dialog).backgroundColor;
          return background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)';
        })
      )
    )
    .toBe(true);
}

const policy: WorkplacePolicy = {
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
  showColleagueNames: false,
  version: 2,
};
const actualBookingId = '40000000-0000-0000-0000-000000000020';
const floor = {
  ...locationFloor,
  backgroundAssetPath: `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760"><rect width="1200" height="760" fill="#f4f7f8"/><path d="M80 90h1040v580H80z" fill="white" stroke="#b8c6cc" stroke-width="6"/><path d="M390 90v580M780 90v580M80 380h1040" fill="none" stroke="#d5dfe3" stroke-width="4"/></svg>'
  )}`,
};

test('loaded list and map inspection lead to the server-confirmed personal booking with native owner actions', async ({
  page,
}, testInfo) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS.filter((item) => item.resourceKey !== 'APP.ROOMS'),
  });
  let persisted: WorkplaceBooking | null = null;
  let unexpectedWrites = 0;
  const creates: { key: string; input: WorkplaceBookingInput }[] = [];
  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/photo') || path.endsWith('/photo/metadata'))
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: '{"success":false,"message":"No registered photo"}',
      });
    if (path.endsWith('/explore'))
      return fulfillSuccess(route, {
        sites: [locationSite],
        floors: [floor],
        selectedFloor: floor,
        resources: [locationResource],
        occupancy: [],
        closures: [],
        policy,
        generatedAt: '2026-08-19T00:00:00Z',
      });
    if (path.endsWith('/bookings')) {
      if (request.method() === 'GET') return fulfillSuccess(route, persisted ? [persisted] : []);
      const input = request.postDataJSON() as WorkplaceBookingInput;
      creates.push({ key: request.headers()['idempotency-key'] ?? '', input });
      persisted = {
        bookingId: actualBookingId,
        resourceId: input.resourceId,
        resourceName: locationResource.name,
        resourceType: 'DESK',
        siteName: locationSite.name,
        floorName: floor.name,
        purpose: input.purpose,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: 'RESERVED',
        visibleToColleagues: input.visibleToColleagues,
        checkedInAt: null,
        releasedAt: null,
        canCheckIn: true,
        canCancel: true,
        canRelease: false,
        checkInOpensAt: '2026-08-18T23:30:00Z',
        checkInClosesAt: '2026-08-19T01:00:00Z',
        version: 0,
      };
      return fulfillSuccess(route, persisted);
    }
    if (request.method() !== 'GET') {
      unexpectedWrites += 1;
      return route.fulfill({ status: 403 });
    }
    return route.fallback();
  });
  const capture = async (name: string, width: number) => {
    await page.setViewportSize({ width, height: 1000 });
    const sidebar =
      width >= 1280 ? await page.locator('aside[id$="-desktop-navigation"]').boundingBox() : null;
    await expect
      .poll(async () => Math.round((await page.locator('main').boundingBox())?.x ?? -1))
      .toBe(Math.round(sidebar?.width ?? 0));
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await waitForDialogPaint(page);
    await page.screenshot({
      path: testInfo.outputPath(`${name}-${width}-loaded.png`),
      fullPage: (await page.locator('[role="dialog"], [role="alertdialog"]').count()) === 0,
    });
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/workplace/find?view=list&resource=${locationResource.resourceId}`);
  const inspector = page.getByRole('complementary', { name: locationResource.name, exact: true });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByText('No space photo is registered.', { exact: true })).toBeVisible();
  for (const width of [1440, 1280]) await capture('workplace-list-inspector', width);
  await page.getByRole('button', { name: 'Map view', exact: true }).click();
  await expect(page.getByTestId('workplace-floor-plan')).toBeVisible();
  await expect(inspector).toBeVisible();
  for (const width of [1440, 1280]) await capture('workplace-map-inspector', width);
  await page.setViewportSize({ width: 390, height: 1000 });
  await expect(inspector).toBeVisible();
  await capture('workplace-mobile-inspector', 390);
  await capture('workplace-mobile-inspector', 320);
  await inspector.getByRole('button', { name: 'Book this space', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Book a workspace', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Asia/Seoul', { exact: true })).toBeVisible();
  await dialog.getByLabel('Purpose', { exact: true }).fill('Loaded native owner journey');
  await capture('workplace-native-booking-dialog', 320);
  await dialog.getByRole('button', { name: 'Book', exact: true }).click();
  await expect(page).toHaveURL(/\/workplace\/reservations\?/u);
  expect(new URL(page.url()).searchParams.get('reservation')).toBe(actualBookingId);
  const mobileInspector = page.getByRole('dialog', { name: 'Reservation inspector', exact: true });
  await expect(mobileInspector.getByRole('heading', { name: locationResource.name })).toBeVisible();
  await expect(
    mobileInspector.getByRole('button', { name: 'Check in now', exact: true })
  ).toBeVisible();
  await expect(
    mobileInspector.getByRole('button', { name: 'Change space', exact: true })
  ).toBeVisible();
  await expect(
    mobileInspector.getByRole('button', { name: 'Cancel booking', exact: true })
  ).toBeVisible();
  expect(creates).toHaveLength(1);
  expect(creates[0].key).toMatch(/^workplace:booking:[0-9a-f-]{36}$/u);
  expect(creates[0].input).toMatchObject({
    resourceId: locationResource.resourceId,
    purpose: 'Loaded native owner journey',
  });
  for (const width of [1440, 1280, 390, 320]) {
    if (width >= 1280) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(
        page
          .getByRole('complementary', { name: 'Reservation inspector', exact: true })
          .getByRole('heading', { name: locationResource.name, exact: true })
      ).toBeVisible();
    }
    await capture('workplace-confirmed-my-bookings', width);
  }
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    axe.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
  ).toEqual([]);
  await mobileInspector.getByRole('button', { name: 'Cancel booking', exact: true }).click();
  const cancellation = page.getByRole('alertdialog', {
    name: 'Cancel this reservation?',
    exact: true,
  });
  await expect(cancellation).toBeVisible();
  await capture('workplace-cancel-review', 320);
  await cancellation.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(cancellation).toHaveCount(0);
  await mobileInspector.getByRole('button', { name: 'Change space', exact: true }).click();
  const relocation = page.getByRole('dialog', { name: 'Change space or time', exact: true });
  await expect(relocation).toBeVisible();
  await expect(
    relocation.getByRole('textbox', { name: 'Reason for change', exact: true })
  ).toBeVisible();
  await capture('workplace-relocation-review', 320);
  await relocation.getByRole('button', { name: 'Cancel', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(relocation).toHaveCount(0);
  expect(creates).toHaveLength(1);
  expect(unexpectedWrites).toBe(0);
});

test('relocation compares the original and target and requires an authoritative read after conflict or unknown results', async ({
  page,
}, testInfo) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS.filter((item) => item.resourceKey !== 'APP.ROOMS'),
  });
  const target = {
    ...locationResource,
    resourceId: '30000000-0000-0000-0000-000000000014',
    name: 'Actual alternative desk',
    code: 'D-14',
    version: 3,
  };
  let current: WorkplaceBooking = {
    bookingId: actualBookingId,
    resourceId: locationResource.resourceId,
    resourceName: locationResource.name,
    resourceType: 'DESK',
    siteName: locationSite.name,
    floorName: floor.name,
    purpose: 'Original actual booking',
    startsAt: '2026-08-19T00:30:00Z',
    endsAt: '2026-08-19T01:30:00Z',
    status: 'RESERVED',
    visibleToColleagues: false,
    checkedInAt: null,
    releasedAt: null,
    canCheckIn: false,
    canCancel: true,
    canRelease: false,
    checkInOpensAt: '2026-08-19T00:00:00Z',
    checkInClosesAt: '2026-08-19T01:00:00Z',
    version: 5,
  };
  let reads = 0;
  const writes: unknown[] = [];
  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/photo') || path.endsWith('/photo/metadata'))
      return route.fulfill({ status: 404 });
    if (path.endsWith('/explore'))
      return fulfillSuccess(route, {
        sites: [locationSite],
        floors: [floor],
        selectedFloor: floor,
        resources: [locationResource, target],
        occupancy: [],
        closures: [],
        policy,
        generatedAt: '2026-08-19T00:00:00Z',
      });
    if (path.endsWith('/bookings') && request.method() === 'GET') {
      reads += 1;
      return fulfillSuccess(route, [current]);
    }
    if (path.endsWith('/relocate') && request.method() === 'POST') {
      const input = request.postDataJSON();
      writes.push(input);
      if (writes.length <= 2)
        return route.fulfill({
          status: writes.length === 1 ? 409 : 503,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message:
              writes.length === 1 ? 'The selected desk changed.' : 'The command result is unknown.',
          }),
        });
      current = {
        ...current,
        resourceId: target.resourceId,
        resourceName: target.name,
        version: 6,
      };
      return fulfillSuccess(route, current);
    }
    return route.fallback();
  });
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.goto(
    `/workplace/reservations?v=1&period=UPCOMING&types=WORKSPACE&status=ACTIVE&authority=WORKPLACE&reservation=${actualBookingId}&reservationAuthority=WORKPLACE`
  );
  await page
    .getByRole('dialog', { name: 'Reservation inspector', exact: true })
    .getByRole('button', { name: 'Change space', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Change space or time', exact: true });
  await dialog.getByRole('combobox', { name: /Space passing initial checks/u }).click();
  await page.getByRole('option', { name: /Actual alternative desk/u }).click();
  await dialog
    .getByRole('textbox', { name: 'Reason for change', exact: true })
    .fill('Choose an actual alternative');
  const comparison = page.getByTestId('workplace-relocation-comparison');
  await expect(comparison).toContainText('Current booking');
  await expect(comparison).toContainText(locationResource.name);
  await expect(comparison).toContainText('Requested change');
  await expect(comparison).toContainText(target.name);
  const save = dialog.getByRole('button', { name: 'Save reservation change', exact: true });
  await expect(save).toBeEnabled();
  await save.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect.poll(() => writes.length).toBe(1);
  await expect(save).toBeDisabled();
  await expect(
    dialog.getByText(
      'Another change updated the version. Reload the current values and review again.',
      { exact: true }
    )
  ).toBeVisible();
  await expect(page.getByText('The selected desk changed.', { exact: true })).toBeHidden({
    timeout: 10_000,
  });
  await waitForDialogPaint(page);
  await page.screenshot({
    path: testInfo.outputPath('workplace-relocation-known409-320-loaded.png'),
    fullPage: false,
  });
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const previousReads = reads;
    await dialog.getByRole('button', { name: 'Refresh target options', exact: true }).click();
    await expect(save).toBeDisabled();
    expect(writes).toHaveLength(attempt);
    await dialog.getByRole('button', { name: 'Reload latest booking', exact: true }).click();
    await expect.poll(() => reads).toBeGreaterThan(previousReads);
    await expect(save).toBeEnabled();
    await save.click();
    await expect.poll(() => writes.length).toBe(attempt + 1);
    if (attempt === 1) {
      await expect(save).toBeDisabled();
      await expect(
        dialog.getByText(
          'The change result is unknown. Reload your booking before choosing the next action.',
          { exact: true }
        )
      ).toBeVisible();
      await waitForDialogPaint(page);
      await page.screenshot({
        path: testInfo.outputPath('workplace-relocation-unknown-320-loaded.png'),
        fullPage: false,
      });
    }
  }
  await expect(dialog).toHaveCount(0);
  await expect(
    page
      .getByRole('dialog', { name: 'Reservation inspector', exact: true })
      .getByRole('heading', { name: target.name, exact: true })
  ).toBeVisible();
  expect(writes).toHaveLength(3);
  for (const input of writes)
    expect(input).toMatchObject({
      resourceId: target.resourceId,
      version: 5,
      reason: 'Choose an actual alternative',
    });
});

test('mobile cancellation and release use bottom sheets with restored focus and one busy native command', async ({
  page,
}, testInfo) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS.filter((item) => item.resourceKey !== 'APP.ROOMS'),
  });
  const futureId = actualBookingId;
  const activeId = '40000000-0000-0000-0000-000000000021';
  const base: WorkplaceBooking = {
    bookingId: futureId,
    resourceId: locationResource.resourceId,
    resourceName: locationResource.name,
    resourceType: 'DESK',
    siteName: locationSite.name,
    floorName: floor.name,
    purpose: null,
    startsAt: '2026-08-19T00:30:00Z',
    endsAt: '2026-08-19T01:30:00Z',
    status: 'RESERVED',
    visibleToColleagues: false,
    checkedInAt: null,
    releasedAt: null,
    canCheckIn: false,
    canCancel: true,
    canRelease: false,
    checkInOpensAt: '2026-08-19T00:00:00Z',
    checkInClosesAt: '2026-08-19T01:00:00Z',
    version: 5,
  };
  let bookings: WorkplaceBooking[] = [
    base,
    {
      ...base,
      bookingId: activeId,
      resourceName: 'Actual checked-in desk',
      status: 'CHECKED_IN',
      startsAt: '2026-08-18T23:00:00Z',
      checkedInAt: '2026-08-18T23:05:00Z',
      canCancel: false,
      canRelease: true,
      version: 8,
    },
  ];
  const commands: { path: string; input: unknown }[] = [];
  let releaseCommand!: () => void;
  let commandGate = new Promise<void>((resolve) => {
    releaseCommand = resolve;
  });
  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/photo') || path.endsWith('/photo/metadata'))
      return route.fulfill({ status: 404 });
    if (path.endsWith('/bookings') && request.method() === 'GET')
      return fulfillSuccess(route, bookings);
    if (request.method() === 'POST' && /\/(cancel|release)$/u.test(path)) {
      commands.push({ path, input: request.postDataJSON() });
      await commandGate;
      const bookingId = path.split('/').at(-2);
      const original = bookings.find((booking) => booking.bookingId === bookingId);
      if (!original) throw new Error('Unknown native booking target');
      const confirmed: WorkplaceBooking = {
        ...original,
        status: path.endsWith('/cancel') ? 'CANCELLED' : 'RELEASED',
        version: original.version + 1,
        canCancel: false,
        canCheckIn: false,
        canRelease: false,
      };
      bookings = bookings.map((booking) => (booking.bookingId === bookingId ? confirmed : booking));
      return fulfillSuccess(route, confirmed);
    }
    return route.fallback();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/workplace/reservations?v=1&period=UPCOMING&types=WORKSPACE&status=ACTIVE&authority=WORKPLACE&reservation=${futureId}&reservationAuthority=WORKPLACE`
  );
  const futureRow = page.getByTestId(`workplace-reservation-workplace-${futureId}`);
  const reservationInspector = page.getByRole('dialog', {
    name: 'Reservation inspector',
    exact: true,
  });
  const cancelTrigger = reservationInspector.getByRole('button', {
    name: 'Cancel booking',
    exact: true,
  });
  await cancelTrigger.click();
  const cancellation = page.getByRole('alertdialog', {
    name: 'Cancel this reservation?',
    exact: true,
  });
  const checkSheet = async (
    sheet: ReturnType<typeof page.getByRole>,
    width: number,
    name: string
  ) => {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(async () => {
        const box = await sheet.boundingBox();
        return Math.round((box?.y ?? 0) + (box?.height ?? 0));
      })
      .toBe(844);
    const box = await sheet.boundingBox();
    expect(Math.round(box?.x ?? -1)).toBe(0);
    expect(Math.round(box?.width ?? 0)).toBe(width);
    await waitForDialogPaint(page);
    await page.screenshot({
      path: testInfo.outputPath(`${name}-${width}-loaded.png`),
      fullPage: false,
    });
  };
  for (const width of [390, 320]) await checkSheet(cancellation, width, 'workplace-cancel-sheet');
  const keep = cancellation.getByRole('button', { name: 'Keep', exact: true });
  await expect(keep).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(cancellation).toHaveCount(0);
  await expect(cancelTrigger).toBeFocused();
  expect(commands).toHaveLength(0);
  await cancelTrigger.click();
  await cancellation
    .getByRole('button', { name: 'Cancel booking', exact: true })
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
  await expect.poll(() => commands.length).toBe(1);
  expect(commands[0]).toEqual({
    path: `/api/platform/v1/workplace/bookings/${futureId}/cancel`,
    input: { version: 5 },
  });
  await expect(keep).toBeDisabled();
  await keep.focus();
  await page.keyboard.press('Escape');
  await page.mouse.click(4, 4);
  await expect(cancellation).toBeVisible();
  expect(commands).toHaveLength(1);
  releaseCommand();
  await expect(cancellation).toHaveCount(0);
  await expect(futureRow).toHaveCount(0);
  commandGate = new Promise<void>((resolve) => {
    releaseCommand = resolve;
  });
  const activeRow = page.getByTestId(`workplace-reservation-workplace-${activeId}`);
  await activeRow.getByRole('button', { name: 'View detail', exact: true }).click();
  const activeInspector = page.getByRole('dialog', {
    name: 'Reservation inspector',
    exact: true,
  });
  const releaseTrigger = activeInspector.getByRole('button', {
    name: 'Release space',
    exact: true,
  });
  await releaseTrigger.click();
  const release = page.getByRole('alertdialog', {
    name: 'Release this workplace space?',
    exact: true,
  });
  await checkSheet(release, 320, 'workplace-release-sheet');
  await release.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(release).toHaveCount(0);
  await expect(releaseTrigger).toBeFocused();
  await releaseTrigger.click();
  await release.getByRole('button', { name: 'Release space', exact: true }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect.poll(() => commands.length).toBe(2);
  expect(commands[1]).toEqual({
    path: `/api/platform/v1/workplace/bookings/${activeId}/release`,
    input: { version: 8 },
  });
  await expect(release.getByRole('button', { name: 'Keep', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(release).toBeVisible();
  releaseCommand();
  await expect(release).toHaveCount(0);
  await expect(activeRow).toHaveCount(0);
  expect(commands).toHaveLength(2);
});

test('a known booking conflict preserves native filters and the draft while the member manually chooses another actual space', async ({
  page,
}, testInfo) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS.filter((item) => item.resourceKey !== 'APP.ROOMS'),
  });
  const target = {
    ...locationResource,
    resourceId: '30000000-0000-0000-0000-000000000014',
    code: 'D-14',
    name: 'Actual alternative desk',
  };
  const writes: { key: string; input: WorkplaceBookingInput }[] = [];
  let confirmed: WorkplaceBooking | null = null;
  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/photo') || path.endsWith('/photo/metadata'))
      return route.fulfill({ status: 404 });
    if (path.endsWith('/explore'))
      return fulfillSuccess(route, {
        sites: [locationSite],
        floors: [floor],
        selectedFloor: floor,
        resources: [locationResource, target],
        occupancy: [],
        closures: [],
        policy,
        generatedAt: '2026-08-19T00:00:00Z',
      });
    if (path.endsWith('/bookings')) {
      if (request.method() === 'GET') return fulfillSuccess(route, confirmed ? [confirmed] : []);
      const input = request.postDataJSON() as WorkplaceBookingInput;
      writes.push({ key: request.headers()['idempotency-key'] ?? '', input });
      if (writes.length === 1)
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: '{"success":false,"message":"The selected space changed."}',
        });
      confirmed = {
        ...input,
        bookingId: actualBookingId,
        resourceName: target.name,
        resourceType: 'DESK',
        siteName: locationSite.name,
        floorName: floor.name,
        status: 'RESERVED',
        checkedInAt: null,
        releasedAt: null,
        canCheckIn: false,
        canCancel: true,
        canRelease: false,
        checkInOpensAt: '2026-08-19T00:00:00Z',
        checkInClosesAt: '2026-08-19T01:00:00Z',
        version: 0,
      };
      return fulfillSuccess(route, confirmed);
    }
    return route.fallback();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const criteria = `v=1&sites=${locationSite.siteId}&floors=${floor.floorId}&types=DESK&features=MONITOR&accessible=true&date=2026-08-19&start=09%3A01&duration=60&view=list`;
  await page.goto(`/workplace/find?${criteria}&resource=${locationResource.resourceId}`);
  const inspector = page.getByRole('complementary', { name: locationResource.name, exact: true });
  await inspector.getByRole('button', { name: 'Book this space', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Book a workspace', exact: true });
  await dialog
    .getByRole('textbox', { name: 'Purpose', exact: true })
    .fill('Preserved purpose after known conflict');
  await dialog.getByRole('switch').uncheck();
  await dialog.getByRole('button', { name: 'Book', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  const alternatives = dialog.getByRole('button', {
    name: 'Keep filters and find another space',
    exact: true,
  });
  await expect(alternatives).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Purpose', exact: true })).toHaveValue(
    'Preserved purpose after known conflict'
  );
  await waitForDialogPaint(page);
  await page.screenshot({
    path: testInfo.outputPath('workplace-native-conflict-390-loaded.png'),
    fullPage: false,
  });
  await alternatives.click();
  await expect(dialog).toHaveCount(0);
  const preserved = new URL(page.url()).searchParams;
  for (const [key, value] of new URLSearchParams(criteria)) expect(preserved.get(key)).toBe(value);
  expect(preserved.has('resource')).toBe(false);
  expect(writes).toHaveLength(1);
  await page
    .getByRole('button', { name: /^Actual alternative desk.*Initial booking checks passed$/u })
    .click();
  await page
    .getByRole('complementary', { name: target.name, exact: true })
    .getByRole('button', { name: 'Book this space', exact: true })
    .click();
  await expect(dialog.getByRole('textbox', { name: 'Purpose', exact: true })).toHaveValue(
    'Preserved purpose after known conflict'
  );
  await expect(dialog.getByRole('switch')).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Book', exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].input).toMatchObject({
    resourceId: target.resourceId,
    purpose: writes[0].input.purpose,
    visibleToColleagues: false,
    startsAt: writes[0].input.startsAt,
    endsAt: writes[0].input.endsAt,
  });
  expect(writes[1].key).not.toBe(writes[0].key);
  await expect(page).toHaveURL(/\/workplace\/reservations\?/u);
  expect(new URL(page.url()).searchParams.get('reservation')).toBe(actualBookingId);
  await expect(
    page
      .getByRole('dialog', { name: 'Reservation inspector', exact: true })
      .getByRole('heading', { name: target.name, exact: true })
  ).toBeVisible();
});

test('explicit start minutes and custom duration remain native query scope and invalid duration stays blocked', async ({
  page,
}) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS.filter((item) => item.resourceKey !== 'APP.ROOMS'),
  });
  const ranges: { from: string | null; to: string | null }[] = [];
  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/photo') || url.pathname.endsWith('/photo/metadata'))
      return route.fulfill({ status: 404 });
    if (url.pathname.endsWith('/explore')) {
      ranges.push({ from: url.searchParams.get('from'), to: url.searchParams.get('to') });
      return fulfillSuccess(route, {
        sites: [locationSite],
        floors: [floor],
        selectedFloor: floor,
        resources: [locationResource],
        occupancy: [],
        closures: [],
        policy,
        generatedAt: '2026-08-19T00:00:00Z',
      });
    }
    return route.fallback();
  });
  const route = `/workplace/find?v=1&sites=${locationSite.siteId}&floors=${floor.floorId}&tz=Asia%2FSeoul&date=2026-08-19&start=09%3A17&types=DESK&view=list&resource=${locationResource.resourceId}&duration=`;
  await page.goto(`${route}45`);
  const inspector = page.getByRole('complementary', { name: locationResource.name, exact: true });
  const book = inspector.getByRole('button', { name: 'Book this space', exact: true });
  await expect(book).toBeEnabled();
  await expect
    .poll(() => ranges.at(-1))
    .toEqual({ from: '2026-08-19T00:17:00Z', to: '2026-08-19T01:02:00Z' });
  expect(new URL(page.url()).searchParams.get('start')).toBe('09:17');
  expect(new URL(page.url()).searchParams.get('duration')).toBe('45');
  await page.goto(`${route}15`);
  await expect(book).toBeDisabled();
  await expect
    .poll(() => ranges.at(-1))
    .toEqual({ from: '2026-08-19T00:17:00Z', to: '2026-08-19T00:32:00Z' });
  expect(new URL(page.url()).searchParams.get('start')).toBe('09:17');
  expect(new URL(page.url()).searchParams.get('duration')).toBe('15');
  await expect(
    inspector.getByText(
      'The selected time is outside the booking policy for this space. Adjust the date, time, or duration.',
      { exact: true }
    )
  ).toBeVisible();
});
