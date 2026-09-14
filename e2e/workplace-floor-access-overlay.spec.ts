import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import type { Page } from '@playwright/test';

const siteId = '10000000-0000-4000-8000-000000000001';
const floorId = '20000000-0000-4000-8000-000000000001';
const secondFloorId = '20000000-0000-4000-8000-000000000002';
const ruleId = '70000000-0000-4000-8000-000000000001';
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
const floors = [
  { floorId, siteId, name: '10F · Research', state: 'ACTIVE' },
  { floorId: secondFloorId, siteId, name: '11F · Operations', state: 'ACTIVE' },
];
const baseRule = {
  accessRuleId: ruleId,
  siteId,
  floorId: null,
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
const decision = {
  siteId,
  floorId: null as string | null,
  userId: 900018,
  requestedPermission: 'VIEW',
  allowed: true,
  decision: 'ALLOW_EXPLICIT',
  matchedRuleIds: [ruleId],
  evaluatedAt: '2026-09-14T00:00:00Z',
};
async function setup(
  page: Page,
  mode:
    'native' | 'old-review' | 'old-options' | 'foreign-options' | 'mismatched-decision' = 'native',
  existingFloor = false,
  dark = false
) {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: dark ? 'dark' : 'light',
      density: 'standard',
      highContrast: dark,
      reduceMotion: dark,
    },
  });
  const floorRuleId = '70000000-0000-4000-8000-000000000002';
  const selectedRule = { ...baseRule, accessRuleId: floorRuleId, floorId };
  let rules = existingFloor ? [baseRule, selectedRule] : [baseRule];
  const writes: Record<string, unknown>[] = [];
  const reads: Record<string, unknown>[] = [];
  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith('/sites')) return fulfillSuccess(route, [site]);
    if (path.endsWith('/governance/delegated-admin-scopes/effective'))
      return fulfillSuccess(route, []);
    if (path.endsWith('/governance/delegated-admin-scopes'))
      return fulfillSuccess(route, [
        {
          delegationId: '80000000-0000-4000-8000-000000000001',
          delegateType: 'USER',
          delegateUserId: 900018,
          delegateGroupRef: null,
          scopeType: 'SITE',
          siteId,
          managedGroupRef: null,
          permissions: ['ACCESS_MANAGE'],
          validFrom: null,
          validUntil: null,
          state: 'ACTIVE',
          version: 1,
        },
      ]);
    if (path.endsWith('/access-rules')) return fulfillSuccess(route, rules);
    if (path.endsWith('/access-preview'))
      return fulfillSuccess(route, {
        ...decision,
        ...(mode === 'old-options'
          ? {}
          : {
              availableFloors:
                mode === 'foreign-options' ? [{ ...floors[0], siteId: secondFloorId }] : floors,
            }),
      });
    if (path.includes('/experience/collaboration/') && path.endsWith('/review')) {
      const body = request.postDataJSON();
      reads.push(body);
      const bound = {
        ...decision,
        floorId: body.proposed.floorId,
        requestedPermission: body.proposed.permission,
      };
      return fulfillSuccess(route, {
        targetType: 'WP_ACCESS_RULE',
        targetId: existingFloor ? floorRuleId : null,
        current: existingFloor ? rules[1] : null,
        proposed: mode === 'old-review' ? { ...body.proposed, floorId: null } : body.proposed,
        currentActorAccess: bound,
        ...(mode === 'old-review'
          ? {}
          : {
              proposedActorAccess: {
                ...bound,
                allowed: false,
                decision: 'DENY_EXPLICIT',
                ...(mode === 'mismatched-decision' ? { floorId: secondFloorId } : {}),
              },
            }),
        knownImpact: [
          'Only the selected floor rule is saved. Existing site rules remain unchanged.',
          'Existing bookings are not cancelled.',
        ],
        warnings: ['The decisions compare only the current user and verified current groups.'],
        evaluatedAt: decision.evaluatedAt,
      });
    }
    if (path.includes('/experience/collaboration/') && path.endsWith('/changes')) {
      const body = request.postDataJSON();
      writes.push(body);
      const saved = {
        ...baseRule,
        ...body.proposed,
        accessRuleId: floorRuleId,
        version: existingFloor ? 2 : 0,
      };
      rules = existingFloor ? [baseRule, saved] : [...rules, saved];
      return fulfillSuccess(route, saved);
    }
    return route.fallback();
  });
  return { writes, reads };
}
async function openNew(page: Page) {
  await page.goto('/workplace/admin/governance?area=access');
  await page.getByRole('button', { name: 'Add rule' }).click();
  const review = page.getByTestId('governance-change-review');
  await page.getByRole('textbox', { name: 'Member ID' }).fill('900018');
  return review;
}
async function selectFloor(page: Page, name = '10F · Research') {
  await page.getByRole('combobox', { name: 'Access rule scope' }).click();
  await page.getByRole('option', { name, exact: true }).press('Enter');
}
async function prepare(page: Page) {
  const review = page.getByTestId('governance-change-review');
  await review.getByRole('button', { name: 'Review change impact' }).click();
  await expect(
    review.getByText('Only the selected floor rule is saved. Existing site rules remain unchanged.')
  ).toBeVisible();
  await review
    .getByRole('textbox', { name: 'Reason for change' })
    .fill('Restrict this floor without granting site access');
  await review
    .getByRole('checkbox', {
      name: 'I have reviewed the current values, proposed values and known impact.',
    })
    .check();
  return review;
}
async function stableShell(page: Page) {
  await expect
    .poll(() =>
      page
        .locator('main')
        .first()
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const offset =
            window.innerWidth >= 1200
              ? document.querySelector('[data-testid="rooms-sidebar"]')!.getBoundingClientRect()
                  .width
              : 0;
          return (
            Math.abs(rect.x - offset) < 1 && Math.abs(rect.width - (window.innerWidth - offset)) < 1
          );
        })
    )
    .toBe(true);
}

test('native floor create reviews exact current/proposed scope, invalidates changed scope and saves only one atomic command', async ({
  page,
}) => {
  const { writes, reads } = await setup(page);
  const review = await openNew(page);
  await selectFloor(page);
  await page.getByRole('combobox', { name: /^Effect(?: |$)/ }).click();
  await page.getByRole('option', { name: 'Deny', exact: true }).click();
  await prepare(page);
  await expect(review.getByText('Proposed access for the current user: denied')).toBeVisible();
  await expect(review.getByRole('button', { name: 'Save reviewed change' })).toBeEnabled();
  await selectFloor(page, '11F · Operations');
  await expect(review.getByRole('button', { name: 'Save reviewed change' })).toBeDisabled();
  await expect(review.getByRole('checkbox')).not.toBeChecked();
  await selectFloor(page);
  await prepare(page);
  await expect(review.getByRole('button', { name: 'Save reviewed change' })).toBeEnabled();
  await review.getByRole('button', { name: 'Save reviewed change' }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(
    review.getByText('The change and reason were saved. You can check the record in the audit.')
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    proposed: { floorId, effect: 'DENY', version: null },
    confirmed: true,
  });
  expect(reads).toHaveLength(2);
  expect(reads[1]).toMatchObject({ proposed: { floorId } });
});

test('old producer ignoring floorId and wrong proposed actor scope cannot unlock a floor save', async ({
  page,
}) => {
  for (const mode of ['old-review', 'mismatched-decision'] as const) {
    const { writes } = await setup(page, mode);
    const review = await openNew(page);
    await selectFloor(page);
    await review.getByRole('button', { name: 'Review change impact' }).click();
    await expect(review.getByRole('button', { name: 'Reload current values' })).toBeVisible();
    await expect(review.getByRole('textbox', { name: 'Reason for change' })).toBeDisabled();
    await expect(review.getByRole('button', { name: 'Save reviewed change' })).toBeDisabled();
    await expect(review.getByRole('checkbox')).toBeDisabled();
    expect(writes).toHaveLength(0);
    await page.unroute('**/api/platform/v1/admin/workplace/**');
  }
});

test('absent and foreign floor option producer keeps floor creation closed while legacy site editing remains usable', async ({
  page,
}) => {
  for (const mode of ['old-options', 'foreign-options'] as const) {
    const { writes } = await setup(page, mode);
    const review = await openNew(page);
    await expect(page.getByRole('combobox', { name: 'Access rule scope' })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: 'Access rule scope' })).toHaveText(
      /Entire site/
    );
    await review.getByRole('button', { name: 'Review change impact' }).click();
    await expect(
      review.getByText(
        'Only the selected floor rule is saved. Existing site rules remain unchanged.'
      )
    ).toBeVisible();
    expect(writes).toHaveLength(0);
    await page.unroute('**/api/platform/v1/admin/workplace/**');
  }
});

test('existing floor rule scope is immutable and native proposed/current cards retain the actual selected floor', async ({
  page,
}) => {
  const { writes } = await setup(page, 'native', true);
  await page.goto('/workplace/admin/governance?area=access');
  await page.getByRole('button', { name: 'Inspect rule' }).last().click();
  await page.getByRole('button', { name: 'Edit', exact: true }).last().click();
  const review = page.getByTestId('governance-change-review');
  await expect(page.getByRole('combobox', { name: 'Access rule scope' })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Access rule scope' })).toHaveText(/10F/);
  await page.getByRole('combobox', { name: /^Effect(?: |$)/ }).click();
  await page.getByRole('option', { name: 'Deny', exact: true }).click();
  for (const width of [1440, 1280, 390, 320, 640]) {
    await page.setViewportSize({ width, height: 1000 });
    await stableShell(page);
    await prepare(page);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, 0);
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => window.scrollY === 0 && document.documentElement.scrollWidth <= window.innerWidth
        )
      )
      .toBe(true);
    await expect
      .poll(() =>
        review
          .getByRole('button', { name: 'Save reviewed change' })
          .evaluate((button) => button.getAnimations({ subtree: true }).length)
      )
      .toBe(0);
    const findings = await new AxeBuilder({ page })
      .include('[data-testid="governance-change-review"]')
      .analyze();
    expect(findings.violations).toEqual([]);
    await page.screenshot({ path: `/tmp/workplace-floor-access-${width}.png`, fullPage: true });
  }
  await prepare(page);
  await review.getByRole('button', { name: 'Save reviewed change' }).click();
  await expect(
    review.getByText('The change and reason were saved. You can check the record in the audit.')
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ proposed: { floorId, version: 1 } });
});

test('selected floor current/proposed review remains usable in dark high contrast reduced motion and keyboard', async ({
  page,
}) => {
  await setup(page, 'native', true, true);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/workplace/admin/governance?area=access');
  await page.getByRole('button', { name: 'Inspect rule' }).last().click();
  await page.getByRole('button', { name: 'Edit', exact: true }).last().click();
  const review = page.getByTestId('governance-change-review');
  await page.getByRole('combobox', { name: /^Effect(?: |$)/ }).click();
  await page.getByRole('option', { name: 'Deny', exact: true }).press('Enter');
  await prepare(page);
  await review.getByRole('button', { name: 'Save reviewed change' }).focus();
  await expect(review.getByRole('button', { name: 'Save reviewed change' })).toBeFocused();
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await stableShell(page);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, 0);
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => window.scrollY === 0 && document.documentElement.scrollWidth <= window.innerWidth
        )
      )
      .toBe(true);
    await expect
      .poll(() =>
        review
          .getByRole('button', { name: 'Save reviewed change' })
          .evaluate((button) => button.getAnimations({ subtree: true }).length)
      )
      .toBe(0);
    const findings = await new AxeBuilder({ page })
      .include('[data-testid="governance-change-review"]')
      .analyze();
    expect(findings.violations).toEqual([]);
    await page.screenshot({
      path: `/tmp/workplace-floor-access-${width}-dark-hc-rm.png`,
      fullPage: true,
    });
  }
});
