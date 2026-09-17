import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import type { Page, Route } from '@playwright/test';

const VISIT_ID = '17000000-0000-4000-8000-000000000002';
const SITE_ID = '17000000-0000-4000-8000-000000000004';
const EVENT_ID = '17000000-0000-4000-8000-000000000006';
const COMMAND_ID = '17000000-0000-4000-8000-000000000007';
const DEVICE_ID = '17000000-0000-4000-8000-000000000010';
const DEVICE_HASH = 'b'.repeat(64);
const NOW = '2026-09-18T01:00:00Z';

function success(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

function session(state: string) {
  return {
    deviceId: DEVICE_ID,
    siteId: SITE_ID,
    policyId: null,
    privacyNoticeVersion: 'v1',
    privacyNoticeAccepted: state !== 'PRIVACY_NOTICE_REQUIRED',
    lastHeartbeatAt: NOW,
    helpRequested: state === 'HELP_REQUESTED',
    state,
    active: state !== 'RETIRED',
    version: 3,
    updatedAt: NOW,
  };
}

function kioskVisit(state: string, version: number) {
  return {
    visitId: VISIT_ID,
    maskedLabel: 'K** J**',
    purpose: 'Business visit',
    siteId: SITE_ID,
    startsAt: '2026-09-20T01:00:00Z',
    endsAt: '2026-09-20T02:00:00Z',
    state,
    version,
  };
}

function requesterVisit(state: string, version: number) {
  return {
    visitId: VISIT_ID,
    reservation: {
      authority: 'WORKPLACE',
      id: '17000000-0000-4000-8000-000000000001',
      version: 7,
    },
    visitType: 'BUSINESS',
    siteId: SITE_ID,
    startsAt: '2026-09-20T01:00:00Z',
    endsAt: '2026-09-20T02:00:00Z',
    zoneIds: ['17000000-0000-4000-8000-000000000005'],
    guests: [
      {
        opaqueRef: null,
        maskedLabel: 'K** J**',
        purpose: 'Business visit',
        fieldRetentionExpiresAt: { maskedLabel: '2026-12-18T01:00:00Z' },
      },
    ],
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

function commandResult(state: string, version: number) {
  return {
    visit: requesterVisit(state, version),
    receipt: {
      commandId: COMMAND_ID,
      visitId: VISIT_ID,
      state: state === 'RESULT_UNKNOWN' ? 'RESULT_UNKNOWN' : 'SUCCEEDED',
      statusHref: `/v1/workplace/visits/${VISIT_ID}`,
      replayed: false,
      correlationId: 'screen-17-kiosk',
      acceptedAt: NOW,
    },
  };
}

async function bootstrap(page: Page) {
  await page.addInitScript(
    ({ hash }) => {
      (
        window as typeof window & {
          __DWP_WORKPLACE_KIOSK_BOOTSTRAP__?: {
            tenantId: string;
            deviceIdentitySha256: string;
          };
        }
      ).__DWP_WORKPLACE_KIOSK_BOOTSTRAP__ = {
        tenantId: '17',
        deviceIdentitySha256: hash,
      };
    },
    { hash: DEVICE_HASH }
  );
}

async function mockKiosk(page: Page, initialState = 'READY') {
  await bootstrap(page);
  let device = session(initialState);
  let visit = kioskVisit('READY', 2);
  let recoveryReads = 0;
  let posts = 0;
  const headers: Array<Record<string, string>> = [];
  await page.route('**/api/auth/csrf', (route) =>
    success(route, { token: 'screen-17-csrf', headerName: 'X-XSRF-TOKEN' })
  );
  await page.route('**/api/platform/v1/workplace/kiosk/**', (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    headers.push(request.headers());
    if (request.method() === 'GET' && pathname.endsWith('/session')) {
      return success(route, device);
    }
    if (request.method() === 'GET' && pathname.endsWith(`/visits/${VISIT_ID}`)) {
      if (visit.state === 'RESULT_UNKNOWN') {
        recoveryReads += 1;
        if (recoveryReads > 1) visit = kioskVisit('ARRIVED', visit.version + 1);
      }
      return success(route, visit);
    }
    posts += 1;
    if (pathname.endsWith(':arrive')) {
      visit = kioskVisit('RESULT_UNKNOWN', visit.version + 1);
      recoveryReads = 1;
      return success(route, commandResult('RESULT_UNKNOWN', visit.version), 202);
    }
    if (pathname.endsWith(':checkout')) {
      visit = kioskVisit('CHECKED_OUT', visit.version + 1);
      return success(route, commandResult('CHECKED_OUT', visit.version), 202);
    }
    if (pathname.endsWith(':heartbeat')) {
      device = { ...session('READY'), version: device.version + 1 };
      return success(route, device, 202);
    }
    device = { ...session('HELP_REQUESTED'), version: device.version + 1 };
    return success(route, device, 202);
  });
  return { headers, posts: () => posts, recoveryReads: () => recoveryReads };
}

test('uses the bound device projection for arrival, GET-only recovery, checkout, and help', async ({
  page,
}, testInfo) => {
  const evidence = await mockKiosk(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/workplace/kiosk');
  const kiosk = page.getByTestId('workplace-visit-kiosk');
  await expect(kiosk.getByRole('heading', { name: 'Visitor arrival' })).toBeVisible();
  await kiosk.getByRole('textbox', { name: 'Visit reference' }).fill(VISIT_ID);
  await kiosk.getByRole('button', { name: 'Find masked visit' }).click();
  await expect(kiosk.getByText('K** J**')).toBeVisible();
  await expect(kiosk.getByText('vault://visitor/screen-17')).toHaveCount(0);
  await kiosk.getByRole('checkbox', { name: /confirm the visitor/i }).check();
  await kiosk.getByRole('button', { name: 'Confirm arrival' }).click();
  await expect(kiosk.getByText(/only performs GET status recovery/i)).toBeVisible();
  const postsBeforeRecovery = evidence.posts();
  await kiosk.getByRole('button', { name: 'Refresh status' }).click();
  await expect(kiosk.getByText('Arrived')).toBeVisible();
  expect(evidence.posts()).toBe(postsBeforeRecovery);
  await kiosk.getByRole('checkbox', { name: /confirm the visitor/i }).check();
  await kiosk.getByRole('button', { name: 'Confirm checkout' }).click();
  await expect(kiosk.getByText('Checked out')).toBeVisible();
  await kiosk.getByRole('checkbox', { name: /confirm the visitor/i }).check();
  await kiosk.getByRole('button', { name: 'Request operator help' }).click();

  expect(evidence.recoveryReads()).toBeGreaterThan(1);
  for (const requestHeaders of evidence.headers) {
    expect(requestHeaders['x-dwp-tenant-id']).toBe('17');
    expect(requestHeaders['x-dwp-device-identity-sha256']).toBe(DEVICE_HASH);
  }
  const browserState = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    bootstrap: '__DWP_WORKPLACE_KIOSK_BOOTSTRAP__' in window,
  }));
  expect(browserState.bootstrap).toBe(false);
  expect(JSON.stringify(browserState)).not.toContain(DEVICE_HASH);
  expect(JSON.stringify(browserState)).not.toMatch(/vault:\/\/visitor|passport|visitor@example/u);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
  ).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('screen17-kiosk-en-390.png'), fullPage: true });
});

for (const state of [
  'OFFLINE',
  'UNREGISTERED',
  'WRONG_SITE',
  'PROVIDER_UNAVAILABLE',
  'HELP_REQUESTED',
  'RETIRED',
]) {
  test(`keeps kiosk ${state} fail-closed`, async ({ page }) => {
    await mockKiosk(page, state);
    await page.goto('/workplace/kiosk');
    await expect(
      page.getByText(
        state === 'WRONG_SITE' ? 'Wrong site' : new RegExp(state.replaceAll('_', ' '), 'i')
      )
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Visit reference' })).toHaveCount(0);
  });
}

test('requires privacy notice acknowledgement before enabling visit lookup', async ({ page }) => {
  await mockKiosk(page, 'PRIVACY_NOTICE_REQUIRED');
  await page.goto('/workplace/kiosk');
  await expect(page.getByRole('textbox', { name: 'Visit reference' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: /confirm the visitor/i }).check();
  await page.getByRole('button', { name: 'Accept privacy notice' }).click();
  await expect(page.getByRole('textbox', { name: 'Visit reference' })).toBeVisible();
});

test('renders the device flow at 320px without horizontal overflow', async ({ page }) => {
  await mockKiosk(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/workplace/kiosk');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
