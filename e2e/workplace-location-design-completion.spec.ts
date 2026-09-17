import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
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

async function mockLocationCatalog(
  page: Page,
  state: { denied: boolean; mutations: number },
  resource = locationResource
) {
  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      state.mutations += 1;
      return route.fulfill({ status: 403 });
    }
    if (path.endsWith('/sites')) return fulfillSuccess(route, [locationSite]);
    if (path.endsWith('/floors')) return fulfillSuccess(route, [locationFloor]);
    if (path.endsWith('/resources'))
      return state.denied
        ? route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, message: 'Catalog access denied' }),
          })
        : fulfillSuccess(route, [resource]);
    if (path.endsWith('/future-booking-impact'))
      return fulfillSuccess(route, {
        resourceId: resource.resourceId,
        siteId: resource.siteId,
        resourceName: resource.name,
        resourceState: resource.state,
        owner: 'WORKPLACE',
        from: '2026-09-14T00:00:00Z',
        to: '2026-09-15T00:00:00Z',
        metadata: {
          generatedAt: '2026-09-14T04:00:00Z',
          sourceUpdatedAt: null,
          availability: 'EMPTY',
          owner: 'WORKPLACE',
          denominatorBasis: 'CURRENT_RESOURCE_ROSTER',
          historicalRosterAvailable: false,
          recurringOccurrencesIncluded: true,
        },
        affectedBookings: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
        mutatesBookings: false,
        notificationScheduled: false,
        replacementScheduled: false,
      });
    if (path.endsWith('/closures'))
      return fulfillSuccess(route, {
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        generatedAt: '2026-09-14T04:00:00Z',
      });
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'No record' }),
    });
  });
}

test('location catalog supports keyboard inspection, responsive map/list and clears denied retained resources', async ({
  page,
}, testInfo) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const state = { denied: false, mutations: 0 };
  await mockLocationCatalog(page, state);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/workplace/admin/locations');
  const inspector = page.getByTestId('workplace-location-resource-inspector');
  await expect(
    inspector.getByRole('heading', { name: locationResource.name, exact: true })
  ).toBeVisible();
  await inspector.getByRole('button', { name: 'Print space QR', exact: true }).click();
  const qrPreview = page.getByRole('dialog', { name: 'Space QR print preview', exact: true });
  await expect(qrPreview.getByTestId('workplace-resource-qr-card').locator('svg')).toBeVisible();
  await expect(qrPreview.getByRole('heading', { name: locationResource.name })).toBeVisible();
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.workplaceQrPrinted = 'true';
    };
  });
  await qrPreview.getByRole('button', { name: 'Print QR', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-workplace-qr-printed', 'true');
  await qrPreview.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(qrPreview).toHaveCount(0);
  const node = page
    .getByTestId(`layout-resource-${locationResource.resourceId}`)
    .getByRole('button', { name: locationResource.name, exact: true });
  await node.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`resource=${locationResource.resourceId}`));
  expect(state.mutations).toBe(0);
  for (const width of [1440, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(inspector).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await page.screenshot({ path: testInfo.outputPath(`locations-${width}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Map view', exact: true }).click();
  await expect(node).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('locations-320-text-200.png'),
    fullPage: true,
  });
  state.denied = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByTestId('workplace-location-resource-inspector')).toHaveCount(0);
  await expect(page.getByTestId(`layout-resource-${locationResource.resourceId}`)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: locationResource.name, exact: true })).toHaveCount(
    0
  );
  expect(state.mutations).toBe(0);
});

test('the real site-floor tree and native type counts filter inspection without inventing coordinates or commands', async ({
  page,
}, testInfo) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const upperFloor = {
    ...locationFloor,
    floorId: '20000000-0000-4000-8000-000000000013',
    floorNumber: 13,
    name: '13F',
    resourceCount: 1,
  };
  const focus = {
    ...locationResource,
    resourceId: '30000000-0000-4000-8000-000000000020',
    name: 'Actual catalog focus pod',
    type: 'FOCUS_POD',
    code: 'F-20',
    positionX: 42,
    positionY: 18,
  };
  const locker = {
    ...locationResource,
    floorId: upperFloor.floorId,
    resourceId: '30000000-0000-4000-8000-000000000030',
    name: 'Actual catalog locker',
    type: 'LOCKER',
    code: 'L-30',
  };
  const resourceReads: string[] = [];
  let writes = 0;
  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      writes += 1;
      return route.fulfill({ status: 403 });
    }
    if (path.endsWith('/sites'))
      return fulfillSuccess(route, [
        { ...locationSite, configuredFloorCount: 2, resourceCount: 3 },
      ]);
    if (path.endsWith('/floors'))
      return fulfillSuccess(route, [{ ...locationFloor, resourceCount: 2 }, upperFloor]);
    if (path.endsWith('/resources')) {
      resourceReads.push(path);
      return fulfillSuccess(
        route,
        path.includes(upperFloor.floorId) ? [locker] : [locationResource, focus]
      );
    }
    if (path.endsWith('/closures'))
      return fulfillSuccess(route, {
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        generatedAt: '2026-09-14T04:00:00Z',
      });
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{"success":false,"message":"No record"}',
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/workplace/admin/locations?site=${locationSite.siteId}&floor=${locationFloor.floorId}`
  );
  const tree = page.getByTestId('workplace-location-site-tree');
  await expect(tree.getByRole('button', { name: '12F 2', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(tree.getByRole('button', { name: '13F 1', exact: true })).toBeVisible();
  const summary = tree.getByRole('region', { name: 'Selected floor catalog', exact: true });
  await expect(summary.getByRole('button', { name: 'All spaces 2', exact: true })).toBeVisible();
  await summary.getByRole('button', { name: 'Focus pod 1', exact: true }).click();
  await expect(page).toHaveURL(/type=FOCUS_POD/u);
  await expect(page).toHaveURL(/view=list/u);
  const inspector = page.getByTestId('workplace-location-resource-inspector');
  await expect(inspector.getByRole('heading', { name: focus.name, exact: true })).toBeVisible();
  const coordinates = inspector.getByRole('region', {
    name: 'Floor-plan coordinates',
    exact: true,
  });
  await expect(coordinates.getByText('42%', { exact: true })).toBeVisible();
  await expect(coordinates.getByText('18%', { exact: true })).toBeVisible();
  await tree.getByRole('button', { name: '13F 1', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`floor=${upperFloor.floorId}`, 'u'));
  await expect.poll(() => resourceReads.at(-1)).toContain(upperFloor.floorId);
  await expect(summary.getByRole('button', { name: 'Focus pod 0', exact: true })).toBeVisible();
  await expect(inspector).toHaveCount(0);
  await summary.getByRole('button', { name: 'All spaces 1', exact: true }).click();
  await expect(inspector.getByRole('heading', { name: locker.name, exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/type=/u);
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(async () => Math.round((await page.locator('main').boundingBox())?.x ?? -1))
      .toBe(
        Math.round((await page.locator('aside[id$="-desktop-navigation"]').boundingBox())!.width)
      );
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: testInfo.outputPath(`locations-real-tree-type-filter-${width}-loaded.png`),
      fullPage: true,
    });
  }
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
  ).toEqual([]);
  expect(writes).toBe(0);
});

test('location inspection remains usable with long Korean names, dark high contrast and reduced motion', async ({
  page,
}, testInfo) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'ko',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: { mode: 'dark', density: 'comfortable', highContrast: true, reduceMotion: true },
  });
  const resource = {
    ...locationResource,
    name: '협업 업무를 위한 접근 가능한 집중 좌석과 모니터가 있는 공간',
  };
  const state = { denied: false, mutations: 0 };
  await mockLocationCatalog(page, state, resource);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/workplace/admin/locations?view=map');
  const inspector = page.getByTestId('workplace-location-resource-inspector');
  await expect(inspector.getByRole('heading', { name: resource.name, exact: true })).toBeVisible();
  const selection = page
    .getByTestId(`layout-resource-${resource.resourceId}`)
    .getByRole('button', { name: resource.name, exact: true });
  await selection.focus();
  await page.keyboard.press('Enter');
  await expect(selection).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({
    path: testInfo.outputPath('locations-ko-dark-highcontrast-1280.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))
  ).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await expect(selection).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('locations-ko-dark-forcedcolors-320-text-200.png'),
    fullPage: true,
  });
  expect(state.mutations).toBe(0);
});

test('catalog return URL keeps the requested floor while its authorized floor read is pending', async ({
  page,
}) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const nextFloor = {
    ...locationFloor,
    floorId: '20000000-0000-4000-8000-000000000013',
    floorNumber: 13,
    name: '13F',
  };
  const state = { denied: false, mutations: 0 };
  await mockLocationCatalog(page, state, { ...locationResource, floorId: nextFloor.floorId });
  let releaseFloors!: () => void;
  let floorReadStarted = false;
  const gate = new Promise<void>((resolve) => {
    releaseFloors = resolve;
  });
  await page.route('**/api/platform/v1/admin/workplace/floors?**', async (route) => {
    floorReadStarted = true;
    await gate;
    return fulfillSuccess(route, [locationFloor, nextFloor]);
  });
  const resourceReads: string[] = [];
  await page.route('**/api/platform/v1/admin/workplace/floors/*/resources', async (route) => {
    resourceReads.push(new URL(route.request().url()).pathname);
    return route.fallback();
  });
  await page.goto(
    `/workplace/admin/locations?site=${locationSite.siteId}&floor=${nextFloor.floorId}&resource=${locationResource.resourceId}`
  );
  await expect.poll(() => floorReadStarted).toBe(true);
  await expect(page).toHaveURL(new RegExp(`floor=${nextFloor.floorId}`, 'u'));
  releaseFloors();
  const inspector = page.getByTestId('workplace-location-resource-inspector');
  await expect(
    inspector.getByRole('heading', { name: locationResource.name, exact: true })
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`floor=${nextFloor.floorId}`, 'u'));
  expect(resourceReads.length).toBeGreaterThan(0);
  expect(
    resourceReads.every((path) => path.includes(`/floors/${nextFloor.floorId}/resources`))
  ).toBe(true);
  const media = inspector.getByRole('button', { name: 'Manage space photo', exact: true });
  await expect(media).toHaveAttribute('aria-expanded', 'false');
  const closure = inspector.getByRole('button', { name: 'Scheduled space closure', exact: true });
  await expect(closure).toHaveAttribute('aria-expanded', 'false');
  await closure.click();
  await expect(
    inspector.getByRole('region', { name: 'Scheduled space closure', exact: true })
  ).toBeVisible();
  expect(state.mutations).toBe(0);
});
