import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import type { Page } from '@playwright/test';

const siteId = '10000000-0000-0000-0000-000000000001';
const ruleId = '70000000-0000-0000-0000-000000000001';
const site = {
  siteId,
  code: 'HQ',
  name: 'Governance test site',
  nameKo: '검토 테스트',
  nameEn: 'Governance test site',
  type: 'HEADQUARTERS',
  timeZone: 'Asia/Seoul',
  state: 'ACTIVE',
  version: 1,
};
const initialRule = {
  accessRuleId: ruleId,
  siteId,
  subjectType: 'USER',
  subjectUserId: 900018,
  subjectGroupRef: null,
  permission: 'VIEW',
  effect: 'ALLOW',
  validFrom: null,
  validUntil: null,
  state: 'ACTIVE',
  version: 1,
};
const delegation = {
  delegationId: '80000000-0000-0000-0000-000000000001',
  delegateType: 'USER',
  delegateUserId: 900018,
  delegateGroupRef: null,
  scopeType: 'SITE',
  siteId,
  managedGroupRef: null,
  permissions: ['CATALOG_VIEW'],
  validFrom: null,
  validUntil: null,
  state: 'ACTIVE',
  version: 1,
};
async function setup(page: Page, readOnly = false) {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: readOnly
      ? FULL_PRODUCT_PERMISSIONS.filter(
          (permission) =>
            !['APP.WORKPLACE', 'ADMIN.WORKPLACE'].includes(permission.resourceKey) ||
            permission.permissionCode === 'VIEW'
        )
      : FULL_PRODUCT_PERMISSIONS,
  });
  let rule = { ...initialRule };
  let policy = { sharingEnabled: false, maximumVisibility: 'SITE', version: 0 };
  let connectors = ['CALENDAR', 'ACTUAL_PRESENCE', 'SIGNAGE', 'VISITOR', 'VEHICLE'].map((kind) => ({
    kind,
    provider: null as string | null,
    status: 'NOT_CONFIGURED',
    configurationReference: null as string | null,
    lastVerifiedAt: null,
    version: 0,
  }));
  const writes: unknown[] = [];
  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/sites')) return fulfillSuccess(route, [site]);
    if (path.endsWith('/governance/delegated-admin-scopes/effective'))
      return fulfillSuccess(route, []);
    if (path.endsWith('/governance/delegated-admin-scopes'))
      return fulfillSuccess(route, [delegation]);
    if (path.endsWith('/access-rules')) return fulfillSuccess(route, [rule]);
    if (path.endsWith('/access-preview'))
      return fulfillSuccess(route, {
        siteId,
        userId: 900018,
        requestedPermission: 'VIEW',
        allowed: true,
        decision: 'ALLOW_EXPLICIT',
        matchedRuleIds: [ruleId],
        evaluatedAt: '2026-09-14T00:00:00Z',
      });
    if (path.includes('/experience/collaboration/') && path.endsWith('/review')) {
      const body = request.postDataJSON();
      return fulfillSuccess(route, {
        targetType: path.includes('/delegations/') ? 'WP_DELEGATION' : 'WP_ACCESS_RULE',
        targetId: ruleId,
        current: path.includes('/delegations/') ? delegation : rule,
        proposed: body.proposed,
        currentActorAccess: null,
        knownImpact: ['Only this selected item is saved.', 'Existing bookings remain unchanged.'],
        warnings: ['This review does not predict employee behavior.'],
        evaluatedAt: '2026-09-14T00:00:00Z',
      });
    }
    if (path.includes('/experience/collaboration/') && path.endsWith('/changes')) {
      const body = request.postDataJSON();
      writes.push(body);
      rule = { ...rule, ...body.proposed, version: rule.version + 1 };
      return fulfillSuccess(route, rule);
    }
    if (path.endsWith('/experience/collaboration/overview'))
      return fulfillSuccess(route, {
        policy,
        connectors,
        privacy: {
          bookingRetentionDays: 365,
          legalHoldCount: 2,
          anonymizedBookingCount: 4,
          expiredEligibleBookingCount: 3,
          facilityRequestEligibleRetentionCount: 5,
          facilityClosureEligibleRetentionCount: 6,
          facilityRequestsPurgedCount: 7,
          facilityClosuresPurgedCount: 8,
        },
        generatedAt: '2026-09-14T00:00:00Z',
      });
    if (path.endsWith('/experience/collaboration/policy') && request.method() === 'PUT') {
      const body = request.postDataJSON();
      writes.push(body);
      policy = {
        sharingEnabled: body.sharingEnabled,
        maximumVisibility: body.maximumVisibility,
        version: policy.version + 1,
      };
      return fulfillSuccess(route, policy);
    }
    if (path.includes('/experience/collaboration/connectors/') && request.method() === 'PUT') {
      const kind = path.split('/').at(-1);
      const body = request.postDataJSON();
      writes.push(body);
      connectors = connectors.map((connector) =>
        connector.kind === kind
          ? {
              ...connector,
              provider: body.provider,
              configurationReference: body.configurationReference,
              status: body.enabled ? 'CONFIGURED_UNVERIFIED' : 'DISABLED',
              version: connector.version + 1,
            }
          : connector
      );
      return fulfillSuccess(
        route,
        connectors.find((connector) => connector.kind === kind)
      );
    }
    return route.fallback();
  });
  return writes;
}

async function expectStableShell(page: Page) {
  await expect
    .poll(() =>
      page
        .locator('main')
        .first()
        .evaluate((element) => {
          const sidebar = document.querySelector('[data-testid="rooms-sidebar"]')!;
          const offset = window.innerWidth >= 1200 ? sidebar.getBoundingClientRect().width : 0;
          const rect = element.getBoundingClientRect();
          return (
            Math.abs(rect.x - offset) < 1 && Math.abs(rect.width - (window.innerWidth - offset)) < 1
          );
        })
    )
    .toBe(true);
}

test('access inspector saves only a reviewed change with reason and confirmation', async ({
  page,
}) => {
  const writes = await setup(page);
  await page.goto('/workplace/admin/governance?area=access');
  await page.getByRole('button', { name: 'Inspect rule' }).click();
  await expect(page.getByRole('heading', { name: 'Selected access rule' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).last().click();
  const review = page.getByTestId('governance-change-review');
  await expect(review.getByText('Current values', { exact: true })).toBeVisible();
  await expect(review.getByText('Proposed values', { exact: true })).toBeVisible();
  const save = review.getByRole('button', { name: 'Save reviewed change' });
  await expect(save).toBeDisabled();
  await review.getByRole('button', { name: 'Review change impact' }).click();
  await expect(review.getByText('Only this selected item is saved.')).toBeVisible();
  await review.getByRole('textbox', { name: 'Reason for change' }).fill('Reviewed site rule');
  await review
    .getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
    })
    .check();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(
    review.getByText('The change and reason were saved. You can check the record in the audit.')
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    reason: 'Reviewed site rule',
    confirmed: true,
    proposed: { version: 1 },
  });
  await expect(review.getByRole('button', { name: 'View audit' })).toBeVisible();
});

test('sharing policy and connector configuration save actual versioned fields and retain unverified status', async ({
  page,
}) => {
  const writes = await setup(page);
  await page.goto('/workplace/admin/governance?area=experience');
  const settings = page.getByTestId('governance-experience-settings');
  await settings
    .getByRole('checkbox', { name: 'Allow work plan sharing in the organization' })
    .check();
  await settings
    .getByRole('textbox', { name: 'Reason for change' })
    .first()
    .fill('Enable consent-based plans');
  await settings
    .getByRole('checkbox', {
      name: 'I have reviewed the current settings, proposed values and affected scope.',
    })
    .first()
    .check();
  await settings.getByRole('button', { name: 'Save reviewed change' }).first().click();
  await expect(
    settings.getByText('The change and reason were saved. You can check the record in the audit.')
  ).toHaveCount(1);
  expect(writes[0]).toMatchObject({
    sharingEnabled: true,
    maximumVisibility: 'SITE',
    version: 0,
    reason: 'Enable consent-based plans',
    confirmed: true,
  });
  const connector = settings.getByRole('region', { name: 'Calendar connector', exact: true });
  await connector.getByRole('textbox', { name: 'Provider identifier' }).fill('calendar-adapter');
  await connector.getByRole('checkbox', { name: 'Enable connector configuration' }).check();
  await connector
    .getByRole('textbox', { name: 'Reason for change' })
    .fill('Register approved adapter reference');
  await connector
    .getByRole('checkbox', {
      name: 'I have reviewed the current settings, proposed values and affected scope.',
    })
    .check();
  await connector.getByRole('button', { name: 'Save reviewed change' }).click();
  await expect(
    connector.getByText(/The connection and actual data have not been verified\./u)
  ).toBeVisible();
  expect(writes[1]).toMatchObject({
    provider: 'calendar-adapter',
    configurationReference: null,
    enabled: true,
    version: 0,
    confirmed: true,
  });
});

test('mobile delegation shows current and proposed values before impact review', async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/workplace/admin/governance?area=delegation');
  await page.getByRole('button', { name: 'Edit', exact: true }).last().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Current values', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Proposed values', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Review change impact' }).click();
  await expect(dialog.getByRole('button', { name: 'Save reviewed change' })).toBeDisabled();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true
  );
  await page.screenshot({ path: '/tmp/workplace-governance-delegation-390.png', fullPage: true });
});

test('privacy settings and access review reflow at desktop, mobile and 200 percent equivalent viewport', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/workplace/admin/governance?area=experience');
  const settings = page.getByTestId('governance-experience-settings');
  await expect(settings.getByRole('heading', { name: 'Privacy retention status' })).toBeVisible();
  await expect(settings.getByText('Bookings under legal hold')).toBeVisible();
  await expect(
    settings.getByText('Not configured. No external status data is available.')
  ).toHaveCount(5);
  for (const width of [1440, 1280, 390, 320, 640]) {
    await page.setViewportSize({ width, height: 900 });
    await expectStableShell(page);
    if (width < 1200)
      await expect
        .poll(async () =>
          page
            .locator('main')
            .first()
            .evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return Math.abs(rect.x) < 1 && Math.abs(rect.width - window.innerWidth) < 1;
            })
        )
        .toBe(true);
    const sizing = await settings.evaluate((element) => ({
      width: element.clientWidth,
      scroll: element.scrollWidth,
      overflow: Array.from(element.querySelectorAll('*'))
        .filter(
          (child) => child.getBoundingClientRect().right > element.getBoundingClientRect().right + 1
        )
        .slice(0, 8)
        .map((child) => ({
          tag: child.tagName,
          class: child.className,
          text: child.textContent?.slice(0, 50),
          width: child.getBoundingClientRect().width,
        })),
    }));
    expect(sizing.scroll, JSON.stringify({ viewport: width, ...sizing })).toBeLessThanOrEqual(
      sizing.width + 1
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({
      path: `/tmp/workplace-governance-settings-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto('/workplace/admin/governance?area=access');
  await page
    .getByRole('region', { name: 'Selected access rule', exact: true })
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  const review = page.getByTestId('governance-change-review');
  await review.getByRole('combobox', { name: /^Effect(?: |$)/u }).click();
  await page.getByRole('option', { name: 'Deny', exact: true }).click();
  await review.getByRole('button', { name: 'Review change impact' }).click();
  await expect(review.getByText('Only this selected item is saved.')).toBeVisible();
  await review
    .getByRole('textbox', { name: 'Reason for change' })
    .fill('Loaded representative review');
  await review
    .getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
    })
    .check();
  await expect(review.getByRole('button', { name: 'Save reviewed change' })).toBeEnabled();
  const axe = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    axe.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? '')),
    JSON.stringify(axe.violations)
  ).toEqual([]);
  for (const width of [1440, 1280, 390, 320, 640]) {
    await page.setViewportSize({ width, height: 900 });
    await expectStableShell(page);
    if (width < 1200)
      await expect
        .poll(async () =>
          page
            .locator('main')
            .first()
            .evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return Math.abs(rect.x) < 1 && Math.abs(rect.width - window.innerWidth) < 1;
            })
        )
        .toBe(true);
    expect(await review.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true
    );
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const delegationPanel = review.getByRole('region', {
      name: 'Administrative delegations',
      exact: true,
    });
    const reviewPanel = review.getByRole('region', { name: 'Change review', exact: true });
    expect(
      await delegationPanel.evaluate((element) => {
        const reviewElement = element
          .closest('[data-testid="governance-change-review"]')!
          .querySelector('[aria-label="Change review"]')!;
        return window.innerWidth < 1200
          ? element.getBoundingClientRect().top > reviewElement.getBoundingClientRect().bottom
          : element.getBoundingClientRect().right < reviewElement.getBoundingClientRect().left;
      })
    ).toBe(true);
    await expect(reviewPanel).toBeAttached();
    await page.screenshot({
      path: `/tmp/workplace-governance-access-${width}.png`,
      fullPage: true,
    });
  }
});

test('scoped policy override uses native current/proposed review and atomic reason audit save', async ({
  page,
}) => {
  await setup(page);
  const overrideId = 'a0000000-0000-0000-0000-000000000001';
  let override = {
    policyOverrideId: overrideId,
    scopeType: 'TENANT',
    scopeId: null,
    policyPatch: { minimumBookingMinutes: 30 },
    state: 'ACTIVE',
    version: 2,
  };
  const changes: unknown[] = [];
  await page.route('**/api/platform/v1/admin/workplace/governance/policy-overrides**', (route) =>
    fulfillSuccess(route, [override])
  );
  await page.route('**/api/platform/v1/admin/workplace/governance/policy-preview**', (route) =>
    fulfillSuccess(route, {
      effectivePolicy: { minimumBookingMinutes: 30 },
      fieldSources: {},
      scopeType: 'TENANT',
      scopeId: null,
    })
  );
  await page.route('**/api/platform/v1/admin/workplace/governance/campuses**', (route) =>
    fulfillSuccess(route, [])
  );
  await page.route(
    '**/api/platform/v1/admin/workplace/experience/collaboration/policy-overrides/**',
    async (route) => {
      const body = route.request().postDataJSON();
      if (new URL(route.request().url()).pathname.endsWith('/review'))
        return fulfillSuccess(route, {
          targetType: 'WP_POLICY_OVERRIDE',
          targetId: overrideId,
          current: override,
          proposed: body.proposed,
          currentActorAccess: null,
          knownImpact: ['Future booking validation uses this scoped policy.'],
          warnings: [],
          evaluatedAt: '2026-09-14T00:00:00Z',
        });
      changes.push({ url: route.request().url(), ...body });
      override = { ...override, ...body.proposed, version: override.version + 1 };
      return fulfillSuccess(route, override);
    }
  );
  await page.goto('/workplace/admin/governance?area=policy');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const review = dialog.getByTestId('governance-change-review');
  await expect(review.getByText('Current values', { exact: true })).toBeVisible();
  await expect(review.getByText('Proposed values', { exact: true })).toBeVisible();
  await dialog.locator('input[type=number]:not([disabled])').first().fill('45');
  await review.getByRole('button', { name: 'Review change impact' }).click();
  await expect(
    review.getByText('Future booking validation uses this scoped policy.')
  ).toBeVisible();
  await review
    .getByRole('textbox', { name: 'Reason for change' })
    .fill('Fixture scoped policy approval');
  await review
    .getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
    })
    .check();
  await review.getByRole('button', { name: 'Save reviewed change' }).click();
  await expect(
    review.getByText('The change and reason were saved. You can check the record in the audit.')
  ).toBeVisible();
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({
    proposed: {
      scopeType: 'TENANT',
      scopeId: null,
      version: 2,
      policyPatch: { minimumBookingMinutes: 45 },
    },
    reason: 'Fixture scoped policy approval',
    confirmed: true,
  });
  expect((changes[0] as { url: string }).url).toContain(
    `/policy-overrides/${overrideId}/changes?scopeType=TENANT`
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
  await dialog.evaluate((element) => {
    for (const child of [element, ...element.querySelectorAll('*')]) {
      if (child instanceof HTMLElement && child.scrollHeight > child.clientHeight)
        child.scrollTop = 0;
    }
  });
  await review.getByText('Current values', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: '/tmp/workplace-governance-scoped-policy-320.png',
    fullPage: false,
  });
  await review.getByRole('button', { name: 'View audit' }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: '/tmp/workplace-governance-scoped-policy-review-320.png',
    fullPage: false,
  });
});

test('global viewer can read privacy and connector status while all settings writes stay disabled', async ({
  page,
}) => {
  const writes = await setup(page, true);
  await page.goto('/workplace/admin/governance?area=experience');
  const settings = page.getByTestId('governance-experience-settings');
  await expect(
    settings.getByText('Facility requests eligible for retention cleanup', { exact: true })
  ).toBeVisible();
  await expect(settings.locator('dl').getByText('5', { exact: true })).toBeVisible();
  await expect(
    settings.getByText(
      'The configured Workplace retention period also applies to terminal facility requests and past closure reasons. Legal holds and active work are preserved.'
    )
  ).toBeVisible();
  await expect(
    settings.getByRole('checkbox', { name: 'Allow work plan sharing in the organization' })
  ).toBeDisabled();
  await expect(
    settings.getByRole('button', { name: 'Save reviewed change' }).first()
  ).toBeDisabled();
  await expect(
    settings.getByText('Not configured. No external status data is available.', { exact: true })
  ).toHaveCount(5);
  expect(writes).toHaveLength(0);
});
