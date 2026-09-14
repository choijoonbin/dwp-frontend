import { expect, test, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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

const otherFloor = {
  ...locationFloor,
  floorId: '20000000-0000-4000-8000-000000000013',
  floorNumber: 13,
  name: '13F',
  nameKo: '13층',
  nameEn: '13F',
};
const restrictedSite = {
  ...locationSite,
  totalFloorCount: null,
  countsScope: 'FLOORS',
  allowedFloorIds: [locationFloor.floorId],
  configuredFloorCount: 1,
};
const scope = {
  delegationId: '60000000-0000-4000-8000-000000000001',
  scopeType: 'SITE',
  scopeId: locationSite.siteId,
  permissions: ['CATALOG_MANAGE', 'ACCESS_MANAGE', 'POLICY_MANAGE', 'FLOOR_PLAN_MANAGE'],
  floorIds: [locationFloor.floorId],
  validUntil: null,
};
const overrideId = '70000000-0000-4000-8000-000000000001';
const override = {
  policyOverrideId: overrideId,
  scopeType: 'FLOOR',
  scopeId: locationFloor.floorId,
  policyPatch: { requireCheckIn: true },
  state: 'ACTIVE',
  version: 1,
};

async function authorizedDelegate(page: Page) {
  await isolateWorkplaceDevelopmentUpdates(page);
  await mockShellSession(page, ['EMPLOYEE'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
}
function denied(route: Route) {
  return route.fulfill({
    status: 403,
    contentType: 'application/json',
    body: JSON.stringify({
      success: false,
      message: 'The selected floor is no longer authorized.',
    }),
  });
}

test('floor-limited catalog uses actual scoped counts and permits only the canonical floor command', async ({
  page,
}, testInfo) => {
  await authorizedDelegate(page);
  let currentFloor = { ...locationFloor };
  let resourceDenied = false;
  let resourceReads = 0;
  const writes: { path: string; method: string; input: unknown }[] = [];
  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      writes.push({ path, method: request.method(), input: request.postDataJSON() });
      if (path.endsWith(`/floors/${locationFloor.floorId}`)) {
        currentFloor = { ...currentFloor, nameKo: '실제 허용 층', version: 2 };
        return fulfillSuccess(route, currentFloor);
      }
      return denied(route);
    }
    if (path.endsWith('/delegated-admin-scopes/effective')) return fulfillSuccess(route, [scope]);
    if (path.endsWith('/sites')) return fulfillSuccess(route, [restrictedSite]);
    // An unexpected extra producer row must not expand the delegated floor set.
    if (path.endsWith('/floors')) return fulfillSuccess(route, [currentFloor, otherFloor]);
    if (path.endsWith('/resources')) {
      resourceReads += 1;
      return resourceDenied ? denied(route) : fulfillSuccess(route, [locationResource]);
    }
    if (path.endsWith('/closures'))
      return fulfillSuccess(route, {
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        generatedAt: '2026-09-14T08:00:00Z',
      });
    return route.fulfill({ status: 404 });
  });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/workplace/admin/locations');
  const inspector = page.getByTestId('workplace-location-resource-inspector');
  await expect(
    inspector.getByRole('heading', { name: locationResource.name, exact: true })
  ).toBeVisible();
  await expect(page.getByText('1 accessible floors', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add site', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add floor', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /^13F/u })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add space', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Edit floor', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit floor', exact: true });
  await dialog.getByRole('textbox', { name: 'Korean name', exact: true }).fill('실제 허용 층');
  await dialog.getByRole('button', { name: 'Save', exact: true }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([
    {
      path: `/api/platform/v1/admin/workplace/sites/${locationSite.siteId}/floors/${locationFloor.floorId}`,
      method: 'PUT',
      input: expect.objectContaining({ version: 1, nameKo: '실제 허용 층' }),
    },
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  await page.screenshot({
    path: testInfo.outputPath('catalog-restricted-native-floor-1280-loaded.png'),
    fullPage: true,
  });
  const before = resourceReads;
  resourceDenied = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).first().click();
  await expect.poll(() => resourceReads).toBeGreaterThan(before);
  await expect(inspector).toHaveCount(0);
  expect(writes).toHaveLength(1);
});

test('permitted floor policy keeps its native target and UNKNOWN draft until authoritative403 removes it', async ({
  page,
}, testInfo) => {
  await authorizedDelegate(page);
  let sourceDenied = false;
  let overrideReads = 0;
  const changes: { query: Record<string, string>; input: Record<string, unknown> }[] = [];
  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith('/delegated-admin-scopes/effective')) return fulfillSuccess(route, [scope]);
    if (path.endsWith('/sites')) return fulfillSuccess(route, [restrictedSite]);
    if (path.endsWith('/floors')) return fulfillSuccess(route, [locationFloor, otherFloor]);
    if (path.endsWith('/zones')) return fulfillSuccess(route, []);
    if (path.endsWith('/resources')) return fulfillSuccess(route, [locationResource]);
    if (path.endsWith('/policy-overrides') && request.method() === 'GET') {
      overrideReads += 1;
      return sourceDenied ? denied(route) : fulfillSuccess(route, [override]);
    }
    if (path.endsWith('/policy-preview'))
      return fulfillSuccess(route, {
        targetScopeType: url.searchParams.get('scopeType'),
        targetScopeId: url.searchParams.get('scopeId'),
        effectivePolicy: { requireCheckIn: true },
        fieldSources: {},
        appliedOverrideIds: [overrideId],
        generatedAt: '2026-09-14T08:00:00Z',
      });
    if (path.endsWith('/review')) {
      const input = request.postDataJSON();
      return fulfillSuccess(route, {
        targetType: 'POLICY_OVERRIDE',
        targetId: overrideId,
        current: override,
        proposed: input.proposed,
        currentActorAccess: null,
        proposedActorAccess: null,
        knownImpact: ['The native allowed floor requires check-in.'],
        warnings: [],
        evaluatedAt: '2026-09-14T08:00:00Z',
      });
    }
    if (path.endsWith('/changes')) {
      changes.push({ query: Object.fromEntries(url.searchParams), input: request.postDataJSON() });
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'The native outcome is unknown.' }),
      });
    }
    return route.fulfill({ status: 404 });
  });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/workplace/admin/governance?area=policy');
  await expect(page.getByRole('combobox', { name: /^Scope target/u })).toContainText('12F');
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Edit partial policy', exact: true });
  const reason = dialog.getByRole('textbox', { name: 'Reason for change', exact: true });
  await expect(reason).toBeVisible();
  await reason.fill('Retain the actual floor policy purpose');
  await expect(dialog.getByRole('combobox', { name: /^Policy scope/u })).toContainText('Floor');
  await dialog.getByRole('button', { name: 'Review change impact', exact: true }).click();
  await dialog
    .getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
      exact: true,
    })
    .check();
  const save = dialog.getByRole('button', { name: 'Save reviewed change', exact: true });
  await expect(save).toBeEnabled();
  await save.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(save).toBeDisabled();
  await expect(
    dialog.getByText(
      'The save result is unknown. Check the current values and audit before submitting again.',
      { exact: true }
    )
  ).toBeVisible();
  await expect(reason).toHaveValue('Retain the actual floor policy purpose');
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({
    query: { scopeType: 'FLOOR', scopeId: locationFloor.floorId },
    input: {
      reason: 'Retain the actual floor policy purpose',
      confirmed: true,
      proposed: { scopeType: 'FLOOR', scopeId: locationFloor.floorId, version: 1 },
    },
  });
  await expect
    .poll(() => dialog.evaluate((element) => getComputedStyle(element).opacity))
    .toBe('1');
  await page.screenshot({
    path: testInfo.outputPath('policy-restricted-native-floor-unknown-1280-loaded.png'),
    fullPage: false,
  });
  const before = overrideReads;
  sourceDenied = true;
  await dialog.getByRole('button', { name: 'Reload current values', exact: true }).click();
  await expect.poll(() => overrideReads).toBeGreaterThan(before);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  expect(changes).toHaveLength(1);
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    axe.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')
  ).toEqual([]);
});

test('native floor-plan UNKNOWN blocks same-floor reopening until a successful explicit native reread', async ({
  page,
}) => {
  await authorizedDelegate(page);
  let revisionReads = 0;
  const drafts: { path: string; input: unknown }[] = [];
  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/delegated-admin-scopes/effective')) return fulfillSuccess(route, [scope]);
    if (path.endsWith('/sites')) return fulfillSuccess(route, [restrictedSite]);
    if (path.endsWith('/floors')) return fulfillSuccess(route, [locationFloor, otherFloor]);
    if (path.endsWith('/floor-plan-revisions') && request.method() === 'GET') {
      revisionReads += 1;
      return fulfillSuccess(route, []);
    }
    if (path.endsWith('/floor-plan-revisions') && request.method() === 'POST') {
      drafts.push({ path, input: request.postDataJSON() });
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Native draft outcome unknown.' }),
      });
    }
    return route.fulfill({ status: 404 });
  });
  await page.goto('/workplace/admin/governance?area=floorPlans');
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create draft', exact: true });
  await dialog
    .getByRole('textbox', { name: 'Change summary', exact: true })
    .fill('Preserve native permitted-floor release intent');
  await dialog.getByRole('button', { name: 'Create', exact: true }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(dialog.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
  await expect(
    dialog.getByText(
      'The save result is unknown. Check the current values and audit before submitting again.',
      { exact: true }
    )
  ).toBeVisible();
  expect(drafts).toEqual([
    {
      path: `/api/platform/v1/admin/workplace/governance/floors/${locationFloor.floorId}/floor-plan-revisions`,
      input: {
        basedOnRevisionId: null,
        changeSummary: 'Preserve native permitted-floor release intent',
      },
    },
  ]);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create draft', exact: true })).toHaveCount(0);
  const before = revisionReads;
  await page.getByRole('button', { name: 'Reload current values', exact: true }).first().click();
  await expect.poll(() => revisionReads).toBeGreaterThan(before);
  await expect(page.getByRole('button', { name: 'Create draft', exact: true })).toBeEnabled();
  expect(drafts).toHaveLength(1);
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: 'Change summary', exact: true })).toHaveValue(
    'Preserve native permitted-floor release intent'
  );
  await expect(dialog.getByRole('button', { name: 'Create', exact: true })).toBeEnabled();
  expect(drafts).toHaveLength(1);
});
