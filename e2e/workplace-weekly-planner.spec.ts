import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

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

const NOW = new Date('2026-09-16T00:00:00.000Z');
const USER_ID = 900018;
const PERSON_ID = '51000000-0000-4000-8000-000000000018';
const DELEGATE_ID = '51000000-0000-4000-8000-000000000019';
const GRANT_ID = '52000000-0000-4000-8000-000000000019';
const INTENT_ID = '53000000-0000-4000-8000-000000000001';
const SECOND_INTENT_ID = '53000000-0000-4000-8000-000000000002';
const ITEM_ONE = '54000000-0000-4000-8000-000000000001';
const ITEM_TWO = '54000000-0000-4000-8000-000000000002';
const HOLD_ONE = '55000000-0000-4000-8000-000000000001';
const BATCH_ID = '56000000-0000-4000-8000-000000000001';
const BATCH_ITEM_ONE = '57000000-0000-4000-8000-000000000001';
const BATCH_ITEM_TWO = '57000000-0000-4000-8000-000000000002';
const WAITLIST_ID = '58000000-0000-4000-8000-000000000001';
const OFFER_ID = '59000000-0000-4000-8000-000000000001';

const canonicalPlan =
  `/workplace/planner?v=1&week=2026-09-14&dates=2026-09-14%2C2026-09-15` +
  `&start=09%3A00&duration=540&tz=Asia%2FSeoul&target=SELF&beneficiaries=${PERSON_ID}` +
  `&site=${locationSite.siteId}&floor=${locationFloor.floorId}&types=DESK&step=PLAN`;

type BatchMode = 'SUCCEEDED' | 'PARTIAL' | 'RESULT_UNKNOWN';

type PlannerOptions = Readonly<{
  batchMode?: BatchMode;
  denyBeneficiaries?: boolean;
  expiredHold?: boolean;
  unavailableItem?: boolean;
  offerExpiresInSeconds?: number;
  promotionBlocked?: boolean;
  locale?: 'en' | 'ko';
}>;

function failure(route: Route, status: 403 | 503, message: string) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      success: false,
      errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
      message,
    }),
  });
}

function candidate() {
  return {
    resourceId: locationResource.resourceId,
    calendarResourceId: null,
    name: locationResource.name,
    resourceType: 'DESK',
    siteId: locationSite.siteId,
    floorId: locationFloor.floorId,
    neighborhood: 'Zone A',
    timeZone: locationSite.timeZone,
    accessible: true,
    features: ['MONITOR'],
    preferred: true,
    resourceVersion: 7,
  };
}

type TeamConstraintFixture = Readonly<{
  groupKey: string;
  clientItemKeys: readonly string[];
  sameNeighborhood: boolean;
  adjacentSeats: boolean;
  minimumDistanceMeters: number | null;
  maximumDistanceMeters: number | null;
}>;

function preview(
  intentId = INTENT_ID,
  unavailableItem = false,
  teamPlacementConstraints: readonly TeamConstraintFixture[] = []
) {
  return {
    intentId,
    state: 'PREVIEWED',
    actorUserId: USER_ID,
    requestedHoldTtlSeconds: 120,
    allowAlternatives: true,
    reason: 'Weekly workplace plan',
    items: [
      {
        intentItemId: ITEM_ONE,
        clientItemKey: `2026-09-14:${USER_ID}:DESK`,
        actorUserId: USER_ID,
        beneficiaryUserId: USER_ID,
        beneficiaryPersonPublicId: PERSON_ID,
        beneficiaryDisplayName: 'Tenant Admin',
        delegationGrantId: null,
        resourceType: 'DESK',
        startsAt: '2026-09-14T09:00:00+09:00',
        endsAt: '2026-09-14T18:00:00+09:00',
        decision: 'AVAILABLE',
        decisionCode: 'AVAILABLE',
        candidates: [candidate()],
        version: 1,
      },
      {
        intentItemId: ITEM_TWO,
        clientItemKey: `2026-09-15:${USER_ID}:DESK`,
        actorUserId: USER_ID,
        beneficiaryUserId: USER_ID,
        beneficiaryPersonPublicId: PERSON_ID,
        beneficiaryDisplayName: 'Tenant Admin',
        delegationGrantId: null,
        resourceType: 'DESK',
        startsAt: '2026-09-15T09:00:00+09:00',
        endsAt: '2026-09-15T18:00:00+09:00',
        decision: unavailableItem ? 'UNAVAILABLE' : 'AVAILABLE',
        decisionCode: unavailableItem ? 'NO_AUTHORIZED_RESOURCE_AVAILABLE' : 'AVAILABLE',
        candidates: unavailableItem ? [] : [candidate()],
        version: 1,
      },
    ],
    teamPlacementConstraints,
    placementConstraintEvidence: teamPlacementConstraints.map((constraint) => ({
      groupKey: constraint.groupKey,
      clientItemKeys: constraint.clientItemKeys,
      state: 'UNSUPPORTED',
      code: 'PHYSICAL_DISTANCE_SCALE_NOT_CONFIGURED',
      message: 'This floor has no governed meter scale for physical distance validation.',
      selectedResourceIds: [],
    })),
    version: 1,
    createdAt: NOW.toISOString(),
  };
}

function batch(mode: BatchMode) {
  const firstState = mode === 'RESULT_UNKNOWN' ? 'RESULT_UNKNOWN' : 'SUCCEEDED';
  const secondState =
    mode === 'SUCCEEDED' ? 'SUCCEEDED' : mode === 'PARTIAL' ? 'FAILED' : 'RESULT_UNKNOWN';
  return {
    batchId: BATCH_ID,
    intentId: INTENT_ID,
    actorUserId: USER_ID,
    state: mode,
    failurePolicy: 'KEEP_SUCCEEDED',
    reason: 'Weekly workplace plan',
    items: [
      {
        batchItemId: BATCH_ITEM_ONE,
        intentItemId: ITEM_ONE,
        holdId: HOLD_ONE,
        clientItemKey: `2026-09-14:${USER_ID}:DESK`,
        beneficiaryUserId: USER_ID,
        beneficiaryPersonPublicId: PERSON_ID,
        beneficiaryDisplayName: 'Tenant Admin',
        delegationGrantId: null,
        resourceType: 'DESK',
        resourceId: locationResource.resourceId,
        resourceDisplayName: locationResource.name,
        siteId: locationSite.siteId,
        floorId: locationFloor.floorId,
        timeZone: locationSite.timeZone,
        startsAt: '2026-09-14T09:00:00+09:00',
        endsAt: '2026-09-14T18:00:00+09:00',
        authority: 'WORKPLACE',
        state: firstState,
        ownerReferenceId: mode === 'RESULT_UNKNOWN' ? null : 'booking-workplace-1',
        ownerVersion: mode === 'RESULT_UNKNOWN' ? null : 1,
        errorCode: mode === 'RESULT_UNKNOWN' ? 'RESULT_UNKNOWN' : null,
        errorMessage: mode === 'RESULT_UNKNOWN' ? 'The authoritative result is pending.' : null,
        compensationAvailable: mode !== 'RESULT_UNKNOWN',
        requeryRequired: mode === 'RESULT_UNKNOWN',
        version: 1,
        updatedAt: NOW.toISOString(),
      },
      {
        batchItemId: BATCH_ITEM_TWO,
        intentItemId: ITEM_TWO,
        holdId: '55000000-0000-4000-8000-000000000002',
        clientItemKey: `2026-09-15:${USER_ID}:DESK`,
        beneficiaryUserId: USER_ID,
        beneficiaryPersonPublicId: PERSON_ID,
        beneficiaryDisplayName: 'Tenant Admin',
        delegationGrantId: null,
        resourceType: 'DESK',
        resourceId: locationResource.resourceId,
        resourceDisplayName: locationResource.name,
        siteId: locationSite.siteId,
        floorId: locationFloor.floorId,
        timeZone: locationSite.timeZone,
        startsAt: '2026-09-15T09:00:00+09:00',
        endsAt: '2026-09-15T18:00:00+09:00',
        authority: 'WORKPLACE',
        state: secondState,
        ownerReferenceId: secondState === 'SUCCEEDED' ? 'booking-workplace-2' : null,
        ownerVersion: secondState === 'SUCCEEDED' ? 1 : null,
        errorCode:
          secondState === 'FAILED'
            ? 'RESOURCE_CONFLICT'
            : secondState === 'RESULT_UNKNOWN'
              ? 'RESULT_UNKNOWN'
              : null,
        errorMessage: secondState === 'FAILED' ? 'The resource changed before confirmation.' : null,
        compensationAvailable: secondState === 'SUCCEEDED',
        requeryRequired: secondState === 'RESULT_UNKNOWN',
        version: 1,
        updatedAt: NOW.toISOString(),
      },
    ],
    terminal: true,
    requeryRequired: mode === 'RESULT_UNKNOWN',
    version: 3,
    createdAt: NOW.toISOString(),
    startedAt: NOW.toISOString(),
    completedAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

function waitlistEntry(offerExpiresInSeconds = 300, promotionBlocked = false) {
  return {
    waitlistEntryId: WAITLIST_ID,
    actorUserId: USER_ID,
    beneficiaryUserId: USER_ID,
    beneficiaryPersonPublicId: PERSON_ID,
    beneficiaryDisplayName: 'Tenant Admin',
    resourceType: 'DESK',
    preferredResourceId: null,
    siteId: locationSite.siteId,
    floorId: locationFloor.floorId,
    startsAt: '2026-09-15T09:00:00+09:00',
    endsAt: '2026-09-15T18:00:00+09:00',
    purpose: 'Weekly workplace plan',
    autoConfirm: false,
    conditions: {
      maximumDistanceMeters: 800,
      earliestStart: '2026-09-15T09:00:00+09:00',
      latestEnd: '2026-09-15T18:00:00+09:00',
      pricingMode: 'NOT_APPLICABLE',
      maximumPrice: null,
      currency: null,
    },
    notificationChannels: ['IN_APP', 'EMAIL'],
    state: promotionBlocked ? 'ACTIVE' : 'OFFERED',
    promotionEvaluationState: promotionBlocked ? 'BLOCKED' : 'MATCHED',
    promotionDecisionCode: promotionBlocked ? 'PHYSICAL_DISTANCE_SCALE_NOT_CONFIGURED' : null,
    promotionEvaluatedAt: NOW.toISOString(),
    rank: 3,
    rankVisible: true,
    offer: promotionBlocked
      ? null
      : {
          offerId: OFFER_ID,
          resourceId: locationResource.resourceId,
          resourceDisplayName: locationResource.name,
          siteId: locationSite.siteId,
          floorId: locationFloor.floorId,
          timeZone: locationSite.timeZone,
          holdId: HOLD_ONE,
          state: 'OFFERED',
          startsAt: '2026-09-15T08:00:00+09:00',
          endsAt: '2026-09-15T17:00:00+09:00',
          expiresAt: new Date(NOW.getTime() + offerExpiresInSeconds * 1_000).toISOString(),
          acceptedBatchId: null,
          version: 2,
        },
    version: 2,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

async function mockPlanner(page: Page, options: PlannerOptions = {}) {
  const batchMode = options.batchMode ?? 'SUCCEEDED';
  await isolateWorkplaceDevelopmentUpdates(page);
  if (options.offerExpiresInSeconds === undefined) await page.clock.setFixedTime(NOW);
  else await page.clock.install({ time: NOW });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: options.locale ?? 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  let previewWrites = 0;
  let holdWrites = 0;
  let batchWrites = 0;
  let compensationWrites = 0;
  let replanWrites = 0;
  let waitlistWrites = 0;
  let waitlistReads = 0;
  let waitlistUpdates = 0;
  let waitlistCancels = 0;
  let offerWrites = 0;
  let catalogUnavailable = false;
  let expireOfferOnNextRead = false;
  let currentIntent = preview();
  let currentHolds: Record<string, unknown>[] = [];
  let currentWaitlists = options.unavailableItem
    ? [waitlistEntry(options.offerExpiresInSeconds, options.promotionBlocked)]
    : [];
  const requestBodies: Array<{ path: string; body: unknown; key: string | null }> = [];

  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path.endsWith('/photo') || path.endsWith('/photo/metadata')) {
      return route.fulfill({ status: 404 });
    }
    if (path.endsWith('/booking-intents/beneficiaries') && method === 'GET') {
      if (options.denyBeneficiaries)
        return failure(route, 403, 'Planner beneficiary scope denied.');
      return fulfillSuccess(route, {
        beneficiaries: [
          {
            beneficiaryUserId: USER_ID,
            beneficiaryPersonPublicId: PERSON_ID,
            displayName: 'Tenant Admin',
            delegationGrantId: null,
            resourceTypes: ['DESK', 'PARKING', 'LOCKER'],
            validUntil: null,
            self: true,
          },
          {
            beneficiaryUserId: USER_ID + 1,
            beneficiaryPersonPublicId: DELEGATE_ID,
            displayName: 'Authorized colleague',
            delegationGrantId: GRANT_ID,
            resourceTypes: ['DESK'],
            validUntil: '2026-09-20T00:00:00Z',
            self: false,
          },
        ],
        generatedAt: NOW.toISOString(),
      });
    }
    if (path.endsWith('/explore') && method === 'GET') {
      if (catalogUnavailable)
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ERROR',
            message: 'Planner catalog is unavailable.',
            data: null,
          }),
        });
      return fulfillSuccess(route, {
        sites: [locationSite],
        floors: [locationFloor],
        selectedFloor: locationFloor,
        resources: [locationResource],
        occupancy: [],
        closures: [],
        generatedAt: NOW.toISOString(),
        policy: {},
      });
    }
    if (path.endsWith('/booking-intents/preview') && method === 'POST') {
      previewWrites += 1;
      const intentId = previewWrites === 1 ? INTENT_ID : SECOND_INTENT_ID;
      const body = request.postDataJSON() as {
        teamPlacementConstraints?: readonly TeamConstraintFixture[];
      };
      currentIntent = preview(
        intentId,
        options.unavailableItem,
        body.teamPlacementConstraints ?? []
      );
      currentHolds = [];
      requestBodies.push({
        path,
        body,
        key: request.headers()['idempotency-key'] ?? null,
      });
      return fulfillSuccess(route, currentIntent);
    }
    if (path.includes('/booking-intents/') && path.endsWith('/holds') && method === 'POST') {
      holdWrites += 1;
      const expiresAt = options.expiredHold ? '2026-09-15T23:59:59Z' : '2026-09-16T00:01:30Z';
      currentHolds = [
        {
          holdId: HOLD_ONE,
          intentItemId: ITEM_ONE,
          resourceId: locationResource.resourceId,
          state: 'ACTIVE',
          startsAt: '2026-09-14T09:00:00+09:00',
          endsAt: '2026-09-14T18:00:00+09:00',
          expiresAt,
          version: 1,
        },
      ];
      requestBodies.push({
        path,
        body: request.postDataJSON(),
        key: request.headers()['idempotency-key'] ?? null,
      });
      return fulfillSuccess(route, {
        intentId: currentIntent.intentId,
        intentState: 'HELD',
        intentVersion: 2,
        serverTime: NOW.toISOString(),
        holds: currentHolds,
      });
    }
    if (/\/booking-intents\/[^/]+$/u.test(path) && method === 'GET') {
      return fulfillSuccess(route, {
        intent: currentIntent,
        holds: currentHolds,
        latestBatchId: batchWrites > 0 ? BATCH_ID : null,
        latestBatchStatusUrl:
          batchWrites > 0 ? `/api/platform/v1/workplace/booking-batches/${BATCH_ID}` : null,
        serverTime: NOW.toISOString(),
      });
    }
    if (path.endsWith('/booking-batches') && method === 'POST') {
      batchWrites += 1;
      requestBodies.push({
        path,
        body: request.postDataJSON(),
        key: request.headers()['idempotency-key'] ?? null,
      });
      return fulfillSuccess(route, {
        batchId: BATCH_ID,
        state: 'ACCEPTED',
        statusUrl: `/api/platform/v1/workplace/booking-batches/${BATCH_ID}`,
        version: 1,
        acceptedAt: NOW.toISOString(),
      });
    }
    if (path.endsWith('/compensations') && method === 'POST') {
      compensationWrites += 1;
      requestBodies.push({
        path,
        body: request.postDataJSON(),
        key: request.headers()['idempotency-key'] ?? null,
      });
      return fulfillSuccess(route, { ...batch('PARTIAL'), state: 'COMPENSATED' });
    }
    if (path.endsWith('/replans') && method === 'POST') {
      replanWrites += 1;
      return fulfillSuccess(route, preview(SECOND_INTENT_ID));
    }
    if (/\/booking-batches\/[^/]+$/u.test(path) && method === 'GET') {
      return fulfillSuccess(route, batch(batchMode));
    }
    if (path.endsWith('/waitlist-entries') && method === 'GET') {
      waitlistReads += 1;
      if (expireOfferOnNextRead && currentWaitlists[0]?.offer) {
        expireOfferOnNextRead = false;
        currentWaitlists = [
          {
            ...currentWaitlists[0],
            offer: { ...currentWaitlists[0].offer, state: 'EXPIRED' },
          },
        ];
      }
      return fulfillSuccess(route, {
        content: currentWaitlists,
        page: 0,
        size: 50,
        totalElements: currentWaitlists.length,
        totalPages: currentWaitlists.length ? 1 : 0,
        generatedAt: NOW.toISOString(),
      });
    }
    if (path.endsWith('/waitlist-entries') && method === 'POST') {
      waitlistWrites += 1;
      currentWaitlists = [waitlistEntry(options.offerExpiresInSeconds, options.promotionBlocked)];
      requestBodies.push({
        path,
        body: request.postDataJSON(),
        key: request.headers()['idempotency-key'] ?? null,
      });
      return fulfillSuccess(route, currentWaitlists[0]);
    }
    if (path.includes('/waitlist-entries/') && path.endsWith(':cancel') && method === 'POST') {
      waitlistCancels += 1;
      requestBodies.push({
        path,
        body: request.postDataJSON(),
        key: request.headers()['idempotency-key'] ?? null,
      });
      currentWaitlists = currentWaitlists.map((entry) => ({
        ...entry,
        state: 'CANCELLED',
        offer: null,
        version: entry.version + 1,
      }));
      return fulfillSuccess(route, currentWaitlists[0]);
    }
    if (path.includes('/waitlist-entries/') && method === 'PATCH') {
      waitlistUpdates += 1;
      const body = request.postDataJSON() as { autoConfirm: boolean };
      currentWaitlists = [
        {
          ...waitlistEntry(options.offerExpiresInSeconds, options.promotionBlocked),
          autoConfirm: body.autoConfirm,
          version: 3,
        },
      ];
      return fulfillSuccess(route, currentWaitlists[0]);
    }
    if (path.includes('/alternative-offers/') && path.endsWith(':accept') && method === 'POST') {
      offerWrites += 1;
      return fulfillSuccess(route, {
        batchId: BATCH_ID,
        state: 'ACCEPTED',
        statusUrl: `/api/platform/v1/workplace/booking-batches/${BATCH_ID}`,
        version: 1,
        acceptedAt: NOW.toISOString(),
      });
    }
    return route.fallback();
  });

  return {
    counts: () => ({
      previewWrites,
      holdWrites,
      batchWrites,
      compensationWrites,
      replanWrites,
      waitlistWrites,
      waitlistReads,
      waitlistUpdates,
      waitlistCancels,
      offerWrites,
    }),
    makeCatalogStale: () => {
      catalogUnavailable = true;
    },
    expireOfferOnRead: () => {
      expireOfferOnNextRead = true;
    },
    requestBodies,
  };
}

test('plans and confirms a server-held multi-day package with responsive and accessible states', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const evidence = await mockPlanner(page);
  await page.goto(canonicalPlan);

  const surface = page.getByTestId('workplace-weekly-planner');
  const configuration = page.getByTestId('workplace-planner-configuration');
  const previewAction = page.getByTestId('workplace-planner-preview');
  await expect(surface).toBeVisible();
  await expect(configuration).toBeVisible();
  await expect(previewAction).toBeEnabled();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);

  for (const width of [1440, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(configuration).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    if (width >= 1280) {
      const configurationBox = await configuration.boundingBox();
      const beneficiaryBox = await page
        .getByTestId(`workplace-planner-beneficiary-${PERSON_ID}`)
        .boundingBox();
      expect(configurationBox && beneficiaryBox).toBeTruthy();
      expect(beneficiaryBox!.x + beneficiaryBox!.width).toBeLessThanOrEqual(
        configurationBox!.x + configurationBox!.width
      );
    } else {
      const mobilePreview = page.getByTestId('workplace-planner-preview-mobile');
      await expect(mobilePreview).toBeVisible();
      const mobilePreviewBox = await mobilePreview.boundingBox();
      expect(mobilePreviewBox).toBeTruthy();
      expect(mobilePreviewBox!.y + mobilePreviewBox!.height).toBeLessThanOrEqual(
        width <= 390 ? 844 : 900
      );
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    }
    await page.screenshot({
      path: testInfo.outputPath(`workplace-weekly-planner-plan-${width}.png`),
      fullPage: false,
    });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await previewAction.click();
  await expect(page).toHaveURL((url) => url.searchParams.get('step') === 'REVIEW');
  await expect(page.getByTestId('workplace-planner-review')).toBeVisible();
  const firstReviewItem = page.getByTestId(`workplace-planner-item-${ITEM_ONE}`);
  await expect(firstReviewItem).toContainText('Booked by Tenant Admin for Tenant Admin');
  await expect(firstReviewItem.locator('details')).not.toHaveAttribute('open', '');
  await expect(firstReviewItem.getByText(/Actor 900018/u)).toBeHidden();
  expect(evidence.counts().previewWrites).toBe(1);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileReviewAction = page.getByTestId('workplace-planner-acquire-holds');
  await mobileReviewAction.scrollIntoViewIfNeeded();
  await expect(mobileReviewAction).toBeVisible();
  const mobileActionBox = await mobileReviewAction.boundingBox();
  expect(mobileActionBox && mobileActionBox.y + mobileActionBox.height).toBeLessThanOrEqual(844);
  await page.screenshot({
    path: testInfo.outputPath('workplace-weekly-planner-review-390.png'),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByTestId('workplace-planner-acquire-holds').click();
  await expect(page.getByTestId('workplace-planner-hold-timer')).toContainText('90s remaining');
  const holdBody = evidence.requestBodies.find((entry) => entry.path.endsWith('/holds'))?.body as {
    selections: Array<Record<string, unknown>>;
  };
  expect(holdBody.selections[0]).toMatchObject({
    expectedItemVersion: 1,
    expectedResourceVersion: 7,
  });

  await page.getByTestId('workplace-planner-confirm-batch').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm batch now' }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('step') === 'RESULT');
  await expect(page.getByTestId('workplace-planner-result')).toContainText('Succeeded');
  await expect(page.getByTestId('workplace-planner-result')).toContainText(locationResource.name);
  await expect(page.getByTestId('workplace-planner-result')).toContainText(
    'Booked for Tenant Admin'
  );
  await expect(page.getByTestId('workplace-planner-result')).toContainText('Pangyo HQ · 12F');
  const firstResultItem = page.getByTestId(`workplace-planner-result-item-${BATCH_ITEM_ONE}`);
  await expect(firstResultItem.locator('details')).not.toHaveAttribute('open', '');
  await expect(firstResultItem.getByText(new RegExp(locationSite.siteId, 'u'))).toBeHidden();
  expect(evidence.counts()).toMatchObject({ previewWrites: 1, holdWrites: 1, batchWrites: 1 });
  const keys = evidence.requestBodies.map((entry) => entry.key).filter(Boolean);
  expect(new Set(keys).size).toBe(keys.length);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('workplace-weekly-planner-result-1440.png'),
    fullPage: false,
  });
});

test('recovers expired holds with a new intent and blocks commands after the source becomes stale', async ({
  page,
}) => {
  const evidence = await mockPlanner(page, { expiredHold: true });
  await page.goto(canonicalPlan);
  await page.getByTestId('workplace-planner-preview').click();
  await page.getByTestId('workplace-planner-acquire-holds').click();
  await expect(page.getByTestId('workplace-planner-hold-timer')).toContainText(
    'server hold expired',
    { ignoreCase: true }
  );
  await page.getByTestId('workplace-planner-acquire-holds').click();
  await expect.poll(() => evidence.counts().previewWrites).toBe(2);
  await expect(page).toHaveURL((url) => url.searchParams.get('intent') === SECOND_INTENT_ID);

  await page.goto(canonicalPlan);
  await expect(page.getByTestId('workplace-planner-preview')).toBeEnabled();
  evidence.makeCatalogStale();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('The planning source is stale.', { exact: false })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId('workplace-planner-preview')).toBeDisabled();
});

test('surfaces partial recovery, waitlist controls, alternative offers and result-unknown requery without replay', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const partial = await mockPlanner(page, { batchMode: 'PARTIAL', unavailableItem: true });
  await page.goto(canonicalPlan);
  await page.getByTestId('workplace-planner-preview').click();
  await page
    .getByTestId(`workplace-planner-item-${ITEM_TWO}`)
    .getByRole('button', { name: 'Join waitlist' })
    .click();
  await expect.poll(() => partial.counts().waitlistWrites).toBe(1);
  const waitlist = page.getByTestId(`workplace-planner-waitlist-${WAITLIST_ID}`);
  await expect(waitlist).toContainText('Current rank 3');
  await expect(waitlist).toContainText('Price: not applicable');
  await expect(waitlist).toContainText('Notifications: In-app, Email');
  await expect(waitlist).toContainText('Proposed:');
  await expect(waitlist).toContainText(`${locationResource.name} · Pangyo HQ · 12F`);
  await expect(waitlist).toContainText('Sep 15, 2026, 8:00 AM – 5:00 PM');
  await expect(waitlist.getByTestId('workplace-planner-offer-countdown')).toContainText(
    'Offer expires in 300s'
  );
  await waitlist.getByRole('button', { name: 'Enable auto-confirm' }).click();
  await expect.poll(() => partial.counts().waitlistUpdates).toBe(1);

  await page.getByTestId('workplace-planner-acquire-holds').click();
  await page.getByTestId('workplace-planner-confirm-batch').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm batch now' }).click();
  await expect(page.getByTestId('workplace-planner-result')).toContainText('Partially completed');
  await page.getByRole('button', { name: 'Accept this offer' }).first().click();
  await expect.poll(() => partial.counts().offerWrites).toBe(1);
  await page.getByRole('button', { name: 'Cancel successful items' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Cancel successful items' })
    .click();
  await expect.poll(() => partial.counts().compensationWrites).toBe(1);
  await page.screenshot({
    path: testInfo.outputPath('workplace-weekly-planner-partial-recovery.png'),
    fullPage: false,
  });

  const unknownPage = await page.context().newPage();
  const unknown = await mockPlanner(unknownPage, { batchMode: 'RESULT_UNKNOWN' });
  await unknownPage.goto(
    `${canonicalPlan.replace('step=PLAN', 'step=RESULT')}&intent=${INTENT_ID}&batch=${BATCH_ID}`
  );
  await expect(unknownPage.getByTestId('workplace-planner-result-unknown')).toBeVisible();
  await unknownPage.screenshot({
    path: testInfo.outputPath('workplace-weekly-planner-result-unknown.png'),
    fullPage: false,
  });
  await unknownPage.getByRole('button', { name: 'Query authoritative status' }).first().click();
  expect(unknown.counts().batchWrites).toBe(0);
  await unknownPage.close();
});

test('preserves team placement conditions and exposes server support evidence', async ({
  page,
}, testInfo) => {
  const evidence = await mockPlanner(page);
  const teamPlan = canonicalPlan
    .replace('target=SELF', 'target=TEAM')
    .replace(`beneficiaries=${PERSON_ID}`, `beneficiaries=${PERSON_ID}%2C${DELEGATE_ID}`)
    .concat('&adjacent=1&neighborhood=1&minDistance=1&maxDistance=8');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(teamPlan);
  await expect(page.getByLabel('Keep team seats adjacent')).toBeChecked();
  await expect(page.getByLabel('Keep the team in one Neighborhood')).toBeChecked();
  await page.getByTestId('workplace-planner-preview-mobile').click();
  await expect(page).toHaveURL((url) => url.searchParams.get('step') === 'REVIEW');

  const previewBody = evidence.requestBodies.find((entry) =>
    entry.path.endsWith('/booking-intents/preview')
  )?.body as { teamPlacementConstraints: TeamConstraintFixture[] };
  expect(previewBody.teamPlacementConstraints).toHaveLength(2);
  expect(previewBody.teamPlacementConstraints[0]).toMatchObject({
    adjacentSeats: true,
    sameNeighborhood: true,
    minimumDistanceMeters: 1,
    maximumDistanceMeters: 8,
  });
  const placement = page.getByTestId('workplace-planner-placement-evidence');
  await expect(placement).toContainText('Unsupported');
  await expect(placement).toContainText('PHYSICAL_DISTANCE_SCALE_NOT_CONFIGURED');
  const delegateReviewItem = page.getByText('Authorized colleague · Desk').first().locator('..');
  await expect(delegateReviewItem.getByText(new RegExp(GRANT_ID, 'u'))).toBeHidden();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await placement.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('workplace-weekly-planner-team-evidence-390.png'),
    fullPage: false,
  });
});

test('preserves legacy planner state and fails closed when beneficiary authority denies access', async ({
  page,
}) => {
  await mockPlanner(page, { denyBeneficiaries: true });
  await page.goto(
    `/workplace/find?mode=PLANNER&date=2026-09-16&sites=${locationSite.siteId}` +
      `&floors=${locationFloor.floorId}&types=DESK#weekly-review`
  );
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === '/workplace/planner' &&
      url.hash === '#weekly-review' &&
      url.searchParams.get('v') === '1' &&
      url.searchParams.get('site') === locationSite.siteId &&
      url.searchParams.get('floor') === locationFloor.floorId &&
      url.searchParams.get('types') === 'DESK' &&
      !url.searchParams.has('mode')
    );
  });
  await expect(page.getByText('Planner access is unavailable', { exact: true })).toBeVisible();
  await expect(page.getByTestId('workplace-planner-preview')).toHaveCount(0);

  const fallbackPage = await page.context().newPage();
  await mockPlanner(fallbackPage);
  const unknownSite = '10000000-0000-4000-8000-000000000099';
  const unknownFloor = '20000000-0000-4000-8000-000000000099';
  await fallbackPage.goto(
    canonicalPlan
      .replace(locationSite.siteId, unknownSite)
      .replace(locationFloor.floorId, unknownFloor)
  );
  await expect(fallbackPage).toHaveURL((url) => {
    return (
      url.searchParams.get('site') === unknownSite && url.searchParams.get('floor') === unknownFloor
    );
  });
  await expect(fallbackPage.getByLabel('Site')).toHaveText('Location unavailable');
  await expect(fallbackPage.getByLabel('Floor')).toHaveText('Location unavailable');
  await expect(fallbackPage.getByText('Location unavailable', { exact: true })).toHaveCount(2);
  await expect(fallbackPage.getByText(unknownSite, { exact: true })).toHaveCount(0);
  await expect(fallbackPage.getByText(unknownFloor, { exact: true })).toHaveCount(0);
  await fallbackPage.close();
});

test('uses server time for offer expiry, refreshes without accepting, and leaves with confirmation', async ({
  page,
}, testInfo) => {
  const evidence = await mockPlanner(page, {
    unavailableItem: true,
    offerExpiresInSeconds: 2,
  });
  await page.goto(canonicalPlan);
  const waitlist = page.getByTestId(`workplace-planner-waitlist-${WAITLIST_ID}`);
  const countdown = waitlist.getByTestId('workplace-planner-offer-countdown');
  await expect(countdown).toContainText('Offer expires in 2s');

  evidence.expireOfferOnRead();
  await page.clock.fastForward(3_000);
  await expect(countdown).toContainText('This offer has expired');
  await expect(waitlist.getByTestId('workplace-planner-offer-accept')).toBeDisabled();
  await expect.poll(() => evidence.counts().waitlistReads).toBeGreaterThan(1);
  expect(evidence.counts().offerWrites).toBe(0);
  await waitlist.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('workplace-weekly-planner-offer-expired.png'),
    fullPage: false,
  });

  const readsBeforeRefresh = evidence.counts().waitlistReads;
  await waitlist.getByTestId('workplace-planner-offer-refresh').click();
  await expect.poll(() => evidence.counts().waitlistReads).toBeGreaterThan(readsBeforeRefresh);

  await waitlist.getByRole('button', { name: 'Leave waitlist' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Leave waitlist' }).click();
  await expect.poll(() => evidence.counts().waitlistCancels).toBe(1);
  const cancellation = evidence.requestBodies.find((entry) => entry.path.endsWith(':cancel'));
  expect(cancellation?.body).toMatchObject({
    expectedVersion: 2,
    explicitConfirmation: true,
  });
  expect(cancellation?.body).toMatchObject({ reason: expect.any(String) });
  expect(cancellation?.key).toMatch(/^workplace:planner-waitlist-cancel:/u);
  await expect(waitlist).toContainText('Cancelled');
  await page.screenshot({
    path: testInfo.outputPath('workplace-weekly-planner-offer-expired-and-left.png'),
    fullPage: false,
  });
});

test('explains blocked waitlist promotion and provides an authoritative refresh action', async ({
  page,
}, testInfo) => {
  const evidence = await mockPlanner(page, {
    unavailableItem: true,
    promotionBlocked: true,
  });
  await page.goto(canonicalPlan);
  const feedback = page.getByTestId(`workplace-planner-promotion-${WAITLIST_ID}`);
  await expect(feedback).toContainText('Alternative matching needs attention');
  await expect(feedback).toContainText('no governed meter scale');
  await expect(page.getByTestId('workplace-planner-offer-accept')).toHaveCount(0);
  const readsBeforeRefresh = evidence.counts().waitlistReads;
  await feedback.getByRole('button', { name: 'Refresh waitlist status' }).click();
  await expect.poll(() => evidence.counts().waitlistReads).toBeGreaterThan(readsBeforeRefresh);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await feedback.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('workplace-weekly-planner-promotion-blocked.png'),
    fullPage: false,
  });

  const koPage = await page.context().newPage();
  await koPage.setViewportSize({ width: 390, height: 844 });
  await mockPlanner(koPage, {
    unavailableItem: true,
    promotionBlocked: true,
    locale: 'ko',
  });
  await koPage.goto(canonicalPlan);
  await expect(koPage.getByRole('heading', { name: '주간 예약 플래너' })).toBeVisible();
  await expect(koPage.getByText('알림 채널: 앱 내 알림, 이메일')).toBeVisible();
  await expect(koPage.getByText('대안 매칭 조건을 확인해야 합니다')).toBeVisible();
  expect((await new AxeBuilder({ page: koPage }).include('main').analyze()).violations).toEqual([]);
  await koPage.getByTestId(`workplace-planner-promotion-${WAITLIST_ID}`).scrollIntoViewIfNeeded();
  await koPage.screenshot({
    path: testInfo.outputPath('workplace-weekly-planner-promotion-blocked-ko-390.png'),
    fullPage: false,
  });
  await koPage.close();
});
