import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

import type { Page } from '@playwright/test';

const policy = {
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
  showColleagueNames: true,
  version: 2,
};

const campus = {
  campusId: '50000000-0000-0000-0000-000000000001',
  code: 'PANGYO',
  nameKo: '판교 캠퍼스',
  nameEn: 'Pangyo Campus',
  state: 'ACTIVE',
  buildingCount: 1,
  version: 1,
};

const site = {
  siteId: '10000000-0000-0000-0000-000000000001',
  campusId: campus.campusId,
  code: 'PANGYO',
  name: 'Pangyo HQ',
  nameKo: '판교 본사',
  nameEn: 'Pangyo HQ',
  type: 'HEADQUARTERS',
  address: 'Bundang-gu, Seongnam',
  timeZone: 'Asia/Seoul',
  totalFloorCount: 20,
  configuredFloorCount: 1,
  resourceCount: 1,
  state: 'ACTIVE',
  version: 1,
};

const floor = {
  floorId: '20000000-0000-0000-0000-000000000012',
  siteId: site.siteId,
  siteName: site.name,
  floorNumber: 12,
  name: '12F',
  nameKo: '12층',
  nameEn: '12F',
  planWidth: 1200,
  planHeight: 760,
  backgroundAssetPath: null,
  state: 'ACTIVE',
  resourceCount: 1,
  version: 1,
};

const zone = {
  zoneId: '60000000-0000-0000-0000-000000000001',
  floorId: floor.floorId,
  code: 'FOCUS',
  nameKo: '집중 구역',
  nameEn: 'Focus zone',
  type: 'QUIET',
  boundary: {},
  state: 'ACTIVE',
  sectionCount: 0,
  resourceCount: 1,
  version: 1,
};

const resource = {
  resourceId: '30000000-0000-0000-0000-000000000012',
  floorId: floor.floorId,
  siteId: site.siteId,
  calendarResourceId: null,
  code: 'D-1208',
  name: 'Focus desk 12',
  nameKo: '집중 좌석 12',
  nameEn: 'Focus desk 12',
  type: 'DESK',
  mode: 'RESERVABLE',
  state: 'AVAILABLE',
  neighborhood: 'Focus zone',
  capacity: 1,
  features: ['MONITOR', 'STANDING'],
  accessible: true,
  approvalRequired: false,
  positionX: 12,
  positionY: 18,
  widthPercent: 12,
  heightPercent: 10,
  rotationDegrees: 0,
  assignedToCurrentUser: false,
  assignedUserId: null,
  assignedPersonPublicId: null,
  assignedDisplayName: null,
  version: 1,
};

const unplacedResource = {
  ...resource,
  resourceId: '30000000-0000-0000-0000-000000000013',
  code: 'D-1209',
  name: 'Focus desk 13',
  nameKo: '집중 좌석 13',
  nameEn: 'Focus desk 13',
  positionX: 0,
  positionY: 0,
  version: 2,
};

const publishedRevision = {
  revisionId: '70000000-0000-0000-0000-000000000001',
  floorId: floor.floorId,
  revisionNumber: 1,
  basedOnRevisionId: null,
  restoreSourceRevisionId: null,
  state: 'PUBLISHED',
  planWidth: floor.planWidth,
  planHeight: floor.planHeight,
  backgroundAssetPath: null,
  backgroundAssetKey: null,
  backgroundContentType: null,
  backgroundSizeBytes: null,
  backgroundSha256: null,
  changeSummary: 'Initial published layout',
  contentHash: 'published-layout',
  placementCount: 1,
  submittedAt: '2026-08-18T00:00:00Z',
  submittedBy: 900018,
  publishedAt: '2026-08-18T01:00:00Z',
  publishedBy: 900018,
  version: 1,
};

const draftRevision = {
  ...publishedRevision,
  revisionId: '70000000-0000-0000-0000-000000000002',
  revisionNumber: 2,
  basedOnRevisionId: publishedRevision.revisionId,
  state: 'DRAFT',
  changeSummary: 'Resume persisted floor-plan draft',
  contentHash: 'draft-layout',
  submittedAt: null,
  submittedBy: null,
  publishedAt: null,
  publishedBy: null,
  version: 0,
};

const placement = {
  placementId: '80000000-0000-0000-0000-000000000001',
  resourceId: resource.resourceId,
  resourceVersion: resource.version,
  zoneId: zone.zoneId,
  sectionId: null,
  positionX: resource.positionX,
  positionY: resource.positionY,
  widthPercent: resource.widthPercent,
  heightPercent: resource.heightPercent,
  rotationDegrees: resource.rotationDegrees,
  metadata: {},
  version: 0,
};

const READ_ONLY_WORKPLACE_PERMISSIONS = FULL_PRODUCT_PERMISSIONS.filter((permission) => {
  if (
    !['APP.WORKPLACE', 'APP.ROOMS', 'ADMIN.WORKPLACE', 'ADMIN.ROOMS'].includes(
      permission.resourceKey
    )
  ) {
    return true;
  }
  return permission.permissionCode === 'VIEW';
});

function booking(overrides: Record<string, unknown> = {}) {
  return {
    bookingId: '40000000-0000-0000-0000-000000000001',
    resourceId: resource.resourceId,
    resourceName: resource.name,
    resourceType: resource.type,
    siteName: site.name,
    floorName: floor.name,
    purpose: 'Architecture review',
    startsAt: '2026-08-19T00:30:00Z',
    endsAt: '2026-08-19T01:30:00Z',
    status: 'RESERVED',
    visibleToColleagues: true,
    checkedInAt: null,
    releasedAt: null,
    canCheckIn: true,
    canCancel: true,
    canRelease: false,
    checkInOpensAt: '2026-08-18T23:30:00Z',
    checkInClosesAt: '2026-08-19T01:00:00Z',
    version: 0,
    ...overrides,
  };
}

async function mockWorkplace(page: Page) {
  let draftPlacements = [{ ...placement }];
  let draftVersion = draftRevision.version;
  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/workplace/explore')) {
      return fulfillSuccess(route, {
        sites: [site],
        floors: [floor],
        selectedFloor: floor,
        resources: [resource],
        occupancy: [],
        policy,
        generatedAt: '2026-08-19T00:00:00Z',
      });
    }
    if (path.endsWith('/workplace/bookings')) {
      return fulfillSuccess(
        route,
        request.method() === 'GET' ? [booking()] : booking(request.postDataJSON())
      );
    }
    if (/\/workplace\/bookings\/[^/]+\/(check-in|cancel|release)$/u.test(path)) {
      return fulfillSuccess(route, booking({ version: 1 }));
    }
    return route.fallback();
  });

  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/admin/workplace/sites')) return fulfillSuccess(route, [site]);
    if (path.endsWith('/admin/workplace/floors')) return fulfillSuccess(route, [floor]);
    if (path.endsWith(`/admin/workplace/floors/${floor.floorId}/resources`)) {
      return fulfillSuccess(route, [resource, unplacedResource]);
    }
    if (path.endsWith('/admin/workplace/governance/campuses')) {
      return fulfillSuccess(route, [campus]);
    }
    if (path.endsWith(`/admin/workplace/governance/floors/${floor.floorId}/zones`)) {
      return fulfillSuccess(route, [zone]);
    }
    if (path.endsWith(`/admin/workplace/governance/zones/${zone.zoneId}/sections`)) {
      return fulfillSuccess(route, []);
    }
    if (path.endsWith(`/admin/workplace/governance/sites/${site.siteId}/access-rules`)) {
      return fulfillSuccess(route, []);
    }
    if (path.endsWith(`/admin/workplace/governance/sites/${site.siteId}/access-preview`)) {
      return fulfillSuccess(route, {
        siteId: site.siteId,
        userId: 900018,
        requestedPermission: 'VIEW',
        allowed: true,
        decision: 'ALLOW_COMPATIBILITY_DEFAULT',
        matchedRuleIds: [],
        evaluatedAt: '2026-08-19T00:00:00Z',
      });
    }
    if (path.endsWith('/admin/workplace/governance/policy-overrides')) {
      return fulfillSuccess(route, []);
    }
    if (path.endsWith('/admin/workplace/governance/policy-preview')) {
      return fulfillSuccess(route, {
        targetScopeType: 'TENANT',
        targetScopeId: null,
        effectivePolicy: policy,
        fieldSources: {},
        appliedOverrideIds: [],
        generatedAt: '2026-08-19T00:00:00Z',
      });
    }
    if (path.endsWith(`/admin/workplace/governance/floors/${floor.floorId}/floor-plan-revisions`)) {
      return fulfillSuccess(route, [draftRevision, publishedRevision]);
    }
    if (path.endsWith(`/admin/workplace/governance/floors/${floor.floorId}/projection`)) {
      return fulfillSuccess(route, {
        floorId: floor.floorId,
        publishedRevisionId: publishedRevision.revisionId,
        revisionNumber: publishedRevision.revisionNumber,
        planWidth: floor.planWidth,
        planHeight: floor.planHeight,
        backgroundAssetPath: null,
        placements: [placement],
        publishedAt: publishedRevision.publishedAt,
      });
    }
    if (
      path.endsWith(
        `/admin/workplace/governance/floor-plan-revisions/${draftRevision.revisionId}/snapshot`
      )
    ) {
      return fulfillSuccess(route, {
        revision: { ...draftRevision, version: draftVersion },
        placements: draftPlacements,
      });
    }
    if (
      path.endsWith(
        `/admin/workplace/governance/floor-plan-revisions/${draftRevision.revisionId}`
      ) &&
      request.method() === 'PUT'
    ) {
      const input = request.postDataJSON() as {
        placements: Array<typeof placement>;
      };
      draftPlacements = input.placements.map((candidate, index) => ({
        ...candidate,
        placementId: `80000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
        version: draftVersion + 1,
      }));
      draftVersion += 1;
      return fulfillSuccess(route, {
        ...draftRevision,
        version: draftVersion,
        placementCount: input.placements.length,
      });
    }
    if (path.endsWith('/admin/workplace/governance/delegated-admin-scopes/effective')) {
      return fulfillSuccess(route, []);
    }
    if (path.endsWith('/admin/workplace/governance/delegated-admin-scopes')) {
      return fulfillSuccess(route, []);
    }
    if (path.endsWith('/admin/workplace/policy')) {
      const value =
        request.method() === 'PUT'
          ? { ...request.postDataJSON(), version: policy.version + 1 }
          : policy;
      return fulfillSuccess(route, value);
    }
    return route.fallback();
  });
}

async function clickWorkplaceNavigationLink(page: Page, name: string) {
  const link = page.getByRole('link', { name });
  if (!(await link.isVisible())) {
    await page.getByRole('button', { name: 'Open Workplace navigation' }).click();
    await expect(link).toBeVisible();
  }
  await link.click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await mockWorkplace(page);
});

test('members discover and book a workspace using tenant policy and site time zone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/workplace/explore');

  await expect(page.getByRole('heading', { name: 'Find a space', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Start time')).toContainText('09:30');
  await page.getByRole('button', { name: /^Focus desk 12.*Available$/u }).click();

  const dialog = page.getByRole('dialog', { name: 'Book a workspace' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Asia/Seoul')).toBeVisible();
  await dialog.getByLabel('Purpose').fill('Workplace E2E review');
  await dialog.getByRole('button', { name: 'Book', exact: true }).click();
  await expect(dialog).toBeHidden();

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('members receive server-authoritative booking actions', async ({ page }) => {
  await page.goto('/workplace/my-bookings');
  await expect(page.getByRole('heading', { name: 'My space bookings', level: 1 })).toBeVisible();
  await expect(page.getByText('Focus desk 12', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel booking' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Release' })).toHaveCount(0);
});

test('room timelines use Calendar policy hours and each resource IANA time zone', async ({
  page,
}) => {
  await page.goto('/workplace/rooms');

  await expect(page.getByRole('heading', { name: 'Find a room', level: 1 })).toBeVisible();
  await expect(page.getByText('Local time · Asia/Seoul').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Book Focus 08 at 09:00 AM/u })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Focus 08 at 08:00 AM/u })).toHaveCount(0);
});

test('read-only roles see accessible reasons and cannot invoke booking or administration writes', async ({
  page,
}) => {
  await page.route('**/api/auth/permissions', (route) =>
    fulfillSuccess(route, READ_ONLY_WORKPLACE_PERMISSIONS)
  );

  await page.goto('/workplace/explore');
  await expect(page.getByTestId('rooms-permission-notice')).toContainText(
    'cannot create Workplace bookings'
  );
  await page.getByRole('button', { name: /^Focus desk 12.*Available$/u }).click();
  await expect(page.getByRole('dialog', { name: 'Book a workspace' })).toHaveCount(0);
  await expect(page.getByText('cannot create Workplace bookings').last()).toBeVisible();

  await page.goto('/workplace/my-bookings');
  await expect(page.getByTestId('rooms-permission-notice')).toContainText(
    'cannot cancel, check in, or release'
  );
  await expect(page.getByRole('button', { name: 'Check in' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0);

  await page.goto('/workplace/admin/locations');
  await expect(page.getByTestId('rooms-permission-notice')).toContainText('read only');
  await expect(page.getByRole('button', { name: 'Add site' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add floor' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add space' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save layout' })).toBeDisabled();

  await page.goto('/workplace/admin/policies');
  await expect(page.getByTestId('rooms-permission-notice')).toContainText(
    'policy management permission is required'
  );
  await expect(
    page.getByRole('switch', { name: 'Show member names on reserved spaces' })
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('administrators can distinguish lifecycle state and edit the spatial inventory', async ({
  page,
}) => {
  await page.goto('/workplace/admin/locations');
  await expect(
    page.getByRole('heading', { name: 'Sites and floor plans', level: 1 })
  ).toBeVisible();
  await expect(page.getByText('Pangyo HQ', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('workplace-layout-editor')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add space' })).toBeEnabled();
});

test('administrators can change and persist tenant booking governance', async ({ page }) => {
  await page.goto('/workplace/admin/policies');
  await expect(
    page.getByRole('heading', { name: 'Workplace operating policy', level: 1 })
  ).toBeVisible();

  const visibility = page.getByRole('switch', {
    name: 'Show member names on reserved spaces',
  });
  await expect(visibility).toBeChecked();
  await visibility.uncheck();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('The Workplace policy was saved.')).toBeVisible();
});

test('workplace governance remains complete on mobile and resumes persisted floor-plan drafts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/workplace/admin/governance');

  await expect(page.getByRole('heading', { name: 'Workplace governance', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Campuses', level: 2 })).toBeVisible();

  await page.getByRole('tab', { name: 'Access control' }).click();
  await expect(
    page.getByRole('heading', { name: 'Building access rules', level: 2 })
  ).toBeVisible();
  await expect(page.getByText(/compatibility default/u).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Policy inheritance' }).click();
  await expect(
    page.getByRole('heading', { name: 'Partial policies', level: 2, exact: true })
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Floor-plan releases' }).click();
  await expect(page.getByRole('heading', { name: 'Revision history', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Edit draft' }).click();
  await expect(
    page.getByRole('heading', { name: 'Edit floor-plan draft', level: 2 })
  ).toBeVisible();
  await expect(page.getByTestId('workplace-layout-editor')).toBeVisible();

  await page.getByRole('button', { name: 'Add to layout' }).click();
  const placedResource = page.getByTestId(`layout-resource-${resource.resourceId}`);
  const bounds = await placedResource.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds) {
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 36, bounds.y + bounds.height / 2 + 12, {
      steps: 6,
    });
    await page.mouse.up();
  }
  const horizontalPosition = page.getByLabel('Horizontal position (%)');
  await expect(horizontalPosition).not.toHaveValue(String(resource.positionX));
  const persistedHorizontalPosition = await horizontalPosition.inputValue();
  await expect(page.getByText('2 unsaved')).toBeVisible();

  await page.getByRole('tab', { name: 'Admin delegation' }).click();
  const unsavedDialog = page.getByRole('alertdialog', {
    name: 'Discard unsaved floor-plan changes?',
  });
  await expect(unsavedDialog).toBeVisible();
  await unsavedDialog.getByRole('button', { name: 'Keep' }).click();
  await expect(
    page.getByRole('heading', { name: 'Edit floor-plan draft', level: 2 })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Save layout' }).click();
  await expect(page.getByText('The floor-plan draft was saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.getByRole('button', { name: 'Edit draft' }).click();
  await page.getByTestId(`layout-resource-${resource.resourceId}`).click();
  await expect(page.getByLabel('Horizontal position (%)')).toHaveValue(persistedHorizontalPosition);
  await expect(page.getByText('2 resources')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/area=floorPlans/u);
  await expect(page.getByRole('heading', { name: 'Revision history', level: 2 })).toBeVisible();

  await page.getByRole('tab', { name: 'Admin delegation' }).click();
  await expect(page).toHaveURL(/area=delegation/u);
  await expect(
    page.getByRole('heading', { name: 'Administrative delegations', level: 2 })
  ).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport);

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('administrators are warned before discarding unsaved Workplace policy changes', async ({
  page,
}) => {
  await page.goto('/workplace/admin/policies');
  const visibility = page.getByRole('switch', {
    name: 'Show member names on reserved spaces',
  });
  await visibility.uncheck();

  await clickWorkplaceNavigationLink(page, 'Operations overview');
  const dialog = page.getByRole('alertdialog', {
    name: 'Discard unsaved Workplace policy changes?',
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep' }).click();
  await expect(
    page.getByRole('heading', { name: 'Workplace operating policy', level: 1 })
  ).toBeVisible();

  await clickWorkplaceNavigationLink(page, 'Operations overview');
  await dialog.getByRole('button', { name: 'Discard changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Workplace operations overview', level: 1 })
  ).toBeVisible();
});

test('mobile discovery defaults to the complete list without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/workplace/explore');
  await expect(page.getByRole('heading', { name: 'Find a space', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Focus desk 12/u })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport);
});
