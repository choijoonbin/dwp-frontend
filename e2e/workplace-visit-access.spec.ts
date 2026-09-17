import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';

import type { Locator, Page, Route } from '@playwright/test';

const RESERVATION_ID = '17000000-0000-4000-8000-000000000001';
const VISIT_ID = '17000000-0000-4000-8000-000000000002';
const PREVIEW_ID = '17000000-0000-4000-8000-000000000003';
const SITE_ID = '17000000-0000-4000-8000-000000000004';
const ZONE_ID = '17000000-0000-4000-8000-000000000005';
const EVENT_ID = '17000000-0000-4000-8000-000000000006';
const COMMAND_ID = '17000000-0000-4000-8000-000000000007';
const POLICY_ID = '17000000-0000-4000-8000-000000000008';
const BINDING_ID = '17000000-0000-4000-8000-000000000009';
const DEVICE_ID = '17000000-0000-4000-8000-000000000010';
const NOW = '2026-09-18T01:00:00Z';
const GOVERNED_PRODUCTS = [
  'approvals',
  'calendar',
  'communications',
  'dwaion',
  'hcm',
  'mail',
  'meetings',
  'messaging',
  'notifications',
  'services',
  'spaces',
  'workplace',
] as const;

function accepted(route: Route, data: unknown) {
  return route.fulfill({
    status: 202,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'Accepted', data }),
  });
}

async function elevatedAuthority(page: Page) {
  await page.unroute('**/api/auth/product-surface-contexts');
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    fulfillSuccess(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'screen-17-elevated',
      sourceRevisions: { auth: '17', policy: '17', productRelationship: '17' },
      activeAccessMode: 'ELEVATED',
      generatedAt: NOW,
      contexts: [],
      rollouts: GOVERNED_PRODUCTS.map((productKey) => ({
        productKey,
        state: '000',
        flags: { contextShadow: false, capabilityEnforcement: false, surfaceUi: false },
        cohort: 'baseline',
        opaqueRevision: `rollout-${productKey}-baseline`,
        authorityStatus: 'NOT_EVALUATED',
      })),
    })
  );
}

function guest() {
  return {
    opaqueRef: 'vault://visitor/screen-17',
    maskedLabel: 'K** J**',
    purpose: 'Business visit',
    fieldRetentionExpiresAt: {
      maskedLabel: '2026-12-18T01:00:00Z',
      purpose: '2026-12-18T01:00:00Z',
    },
  };
}

function provider(kind: 'VISITOR' | 'ACCESS', state = 'READY') {
  return {
    kind,
    state,
    configurationVersion: 3,
    observedConfigurationVersion: state === 'READY' ? 3 : null,
    evidenceReference: state === 'READY' ? `${kind.toLowerCase()}-evidence-17` : null,
    lastSuccessAt: state === 'READY' ? NOW : null,
    sourceAt: NOW,
    receivedAt: NOW,
    limitationCode: state === 'READY' ? null : 'PROVIDER_UNVERIFIED',
    manualOwner: 'Site security',
    manualProcedure: 'Confirm with the security desk.',
  };
}

function requesterVisit(state: string, version: number) {
  return {
    visitId: VISIT_ID,
    reservation: { authority: 'WORKPLACE', id: RESERVATION_ID, version: 7 },
    visitType: 'BUSINESS',
    siteId: SITE_ID,
    startsAt: '2026-09-20T01:00:00Z',
    endsAt: '2026-09-20T02:00:00Z',
    zoneIds: [ZONE_ID],
    guests: [guest()],
    state,
    version,
    recoveryByGetOnly: state === 'RESULT_UNKNOWN',
    recoveryHref: state === 'RESULT_UNKNOWN' ? `/v1/workplace/visits/${VISIT_ID}` : null,
    timeline: [
      {
        eventId: EVENT_ID,
        eventType: `VISIT_${state}`,
        state,
        detailCode: null,
        occurredAt: NOW,
      },
    ],
    updatedAt: NOW,
  };
}

function command(state: string, version: number) {
  return {
    visit: requesterVisit(state, version),
    receipt: {
      commandId: COMMAND_ID,
      visitId: VISIT_ID,
      state: state === 'RESULT_UNKNOWN' ? 'RESULT_UNKNOWN' : 'SUCCEEDED',
      statusHref: `/v1/workplace/visits/${VISIT_ID}`,
      replayed: false,
      correlationId: 'screen-17-e2e',
      acceptedAt: NOW,
    },
  };
}

type VisitEvidence = {
  previewBodies: unknown[];
  commandUrls: string[];
  commandKeys: string[];
  recoveryGets: () => number;
};

async function mockReservationVisits(
  page: Page,
  locale: 'en' | 'ko' = 'en',
  options: { readOnly?: boolean; denied?: boolean; providerState?: string } = {}
): Promise<VisitEvidence> {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-09-18T01:00:00Z'));
  await mockShellSession(page, options.readOnly ? ['EMPLOYEE'] : ['TENANT_ADMIN'], {
    locale,
    permissions: options.readOnly
      ? [
          {
            resourceType: 'APP',
            resourceKey: 'APP.WORKPLACE',
            permissionCode: 'VIEW',
            effect: 'ALLOW',
          },
        ]
      : FULL_PRODUCT_PERMISSIONS,
  });
  let current: ReturnType<typeof requesterVisit> | null = null;
  let recoveryGets = 0;
  const previewBodies: unknown[] = [];
  const commandUrls: string[] = [];
  const commandKeys: string[] = [];

  await page.route('**/api/platform/v1/workplace/bookings**', (route) =>
    fulfillSuccess(route, [
      {
        bookingId: RESERVATION_ID,
        resourceId: 'desk-screen-17',
        resourceName: 'Visitor welcome desk',
        resourceType: 'DESK',
        siteName: 'Seoul HQ',
        floorName: '17F',
        purpose: 'Visitor access acceptance',
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
    ])
  );
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
  await page.route('**/api/platform/v1/workplace/visits**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (options.denied) return route.fulfill({ status: 404, body: '' });
    if (request.method() === 'GET' && url.pathname === '/api/platform/v1/workplace/visits') {
      return fulfillSuccess(route, { items: current ? [current] : [], generatedAt: NOW });
    }
    if (request.method() === 'GET' && url.pathname.endsWith(`/${VISIT_ID}`)) {
      if (current?.state === 'RESULT_UNKNOWN') {
        recoveryGets += 1;
        if (recoveryGets > 1) current = requesterVisit('READY', current.version + 1);
      }
      return fulfillSuccess(route, current);
    }
    if (url.pathname.endsWith('/visits:preview')) {
      previewBodies.push(request.postDataJSON());
      const state = options.providerState ?? 'READY';
      return fulfillSuccess(route, {
        previewId: PREVIEW_ID,
        version: 1,
        reservation: { authority: 'WORKPLACE', id: RESERVATION_ID, version: 7 },
        visitType: 'BUSINESS',
        siteId: SITE_ID,
        startsAt: '2026-09-20T01:00:00Z',
        endsAt: '2026-09-20T02:00:00Z',
        zoneIds: [ZONE_ID],
        guestCount: 1,
        approvalRequired: false,
        ndaRequired: true,
        identityVerificationRequired: true,
        minimumCollectionFields: ['maskedLabel', 'purpose'],
        visitorProvider: provider('VISITOR', state),
        accessProvider: provider('ACCESS', state),
        eligible: state === 'READY',
        limitations: state === 'READY' ? [] : ['PROVIDER_UNVERIFIED'],
        expiresAt: '2026-09-18T01:10:00Z',
        generatedAt: NOW,
      });
    }
    commandUrls.push(url.pathname);
    commandKeys.push(request.headers()['idempotency-key'] ?? '');
    if (url.pathname === '/api/platform/v1/workplace/visits') {
      current = requesterVisit('PREVIEWED', 1);
    } else if (url.pathname.endsWith(':send-invitation')) {
      current = requesterVisit('APPROVED', (current?.version ?? 1) + 1);
    } else if (url.pathname.endsWith('/access-requests')) {
      current = requesterVisit('RESULT_UNKNOWN', (current?.version ?? 2) + 1);
      recoveryGets = 0;
    } else if (url.pathname.endsWith(':cancel')) {
      current = requesterVisit('CANCELLED', (current?.version ?? 3) + 1);
    }
    return accepted(route, command(current!.state, current!.version));
  });
  return { previewBodies, commandUrls, commandKeys, recoveryGets: () => recoveryGets };
}

async function openVisitorTab(page: Page, locale: 'en' | 'ko' = 'en') {
  await page.goto(
    `/workplace/reservations?v=1&period=UPCOMING&types=ALL&status=ACTIVE&authority=ALL&reservation=${RESERVATION_ID}&reservationAuthority=WORKPLACE&tab=VISITS`
  );
  const inspectorName = locale === 'ko' ? '예약 상세 검사기' : 'Reservation inspector';
  const inspector = page
    .getByRole('complementary', { name: inspectorName })
    .or(page.getByRole('dialog', { name: inspectorName }));
  await expect(inspector).toBeVisible();
  const visitorTab = inspector.getByRole('tab', {
    name: locale === 'ko' ? '방문자' : 'Visitors',
  });
  if ((await visitorTab.getAttribute('aria-selected')) !== 'true') await visitorTab.click();
  await expect(visitorTab).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/(?:\?|&)tab=VISITS(?:&|$)/u);
  return page.getByTestId('workplace-reservation-visitors');
}

async function focusByKeyboard(page: Page, target: Locator) {
  for (let index = 0; index < 80; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error('Keyboard focus did not reach the visitor action.');
}

test('runs preview, create, invitation, GET-only access recovery, and cancel without raw PII', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const evidence = await mockReservationVisits(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const visits = await openVisitorTab(page);

  await visits.getByRole('button', { name: 'Prepare visitor access' }).click();
  await visits.getByRole('textbox', { name: 'Visit type' }).fill('BUSINESS');
  await visits.getByRole('textbox', { name: 'Site ID' }).fill(SITE_ID);
  await visits.getByRole('textbox', { name: 'Access zone IDs' }).fill(ZONE_ID);
  await visits
    .getByRole('textbox', { name: 'Visitor vault reference' })
    .fill('vault://visitor/screen-17');
  await visits.getByRole('textbox', { name: 'Masked label' }).fill('K** J**');
  await visits.getByRole('checkbox', { name: /confirm the purpose/i }).check();
  await visits.getByRole('button', { name: 'Preview requirements' }).click();
  await expect(visits.getByText('Visitor provider · Ready')).toBeVisible();
  await visits.getByRole('button', { name: 'Create visit' }).click();

  await expect(visits.getByText('Prepared', { exact: true })).toBeVisible();
  await visits.getByRole('checkbox', { name: /current visit version/i }).check();
  await visits.getByRole('button', { name: 'Send invitation' }).click();
  await expect(visits.getByText('Approved', { exact: true })).toBeVisible();
  await visits.getByRole('checkbox', { name: /current visit version/i }).check();
  await visits.getByRole('button', { name: 'Request access' }).click();
  await expect(visits.getByText(/GET status recovery/i)).toBeVisible();
  const postsBeforeRecovery = evidence.commandUrls.length;
  await visits.getByRole('button', { name: 'Refresh status' }).click();
  await expect(visits.getByText('Ready for arrival', { exact: true })).toBeVisible();
  expect(evidence.commandUrls).toHaveLength(postsBeforeRecovery);
  await visits.getByRole('checkbox', { name: /current visit version/i }).check();
  await visits.getByRole('button', { name: 'Cancel visit' }).click();
  await expect(visits.getByText('Cancelled', { exact: true })).toBeVisible();

  expect(evidence.previewBodies[0]).toMatchObject({
    guests: [{ opaqueRef: 'vault://visitor/screen-17', maskedLabel: 'K** J**' }],
  });
  expect(evidence.commandKeys.every(Boolean)).toBe(true);
  expect(new Set(evidence.commandKeys).size).toBe(evidence.commandKeys.length);
  expect(evidence.recoveryGets()).toBeGreaterThan(1);
  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  expect(JSON.stringify(storage)).not.toMatch(/visitor@example|passport|010-\d/u);
  await expect(page.getByText('visitor@example.test')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('screen17-user-en-1440.png'), fullPage: true });
});

for (const entry of [
  { width: 1280, locale: 'en' as const },
  { width: 390, locale: 'ko' as const },
  { width: 320, locale: 'en' as const },
]) {
  test(`keeps the ${entry.width}px ${entry.locale} visitor flow accessible and overflow-free`, async ({
    page,
  }, testInfo) => {
    await mockReservationVisits(page, entry.locale);
    if (entry.width === 1280) await page.emulateMedia({ colorScheme: 'dark' });
    if (entry.width === 390) {
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    }
    await page.setViewportSize({ width: entry.width, height: 844 });
    const visits = await openVisitorTab(page, entry.locale);
    if (entry.width === 1280) {
      await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
      await expect(
        visits.getByRole('button', {
          name: entry.locale === 'ko' ? '방문·출입 준비' : 'Prepare visitor access',
        })
      ).toBeVisible();
    }
    if (entry.width === 320) {
      const prepare = visits.getByRole('button', { name: 'Prepare visitor access' });
      await focusByKeyboard(page, prepare);
      await page.keyboard.press('Enter');
      await expect(visits.getByRole('textbox', { name: 'Visit type' })).toBeVisible();
    }
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', entry.width);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`screen17-user-${entry.locale}-${entry.width}.png`),
      fullPage: true,
    });
  });
}

test('blocks creation when either provider is unverified and shows the manual owner', async ({
  page,
}) => {
  await mockReservationVisits(page, 'en', { providerState: 'CONFIGURED_UNVERIFIED' });
  const visits = await openVisitorTab(page);
  await visits.getByRole('button', { name: 'Prepare visitor access' }).click();
  await visits.getByRole('textbox', { name: 'Site ID' }).fill(SITE_ID);
  await visits.getByRole('textbox', { name: 'Access zone IDs' }).fill(ZONE_ID);
  await visits
    .getByRole('textbox', { name: 'Visitor vault reference' })
    .fill('vault://visitor/screen-17');
  await visits.getByRole('textbox', { name: 'Masked label' }).fill('K** J**');
  await visits.getByRole('checkbox', { name: /confirm the purpose/i }).check();
  await visits.getByRole('button', { name: 'Preview requirements' }).click();
  await expect(visits.getByText(/Manual recovery owner: Site security/u)).toBeVisible();
  await expect(visits.getByRole('button', { name: 'Create visit' })).toBeDisabled();
});

test('fails closed for an unauthorized requester without exposing visit existence', async ({
  page,
}) => {
  await mockReservationVisits(page, 'en', { denied: true });
  const visits = await openVisitorTab(page);
  await expect(
    visits.getByText(/could not be loaded without exposing visit details/u)
  ).toBeVisible();
  await expect(visits.getByText('K** J**')).toHaveCount(0);
});

function adminVisit(state = 'APPROVAL_PENDING', version = 4) {
  return {
    ...requesterVisit(state, version),
    requesterUserId: 17001,
    recoveryByGetOnly: undefined,
    recoveryHref: undefined,
    providerOperationEvidenceReference: null,
    limitationCode: null,
  };
}

async function mockAdminVisit(page: Page, readOnly = false) {
  await isolateWorkplaceDevelopmentUpdates(page);
  await mockShellSession(page, readOnly ? ['EMPLOYEE'] : ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: readOnly
      ? [
          {
            resourceType: 'APP',
            resourceKey: 'ADMIN.WORKPLACE',
            permissionCode: 'VIEW',
            effect: 'ALLOW',
          },
        ]
      : FULL_PRODUCT_PERMISSIONS,
  });
  if (!readOnly) await elevatedAuthority(page);
  let detail = adminVisit();
  let posts = 0;
  await page.route('**/api/platform/v1/admin/workplace/visits**', (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'GET' && pathname.endsWith('/exceptions')) {
      return fulfillSuccess(route, {
        items: [
          {
            visitId: VISIT_ID,
            kind: 'APPROVAL_PENDING',
            state: detail.state,
            maskedGuestLabel: 'K** J**',
            siteId: SITE_ID,
            startsAt: '2026-09-20T01:00:00Z',
            version: detail.version,
            limitationCode: null,
            updatedAt: NOW,
          },
        ],
        generatedAt: NOW,
      });
    }
    if (request.method() === 'GET') return fulfillSuccess(route, detail);
    posts += 1;
    detail = adminVisit('APPROVED', detail.version + 1);
    return accepted(route, {
      visit: detail,
      receipt: {
        commandId: COMMAND_ID,
        visitId: VISIT_ID,
        state: 'SUCCEEDED',
        statusHref: `/v1/admin/workplace/visits/${VISIT_ID}`,
        replayed: false,
        correlationId: 'screen-17-admin',
        acceptedAt: NOW,
      },
    });
  });
  return { posts: () => posts };
}

test('operates the elevated visitor exception inspector and fails closed in read-only mode', async ({
  page,
}) => {
  const evidence = await mockAdminVisit(page);
  await page.goto('/workplace/admin/visits');
  await page.getByRole('button', { name: 'Inspect' }).click();
  const inspector = page.getByRole('complementary', { name: 'Visitor exception inspector' });
  await inspector.getByRole('checkbox', { name: /elevated operation/i }).check();
  await inspector.getByRole('button', { name: 'Approve visit' }).click();
  await expect(inspector.getByText('Approved', { exact: true })).toBeVisible();
  expect(evidence.posts()).toBe(1);

  await mockAdminVisit(page, true);
  await page.goto('/workplace/admin/visits');
  await expect(page.getByText(/Read-only authority is active/u)).toBeVisible();
  await page.getByRole('button', { name: 'Inspect' }).click();
  await expect(page.getByRole('button', { name: 'Approve visit' })).toBeDisabled();
});

async function mockVisitManagement(page: Page) {
  await isolateWorkplaceDevelopmentUpdates(page);
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await elevatedAuthority(page);
  const posts: string[] = [];
  const policy = {
    policyId: POLICY_ID,
    visitType: 'BUSINESS',
    approvalRequired: true,
    ndaRequired: false,
    identityVerificationRequired: true,
    allowedFrom: '08:00:00',
    allowedUntil: '20:00:00',
    minimumCollectionFields: ['maskedLabel', 'purpose'],
    retentionDays: 90,
    active: true,
    version: 2,
    updatedAt: NOW,
  };
  const providerBinding = {
    bindingId: BINDING_ID,
    kind: 'VISITOR',
    providerCode: 'DWP_VISITOR',
    configurationVersion: 3,
    observedConfigurationVersion: 3,
    state: 'READY',
    evidenceReference: 'provider-evidence-17',
    lastSuccessAt: NOW,
    sourceAt: NOW,
    receivedAt: NOW,
    manualOwner: 'Site security',
    manualProcedure: 'Confirm with the security desk.',
    active: true,
    version: 3,
    updatedAt: NOW,
  };
  const kiosk = {
    deviceId: DEVICE_ID,
    siteId: SITE_ID,
    policyId: POLICY_ID,
    privacyNoticeVersion: 'v1',
    privacyNoticeAccepted: true,
    lastHeartbeatAt: NOW,
    helpRequested: false,
    state: 'READY',
    active: true,
    version: 2,
    updatedAt: NOW,
  };
  await page.route('**/api/platform/v1/admin/workplace/visit-policies**', (route) => {
    const request = route.request();
    if (request.method() === 'GET') return fulfillSuccess(route, [policy]);
    posts.push(new URL(request.url()).pathname);
    if (request.url().endsWith(':impact-preview')) {
      return fulfillSuccess(route, {
        policyId: POLICY_ID,
        currentVersion: 2,
        affectedFutureVisits: 3,
        warnings: ['Three future visits require review.'],
        generatedAt: NOW,
      });
    }
    return accepted(route, {});
  });
  await page.route('**/api/platform/v1/admin/workplace/access-zones**', (route) => {
    const request = route.request();
    if (request.method() === 'GET') return fulfillSuccess(route, []);
    posts.push(new URL(request.url()).pathname);
    return accepted(route, {
      item: {
        zoneId: ZONE_ID,
        ...request.postDataJSON(),
        version: 1,
        updatedAt: NOW,
      },
      receipt: {
        commandId: COMMAND_ID,
        resourceType: 'ACCESS_ZONE',
        resourceId: ZONE_ID,
        resourceVersion: 1,
        replayed: false,
        correlationId: 'screen-17-zone',
        acceptedAt: NOW,
      },
    });
  });
  await page.route('**/api/platform/v1/admin/workplace/provider-bindings**', (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return fulfillSuccess(route, [providerBinding]);
    }
    posts.push(new URL(request.url()).pathname);
    return accepted(route, {
      item: providerBinding,
      receipt: {
        commandId: COMMAND_ID,
        resourceType: 'PROVIDER_BINDING',
        resourceId: BINDING_ID,
        resourceVersion: 3,
        replayed: false,
        correlationId: 'screen-17-provider',
        acceptedAt: NOW,
      },
    });
  });
  await page.route('**/api/platform/v1/admin/workplace/kiosk-devices**', (route) => {
    const request = route.request();
    if (request.method() === 'GET') return fulfillSuccess(route, [kiosk]);
    posts.push(new URL(request.url()).pathname);
    return accepted(route, {
      item: kiosk,
      receipt: {
        commandId: COMMAND_ID,
        resourceType: 'KIOSK_DEVICE',
        resourceId: DEVICE_ID,
        resourceVersion: 2,
        replayed: false,
        correlationId: 'screen-17-kiosk',
        acceptedAt: NOW,
      },
    });
  });
  return posts;
}

test('reaches and operates policy, zone, provider, and kiosk management menus', async ({
  page,
}) => {
  const posts = await mockVisitManagement(page);
  await page.goto('/workplace/admin/visit-policies');
  await page.getByRole('button', { name: 'Inspect' }).click();
  await page.getByRole('checkbox', { name: /versioned change/i }).check();
  await page.getByRole('button', { name: 'Preview impact' }).click();
  await expect(page.getByText('3 future visits may be affected')).toBeVisible();

  await page.goto('/workplace/admin/access-zones');
  await page.getByRole('button', { name: 'Create' }).first().click();
  await page.getByRole('textbox', { name: 'Site ID' }).fill(SITE_ID);
  await page.getByRole('textbox', { name: 'Zone code' }).fill('LOBBY');
  await page.getByRole('textbox', { name: 'Name' }).fill('Visitor lobby');
  await page.getByRole('textbox', { name: 'Provider mapping reference' }).fill('zone/lobby');
  await page.getByRole('checkbox', { name: /versioned change/i }).check();
  await page.getByRole('button', { name: 'Save' }).click();

  await page.goto('/workplace/admin/visit-providers');
  await page.getByRole('button', { name: 'Inspect' }).click();
  await page.getByRole('textbox', { name: 'Test evidence reference' }).fill('provider-test-17');
  await page.getByRole('checkbox', { name: /versioned change/i }).check();
  await page.getByRole('button', { name: 'Record provider test' }).click();

  await page.goto('/workplace/admin/kiosk-devices');
  await page.getByRole('button', { name: 'Inspect' }).click();
  await page.getByRole('textbox', { name: 'Device identity SHA-256' }).fill('c'.repeat(64));
  await page.getByRole('checkbox', { name: /versioned change/i }).check();
  await page.getByRole('button', { name: 'Save' }).click();

  expect(posts).toEqual(
    expect.arrayContaining([
      `/api/platform/v1/admin/workplace/visit-policies/${POLICY_ID}:impact-preview`,
      '/api/platform/v1/admin/workplace/access-zones',
      `/api/platform/v1/admin/workplace/provider-bindings/${BINDING_ID}:test`,
      `/api/platform/v1/admin/workplace/kiosk-devices/${DEVICE_ID}`,
    ])
  );
});
