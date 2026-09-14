import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Request } from '@playwright/test';
import { workplaceSourceSnapshot } from './support/workplace-source-snapshot';

test('original-backed Workplace screens load with the real local session and native data', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.WORKPLACE_NATIVE_VERIFY !== '1',
    'Opt in to read-only local runtime verification.'
  );
  test.setTimeout(180_000);
  const sourcesBefore = await workplaceSourceSnapshot();
  const backendReadme = await readFile(path.resolve('../dwp-backend/README.md'), 'utf8');
  const password = backendReadme.match(/공통 비밀번호 `([^`]+)`/)?.[1];
  expect(password).toBeTruthy();
  const requests: { pathname: string; status: number }[] = [];
  const pending = new Set<Request>();
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/platform/v1/')) pending.add(request);
  });
  page.on('requestfinished', (request) => pending.delete(request));
  page.on('requestfailed', (request) => pending.delete(request));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/platform/v1/'))
      requests.push({ pathname: url.pathname, status: response.status() });
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/sign-in?returnUrl=%2Fworkplace%2Fhome');
  await page.locator('input[name="email"]').fill('joonbin@sk.com');
  await page.locator('input[name="password"]').fill(password!);
  const loginFinished = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/auth/login' &&
      response.request().method() === 'POST'
  );
  await page.locator('#dwp-sign-in-form button[type="submit"]').click();
  const loginResponse = await loginFinished;
  expect(loginResponse.status()).toBe(200);
  const login = (await loginResponse.json()).data;
  const headers = { 'X-Tenant-ID': String(login.tenantId) };
  await expect(page).toHaveURL(/\/workplace\/home/, { timeout: 45_000 });
  const meResponse = await page.request.get('/api/auth/me', { headers });
  expect(meResponse.status()).toBe(200);
  const me = (await meResponse.json()).data;
  expect(String(me.tenantId)).toBe(headers['X-Tenant-ID']);
  const sitesResponse = await page.request.get('/api/platform/v1/admin/workplace/sites', {
    headers,
  });
  expect(sitesResponse.status()).toBe(200);
  const sites = (await sitesResponse.json()).data as { siteId: string }[];
  expect(sites.length).toBeGreaterThan(0);
  const siteId = sites[0].siteId;
  const floorsResponse = await page.request.get(
    `/api/platform/v1/admin/workplace/floors?siteId=${encodeURIComponent(siteId)}`,
    { headers }
  );
  expect(floorsResponse.status()).toBe(200);
  const floors = (await floorsResponse.json()).data as { floorId: string }[];
  const operationsQuery = new URLSearchParams({ siteId, page: '0', size: '25' });
  const now = Date.now();
  operationsQuery.set('from', new Date(now - 7 * 86_400_000).toISOString());
  operationsQuery.set('to', new Date(now + 30 * 86_400_000).toISOString());
  if (floors[0]) operationsQuery.set('floorId', floors[0].floorId);
  const operationsResponse = await page.request.get(
    `/api/platform/v1/admin/workplace/bookings?${operationsQuery}`,
    { headers }
  );
  expect(operationsResponse.status()).toBe(200);
  const nativeBookings = (await operationsResponse.json()).data;
  for (const booking of nativeBookings.content) {
    expect(booking.siteId).toBe(siteId);
    if (floors[0]) expect(booking.floorId).toBe(floors[0].floorId);
  }
  const output = path.resolve('../output/workplace-full-implementation-final/live-original-loaded');
  await mkdir(output, { recursive: true });
  const views = [
    ['01-home', '/workplace/home'],
    ['02-05-explore', '/workplace/explore'],
    ['04-06-bookings', '/workplace/my-bookings'],
    ['04-calendar-owner', '/workplace/my-meetings'],
    ['07-team', '/workplace/home?view=team'],
    ['08-overview', '/workplace/admin/overview'],
    ['09-catalog', `/workplace/admin/locations?site=${encodeURIComponent(siteId)}`],
    ['10-policy', '/workplace/admin/policies'],
    ['10-meeting-operations', '/workplace/admin/meeting-operations'],
    [
      '11-operations',
      `/workplace/admin/operations?view=bookings&site=${encodeURIComponent(siteId)}`,
    ],
    [
      '11-facilities',
      `/workplace/admin/operations?view=facilities&site=${encodeURIComponent(siteId)}`,
    ],
    ['12-insights', `/workplace/admin/overview?view=insights&site=${encodeURIComponent(siteId)}`],
    ['13-access', '/workplace/admin/governance?area=access'],
    ['13-delegation', '/workplace/admin/governance?area=delegation'],
    ['13-experience', '/workplace/admin/governance?area=experience'],
  ];
  const results: {
    screen: string;
    width: number;
    requestedUrl: string;
    actualUrl: string;
    loadedTextLength: number;
    pendingRequests: number;
    progressbars: number;
    screenshot: string;
  }[] = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const [screen, target] of views) {
      await page.goto(target);
      await expect(page).toHaveURL(
        new RegExp(target.split('?')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      );
      await expect(page.getByTestId('product-surface-loading-shell')).toHaveCount(0, {
        timeout: 20_000,
      });
      const main = page.locator('#dwp-main-content').first();
      await expect(main).toBeVisible();
      await expect.poll(() => pending.size, { timeout: 35_000 }).toBe(0);
      await expect(main.getByRole('progressbar')).toHaveCount(0, { timeout: 20_000 });
      await expect(main.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
      if (screen === '10-policy')
        await expect(main.getByTestId('policy-editor')).toBeVisible({ timeout: 20_000 });
      if (width >= 900) {
        await expect
          .poll(
            async () => {
              const [mainBox, sidebarBox] = await Promise.all([
                main.boundingBox(),
                page.getByTestId('rooms-sidebar').boundingBox(),
              ]);
              return mainBox && sidebarBox
                ? Math.abs(mainBox.x - sidebarBox.x - sidebarBox.width)
                : 999;
            },
            { timeout: 10_000 }
          )
          .toBeLessThan(2);
      }
      let previous = '';
      let stable = 0;
      await expect
        .poll(
          async () => {
            if (await page.getByTestId('product-surface-loading-shell').count()) return 0;
            const text = (await main.innerText()).trim();
            stable = text === previous && text.length > 50 ? stable + 1 : 0;
            previous = text;
            return stable;
          },
          { intervals: [250, 250, 250, 500], timeout: 20_000 }
        )
        .toBeGreaterThanOrEqual(2);
      const screenshot = path.join(output, `${screen}-${width}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      results.push({
        screen,
        width,
        requestedUrl: target,
        actualUrl: new URL(page.url()).pathname + new URL(page.url()).search,
        loadedTextLength: previous.length,
        pendingRequests: pending.size,
        progressbars: await main.getByRole('progressbar').count(),
        screenshot,
      });
    }
  }
  const report = {
    status: 'PASS',
    checkedAt: new Date().toISOString(),
    source: 'REAL_LOCAL_UI_LOGIN_NATIVE_HTTP_NO_RESPONSE_MOCKS',
    account:
      'existing local SKAX integrated verification administrator seed shown in the supplied original',
    siteId,
    nativeOperations: {
      status: operationsResponse.status(),
      filteredRows: nativeBookings.content.length,
      totalElements: nativeBookings.totalElements,
      canonicalIdsVerified: true,
    },
    results,
    nativeHttp: requests,
    sourcesBefore,
    sourcesAfter: await workplaceSourceSnapshot(),
    limits: [
      'Read-only populated or empty native states; no bookings or grants created.',
      'Screen03 and command conflict/UNKNOWN states are covered by separate controlled journey tests.',
      'This proves loaded UI and native reads, not pixel identity or external integration success.',
    ],
  };
  expect(report.sourcesAfter).toEqual(sourcesBefore);
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
  await testInfo.attach('live-original-loaded-manifest', {
    body: JSON.stringify(report),
    contentType: 'application/json',
  });
});
