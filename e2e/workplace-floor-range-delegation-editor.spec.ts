import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';
import type { Locator, Page } from '@playwright/test';
import type {
  WorkplaceFloor,
  WorkplaceSite,
  WorkplaceGovernanceDelegatedAdminScope,
  WorkplaceGovernanceDelegatedAdminScopeInput,
} from '@dwp-frontend/shared-utils';

/** HTTP fixtures exercise the loaded native editor; no tenant business writes or runtime changes. */
const output = '/Users/a10697/Work/DWP/output/workplace-floor-range-delegation-2026-09-14/editor';
const siteId = '11111111-1111-4111-8111-111111111111';
const otherSiteId = '22222222-2222-4222-8222-222222222222';
const firstFloorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondFloorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const thirdFloorId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const delegationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const site = {
  siteId,
  code: 'HQ',
  name: 'Headquarters · Research and operations',
  nameKo: '본사 연구 운영',
  nameEn: 'Headquarters · Research and operations',
  type: 'HEADQUARTERS',
  address: null,
  timeZone: 'Asia/Seoul',
  totalFloorCount: 3,
  configuredFloorCount: 3,
  resourceCount: 8,
  state: 'ACTIVE',
  version: 2,
} satisfies WorkplaceSite;
const floors = [
  {
    floorId: firstFloorId,
    siteId,
    siteName: site.name,
    floorNumber: 10,
    name: '10F · Research and development',
    nameKo: '10층 연구개발',
    nameEn: '10F · Research and development',
    state: 'ACTIVE',
    resourceCount: 4,
  },
  {
    floorId: secondFloorId,
    siteId,
    siteName: site.name,
    floorNumber: 11,
    name: '11F · Operations planning',
    nameKo: '11층 운영계획',
    nameEn: '11F · Operations planning',
    state: 'DRAFT',
    resourceCount: 3,
  },
  {
    floorId: thirdFloorId,
    siteId,
    siteName: site.name,
    floorNumber: 12,
    name: '12F · Closed project space',
    nameKo: '12층 종료 프로젝트',
    nameEn: '12F · Closed project space',
    state: 'CLOSED',
    resourceCount: 1,
  },
].map((value) => ({
  ...value,
  planWidth: 1200,
  planHeight: 800,
  backgroundAssetPath: null,
  version: 3,
})) as WorkplaceFloor[];
const saved: WorkplaceGovernanceDelegatedAdminScope = {
  delegationId,
  delegateType: 'USER',
  delegateUserId: 900018,
  delegateGroupRef: null,
  scopeType: 'SITE',
  siteId,
  managedGroupRef: null,
  permissions: ['CATALOG_VIEW', 'CATALOG_MANAGE'],
  floorIds: [firstFloorId, secondFloorId],
  validFrom: '2026-09-01T00:00:00Z',
  validUntil: '2026-12-31T00:00:00Z',
  state: 'ACTIVE',
  version: 11,
};
const impact =
  'Only the selected administrator permissions and validity are changed. The saved floor scope remains unchanged.';
const confirmLabel = 'I have reviewed the current values, proposed values and known impact.';
type Body = {
  proposed: WorkplaceGovernanceDelegatedAdminScopeInput;
  reason: string;
  confirmed: boolean;
};
type Mode =
  | 'native'
  | 'wrong-current-floor'
  | 'wrong-current-permission'
  | 'wrong-current-validity'
  | 'wrong-proposed-floor'
  | 'malformed-metadata'
  | 'unknown'
  | 'foreign-options';

async function setup(page: Page, mode: Mode = 'native') {
  await isolateWorkplaceDevelopmentUpdates(page);
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: { mode: 'light', density: 'standard', highContrast: false, reduceMotion: true },
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let assignments = [{ ...saved }];
  const reviews: { path: string; body: Body; response: Record<string, unknown> }[] = [];
  const changes: { path: string; body: Body }[] = [];
  const reads: string[] = [];
  const unexpectedWrites: string[] = [];
  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (request.method() === 'GET') {
      reads.push(path);
      if (path.endsWith('/sites')) return fulfillSuccess(route, [site]);
      if (path.endsWith('/floors'))
        return fulfillSuccess(
          route,
          mode === 'foreign-options' ? [{ ...floors[0], siteId: otherSiteId }] : floors
        );
      if (path.endsWith('/governance/delegated-admin-scopes/effective'))
        return fulfillSuccess(route, []);
      if (path.endsWith('/governance/delegated-admin-scopes'))
        return fulfillSuccess(route, assignments);
      return route.fallback();
    }
    if (
      request.method() === 'POST' &&
      /\/experience\/collaboration\/delegations\/(?:[^/]+\/)?review$/.test(path)
    ) {
      const body = request.postDataJSON() as Body;
      const existing = path.includes(`/${delegationId}/`) ? assignments[0] : null;
      const current = existing ? { ...existing } : null;
      if (mode === 'wrong-current-floor' && current) current.floorIds = [firstFloorId];
      if (mode === 'wrong-current-permission' && current) current.permissions = ['CATALOG_VIEW'];
      if (mode === 'wrong-current-validity' && current) current.validUntil = '2026-12-30T00:00:00Z';
      const response = {
        targetType: 'WP_DELEGATION',
        targetId: existing?.delegationId ?? null,
        current,
        proposed:
          mode === 'wrong-proposed-floor' ? { ...body.proposed, floorIds: null } : body.proposed,
        currentActorAccess: null,
        knownImpact: [impact],
        warnings: [
          'Other current user and verified group grants retain their own permission scopes.',
        ],
        evaluatedAt: '2026-09-14T00:00:00Z',
        ...(mode === 'malformed-metadata'
          ? { evaluatedAt: 'not-a-time', warnings: { invalid: true } }
          : {}),
      };
      reviews.push({ path, body, response });
      return fulfillSuccess(route, response);
    }
    if (
      request.method() === 'POST' &&
      /\/experience\/collaboration\/delegations\/(?:[^/]+\/)?changes$/.test(path)
    ) {
      const body = request.postDataJSON() as Body;
      changes.push({ path, body });
      if (mode === 'unknown')
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Fixture simulates unknown command delivery.' }),
        });
      const result = {
        ...body.proposed,
        delegationId: path.includes(`/${delegationId}/`)
          ? delegationId
          : 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        version: (body.proposed.version ?? -1) + 1,
      } as WorkplaceGovernanceDelegatedAdminScope;
      assignments = [result];
      return fulfillSuccess(route, result);
    }
    unexpectedWrites.push(`${request.method()} ${path}`);
    return route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'No non-fixture command is permitted.' }),
    });
  });
  return { reviews, changes, reads, unexpectedWrites };
}
async function openSaved(page: Page) {
  await page.goto('/workplace/admin/governance?area=delegation');
  await expect(
    page.getByText(`Managed floor scope: ${floors[0].name}, ${floors[1].name}`, { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit administrative delegation' });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('checkbox', { name: `${floors[0].name} · Active`, exact: true })
  ).toBeVisible();
  return dialog;
}
async function reviewAndConfirm(
  dialog: Locator,
  reason = 'Limit the mutable administrator permissions within the saved native floor scope'
) {
  const review = dialog.getByTestId('governance-change-review');
  await review.getByRole('button', { name: 'Review change impact' }).click();
  await expect(review.getByText(impact, { exact: true })).toBeVisible();
  await review.getByRole('textbox', { name: 'Reason for change' }).fill(reason);
  await review.getByRole('checkbox', { name: confirmLabel }).check();
  await expect(review.getByRole('button', { name: 'Save reviewed change' })).toBeEnabled();
  return review;
}
async function stableAndAccessible(page: Page, dialog?: Locator) {
  await expect
    .poll(() =>
      page
        .locator('main')
        .first()
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const sidebar = document.querySelector('[data-testid="rooms-sidebar"]');
          const offset =
            window.innerWidth >= 1200 ? (sidebar?.getBoundingClientRect().width ?? 0) : 0;
          return (
            Math.abs(rect.x - offset) < 1 && Math.abs(rect.width - (window.innerWidth - offset)) < 1
          );
        })
    )
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  if (dialog) {
    const overflow = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.left >= -1 &&
        rect.right <= window.innerWidth + 1 &&
        element.scrollWidth <= element.clientWidth + 1
      );
    });
    expect(overflow).toBe(true);
  }
  const result = await new AxeBuilder({ page })
    .include(dialog ? '[role="dialog"]' : 'main')
    .analyze();
  expect(result.violations).toEqual([]);
}
async function capture(page: Page, name: string, focus?: Locator) {
  if (focus) await focus.scrollIntoViewIfNeeded();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}

test('saved floor range shows native names and immutable scope, reviews exact snapshots and dispatches once at1440/390/320', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await setup(page);
  let dialog = await openSaved(page);
  await expect(dialog.getByRole('textbox', { name: 'Member ID' })).toHaveValue('900018');
  await expect(dialog.getByRole('textbox', { name: 'Member ID' })).toBeDisabled();
  for (const label of ['Delegate type', 'Policy scope', 'Building', 'Managed floor scope'])
    await expect(
      dialog.getByRole('combobox', { name: new RegExp('^' + label + '(?: |$)') })
    ).toBeDisabled();
  for (const floor of floors)
    await expect(
      dialog.getByRole('checkbox', {
        name: new RegExp(floor.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      })
    ).toBeDisabled();
  await expect(
    dialog.getByRole('checkbox', { name: `${floors[0].name} · Active`, exact: true })
  ).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: /^11F · Operations planning/ })).toBeChecked();
  await dialog.getByRole('checkbox', { name: 'Manage catalog', exact: true }).uncheck();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const review = await reviewAndConfirm(dialog);
    await stableAndAccessible(page, dialog);
    const body = fixture.reviews.at(-1)!.body;
    expect(body.proposed).toMatchObject({
      siteId,
      delegateUserId: saved.delegateUserId,
      floorIds: saved.floorIds,
      permissions: ['CATALOG_VIEW'],
      validFrom: saved.validFrom,
      validUntil: saved.validUntil,
      version: 11,
    });
    expect(fixture.reviews.at(-1)!.response.current).toMatchObject(saved);
    expect(fixture.reviews.at(-1)!.response.proposed).toEqual(body.proposed);
    await capture(
      page,
      `saved-reviewed-${width}-values`,
      dialog.getByRole('region', { name: 'Current values' })
    );
    if (width < 1000)
      await capture(
        page,
        `saved-reviewed-${width}-scope`,
        dialog.getByRole('combobox', { name: /^Managed floor scope(?: |$)/ })
      );
    await review.getByRole('button', { name: 'Save reviewed change' }).focus();
    await expect(review.getByRole('button', { name: 'Save reviewed change' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(review.getByRole('button', { name: 'Return to item' })).toBeFocused();
    await capture(
      page,
      `saved-reviewed-${width}-confirmation`,
      review.getByRole('textbox', { name: 'Reason for change' })
    );
  }
  const review = await reviewAndConfirm(dialog);
  await review.getByRole('button', { name: 'Save reviewed change' }).evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect(
    review.getByText('The change and reason were saved. You can check the record in the audit.')
  ).toBeVisible();
  expect(fixture.changes).toHaveLength(1);
  expect(fixture.changes[0]).toMatchObject({
    path: `/api/platform/v1/admin/workplace/experience/collaboration/delegations/${delegationId}/changes`,
    body: {
      confirmed: true,
      proposed: { floorIds: saved.floorIds, version: 11, permissions: ['CATALOG_VIEW'] },
    },
  });
  expect(fixture.changes[0].body.reason).toBe(
    'Limit the mutable administrator permissions within the saved native floor scope'
  );
  expect(fixture.unexpectedWrites).toEqual([]);
  await capture(
    page,
    'saved-success-320',
    review.getByText('The change and reason were saved. You can check the record in the audit.')
  );
  dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
});

test('new floor range requires a nonempty native option selection and reviews a null current target', async ({
  page,
}) => {
  const fixture = await setup(page);
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/workplace/admin/governance?area=delegation');
  await page.getByRole('button', { name: 'Add delegation' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add delegation' });
  await dialog.getByRole('textbox', { name: 'Member ID' }).fill('900022');
  await dialog.getByRole('combobox', { name: /^Managed floor scope(?: |$)/ }).click();
  await page.getByRole('option', { name: 'Selected floors', exact: true }).press('Enter');
  const review = dialog.getByTestId('governance-change-review');
  await expect(review.getByRole('button', { name: 'Review change impact' })).toBeDisabled();
  for (const floor of floors)
    await expect(
      dialog.getByRole('checkbox', {
        name: new RegExp(floor.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      })
    ).toBeVisible();
  await dialog.getByRole('checkbox', { name: `${floors[0].name} · Active`, exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(
    dialog.getByRole('checkbox', { name: `${floors[0].name} · Active`, exact: true })
  ).toBeChecked();
  await dialog.getByRole('checkbox', { name: /^11F · Operations planning/ }).check();
  await reviewAndConfirm(dialog, 'Assign only the two selected canonical floors');
  await stableAndAccessible(page, dialog);
  expect(fixture.reviews.at(-1)!.response.current).toBeNull();
  expect(fixture.reviews.at(-1)!.response.targetId).toBeNull();
  expect(fixture.reviews.at(-1)!.body.proposed).toMatchObject({
    delegateUserId: 900022,
    floorIds: [firstFloorId, secondFloorId],
    version: null,
  });
  await capture(
    page,
    'new-selected-floors-390',
    dialog.getByRole('combobox', { name: /^Managed floor scope(?: |$)/ })
  );
  await review.getByRole('button', { name: 'Save reviewed change' }).click();
  await expect(
    review.getByText('The change and reason were saved. You can check the record in the audit.')
  ).toBeVisible();
  expect(fixture.changes).toHaveLength(1);
  expect(fixture.changes[0].path).toBe(
    '/api/platform/v1/admin/workplace/experience/collaboration/delegations/changes'
  );
  expect(fixture.changes[0].body.confirmed).toBe(true);
  expect(fixture.unexpectedWrites).toEqual([]);
});

for (const mode of [
  'wrong-current-floor',
  'wrong-current-permission',
  'wrong-current-validity',
  'wrong-proposed-floor',
  'malformed-metadata',
] as const) {
  test(`native ${mode} cannot unlock a saved restricted assignment even with the same version`, async ({
    page,
  }) => {
    const fixture = await setup(page, mode),
      dialog = await openSaved(page);
    await dialog.getByRole('checkbox', { name: 'Manage catalog', exact: true }).uncheck();
    const review = dialog.getByTestId('governance-change-review');
    await review.getByRole('button', { name: 'Review change impact' }).click();
    await expect(
      review.getByText('The change impact is unavailable. Reload current values and review again.')
    ).toBeVisible();
    await expect(review.getByRole('button', { name: 'Save reviewed change' })).toBeDisabled();
    await expect(review.getByRole('checkbox', { name: confirmLabel })).toBeDisabled();
    await expect(review.getByRole('textbox', { name: 'Reason for change' })).toBeDisabled();
    expect(fixture.reviews).toHaveLength(1);
    expect(fixture.changes).toEqual([]);
    expect(fixture.unexpectedWrites).toEqual([]);
    if (mode === 'malformed-metadata')
      await capture(
        page,
        'malformed-native-review',
        review.getByText(
          'The change impact is unavailable. Reload current values and review again.'
        )
      );
  });
}

test('UNKNOWN manual source recheck reloads facts and never repeats the changes POST', async ({
  page,
}) => {
  const fixture = await setup(page, 'unknown'),
    dialog = await openSaved(page);
  await page.setViewportSize({ width: 320, height: 1000 });
  await dialog.getByRole('checkbox', { name: 'Manage catalog', exact: true }).uncheck();
  const review = await reviewAndConfirm(dialog);
  await review.getByRole('button', { name: 'Save reviewed change' }).click();
  await expect(
    review.getByText(
      'The save result is unknown. Check the current values and audit before submitting again.'
    )
  ).toBeVisible();
  await expect(review.getByRole('button', { name: 'Save reviewed change' })).toBeDisabled();
  await expect(
    dialog.getByRole('checkbox', { name: 'Manage catalog', exact: true })
  ).toBeDisabled();
  const before = fixture.reads.length;
  await capture(
    page,
    'unknown-save-320',
    review.getByRole('button', { name: 'Reload current values' })
  );
  await review.getByRole('button', { name: 'Reload current values' }).click();
  await expect(
    review.getByText('Current values reloaded. Review and confirm the proposed values again.')
  ).toBeVisible();
  expect(fixture.reads.length).toBeGreaterThan(before);
  expect(fixture.changes).toHaveLength(1);
  await expect(review.getByRole('button', { name: 'Save reviewed change' })).toBeDisabled();
  await expect(review.getByRole('checkbox', { name: confirmLabel })).not.toBeChecked();
  await stableAndAccessible(page, dialog);
  await capture(
    page,
    'unknown-rechecked-320',
    review.getByText('Current values reloaded. Review and confirm the proposed values again.')
  );
  expect(fixture.unexpectedWrites).toEqual([]);
});

test('foreign native floor options expose no selectable floor and cannot enable a new floor assignment', async ({
  page,
}) => {
  const fixture = await setup(page, 'foreign-options');
  await page.goto('/workplace/admin/governance?area=delegation');
  await page.getByRole('button', { name: 'Add delegation' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add delegation' });
  await dialog.getByRole('textbox', { name: 'Member ID' }).fill('900022');
  await dialog.getByRole('combobox', { name: /^Managed floor scope(?: |$)/ }).click();
  await page.getByRole('option', { name: 'Selected floors', exact: true }).click();
  await expect(
    dialog.getByText(
      'Current floor information is unavailable. Recheck the site and floor information.',
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    dialog.getByRole('checkbox', {
      name: new RegExp(floors[0].name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    })
  ).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Review change impact' })).toBeDisabled();
  expect(fixture.changes).toEqual([]);
  expect(fixture.reviews).toEqual([]);
  expect(fixture.unexpectedWrites).toEqual([]);
});
