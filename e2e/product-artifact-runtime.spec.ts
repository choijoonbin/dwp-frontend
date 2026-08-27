import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import applicationArchitecture from '../architecture/frontend-apps.json' with { type: 'json' };
import { DEFAULT_APP_PERMISSIONS } from './support/runtime-access';
import { mockShellSession } from './support/shell-session';

const MEETINGS_APP_PERMISSIONS = ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
  resourceType: 'APP',
  resourceKey: 'APP.MEETINGS',
  permissionCode,
  effect: 'ALLOW' as const,
}));

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: [...DEFAULT_APP_PERMISSIONS, ...MEETINGS_APP_PERMISSIONS],
  });
});

const DEPLOYED_APPLICATIONS = [
  ...applicationArchitecture.applications,
  applicationArchitecture.shell,
] as const;

test('every declared route and asset namespace resolves to its exact built artifact', async ({
  request,
}) => {
  for (const application of DEPLOYED_APPLICATIONS) {
    for (const prefix of application.routePrefixes) {
      if (prefix === '/ask') continue;
      const routes =
        prefix === '/'
          ? ['/']
          : [prefix, `${prefix}/__artifact-routing-matrix__/nested?scope=tenant-a`];

      for (const route of routes) {
        const response = await request.get(route, { maxRedirects: 0 });
        expect(response.status(), `${route} must be served`).toBe(200);
        expect(response.headers()['cache-control'], `${route} HTML must not be cached`).toBe(
          'no-store'
        );
        expect(
          await response.text(),
          `${route} must load the ${application.id} artifact`
        ).toContain(`/assets/dwp/${application.id}/`);
      }
    }

    const indexResponse = await request.get(
      application.routePrefixes.find((prefix) => prefix !== '/ask') ?? '/'
    );
    const indexHtml = await indexResponse.text();
    const entryAsset = indexHtml.match(
      new RegExp(`src="(/assets/dwp/${application.id}/assets/[^"]+\\.js)"`, 'u')
    )?.[1];
    expect(entryAsset, `${application.id} must declare its own entry asset`).toBeTruthy();
    const assetResponse = await request.get(entryAsset as string);
    expect(assetResponse.status(), `${application.id} entry asset must exist`).toBe(200);
    expect(assetResponse.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  }
});

test('legacy sensitive ask routes redirect without retaining query data', async ({ request }) => {
  for (const route of ['/ask?question=confidential', '/ask/legacy?question=confidential']) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe('/dwaion/new');
    expect(response.headers()['cache-control']).toBe('no-store');
  }
});

test('route-prefix lookalikes cannot select a privileged product artifact', async ({ request }) => {
  for (const route of ['/administrator', '/provider-portal', '/accounting', '/hr-export']) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('/assets/dwp/workspace/');
  }
});

test('built Workspace artifact boots its canonical route', async ({ page }) => {
  await page.goto('/work/home');

  await expect(page.locator('html')).toHaveAttribute('data-application-id', 'workspace');
  await expect(page.getByTestId('work-header')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Work home', level: 1 })).toBeVisible();
});

test('built Meetings artifact loads its canonical route and media runtime', async ({ page }) => {
  await page.route('**/api/meetings/v1/home*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        success: true,
        data: {
          serverNow: '2026-08-27T00:00:00Z',
          timeZone: 'Asia/Seoul',
          capabilities: {
            available: true,
            provider: 'LIVEKIT',
            unavailableReason: null,
            audio: true,
            video: true,
            screenShare: true,
            participantList: true,
            chat: true,
            reactions: true,
            handRaise: true,
            captions: false,
            maximumParticipants: 100,
            tokenTtlSeconds: 300,
            unmuteControl: 'REQUEST_ONLY',
            recordingConfigured: false,
            transcriptConfigured: false,
            aiNotesConfigured: false,
          },
          activeMeeting: null,
          nextMeeting: null,
          today: [],
          recent: [],
          metrics: {
            meetingsToday: 0,
            meetingMinutesToday: 0,
            waitingForApproval: 0,
            qualityScore: null,
            averageJoinSeconds: null,
          },
        },
      }),
    })
  );

  await page.goto('/meetings/home');

  await expect(page.locator('html')).toHaveAttribute('data-application-id', 'meetings');
  await expect(
    page.getByRole('heading', {
      name: "Run today's conversations with less friction",
      level: 1,
    })
  ).toBeVisible();
});

test('unknown deployment route renders a stable local 404 without reloading', async ({ page }) => {
  let mainDocumentRequests = 0;
  page.on('request', (request) => {
    if (request.resourceType() === 'document' && request.frame() === page.mainFrame()) {
      mainDocumentRequests += 1;
    }
  });

  await page.goto('/route-that-no-product-owns?source=artifact-smoke#missing');

  await expect(page.locator('html')).toHaveAttribute('data-application-id', 'workspace');
  const notFound = page.getByTestId('product-artifact-route-not-found');
  const heading = page.getByRole('heading', {
    name: 'This product page could not be found',
    level: 1,
  });
  await expect(notFound).toBeVisible();
  await expect(notFound).toHaveAttribute('id', 'dwp-main-content');
  await expect(heading).toBeVisible();
  await expect(page).toHaveTitle('This product page could not be found · DWP');
  await expect(page.getByRole('button', { name: 'Go to product home' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go to DWP home' })).toBeVisible();
  await expect(page).toHaveURL(/\/route-that-no-product-owns\?source=artifact-smoke#missing$/u);
  await page.waitForTimeout(750);
  expect(mainDocumentRequests).toBe(1);
  expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(1);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(notFound).toBeFocused();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole('button', { name: 'Go to product home' }).click();
  await expect(page).toHaveURL(/\/work\/home$/u);
  await expect(page.getByRole('heading', { name: 'Work home', level: 1 })).toBeFocused();
});
