import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import {
  ATTACHMENT_CURSOR,
  EVENT_CURSOR,
  ITEM_ID,
  MESSAGE_CURSOR,
  ORDER_ID,
  OTHER_ORDER_ID,
  PAGE_CURSOR,
  PREVIEW_ID,
  READY_ORDER_ID,
  RESERVATION_ID,
  SITE_ID,
  catalogItem,
  command,
  elevatedAuthority,
  fulfillAccepted,
  mockServices,
  serviceOrder,
} from './support/workplace-reservation-services-fixtures';
import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';
import {
  mockWorkplaceServiceOperations,
  WORKPLACE_SERVICE_OPERATIONS_IDS,
} from './support/workplace-service-operations-fixtures';

import type { Locator, Page } from '@playwright/test';
import type { Locale } from './support/workplace-reservation-services-fixtures';

const ARTIFACTS = path.resolve('artifacts/workplace-services');

type ReservationOrderEvidence = {
  previewBodies: Array<unknown>;
  previewPosts: () => number;
  submitBodies: Array<unknown>;
  submitKeys: string[];
  submitPosts: () => number;
};

async function mockReservationServiceOrder(
  page: Page,
  locale: Locale
): Promise<ReservationOrderEvidence> {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-09-16T01:00:00.000Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale,
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await elevatedAuthority(page);

  const previewBodies: Array<unknown> = [];
  const submitBodies: Array<unknown> = [];
  const submitKeys: string[] = [];
  let previewPosts = 0;
  let submitPosts = 0;
  const submitted = {
    ...serviceOrder({ state: 'SUBMITTED', workState: 'SUBMITTED', impact: 'NONE' }),
    reservationVersion: 7,
    currentReservationVersion: 7,
    reconfirmationRequired: false,
    resultDetail: null,
  };

  await page.route('**/api/platform/v1/workplace/bookings**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillSuccess(route, [
      {
        bookingId: RESERVATION_ID,
        resourceId: 'desk-focus-18',
        resourceName: 'Focus desk 18',
        resourceType: 'DESK',
        siteName: 'Seoul HQ',
        floorName: '12F',
        purpose: 'Global service design review',
        startsAt: '2026-09-20T01:00:00Z',
        endsAt: '2026-09-20T02:00:00Z',
        status: 'RESERVED',
        visibleToColleagues: false,
        checkedInAt: null,
        releasedAt: null,
        canCheckIn: false,
        canCancel: true,
        canRelease: false,
        checkInOpensAt: '2026-09-20T00:45:00Z',
        checkInClosesAt: '2026-09-20T01:15:00Z',
        version: 7,
      },
    ]);
  });
  await page.route('**/api/platform/v1/rooms/bookings**', (route) => fulfillSuccess(route, []));
  await page.route('**/api/platform/v1/rooms/policy', (route) =>
    fulfillSuccess(route, {
      weekStart: 1,
      workingDayStart: '08:00:00',
      workingDayEnd: '20:00:00',
      defaultEventMinutes: 30,
      minimumEventMinutes: 15,
      maximumEventMinutes: 240,
      maximumAdvanceDays: 90,
      defaultBufferMinutes: 0,
      weeklyFocusTargetMinutes: 300,
      dailyMeetingLimitMinutes: 240,
      enforceMeetingAgenda: true,
      allowExternalAttendees: false,
      version: 5,
    })
  );
  await page.route('**/api/platform/v1/workplace/service-catalog**', (route) =>
    fulfillSuccess(route, {
      reservationAuthority: 'WORKPLACE',
      reservationId: RESERVATION_ID,
      reservationVersion: 7,
      reservationStartsAt: '2026-09-20T01:00:00Z',
      reservationEndsAt: '2026-09-20T02:00:00Z',
      siteReference: SITE_ID,
      resourceReference: 'Focus desk 18',
      resourceType: 'DESK',
      items: [catalogItem()],
      generatedAt: '2026-09-17T00:07:00Z',
    })
  );
  await page.route(
    `**/api/platform/v1/workplace/reservations/${RESERVATION_ID}/service-orders**`,
    (route) => {
      const request = route.request();
      const requestPath = new URL(request.url()).pathname;
      if (request.method() === 'POST' && requestPath.endsWith(':preview')) {
        previewPosts += 1;
        previewBodies.push(request.postDataJSON());
        return fulfillSuccess(route, {
          previewId: PREVIEW_ID,
          reservationAuthority: 'WORKPLACE',
          reservationId: RESERVATION_ID,
          reservationVersion: 7,
          reservationStartsAt: '2026-09-20T01:00:00Z',
          reservationEndsAt: '2026-09-20T02:00:00Z',
          siteReference: SITE_ID,
          resourceReference: 'Focus desk 18',
          attendeeCount: 4,
          costCenter: 'CC-1800',
          specialRequest: 'Prepare two microphones.',
          estimatedCost: 50000,
          currency: 'KRW',
          eligible: true,
          limitations: [],
          lines: [
            {
              catalogItemId: ITEM_ID,
              serviceCode: 'AV_ASSIST',
              category: 'AV',
              nameKo: 'AV 사전 점검',
              nameEn: 'AV readiness',
              providerState: 'READY',
              providerCode: 'DWP_NATIVE_FULFILLMENT',
              catalogVersion: 3,
              providerConfigurationVersion: 1,
              siteScope: [SITE_ID],
              supportedResourceTypes: ['ROOM', 'DESK'],
              optionSchema: [
                {
                  key: 'microphoneCount',
                  type: 'NUMBER',
                  required: true,
                  minimum: 1,
                  maximum: 8,
                },
              ],
              minimumQuantity: 1,
              maximumQuantity: 10,
              orderCutoffMinutes: 90,
              cancellationCutoffMinutes: 60,
              slaResponseMinutes: 15,
              slaFulfillmentLeadMinutes: 45,
              cancellationPolicyKo: '시작 1시간 전까지 취소',
              cancellationPolicyEn: 'Cancel until one hour before',
              capacityMode: 'UNBOUNDED',
              capacityFreshnessSeconds: 900,
              inspectionMode: 'NONE',
              inspectionChecklistSchema: [],
              quantity: 2,
              options: { microphoneCount: 2 },
              unitPrice: 25000,
              currency: 'KRW',
              estimatedCost: 50000,
              capacityReservation: null,
              limitations: [],
            },
          ],
          expiresAt: '2026-09-17T00:17:00Z',
          createdAt: '2026-09-17T00:07:00Z',
        });
      }
      if (request.method() === 'POST') {
        submitPosts += 1;
        submitBodies.push(request.postDataJSON());
        submitKeys.push(request.headers()['idempotency-key'] ?? '');
        return fulfillAccepted(route, command(submitted));
      }
      return route.fallback();
    }
  );
  await page.route(`**/api/platform/v1/workplace/service-orders/${ORDER_ID}`, (route) =>
    fulfillSuccess(route, submitted)
  );

  return {
    previewBodies,
    previewPosts: () => previewPosts,
    submitBodies,
    submitKeys,
    submitPosts: () => submitPosts,
  };
}

async function inspectViewport(page: Page, locale: Locale, width: number) {
  const height = width <= 390 ? 844 : 900;
  await page.setViewportSize({ width, height });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByTestId('workplace-service-orders')).toBeVisible();
  await expect(
    page.getByRole('link', { name: locale === 'ko' ? '예약 열기' : 'Open reservations' })
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width
  );
  await mkdir(ARTIFACTS, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACTS, `screen18-service-orders-${locale}-${width}.png`),
    fullPage: true,
  });
}

async function inspectReservationServicesMobileReview(
  page: Page,
  locale: Locale,
  width: 320 | 390
) {
  await page.setViewportSize({ width, height: 844 });
  const inspector = page.getByRole('dialog', {
    name: locale === 'ko' ? '예약 상세 검사기' : 'Reservation inspector',
  });
  const services = page.getByTestId('workplace-reservation-services');
  const inspectorBox = await inspector.boundingBox();
  const servicesBox = await services.boundingBox();

  expect(inspectorBox).not.toBeNull();
  expect(inspectorBox!.x).toBeLessThanOrEqual(1);
  expect(inspectorBox!.width).toBeGreaterThanOrEqual(width - 2);
  expect(servicesBox).not.toBeNull();
  expect(servicesBox!.width).toBeGreaterThanOrEqual(width - 32);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width
  );
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(2_200);

  await inspector.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(
    services.getByRole('button', {
      name: locale === 'ko' ? '서비스 주문 제출' : 'Place service order',
    })
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);

  await mkdir(ARTIFACTS, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACTS, `screen18-reservation-services-preview-${locale}-${width}.png`),
    fullPage: true,
  });
}

async function inspectReservationServicesDesktopReview(page: Page, width: 1280 | 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const inspector = page.getByRole('complementary', { name: 'Reservation inspector' });
  const services = page.getByTestId('workplace-reservation-services');
  const bannerBox = await page.getByRole('banner').boundingBox();
  const headingBox = await page.getByRole('heading', { name: 'My reservations' }).boundingBox();
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });

  await expect(inspector).toBeVisible();
  await expect(services.getByRole('button', { name: 'Place service order' })).toBeVisible();
  expect(bannerBox).not.toBeNull();
  expect(bannerBox!.y).toBeLessThanOrEqual(1);
  expect(headingBox).not.toBeNull();
  expect(headingBox!.y).toBeGreaterThanOrEqual(bannerBox!.height - 1);
  await expect(skipLink).not.toBeFocused();
  expect((await services.boundingBox())?.width ?? 0).toBeGreaterThan(240);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width
  );
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await mkdir(ARTIFACTS, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACTS, `screen18-reservation-services-preview-en-${width}.png`),
  });
}

async function focusInspectorBoundary(inspector: Locator, edge: 'first' | 'last') {
  await inspector.evaluate((element, requestedEdge) => {
    const candidates = Array.from(
      element.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')
    ).filter(
      (candidate) =>
        candidate.tabIndex >= 0 &&
        !candidate.hasAttribute('disabled') &&
        candidate.getClientRects().length > 0
    );
    const target = requestedEdge === 'first' ? candidates[0] : candidates.at(-1);
    target?.focus();
  }, edge);
}

async function prepareMobileReservationServiceReview(page: Page, locale: Locale) {
  const korean = locale === 'ko';
  const inspector = page.getByRole('dialog', {
    name: korean ? '예약 상세 검사기' : 'Reservation inspector',
  });
  await expect(inspector).toBeVisible();
  await inspector.getByRole('tab', { name: korean ? '서비스' : 'Services' }).click();
  const services = page.getByTestId('workplace-reservation-services');
  await services.getByRole('checkbox', { name: korean ? 'AV 사전 점검' : 'AV readiness' }).check();
  await services.getByRole('button', { name: korean ? '계속' : 'Continue', exact: true }).click();
  await services.getByRole('spinbutton', { name: korean ? '수량' : 'Quantity' }).fill('2');
  await services.getByRole('spinbutton', { name: 'microphoneCount *' }).fill('2');
  await services
    .getByRole('textbox', { name: korean ? '비용센터' : 'Cost center' })
    .fill('CC-1800');
  await services
    .getByRole('textbox', { name: korean ? '특별 요청' : 'Special request' })
    .fill(korean ? '마이크 두 개를 준비해 주세요.' : 'Prepare two microphones.');
  await services
    .getByRole('button', { name: korean ? '서비스 주문 검토' : 'Review service order' })
    .click();
  await services
    .getByRole('checkbox', {
      name: korean
        ? '서비스 항목, 예상 비용, 주문 마감과 취소정책을 검토했습니다.'
        : 'I reviewed the service lines, estimate, cutoff, and cancellation policy.',
    })
    .check();
  return { inspector, services };
}

for (const locale of ['en', 'ko'] as const) {
  test(`renders the reservation service order journey at four widths in ${locale}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await mockServices(page, locale);
    await page.goto(`/workplace/service-orders?order=${ORDER_ID}`);
    await expect(
      page.getByRole('heading', {
        name: locale === 'ko' ? '내 근무공간 서비스 주문' : 'My workplace service orders',
      })
    ).toBeVisible();
    await expect(page.getByText(locale === 'ko' ? '요청자' : 'Requester')).toBeVisible();
    await expect(page.getByText('18001', { exact: true })).toHaveCount(0);
    for (const width of [1440, 1280, 390, 320]) await inspectViewport(page, locale, width);
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  });
}

test('loads 101 service orders in two bounded cursor pages without duplicates or omissions', async ({
  page,
}) => {
  const evidence = await mockServices(page, 'en', false, { largeOrderSet: true });
  await page.goto('/workplace/service-orders');

  const orderButtons = page.getByRole('button', { name: 'View order' });
  await expect(orderButtons).toHaveCount(100);
  expect(evidence.listCursors).toEqual(['first:100']);
  expect(evidence.listIds).toHaveLength(101);
  expect(new Set(evidence.listIds).size).toBe(101);

  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(orderButtons).toHaveCount(101);
  await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
  expect(evidence.listCursors).toEqual(['first:100', `${PAGE_CURSOR}:100`]);
});

test('loads bounded event, message, and attachment cursor pages and preserves projection masking', async ({
  page,
}) => {
  const evidence = await mockServices(page, 'en');
  await page.goto(`/workplace/service-orders?order=${ORDER_ID}`);
  const inspector = page.getByTestId('workplace-service-order-inspector');
  const collaboration = page.getByTestId('workplace-service-order-collaboration');

  await expect(inspector).toBeVisible();
  await expect(collaboration.getByText('Use the east entrance for delivery.')).toBeVisible();
  await expect(collaboration.getByText('approved-layout.pdf')).toBeVisible();
  await expect(inspector.getByText('provider-operation-18')).toHaveCount(0);
  await expect(inspector.getByText('FUL-18', { exact: true })).toHaveCount(0);
  await expect(inspector.getByText('1801', { exact: true })).toHaveCount(0);
  await expect(inspector.getByText('18001', { exact: true })).toHaveCount(0);

  const timeline = inspector.getByRole('heading', { name: 'Order timeline' }).locator('..');
  await timeline.getByRole('button', { name: 'Load more' }).click();
  await expect.poll(() => evidence.eventCursors).toEqual(['first', EVENT_CURSOR]);

  const collaborationLoadMore = collaboration.getByRole('button', { name: 'Load more' });
  await expect(collaborationLoadMore).toHaveCount(2);
  await collaborationLoadMore.first().click();
  await expect(collaboration.getByText('Delivery route confirmed.')).toBeVisible();
  await expect.poll(() => evidence.messageCursors).toEqual(['first', MESSAGE_CURSOR]);
  await collaboration.getByRole('button', { name: 'Load more' }).click();
  await expect(collaboration.getByText('delivery-note.pdf')).toBeVisible();
  await expect.poll(() => evidence.attachmentCursors).toEqual(['first', ATTACHMENT_CURSOR]);

  await page.goto(`/workplace/admin/service-fulfillment?order=${ORDER_ID}`);
  const adminInspector = page.getByTestId('workplace-service-fulfillment-inspector');
  await expect(
    adminInspector.getByRole('textbox', { name: 'External fulfillment reference' })
  ).toHaveValue('FUL-18');
  await expect(adminInspector.getByText(/current assignee is retained/u)).toBeVisible();
});

test('anchors the fresh 1440 reservation Services shell at the viewport origin', async ({
  page,
}) => {
  await mockReservationServiceOrder(page, 'en');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    `/workplace/reservations?v=1&period=UPCOMING&types=ALL&status=ACTIVE&authority=ALL&reservation=${RESERVATION_ID}&reservationAuthority=WORKPLACE`
  );

  await expect(page.getByRole('heading', { name: 'My reservations' })).toBeVisible();
  const bannerBox = await page.getByRole('banner').boundingBox();
  const headingBox = await page.getByRole('heading', { name: 'My reservations' }).boundingBox();
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  expect(bannerBox).not.toBeNull();
  expect(bannerBox!.y).toBeLessThanOrEqual(1);
  expect(headingBox).not.toBeNull();
  expect(headingBox!.y).toBeGreaterThanOrEqual(bannerBox!.height - 1);
  await expect(skipLink).not.toBeFocused();
  await mkdir(ARTIFACTS, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACTS, 'screen18-reservation-services-shell-en-1440.png'),
  });
});

test('previews and submits a reservation-scoped service from the reservation Services tab', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const evidence = await mockReservationServiceOrder(page, 'en');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    `/workplace/reservations?v=1&period=UPCOMING&types=ALL&status=ACTIVE&authority=ALL&reservation=${RESERVATION_ID}&reservationAuthority=WORKPLACE`
  );

  const inspector = page.getByRole('complementary', { name: 'Reservation inspector' });
  await expect(inspector.getByRole('heading', { name: 'Focus desk 18' })).toBeVisible();
  await inspector.getByRole('tab', { name: 'Services' }).click();
  const services = page.getByTestId('workplace-reservation-services');
  await services.getByRole('checkbox', { name: 'AV readiness' }).check();
  await services.getByRole('button', { name: 'Continue' }).click();
  await services.getByRole('spinbutton', { name: 'Quantity' }).fill('2');
  await services.getByRole('spinbutton', { name: 'microphoneCount *' }).fill('2');
  await services.getByRole('textbox', { name: 'Cost center' }).fill('CC-1800');
  await services.getByRole('textbox', { name: 'Special request' }).fill('Prepare two microphones.');
  await services.getByRole('button', { name: 'Review service order' }).click();

  await expect.poll(evidence.previewPosts).toBe(1);
  expect(evidence.previewBodies[0]).toEqual({
    reservationAuthority: 'WORKPLACE',
    expectedReservationVersion: 7,
    attendeeCount: 1,
    costCenter: 'CC-1800',
    specialRequest: 'Prepare two microphones.',
    lines: [{ catalogItemId: ITEM_ID, quantity: 2, options: { microphoneCount: 2 } }],
  });
  await expect(page.getByTestId('workplace-reservation-services-preview')).toContainText(
    '50,000 KRW'
  );
  await services
    .getByRole('checkbox', {
      name: 'I reviewed the service lines, estimate, cutoff, and cancellation policy.',
    })
    .check();

  await inspectReservationServicesDesktopReview(page, 1440);
  await inspectReservationServicesDesktopReview(page, 1280);
  await inspectReservationServicesMobileReview(page, 'en', 390);
  await inspectReservationServicesMobileReview(page, 'en', 320);

  await services.getByRole('button', { name: 'Place service order' }).click();
  await expect.poll(evidence.submitPosts).toBe(1);
  expect(evidence.submitKeys[0]).toContain('service-order-submit');
  expect(evidence.submitBodies[0]).toEqual({
    previewId: PREVIEW_ID,
    expectedReservationVersion: 7,
    explicitConfirmation: true,
    reason: 'Prepare two microphones.',
  });
  await expect(page.getByTestId('workplace-reservation-services-result')).toContainText(
    'The service order was accepted.'
  );
});

test('keeps the Korean reservation Services review usable at 390px and 320px', async ({ page }) => {
  test.setTimeout(120_000);
  await mockReservationServiceOrder(page, 'ko');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/workplace/reservations?v=1&period=UPCOMING&types=ALL&status=ACTIVE&authority=ALL&reservation=${RESERVATION_ID}&reservationAuthority=WORKPLACE`
  );
  await prepareMobileReservationServiceReview(page, 'ko');
  await inspectReservationServicesMobileReview(page, 'ko', 390);
  await inspectReservationServicesMobileReview(page, 'ko', 320);
});

test('keeps the reservation Services review operable at 200 percent zoom with forced colors and reduced motion', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  testInfo.annotations.push({
    type: 'zoom',
    description: 'A 1440 by 900 CSS viewport reflowed at 200% is exercised as 720 by 450.',
  });
  await mockReservationServiceOrder(page, 'en');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto(
    `/workplace/reservations?v=1&period=UPCOMING&types=ALL&status=ACTIVE&authority=ALL&reservation=${RESERVATION_ID}&reservationAuthority=WORKPLACE`
  );
  const { inspector, services } = await prepareMobileReservationServiceReview(page, 'en');

  const inspectorBox = await inspector.boundingBox();
  expect(inspectorBox).not.toBeNull();
  expect(inspectorBox!.x).toBeLessThanOrEqual(1);
  expect(inspectorBox!.width).toBeGreaterThanOrEqual(718);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(720);
  await inspector.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(services.getByRole('button', { name: 'Place service order' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await mkdir(ARTIFACTS, { recursive: true });
  await page.screenshot({
    path: path.join(
      ARTIFACTS,
      'screen18-reservation-services-preview-en-200pct-forced-colors-reduced-motion.png'
    ),
  });
});

test('keeps the mobile reservation Services review accessible in dark mode', async ({ page }) => {
  test.setTimeout(120_000);
  await mockReservationServiceOrder(page, 'en');
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/workplace/reservations?v=1&period=UPCOMING&types=ALL&status=ACTIVE&authority=ALL&reservation=${RESERVATION_ID}&reservationAuthority=WORKPLACE`
  );
  const { inspector, services } = await prepareMobileReservationServiceReview(page, 'en');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await inspector.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(services.getByRole('button', { name: 'Place service order' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await mkdir(ARTIFACTS, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACTS, 'screen18-reservation-services-preview-en-dark-390.png'),
  });
});

for (const locale of ['en', 'ko'] as const) {
  test(`keeps the mobile reservation inspector keyboard-modal and restores focus in ${locale}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await mockReservationServiceOrder(page, locale);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      '/workplace/reservations?v=1&period=UPCOMING&types=ALL&status=ACTIVE&authority=ALL'
    );

    const opener = page
      .getByTestId(`workplace-reservation-workplace-${RESERVATION_ID}`)
      .getByRole('button', { name: locale === 'ko' ? '상세 보기' : 'View detail' });
    await expect(opener).toBeVisible();
    await opener.focus();
    await opener.press('Enter');

    const inspector = page.getByRole('dialog', {
      name: locale === 'ko' ? '예약 상세 검사기' : 'Reservation inspector',
    });
    const close = inspector.getByRole('button', { name: locale === 'ko' ? '닫기' : 'Close' });
    await expect(inspector).toBeVisible();
    await expect.soft(close).toBeFocused();

    await focusInspectorBoundary(inspector, 'last');
    await page.keyboard.press('Tab');
    expect
      .soft(await inspector.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    await focusInspectorBoundary(inspector, 'first');
    await page.keyboard.press('Shift+Tab');
    expect
      .soft(await inspector.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);

    await page.keyboard.press('Escape');
    await expect.soft(inspector).toHaveCount(0);
    if ((await inspector.count()) > 0) await close.click();
    await expect.soft(opener).toBeFocused();
  });
}

test('reuses one message command identity after timeout, re-reads state, and supports secure collaboration', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const evidence = await mockServices(page, 'en', true);
  await page.goto(`/workplace/service-orders?order=${ORDER_ID}`);
  const collaboration = page.getByTestId('workplace-service-order-collaboration');
  const readsBefore = evidence.detailReads();
  await collaboration
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Please confirm the loading route.');
  await collaboration
    .getByRole('textbox', { name: 'Message reason' })
    .fill('Clarify fulfillment access');
  await collaboration
    .getByRole('checkbox', { name: /current service order/u })
    .first()
    .check();
  await collaboration.getByRole('button', { name: 'Send message' }).click();
  await expect(collaboration.getByText(/update was not saved/u)).toBeVisible();
  await expect.poll(evidence.detailReads).toBeGreaterThan(readsBefore);
  await collaboration.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(evidence.messagePosts).toBe(2);
  expect(evidence.messageKeys).toHaveLength(2);
  expect(evidence.messageKeys[0]).toBe(evidence.messageKeys[1]);
  await expect(collaboration.getByText('Please confirm the loading route.')).toBeVisible();

  await page
    .getByRole('textbox', { name: 'Reconfirmation reason' })
    .fill('Accept the updated reservation');
  await page.getByRole('checkbox', { name: /latest authoritative reservation/u }).check();
  await page.getByRole('button', { name: 'Reconfirm services' }).click();
  await expect.poll(evidence.reconfirmPosts).toBe(1);

  const downloadPromise = page.waitForEvent('download');
  await collaboration.getByRole('button', { name: 'Download' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('approved-layout.pdf');

  await collaboration.getByLabel('PDF, PNG, or JPEG up to 25 MiB').setInputFiles({
    name: 'new-layout.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7'),
  });
  await collaboration
    .getByRole('textbox', { name: 'Attachment reason' })
    .fill('Share approved layout');
  await collaboration.getByRole('checkbox', { name: /file belongs to the current/u }).check();
  await collaboration.getByRole('button', { name: 'Upload attachment' }).click();
  await expect.poll(evidence.attachmentPosts).toBe(1);
});

test('re-resolves service contacts and purpose-bound assignees on mobile', async ({ page }) => {
  test.setTimeout(120_000);
  await mockServices(page, 'en');
  const operations = await mockWorkplaceServiceOperations(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/workplace/service-orders?order=${ORDER_ID}`);

  const contact = page.locator('#workplace-service-contact');
  await expect(contact.getByRole('heading', { name: 'Contact workplace support' })).toBeVisible();
  await contact.getByRole('combobox', { name: 'Contact target' }).click();
  await page.getByRole('option', { name: 'On-site assignee' }).click();
  await contact
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Please confirm the loading entrance.');
  await contact.getByRole('textbox', { name: 'Change reason' }).fill('Resolve delivery access');
  await contact
    .getByRole('checkbox', { name: /target will be resolved again by the server/u })
    .check();
  await contact.getByRole('button', { name: 'Send contact request' }).click();

  await expect.poll(() => operations.contactRequests).toHaveLength(1);
  expect(operations.contactRequests[0]?.body).toEqual({
    target: 'ASSIGNEE',
    serviceOrderLineId: WORKPLACE_SERVICE_OPERATIONS_IDS.lineId,
    expectedOrderVersion: 7,
    message: 'Please confirm the loading entrance.',
    explicitConfirmation: true,
    reason: 'Resolve delivery access',
  });
  await expect(contact.getByText('The contact request was accepted for Casey Kim.')).toBeVisible();

  await page.goto(`/workplace/admin/service-fulfillment?order=${READY_ORDER_ID}`);
  const assignee = page.getByTestId('workplace-service-assignee-picker');
  await assignee.getByRole('button', { name: 'Change' }).click();
  await assignee.getByRole('textbox', { name: 'Search eligible assignees' }).fill('Casey');
  await assignee.getByRole('combobox', { name: 'Assignee' }).click();
  await page.getByRole('option', { name: 'Casey Kim · FULFILLMENT' }).click();
  await assignee
    .getByRole('textbox', { name: 'Change reason' })
    .fill('Assign the verified operator');
  await assignee.getByRole('button', { name: 'Assign' }).click();

  await expect.poll(() => operations.assignmentRequests).toHaveLength(1);
  expect(operations.assigneeQueries[0]).toContain('purpose=FULFILLMENT');
  expect(operations.assigneeQueries[0]).toContain(
    `providerId=${WORKPLACE_SERVICE_OPERATIONS_IDS.providerId}`
  );
  expect(operations.assignmentRequests[0]?.body).toEqual({
    directorySubjectId: WORKPLACE_SERVICE_OPERATIONS_IDS.assigneeId,
    expectedTaskVersion: 4,
    explicitConfirmation: true,
    reason: 'Assign the verified operator',
  });
  expect(operations.assignmentRequests[0]?.headers['x-dwp-active-access-mode']).toBe('ELEVATED');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
});

test('shows elevated fulfillment truth, blocks unconfigured provider writes, and reaches catalog management', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const evidence = await mockServices(page, 'en');
  await page.goto(`/workplace/admin/service-fulfillment?order=${ORDER_ID}`);
  await expect(page.getByRole('heading', { name: 'Service fulfillment' })).toBeVisible();
  await expect(page.getByText('Provider receipt is being recovered.')).toBeVisible();
  await page.getByRole('button', { name: 'Update fulfillment' }).click({ force: true });
  expect(evidence.fulfillmentPosts()).toBe(0);

  await page.goto(`/workplace/admin/service-fulfillment?order=${OTHER_ORDER_ID}`);
  await expect(page.getByText('Provider evidence is not READY.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update fulfillment' })).toBeDisabled();

  await page.goto('/workplace/admin/service-catalog');
  await expect(page.getByRole('heading', { name: 'Service catalog' })).toBeVisible();
  await expect(page.getByText('AV readiness', { exact: true }).first()).toBeVisible();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await mkdir(ARTIFACTS, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACTS, 'screen18-admin-service-catalog-en-1440.png'),
    fullPage: true,
  });
});

test('updates a ready fulfillment task from the Korean mobile inspector with elevated evidence', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const evidence = await mockServices(page, 'ko');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/workplace/admin/service-fulfillment?order=${READY_ORDER_ID}`);

  const taskInspector = page.locator('[data-testid^="workplace-service-fulfillment-task-"]');
  await expect(page.getByRole('heading', { name: '서비스 이행 관리' })).toBeVisible();
  await taskInspector.getByRole('combobox', { name: '이행 상태' }).click();
  await page.getByRole('option', { name: '이행 완료' }).click();
  await taskInspector.getByRole('textbox', { name: '외부 이행 참조' }).fill('FUL-18-COMPLETE');
  await taskInspector.getByRole('spinbutton', { name: '이행 수량' }).fill('2');
  await taskInspector
    .getByRole('textbox', { name: '차단 또는 결과 상세' })
    .fill('Provider 완료 영수증을 확인했습니다.');
  await taskInspector.getByRole('textbox', { name: '변경 사유' }).fill('현장 이행 완료 확인');
  await taskInspector
    .getByRole('checkbox', {
      name: 'Provider 상태, 최신 작업 버전과 예약 영향을 확인했습니다.',
    })
    .check();
  await taskInspector.getByRole('button', { name: '이행 상태 변경' }).click();

  await expect.poll(evidence.fulfillmentPosts).toBe(1);
  expect(evidence.fulfillmentKeys[0]).toContain('service-fulfillment-update');
  expect(evidence.fulfillmentBodies[0]).toMatchObject({
    expectedVersion: 4,
    state: 'FULFILLED',
    externalFulfillmentReference: 'FUL-18-COMPLETE',
    fulfilledQuantity: 2,
    reason: '현장 이행 완료 확인',
    explicitConfirmation: true,
  });
  await expect(taskInspector).toContainText('이행 완료');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await mkdir(ARTIFACTS, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACTS, 'screen18-admin-fulfillment-ko-390.png'),
    fullPage: true,
  });
});

test('previews a line cancellation, records reconciliation pending, and performs GET-only requester recovery', async ({
  page,
}) => {
  const evidence = await mockServices(page, 'en');
  await page.goto(`/workplace/service-orders?order=${ORDER_ID}`);
  const inspector = page.getByTestId('workplace-service-order-inspector');
  await inspector.getByText('Cancel part of this service line').click();
  await inspector.getByRole('spinbutton', { name: 'Quantity to cancel' }).fill('1');
  await inspector
    .getByRole('textbox', { name: 'Line cancellation reason' })
    .fill('The meeting needs one fewer microphone.');
  await inspector.getByRole('button', { name: 'Preview refund impact' }).click();

  await expect.poll(evidence.linePreviewPosts).toBe(1);
  expect(evidence.linePreviewBodies[0]).toEqual({
    expectedOrderVersion: 7,
    expectedLineVersion: 3,
    cancelQuantity: 1,
    reason: 'The meeting needs one fewer microphone.',
  });
  await expect(inspector.getByText(/refundable 25,000 KRW/u)).toBeVisible();
  await inspector
    .getByRole('checkbox', {
      name: 'I reviewed the provider cancellation and refund impact shown above.',
    })
    .check();
  await inspector.getByRole('button', { name: 'Confirm line cancellation' }).click();

  await expect.poll(evidence.lineCancelPosts).toBe(1);
  expect(evidence.lineCancelBodies[0]).toEqual({
    cancellationPreviewId: PREVIEW_ID,
    expectedOrderVersion: 7,
    expectedLineVersion: 3,
    explicitConfirmation: true,
    reason: 'The meeting needs one fewer microphone.',
  });
  await expect(
    inspector.getByText('Cancellation receipt state: Reconciliation pending')
  ).toBeVisible();
  await expect.poll(evidence.lineRecoveryGets).toBeGreaterThan(0);
  await expect(inspector.getByText('Cancellation result recovery')).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Reconcile provider result' })).toHaveCount(0);
  expect(evidence.lineReconcilePosts()).toBe(0);
});

test('keeps quarantined attachments blocked until an elevated scan verdict makes them CLEAN', async ({
  page,
}) => {
  const evidence = await mockServices(page, 'en', false, { quarantinedAttachment: true });
  await page.goto(`/workplace/admin/service-fulfillment?order=${ORDER_ID}`);
  const collaboration = page.getByTestId('workplace-service-order-collaboration');
  const attachment = collaboration.locator('li').filter({ hasText: 'approved-layout.pdf' }).first();

  await expect(collaboration.getByText('Quarantined', { exact: true })).toBeVisible();
  await expect(attachment.getByRole('button', { name: 'Download' })).toBeDisabled();
  expect(evidence.downloadGets()).toBe(0);

  await attachment.getByText('Scan verdict and evidence').click();
  await attachment
    .getByRole('textbox', { name: 'Scanner evidence reference' })
    .fill('scanner-job-18');
  await attachment
    .getByRole('textbox', { name: 'Scan decision reason' })
    .fill('Verified tenant scanner result');
  await attachment
    .getByRole('checkbox', {
      name: 'I verified the scanner evidence and understand this verdict controls download access.',
    })
    .check();
  await attachment.getByRole('button', { name: 'Record scan verdict' }).click();

  await expect.poll(evidence.scanPosts).toBe(1);
  expect(evidence.scanBodies[0]).toEqual({
    expectedVersion: 2,
    verdict: 'CLEAN',
    scannerEvidenceReference: 'scanner-job-18',
    detail: null,
    explicitConfirmation: true,
    reason: 'Verified tenant scanner result',
  });
  await expect(collaboration.getByText('Clean', { exact: true }).first()).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await attachment.getByRole('button', { name: 'Download' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('approved-layout.pdf');
  expect(evidence.downloadGets()).toBe(1);
});

test('keeps a view-only requester projection readable while every service mutation fails closed', async ({
  page,
}) => {
  const evidence = await mockServices(page, 'en', false, { readOnly: true });
  await page.goto(`/workplace/service-orders?order=${ORDER_ID}`);
  const inspector = page.getByTestId('workplace-service-order-inspector');

  await expect(page.getByRole('heading', { name: 'My workplace service orders' })).toBeVisible();
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Reconfirm services' })).toHaveCount(0);
  await expect(inspector.getByText('Cancel part of this service line')).toHaveCount(0);
  await expect(inspector.getByRole('button', { name: 'Send message' })).toHaveCount(0);
  await expect(inspector.getByRole('button', { name: 'Upload attachment' })).toHaveCount(0);
  expect(evidence.reconfirmPosts()).toBe(0);
  expect(evidence.linePreviewPosts()).toBe(0);
  expect(evidence.lineCancelPosts()).toBe(0);
  expect(evidence.messagePosts()).toBe(0);
  expect(evidence.attachmentPosts()).toBe(0);
});

test('updates catalog content and changes lifecycle only after an elevated reasoned confirmation', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const evidence = await mockServices(page, 'en');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/workplace/admin/service-catalog');
  await page.getByRole('button', { name: 'Edit' }).click();
  const editor = page.getByTestId('workplace-service-catalog-editor');
  await editor.getByRole('textbox', { name: 'English name' }).fill('AV readiness premium');
  await editor
    .getByRole('textbox', { name: 'Change reason' })
    .fill('Publish the verified premium service copy');
  await editor
    .getByRole('checkbox', {
      name: 'I verified provider truth, site scope, options, pricing, cutoff, and cancellation policy.',
    })
    .check();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect.poll(evidence.catalogUpdatePosts).toBe(1);
  expect(evidence.catalogUpdateBodies[0]).toMatchObject({
    expectedVersion: 3,
    nameEn: 'AV readiness premium',
    reason: 'Publish the verified premium service copy',
    explicitConfirmation: true,
  });
  await expect(page.getByText('AV readiness premium', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Deactivate' }).click();
  const dialog = page.getByRole('dialog', { name: 'Deactivate this service item?' });
  await dialog
    .getByRole('textbox', { name: 'Reason for change' })
    .fill('Provider maintenance window');
  await dialog.getByRole('button', { name: 'Deactivate' }).click();
  await expect.poll(evidence.catalogStatePosts).toBe(1);
  expect(evidence.catalogStateBodies[0]).toEqual({
    expectedVersion: 4,
    active: false,
    explicitConfirmation: true,
    reason: 'Provider maintenance window',
  });
  await expect(page.getByText('Inactive', { exact: true }).first()).toBeVisible();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
});

test('fails closed when service administration permission is absent', async ({ page }) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await mockShellSession(page, ['EMPLOYEE'], { locale: 'en', permissions: [] });
  await page.route('**/api/platform/v1/admin/workplace/service-orders**', (route) =>
    fulfillSuccess(route, {
      items: [],
      nextCursor: null,
      hasMore: false,
      generatedAt: '2026-09-17T00:07:00Z',
    })
  );
  await page.goto('/workplace/admin/service-fulfillment');
  await expect(page.getByRole('heading', { name: '403' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  await expect(page.getByTestId('workplace-service-fulfillment')).toHaveCount(0);
});
