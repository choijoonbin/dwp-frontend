import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Locator, type Page, type Response } from '@playwright/test';

type WorkplaceExplore = {
  sites: { siteId: string; name: string; state: string }[];
  floors: { floorId: string; siteId: string; name: string }[];
  resources: { resourceId: string; siteId: string; floorId: string }[];
  selectedFloor: { floorId: string; siteId: string; name: string } | null;
};

type WorkplaceNavigationPoi = {
  poiId: string;
  siteId: string;
  floorId: string;
  category: string;
};

type WorkplaceNavigationRoute = {
  outcome: string;
  graphRevisionNumber: number;
  steps: {
    floorId: string;
    fromFloorId: string | null;
    toFloorId: string | null;
    fromPositionX: number | null;
    fromPositionY: number | null;
    toPositionX: number | null;
    toPositionY: number | null;
  }[];
  fallback: { floorMapPath: string | null } | null;
};

type LiveReadEvidence = {
  home?: {
    siteId: string;
    siteName: string;
    floorId: string;
    floorName: string;
    resourceCount: number;
  };
  navigation?: {
    poiCount: number;
    outcome: string;
    graphRevisionNumber: number;
    stepCount: number;
    floorMapPath: string;
    coordinateStepCount: number;
  };
  planner?: { convergedUrl: string; observedUrls: string[] };
  reservations?: { convergedUrl: string; observedUrls: string[] };
  forbiddenWrites?: { count: number; requests: string[] };
};

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function responsePath(response: Response) {
  return new URL(response.url()).pathname;
}

async function responseData<T>(response: Response): Promise<T> {
  const body = (await response.json()) as { data: T };
  return body.data;
}

async function clickWorkplaceMenu(page: Page, pathName: string) {
  const link = page.locator(`a[href^="${pathName}"]`).first();
  await expect(link, `The ${pathName} member menu must be available`).toBeVisible();
  await link.click();
}

async function expectRouteConvergence(page: Page, pathName: string, surface: Locator) {
  await expect(page).toHaveURL((url) => url.pathname === pathName, { timeout: 30_000 });
  await expect(surface).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('product-surface-loading-shell')).toHaveCount(0, {
    timeout: 30_000,
  });

  const observedUrls: string[] = [];
  const attachedStates: boolean[] = [];
  for (let sample = 0; sample < 24; sample += 1) {
    const url = new URL(page.url());
    observedUrls.push(`${url.pathname}${url.search}`);
    attachedStates.push(await surface.isVisible());
    await page.waitForTimeout(100);
  }

  const finalWindow = observedUrls.slice(-12);
  const convergedUrl = finalWindow.at(-1)!;
  expect(
    finalWindow,
    `${pathName} must keep one canonical URL for the final observation window`
  ).toEqual(Array.from({ length: finalWindow.length }, () => convergedUrl));
  expect(
    attachedStates.slice(-12).every(Boolean),
    `${pathName} must remain mounted and visible after URL convergence`
  ).toBe(true);
  return { convergedUrl, observedUrls };
}

test('bundled SKAX member can read the four reported Workplace journeys without loops', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.WORKPLACE_MEMBER_READ_VERIFY !== '1',
    'Opt in explicitly: this verification reads the live local SKAX Workplace runtime.'
  );
  test.setTimeout(150_000);

  const backendReadme = await readFile(path.resolve('../dwp-backend/README.md'), 'utf8');
  const password =
    process.env.DWP_VERIFICATION_PASSWORD ?? backendReadme.match(/공통 비밀번호 `([^`]+)`/)?.[1];
  expect(password, 'The bundled local verification password must be available').toBeTruthy();

  const forbiddenWrites: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.match(/^\/api\/platform\/v1\/(rooms|workplace)(?:\/|$)/u) &&
      !READ_METHODS.has(request.method())
    ) {
      forbiddenWrites.push(`${request.method()} ${url.pathname}`);
    }
  });

  const evidence: LiveReadEvidence = {};
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/sign-in?returnUrl=%2Fworkplace%2Fhome');
  await page.locator('input[name="email"]').fill('joonbin@sk.com');
  await page.locator('input[name="password"]').fill(password!);

  const loginFinished = page.waitForResponse(
    (response) =>
      responsePath(response) === '/api/auth/login' && response.request().method() === 'POST'
  );
  const homeExploreFinished = page.waitForResponse(
    (response) =>
      responsePath(response) === '/api/platform/v1/workplace/explore' &&
      response.request().method() === 'GET'
  );
  await page.locator('#dwp-sign-in-form button[type="submit"]').click();
  expect((await loginFinished).status(), 'The real bundled account must sign in').toBe(200);
  await expect(page).toHaveURL((url) => url.pathname === '/workplace/home', { timeout: 45_000 });

  const homeExploreResponse = await homeExploreFinished;
  expect(homeExploreResponse.status(), 'Workplace home discovery must be readable').toBe(200);
  const homeExplore = await responseData<WorkplaceExplore>(homeExploreResponse);
  const selectedFloor = homeExplore.selectedFloor;
  expect(selectedFloor, 'Workplace home must resolve an authorized selected floor').toBeTruthy();
  const selectedSite = homeExplore.sites.find((site) => site.siteId === selectedFloor!.siteId);
  expect(selectedSite, 'The selected floor must belong to an authorized site').toBeTruthy();
  expect(
    homeExplore.resources.length,
    'The selected Workplace catalog must contain resources'
  ).toBeGreaterThan(0);

  const homeScope = page.getByTestId('workplace-home-scope');
  await expect(homeScope).toBeVisible({ timeout: 30_000 });
  await expect(homeScope.getByRole('heading', { level: 1 })).toContainText(selectedSite!.name);
  await expect(homeScope.getByRole('heading', { level: 1 })).toContainText(selectedFloor!.name);
  await expect(page.getByTestId('workplace-home-source-summary')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('선택된 사업장 없음', { exact: true })).toHaveCount(0);
  await expect(page.getByText('근무 공간 홈을 불러오지 못했습니다', { exact: true })).toHaveCount(
    0
  );
  await expect(
    page.getByText(
      '일부 근무 공간 정보를 불러오지 못했습니다. 사용할 수 있는 영역은 계속 표시합니다.',
      {
        exact: true,
      }
    )
  ).toHaveCount(0);
  evidence.home = {
    siteId: selectedSite!.siteId,
    siteName: selectedSite!.name,
    floorId: selectedFloor!.floorId,
    floorName: selectedFloor!.name,
    resourceCount: homeExplore.resources.length,
  };

  const navigationExploreFinished = page.waitForResponse(
    (response) =>
      responsePath(response) === '/api/platform/v1/workplace/explore' &&
      response.request().method() === 'GET'
  );
  const poisFinished = page.waitForResponse(
    (response) =>
      responsePath(response) === '/api/platform/v1/workplace/navigation/pois' &&
      response.request().method() === 'GET'
  );
  const routeFinished = page.waitForResponse(
    (response) =>
      responsePath(response) === '/api/platform/v1/workplace/navigation/routes' &&
      response.request().method() === 'GET'
  );
  await clickWorkplaceMenu(page, '/workplace/navigation');
  await expect(page).toHaveURL((url) => url.pathname === '/workplace/navigation', {
    timeout: 30_000,
  });
  expect((await navigationExploreFinished).status(), 'Navigation context must be readable').toBe(
    200
  );
  const poisResponse = await poisFinished;
  expect(poisResponse.status(), 'Published navigation POIs must be readable').toBe(200);
  const pois = await responseData<WorkplaceNavigationPoi[]>(poisResponse);
  expect(
    pois.length,
    'Indoor navigation needs at least an origin and a destination'
  ).toBeGreaterThanOrEqual(2);
  expect(pois.some((poi) => poi.category === 'ENTRY')).toBe(true);
  expect(pois.some((poi) => poi.category === 'ROOM')).toBe(true);

  const routeResponse = await routeFinished;
  expect(routeResponse.status(), 'The published indoor route must be readable').toBe(200);
  const route = await responseData<WorkplaceNavigationRoute>(routeResponse);
  expect(route.outcome).toBe('GUIDED');
  expect(route.graphRevisionNumber).toBeGreaterThan(0);
  expect(route.steps.length).toBeGreaterThan(0);
  expect(route.fallback?.floorMapPath).toMatch(/^\/assets\/workplace\/.+\.svg$/u);
  const coordinateSteps = route.steps.filter(
    (step) =>
      step.fromFloorId &&
      step.toFloorId &&
      [step.fromPositionX, step.fromPositionY, step.toPositionX, step.toPositionY].every(
        (coordinate) => typeof coordinate === 'number'
      )
  );
  expect(
    coordinateSteps.length,
    'The guided route must expose drawable graph coordinates'
  ).toBeGreaterThan(0);

  const routeMap = page.getByTestId('workplace-wayfinding-map');
  await expect(routeMap).toBeVisible({ timeout: 30_000 });
  await expect(routeMap.locator('img')).toHaveAttribute('src', route.fallback!.floorMapPath!);
  await expect(routeMap.locator('svg line').first()).toBeVisible();
  expect(
    await routeMap.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)
  ).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: '순차 텍스트 안내', exact: true })).toBeVisible();
  evidence.navigation = {
    poiCount: pois.length,
    outcome: route.outcome,
    graphRevisionNumber: route.graphRevisionNumber,
    stepCount: route.steps.length,
    floorMapPath: route.fallback!.floorMapPath!,
    coordinateStepCount: coordinateSteps.length,
  };

  await clickWorkplaceMenu(page, '/workplace/planner');
  evidence.planner = await expectRouteConvergence(
    page,
    '/workplace/planner',
    page.getByTestId('workplace-weekly-planner')
  );
  await expect(page.getByRole('heading', { name: '주간 예약 플래너', exact: true })).toBeVisible();

  await clickWorkplaceMenu(page, '/workplace/reservations');
  evidence.reservations = await expectRouteConvergence(
    page,
    '/workplace/reservations',
    page.getByRole('heading', { level: 1, name: '내 예약', exact: true })
  );
  await expect(page.getByRole('heading', { name: '내 예약', exact: true })).toBeVisible();

  expect(forbiddenWrites, 'The member read verification must never mutate Workplace data').toEqual(
    []
  );
  evidence.forbiddenWrites = { count: forbiddenWrites.length, requests: forbiddenWrites };
  const evidencePath = testInfo.outputPath('workplace-member-read-live-evidence.json');
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  await testInfo.attach('workplace-member-read-live-evidence.json', {
    path: evidencePath,
    contentType: 'application/json',
  });
});
