import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  DIRECTORY_SPACES,
  SPACE_SUMMARY,
  deferredDirectoryResponse,
  envelope,
  mockDirectorySession,
} from './support/space-fixtures';

test('Space detail keeps long labels readable and clear of its glyph at 320px in plain dark mode', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'none' });
  await mockDirectorySession(page, { preferences: { mode: 'dark', highContrast: false } });
  const space = {
    ...DIRECTORY_SPACES[2],
    visibility: 'OPEN',
    memberRole: 'VIEWER',
    summaryEn: 'DecisionEvidenceAndMembershipReview'.repeat(4),
  };
  await page.route(/\/api\/spaces\/v1\/spaces\/customer-zero-operations$/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        space,
        contentPolicy: 'OWNER_REVIEW',
        appPolicy: 'OWNER_REVIEW',
        aiPolicy: 'MEMBER_SCOPED',
        canContribute: false,
        canModerate: false,
        canManage: false,
        featuredContent: [],
        apps: [],
        activity: [],
      }),
    })
  );
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/spaces/customer-zero-operations/overview');
  const heading = page.getByRole('heading', { name: space.nameEn, level: 1, exact: true });
  await expect(heading).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const header = page.locator('main header').filter({ has: heading });
  await expect(header).toHaveCSS('background-color', /rgba\(.+,\s*0\.24\)/);
  const metrics = await header.evaluate((element) => {
    const glyph = element.querySelector('[aria-hidden="true"]')!.getBoundingClientRect();
    const title = element.querySelector('h1')!.getBoundingClientRect();
    return {
      glyphWidth: glyph.width,
      gap: title.left - glyph.right,
      headerOverflow: element.scrollWidth - element.clientWidth,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(metrics.glyphWidth).toBe(52);
  expect(metrics.gap).toBeGreaterThanOrEqual(15);
  expect(metrics.headerOverflow).toBeLessThanOrEqual(1);
  expect(metrics.pageOverflow).toBeLessThanOrEqual(1);
  const contrast = await new AxeBuilder({ page })
    .include('main header')
    .withRules(['color-contrast'])
    .analyze();
  expect(contrast.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('space-detail-dark-long-label-320.png'),
    fullPage: true,
  });
});

test('Space access requests require the membership action, active discoverable spaces, and no effective membership', async ({
  page,
}) => {
  await mockDirectorySession(page, { roles: ['TENANT_ADMIN'] });
  let membershipAction: string | null = 'CREATE';
  let space = { ...SPACE_SUMMARY, memberRole: null as string | null };
  let statusReads = 0;
  let writes = 0;
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope([
        { resourceType: 'APP', resourceKey: 'APP.SPACES', permissionCode: 'VIEW', effect: 'ALLOW' },
        ...(membershipAction
          ? [
              {
                resourceType: 'ACTION',
                resourceKey: 'ACTION.SPACE_MEMBERSHIP',
                permissionCode: membershipAction,
                effect: 'ALLOW',
              },
            ]
          : []),
      ]),
    })
  );
  await page.route(/\/api\/spaces\/v1\/spaces\/company-square$/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        space,
        contentPolicy: 'OWNER_REVIEW',
        appPolicy: 'OWNER_REVIEW',
        aiPolicy: 'MEMBER_SCOPED',
        canContribute: false,
        canModerate: false,
        canManage: false,
        featuredContent: [],
        apps: [],
        activity: [],
      }),
    })
  );
  await page.route(/\/api\/spaces\/v1\/access-requests\?status=PENDING$/, (route) => {
    statusReads += 1;
    return route.fulfill({ contentType: 'application/json', body: envelope([]) });
  });
  await page.route('**/api/spaces/v1/spaces/company-square/access-requests', (route) => {
    writes += 1;
    return route.fulfill({ status: 405 });
  });
  const cases = [
    {
      visibility: 'OPEN',
      lifecycleState: 'ACTIVE',
      memberRole: null,
      action: 'CREATE',
      eligible: true,
    },
    {
      visibility: 'REQUEST',
      lifecycleState: 'ACTIVE',
      memberRole: null,
      action: 'MANAGE',
      eligible: true,
    },
    {
      visibility: 'PRIVATE',
      lifecycleState: 'ACTIVE',
      memberRole: null,
      action: 'CREATE',
      eligible: false,
    },
    {
      visibility: 'HIDDEN',
      lifecycleState: 'ACTIVE',
      memberRole: null,
      action: 'MANAGE',
      eligible: false,
    },
    {
      visibility: 'OPEN',
      lifecycleState: 'SUSPENDED',
      memberRole: null,
      action: 'CREATE',
      eligible: false,
    },
    {
      visibility: 'REQUEST',
      lifecycleState: 'ARCHIVED',
      memberRole: null,
      action: 'CREATE',
      eligible: false,
    },
    {
      visibility: 'OPEN',
      lifecycleState: 'ACTIVE',
      memberRole: 'VIEWER',
      action: 'CREATE',
      eligible: false,
    },
    {
      visibility: 'REQUEST',
      lifecycleState: 'ACTIVE',
      memberRole: null,
      action: null,
      eligible: false,
    },
    {
      visibility: 'REQUEST',
      lifecycleState: 'ACTIVE',
      memberRole: null,
      action: 'VIEW',
      eligible: false,
    },
  ];
  for (const candidate of cases) {
    space = {
      ...SPACE_SUMMARY,
      visibility: candidate.visibility,
      lifecycleState: candidate.lifecycleState,
      memberRole: candidate.memberRole,
    };
    membershipAction = candidate.action;
    statusReads = 0;
    await page.goto('/spaces/company-square/overview');
    await expect(
      page.getByRole('heading', { name: SPACE_SUMMARY.nameEn, exact: true })
    ).toBeVisible();
    if (!candidate.memberRole && candidate.visibility !== 'OPEN') {
      await expect(
        page.getByText('Content and recent activity are available to members of this Space only.', {
          exact: true,
        })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'No featured content yet', exact: true })
      ).toHaveCount(0);
    }
    const request = page.getByRole('button', { name: 'Request access', exact: true });
    if (candidate.eligible) {
      await expect(request).toBeEnabled();
      expect(statusReads).toBe(1);
    } else {
      await expect(request).toHaveCount(0);
      expect(statusReads).toBe(0);
    }
  }
  expect(writes).toBe(0);
});

test('Space access waits for request status and recovers lookup errors before opening a request', async ({
  page,
}) => {
  await mockDirectorySession(page, {
    permissions: [
      { resourceType: 'APP', resourceKey: 'APP.SPACES', permissionCode: 'VIEW', effect: 'ALLOW' },
      {
        resourceType: 'ACTION',
        resourceKey: 'ACTION.SPACE_MEMBERSHIP',
        permissionCode: 'CREATE',
        effect: 'ALLOW',
      },
    ],
  });
  const response = deferredDirectoryResponse();
  let fail = true;
  let writes = 0;
  await page.route(/\/api\/spaces\/v1\/access-requests\?status=PENDING$/, async (route) => {
    await response.promise;
    return fail
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Fixture status outage' }),
        })
      : route.fulfill({ contentType: 'application/json', body: envelope([]) });
  });
  await page.route('**/api/spaces/v1/spaces/ai-transformation/access-requests', (route) => {
    writes += 1;
    return route.fulfill({ status: 405 });
  });
  try {
    await page.goto('/spaces/ai-transformation/overview');
    await expect(
      page.getByRole('button', { name: 'Checking access requests…', exact: true })
    ).toBeDisabled();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    response.release();
    const error = page.getByRole('alert').filter({
      hasText: 'We could not check your pending access requests. Retry before requesting access.',
    });
    await expect(error).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request access', exact: true })).toBeDisabled();
    fail = false;
    await error.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(error).toHaveCount(0);
    await page.getByRole('button', { name: 'Request access', exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: 'Request Space access', exact: true })
    ).toBeVisible();
    expect(writes).toBe(0);
  } finally {
    response.release();
  }
});

test('Space access rechecks an ambiguous POST failure and prevents a duplicate pending request', async ({
  page,
}) => {
  await mockDirectorySession(page, {
    permissions: [
      { resourceType: 'APP', resourceKey: 'APP.SPACES', permissionCode: 'VIEW', effect: 'ALLOW' },
      {
        resourceType: 'ACTION',
        resourceKey: 'ACTION.SPACE_MEMBERSHIP',
        permissionCode: 'CREATE',
        effect: 'ALLOW',
      },
    ],
  });
  let writes = 0;
  let failRefresh = false;
  const pending = {
    accessRequestId: 'request-fixture',
    spaceId: DIRECTORY_SPACES[1].spaceId,
    spaceKey: 'ai-transformation',
    spaceNameKo: DIRECTORY_SPACES[1].nameKo,
    spaceNameEn: DIRECTORY_SPACES[1].nameEn,
    requesterUserId: 42,
    requestedRole: 'VIEWER',
    justification: 'Review collaboration evidence',
    decisionMode: 'OWNER_REVIEW',
    status: 'PENDING',
    createdAt: '2026-10-27T00:00:00Z',
    version: 1,
  };
  await page.route(/\/api\/spaces\/v1\/access-requests\?status=PENDING$/, (route) =>
    failRefresh
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Fixture status outage after POST' }),
        })
      : route.fulfill({ contentType: 'application/json', body: envelope(writes ? [pending] : []) })
  );
  await page.route('**/api/spaces/v1/spaces/ai-transformation/access-requests', (route) => {
    writes += 1;
    failRefresh = true;
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Fixture lost POST response' }),
    });
  });
  await page.goto('/spaces/ai-transformation/overview');
  await page.getByRole('button', { name: 'Request access', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Request Space access', exact: true });
  await dialog.getByLabel('Participation purpose').fill('Review collaboration evidence');
  const submit = dialog.getByRole('button', { name: 'Request access', exact: true });
  await submit.click();
  await expect.poll(() => writes).toBe(1);
  await expect(
    page.getByText('We could not process the access request.', { exact: true })
  ).toBeVisible();
  await expect(submit).toBeDisabled();
  // Close the blocked dialog to use the page-level status recovery action.
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  failRefresh = false;
  await page
    .getByRole('alert')
    .filter({ hasText: 'We could not check your pending access requests.' })
    .getByRole('button', { name: 'Retry', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Access under review', exact: true })
  ).toBeDisabled();
  expect(writes).toBe(1);
});
