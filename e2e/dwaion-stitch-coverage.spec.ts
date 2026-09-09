import AxeBuilder from '@axe-core/playwright';
import koWork from '../libs/shared-i18n/src/locales/ko/work.json' with { type: 'json' };
import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN_AGENT,
  ADMIN_EVALUATION,
  mockDwaionAdminStitch,
} from './support/dwaion-admin-stitch-fixtures';

const SCREENS = [
  {
    id: 'A01',
    path: 'overview',
    title: 'DWAI·ON operations overview',
    ready: 'Total runs',
  },
  {
    id: 'A02',
    path: 'agents',
    title: 'Agent and publishing management',
    ready: ADMIN_AGENT.name,
  },
  {
    id: 'A03',
    path: 'sources',
    title: 'Data sources and connectors',
    ready: 'Calendar',
  },
  {
    id: 'A04',
    path: 'actions',
    title: 'Actions and execution access',
    ready: 'Create calendar event',
  },
  {
    id: 'A05',
    path: 'safety',
    title: 'Policy and safety controls',
    ready: 'Block prompt injection',
  },
  {
    id: 'A06',
    path: 'evaluation',
    title: 'Response quality and evaluation',
    ready: 'Safe calendar handoff checks',
  },
  {
    id: 'A07',
    path: 'gates',
    title: 'Operational readiness review',
    ready: 'Production model credentials',
  },
  {
    id: 'A08',
    path: 'audit',
    title: 'Data retention and audit',
    ready: 'source-policy.updated',
  },
] as const;

async function assertAccessible(page: Page) {
  const violations = (
    await new AxeBuilder({ page })
      .include(
        (await page.getByRole('dialog').or(page.getByRole('alertdialog')).count())
          ? '[role="dialog"], [role="alertdialog"]'
          : 'main'
      )
      .analyze()
  ).violations;
  expect(violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual(
    []
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true
  );
}
async function openScreen(page: Page, screen: (typeof SCREENS)[number]) {
  await page.goto(`/dwaion/admin/${screen.path}`);
  await expect(page.getByRole('heading', { name: screen.title, exact: true })).toBeVisible();
  await expect(
    page.getByRole('main').getByText(screen.ready, { exact: true }).first()
  ).toBeVisible();
}
async function inspectRegistry(page: Page, path: string) {
  if (path === 'agents') await page.getByRole('button', { name: /DWP work assistant/ }).click();
  if (path === 'sources')
    await page.getByRole('button', { name: /Calendar.*Configured connection/ }).click();
  if (path === 'actions') await page.getByRole('button', { name: /Create calendar event/ }).click();
}
async function assertEvaluationSetFields(page: Page, locale = 'en') {
  if ((page.viewportSize()?.width ?? 1440) >= 900) {
    const cell = page.getByRole('gridcell', { name: ADMIN_EVALUATION.summary.name, exact: true });
    await cell.focus();
    await cell.press('Enter');
    return;
  }
  const list = page.getByRole('list', {
    name: locale === 'ko' ? koWork.dwaionAdmin.evaluation.tableLabel : 'DWAI·ON evaluation sets',
  });
  const row = list.getByRole('button', { name: /Safe calendar handoff checks/ });
  await expect(row).toBeVisible();
  await row.focus();
  await row.press('Enter');
  await expect(row).toBeFocused();
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  const fields =
    locale === 'ko'
      ? ['상태: 활성', '사례 수: 2', '최근 실행: 완료']
      : ['State: Active', 'Cases: 2', 'Latest run: Completed'];
  for (const label of [ADMIN_EVALUATION.summary.name, ...fields]) {
    const field = row.getByText(label, { exact: true });
    await expect(field).toBeVisible();
    expect(
      await field.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        return (
          bounds.left >= 0 &&
          bounds.right <= innerWidth + 1 &&
          node.scrollWidth <= node.clientWidth + 1
        );
      })
    ).toBe(true);
  }
  expect(
    await row.evaluate(
      (node) =>
        node.tagName === 'BUTTON' &&
        node.getBoundingClientRect().height >= 44 &&
        node.scrollWidth <= node.clientWidth + 1
    )
  ).toBe(true);
}
for (const screen of SCREENS) {
  for (const width of [1440, 390]) {
    test(`${screen.id} normal-data ${width}: ${screen.path}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await mockDwaionAdminStitch(page);
      await openScreen(page, screen);
      if (screen.path === 'evaluation') await assertEvaluationSetFields(page);
      await assertAccessible(page);
      await page.screenshot({
        path: testInfo.outputPath(`${screen.id}-${width}-normal.png`),
        fullPage: true,
        animations: 'disabled',
      });
      if (['agents', 'sources', 'actions', 'gates', 'audit'].includes(screen.path)) {
        if (screen.path === 'gates' || screen.path === 'audit') {
          const row = page.getByRole('button', {
            name:
              screen.path === 'gates' ? /Production model credentials/ : /source-policy\.updated/,
          });
          await row.focus();
          await row.press('Enter');
        } else await inspectRegistry(page, screen.path);
        const detailLabel =
          screen.path === 'audit'
            ? 'Correlation ID'
            : screen.path === 'agents'
              ? 'Revision history'
              : 'Policy version';
        await expect(page.getByText(detailLabel, { exact: true })).toBeVisible();
        await assertAccessible(page);
        await page.screenshot({
          path: testInfo.outputPath(`${screen.id}-${width}-inspector.png`),
          fullPage: width !== 390,
          animations: 'disabled',
        });
        if (width === 390) {
          await expect(page.getByRole('dialog')).toBeVisible();
          await page.getByRole('button', { name: 'Close details' }).click();
          await expect(
            page.getByRole('button', {
              name: /DWP work assistant|Calendar.*Configured connection|Create calendar event|Production model credentials|source-policy\.updated/,
            })
          ).toBeFocused();
        }
      }
      await expect(
        page.getByText(/Live v|AI accuracy[: ]*[0-9]|100% available|automatic diagnosis complete/i)
      ).toHaveCount(0);
    });
  }
  test(`${screen.id} API 503 has a visible failure, not a fabricated empty success`, async ({
    page,
  }) => {
    await mockDwaionAdminStitch(page, {
      failedPath:
        screen.path === 'evaluation'
          ? '/evaluations'
          : screen.path === 'agents'
            ? '/dwaion/agents'
            : `/${screen.path}`,
    });
    await page.goto(`/dwaion/admin/${screen.path}`);
    await expect(page.getByRole('heading', { name: screen.title, exact: true })).toBeVisible();
    await expect(page.getByText(/could not be|couldn't|unavailable/i).first()).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('main').getByText(screen.ready, { exact: true })).toHaveCount(0);
  });
  test(`${screen.id} missing admin VIEW cannot fetch protected content`, async ({ page }) => {
    const fixture = await mockDwaionAdminStitch(page, { noAccess: true });
    await page.goto(`/dwaion/admin/${screen.path}`);
    await expect(page.getByRole('heading', { name: screen.title, exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Access denied', exact: true })).toBeVisible({
      timeout: 20000,
    });
    expect(fixture.requests).toHaveLength(0);
  });
}

test('A01 period and refresh use the selected API scope with an actual snapshot timestamp', async ({
  page,
}) => {
  const { requests } = await mockDwaionAdminStitch(page);
  await openScreen(page, SCREENS[0]);
  await page.getByRole('combobox', { name: 'Reporting period' }).click();
  await page.getByRole('option', { name: 'Last 7 days', exact: true }).click();
  await expect(page).toHaveURL(/days=7/);
  await expect
    .poll(() => requests.filter((item) => item.search.includes('period_days=7')).length)
    .toBe(1);
  await expect(page.getByText(/Snapshot generated Sep 8, 2026/)).toBeVisible();
  await page.getByRole('button', { name: 'Refresh overview' }).click();
  await expect
    .poll(() => requests.filter((item) => item.search.includes('period_days=7')).length)
    .toBe(2);
});

test('A02 searches loaded entries, inspects real history and confirms publish and retire before mutation', async ({
  page,
}) => {
  const { requests } = await mockDwaionAdminStitch(page);
  await openScreen(page, SCREENS[1]);
  await page.getByRole('textbox', { name: 'Search loaded items' }).fill('unmatched');
  await expect(page.getByText('No items match these filters.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Search loaded items' }).fill('Work operations');
  await inspectRegistry(page, 'agents');
  await expect(page.getByText('2 · 1.2.0 · RETIRED · Work operations')).toBeVisible();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish', exact: true });
  await expect(dialog).toContainText('does not verify model connectivity');
  expect(requests.filter((item) => item.method === 'POST')).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(requests.filter((item) => item.method === 'POST')).toHaveLength(0);
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('The selected revision was published.')).toBeVisible();
  expect(requests.find((item) => item.path.endsWith('/activate'))?.body).toEqual({ version: 7 });
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retire', exact: true }).click();
  const retirement = page.getByRole('alertdialog', { name: 'Retire', exact: true });
  await expect(retirement).toContainText('Existing conversations and source work are not deleted.');
  await assertAccessible(page);
  await retirement.getByRole('button', { name: 'Cancel' }).click();
  expect(requests.filter((item) => item.path.endsWith('/retire'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Retire', exact: true }).click();
  await retirement.getByRole('button', { name: 'Retire', exact: true }).click();
  await expect(page.getByText('The agent was retired.')).toBeVisible();
  expect(requests.find((item) => item.path.endsWith('/retire'))?.body).toEqual({ version: 8 });
});

for (const authority of ['CREATE', 'UPDATE', 'APPROVE', 'MANAGE'] as const) {
  test(`A02 ${authority} exposes only its exact mutation controls`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const { requests } = await mockDwaionAdminStitch(page, {
      agentPermissionCodes: ['VIEW', authority],
    });
    await openScreen(page, SCREENS[1]);

    await expect(page.getByRole('button', { name: 'New agent', exact: true })).toHaveCount(
      authority === 'CREATE' ? 1 : 0
    );
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(
      authority === 'UPDATE' ? 1 : 0
    );
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(
      authority === 'APPROVE' ? 1 : 0
    );
    await expect(page.getByRole('button', { name: 'Retire', exact: true })).toHaveCount(
      authority === 'MANAGE' ? 1 : 0
    );

    await page.getByRole('button', { name: /Approval evidence specialist/ }).click();
    await expect(page.getByRole('button', { name: 'New revision', exact: true })).toHaveCount(
      authority === 'CREATE' ? 1 : 0
    );
    await expect(page.getByRole('button', { name: 'Retire', exact: true })).toHaveCount(
      authority === 'MANAGE' ? 1 : 0
    );
    expect(requests.filter((item) => item.method !== 'GET')).toHaveLength(0);
  });
}

for (const path of ['sources', 'actions'] as const) {
  test(`${path === 'sources' ? 'A03' : 'A04'} policy draft requires reason, carries version, and retains conflict input`, async ({
    page,
  }) => {
    const { requests, state } = await mockDwaionAdminStitch(page);
    await openScreen(page, SCREENS[path === 'sources' ? 2 : 3]);
    await inspectRegistry(page, path);
    await page.getByRole('button', { name: 'Edit policy', exact: true }).click();
    const dialog = page.getByRole('dialog', {
      name: path === 'sources' ? 'Edit data source policy' : 'Edit action policy',
    });
    await expect(dialog.getByRole('region', { name: 'Review changes' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await dialog
      .getByLabel(path === 'sources' ? 'Enable this data source' : 'Enable action', { exact: true })
      .uncheck();
    const reason = 'Review this synthetic policy change with the owning team.';
    await dialog.getByRole('textbox', { name: 'Change reason' }).fill(reason);
    let conflict = true;
    await page.route(`**/api/agent/v1/admin/${path}/*`, (route) =>
      conflict
        ? route.fulfill({
            status: 409,
            json: { detail: 'Policy version conflict' },
          })
        : route.fallback()
    );
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      dialog.getByRole('alert').filter({ hasText: 'could not be completed' })
    ).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Change reason' })).toHaveValue(reason);
    conflict = false;
    if (path === 'sources') state.sources[0].policyVersion = 9;
    else state.actions[0].policyVersion = 10;
    await dialog.getByRole('button', { name: 'Load current version for comparison' }).click();
    await expect(
      dialog.getByRole('alert').filter({ hasText: 'could not be completed' })
    ).toHaveCount(0);
    await expect(dialog.getByRole('textbox', { name: 'Change reason' })).toHaveValue(reason);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const patch = requests.find((item) => item.method === 'PATCH');
    expect(patch?.body).toMatchObject({
      expectedVersion: path === 'sources' ? 9 : 10,
      enabled: false,
      changeReason: reason,
    });
    if (path === 'actions') expect(patch?.body?.confirmationRequired).toBe(true);
  });
}

for (const path of ['sources', 'actions'] as const) {
  for (const authority of ['UPDATE', 'MANAGE'] as const) {
    test(`${path === 'sources' ? 'A03' : 'A04'} ${authority} exposes only its exact policy control`, async ({
      page,
    }) => {
      const permissionOptions =
        path === 'sources'
          ? { sourcePermissionCodes: ['VIEW', authority] as const }
          : { actionPermissionCodes: ['VIEW', authority] as const };
      const { requests } = await mockDwaionAdminStitch(page, permissionOptions);
      await openScreen(page, SCREENS[path === 'sources' ? 2 : 3]);

      await expect(page.getByRole('button', { name: 'Edit policy', exact: true })).toHaveCount(
        authority === 'UPDATE' ? 1 : 0
      );
      await expect(
        page.getByRole('button', {
          name: path === 'sources' ? 'New connector unavailable' : 'New action unavailable',
          exact: true,
        })
      ).toBeDisabled();
      await inspectRegistry(page, path);
      await assertAccessible(page);
      expect(requests.filter((item) => item.method !== 'GET')).toHaveLength(0);
    });
  }
}

for (const path of ['sources', 'actions'] as const) {
  test(`${path === 'sources' ? 'A03' : 'A04'} MANAGE initializes only an empty server policy set`, async ({
    page,
  }) => {
    const permissionOptions =
      path === 'sources'
        ? { sourcePermissionCodes: ['VIEW', 'MANAGE'] as const }
        : { actionPermissionCodes: ['VIEW', 'MANAGE'] as const };
    const { requests } = await mockDwaionAdminStitch(page, {
      ...permissionOptions,
      empty: true,
    });
    await page.goto(`/dwaion/admin/${path}`);
    await expect(
      page.getByRole('heading', {
        name: path === 'sources' ? 'Data sources and connectors' : 'Actions and execution access',
        exact: true,
      })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Initialize default policies', exact: true }).click();
    const dialog = page.getByRole('dialog', {
      name: path === 'sources' ? 'Initialize data source policies' : 'Initialize action policies',
    });
    await expect(
      dialog.getByRole('button', { name: 'Initialize default policies' })
    ).toBeDisabled();
    const reason = `Initialize the ${path} policy set for controlled tenant rollout.`;
    await dialog.getByRole('textbox', { name: 'Change reason' }).fill(reason);
    await assertAccessible(page);
    await dialog.getByRole('button', { name: 'Initialize default policies' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page
        .getByText(path === 'sources' ? 'Calendar' : 'Create calendar event', { exact: true })
        .first()
    ).toBeVisible();
    const request = requests.find((item) => item.path.endsWith(`/${path}/bootstrap`));
    expect(request?.method).toBe('POST');
    expect(request?.body).toMatchObject({
      expectedExistingCount: 0,
      changeReason: reason,
    });
    expect(request?.body?.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
}

test('A05 keyboard edits budget and requires change reason before versioned save', async ({
  page,
}) => {
  const { requests } = await mockDwaionAdminStitch(page);
  await openScreen(page, SCREENS[4]);
  const budget = page.getByRole('slider', {
    name: 'Maximum tool calls per request',
  });
  await budget.focus();
  await page.keyboard.press('ArrowRight');
  await page
    .getByRole('textbox', { name: 'Change reason' })
    .fill('Limit tool calls for the reviewed tenant policy.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('The safety policy was saved.')).toBeVisible();
  expect(requests.find((item) => item.method === 'PATCH')?.body).toMatchObject({
    expectedVersion: 8,
    maxToolCalls: 4,
    requireCitations: true,
  });
  await expect(page.getByText('Runtime enforcement result', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Not provided by this policy API', { exact: true }).first()
  ).toBeVisible();
});

for (const authority of ['UPDATE', 'MANAGE'] as const) {
  test(`A05 ${authority} exposes only its exact safety-policy control`, async ({ page }) => {
    const { requests } = await mockDwaionAdminStitch(page, {
      safetyPermissionCodes: ['VIEW', authority],
    });
    await openScreen(page, SCREENS[4]);
    const slider = page.getByRole('slider', { name: 'Maximum tool calls per request' });
    if (authority === 'UPDATE') {
      await expect(slider).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    } else {
      await expect(slider).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    }
    for (const action of [
      'Policy history unavailable',
      'Schema export unavailable',
      'Dry run unavailable',
    ]) {
      await expect(page.getByRole('button', { name: action, exact: true })).toBeDisabled();
    }
    await assertAccessible(page);
    expect(requests.filter((item) => item.method !== 'GET')).toHaveLength(0);
  });
}

test('A05 MANAGE initializes only a missing server safety policy', async ({ page }) => {
  const { requests } = await mockDwaionAdminStitch(page, {
    empty: true,
    safetyPermissionCodes: ['VIEW', 'MANAGE'],
  });
  await page.goto('/dwaion/admin/safety');
  await expect(
    page.getByRole('heading', { name: 'Policy and safety controls', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Initialize safety policy', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Initialize safety policy', exact: true });
  await expect(dialog.getByRole('button', { name: 'Initialize safety policy' })).toBeDisabled();
  const reason = 'Initialize the fail-closed tenant safety policy for review.';
  await dialog.getByRole('textbox', { name: 'Change reason' }).fill(reason);
  await assertAccessible(page);
  await dialog.getByRole('button', { name: 'Initialize safety policy' }).click();
  await expect(page.getByText('Server-controlled baseline', { exact: true })).toBeVisible();
  const request = requests.find((item) => item.path.endsWith('/safety/bootstrap'));
  expect(request?.method).toBe('POST');
  expect(request?.body).toMatchObject({ expectedExistingCount: 0, changeReason: reason });
  expect(request?.body?.idempotencyKey).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
});

test('A06 active fixture evaluation exposes case outcomes and export, read-only cannot run', async ({
  page,
}) => {
  const { requests } = await mockDwaionAdminStitch(page);
  await openScreen(page, SCREENS[5]);
  await expect(page.getByRole('heading', { name: 'Latest run result' })).toBeVisible();
  await expect(
    page.getByText(
      'Results check source grounding and expected terms only; they do not measure AI accuracy.'
    )
  ).toBeVisible();
  await expect(
    page.getByText(/Quality comparison unavailable: dataset, model, policy/)
  ).toBeVisible();
  await expect(page.getByText(/1 \/ 2 expected terms/)).toBeVisible();
  await expect(page.getByText('1 passed', { exact: true })).toBeVisible();
  await expect(page.getByText('1 failed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Run evaluation', exact: true }).click();
  await expect.poll(() => requests.filter((item) => item.method === 'POST').length).toBe(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export results' }).click();
  expect((await download).suggestedFilename()).toContain('dwaion-evaluation');
  expect(requests.find((item) => item.method === 'POST')?.path).toContain(
    ADMIN_EVALUATION.summary.evaluationSetId
  );
});

for (const authority of ['CREATE', 'UPDATE', 'MANAGE', 'EXECUTE', 'EXPORT'] as const) {
  test(`A06 ${authority} exposes only its exact evaluation control`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const { requests } = await mockDwaionAdminStitch(page, {
      evaluationPermissionCodes: ['VIEW', authority],
    });
    await openScreen(page, SCREENS[5]);

    await expect(
      page.getByRole('button', { name: 'Create evaluation set', exact: true })
    ).toHaveCount(authority === 'CREATE' ? 1 : 0);
    await expect(
      page.getByRole('button', { name: 'Add evaluation case', exact: true })
    ).toHaveCount(authority === 'UPDATE' ? 1 : 0);
    await expect(page.getByRole('button', { name: 'Retire set', exact: true })).toHaveCount(
      authority === 'MANAGE' ? 1 : 0
    );
    await expect(page.getByRole('button', { name: 'Run evaluation', exact: true })).toHaveCount(
      authority === 'EXECUTE' ? 1 : 0
    );
    await expect(page.getByRole('button', { name: 'Export results', exact: true })).toHaveCount(
      authority === 'EXPORT' ? 1 : 0
    );
    await expect(
      page.getByRole('button', { name: 'CSV import unavailable', exact: true })
    ).toBeDisabled();
    await assertAccessible(page);
    expect(requests.filter((item) => item.method !== 'GET')).toHaveLength(0);
  });
}

test('A06 MANAGE lifecycle change carries the selected set version and reason', async ({
  page,
}) => {
  const { requests } = await mockDwaionAdminStitch(page, {
    evaluationPermissionCodes: ['VIEW', 'MANAGE'],
  });
  await openScreen(page, SCREENS[5]);
  const reason = 'Retire this reviewed fixture set after its replacement is active.';
  await page.getByRole('textbox', { name: 'Change reason' }).fill(reason);
  await page.getByRole('button', { name: 'Retire set', exact: true }).click();
  await expect.poll(() => requests.some((item) => item.path.endsWith('/lifecycle'))).toBe(true);
  expect(requests.find((item) => item.path.endsWith('/lifecycle'))?.body).toMatchObject({
    lifecycleState: 'RETIRED',
    expectedVersion: 3,
    changeReason: reason,
  });
});

test('A07 environment changes reload evidence and self-approval remains blocked', async ({
  page,
}) => {
  const { requests } = await mockDwaionAdminStitch(page);
  await openScreen(page, SCREENS[6]);
  await page.getByRole('button', { name: 'Staging', exact: true }).click();
  await expect
    .poll(() => requests.some((item) => item.search.includes('environment=STAGING')))
    .toBe(true);
  await page.getByRole('button', { name: /Production model credentials/ }).click();
  await page.getByRole('button', { name: 'Review details', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Synthetic managed identity boundary check')).toBeVisible();
  await expect(dialog.getByText(/cannot approve because you are the configurator/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save approval decision' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(requests.filter((item) => item.method !== 'GET')).toHaveLength(0);
});

test('A07 pagination keeps every returned gate available for inspection', async ({ page }) => {
  const { requests } = await mockDwaionAdminStitch(page);
  await openScreen(page, SCREENS[6]);

  await expect(page.getByText('1 / 2 · 1–7 / 13', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByText('2 / 2 · 8–13 / 13', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Production evaluation dataset/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Production evaluation dataset', level: 2 })
  ).toBeVisible();
  await expect(
    page.getByText('Missing required evidence: Test result', { exact: true })
  ).toBeVisible();
  await expect
    .poll(() =>
      requests.some(
        (item) => item.method === 'GET' && item.path.endsWith('/gates/EVALUATION_DATASET')
      )
    )
    .toBe(true);
  await assertAccessible(page);
  expect(requests.filter((item) => item.method !== 'GET')).toHaveLength(0);
});

for (const authority of ['CREATE', 'UPDATE', 'APPROVE', 'MANAGE'] as const) {
  test(`A07 ${authority} exposes only its exact gate control`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const { requests } = await mockDwaionAdminStitch(page, {
      gatePermissionCodes: ['VIEW', authority],
    });
    await openScreen(page, SCREENS[6]);
    await expect(page.getByRole('button', { name: 'Review details', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add evidence', exact: true })).toHaveCount(
      authority === 'CREATE' ? 1 : 0
    );
    await expect(page.getByRole('button', { name: 'Edit policy', exact: true })).toHaveCount(
      authority === 'UPDATE' ? 1 : 0
    );
    await expect(page.getByRole('button', { name: 'Review approval', exact: true })).toHaveCount(
      authority === 'APPROVE' ? 1 : 0
    );
    for (const label of [
      'Gate history unavailable',
      'Portfolio export unavailable',
      'Bulk authorization unavailable',
    ]) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeDisabled();
    }
    await assertAccessible(page);
    expect(requests.filter((item) => item.method !== 'GET')).toHaveLength(0);
  });
}

test('A07 MANAGE initializes only an empty environment-scoped gate portfolio', async ({ page }) => {
  const { requests } = await mockDwaionAdminStitch(page, {
    empty: true,
    gatePermissionCodes: ['VIEW', 'MANAGE'],
  });
  await page.goto('/dwaion/admin/gates');
  await expect(
    page.getByRole('heading', { name: 'Operational readiness review', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Initialize gate portfolio', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Initialize operational gates', exact: true });
  await expect(dialog.getByRole('button', { name: 'Initialize gate portfolio' })).toBeDisabled();
  const reason = 'Initialize the production gate portfolio for independent tenant review.';
  await dialog.getByRole('textbox', { name: 'Change reason' }).fill(reason);
  await assertAccessible(page);
  await dialog.getByRole('button', { name: 'Initialize gate portfolio' }).click();
  await expect(
    page.getByText('Production model credentials', { exact: true }).first()
  ).toBeVisible();
  const request = requests.find((item) => item.path.endsWith('/gates/bootstrap'));
  expect(request?.method).toBe('POST');
  expect(request?.search).toContain('environment=PRODUCTION');
  expect(request?.body).toMatchObject({ expectedExistingCount: 0, changeReason: reason });
  expect(request?.body?.idempotencyKey).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
});

test('A08 audit search uses server filters; retention change has its own version and no deletion claim', async ({
  page,
}) => {
  const { requests } = await mockDwaionAdminStitch(page);
  await openScreen(page, SCREENS[7]);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  await download;
  await expect(page.getByText(/Some rows were excluded by the server limit/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Search audit history' }).fill('CALENDAR');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect
    .poll(() => requests.some((item) => item.search.includes('query=CALENDAR')))
    .toBe(true);
  await page.getByRole('spinbutton', { name: 'Retention period (days)' }).fill('210');
  await page
    .getByRole('textbox', { name: 'Change reason', exact: true })
    .fill('Apply the reviewed synthetic retention schedule.');
  await page.getByRole('button', { name: 'Save policy', exact: true }).click();
  await expect(page.getByText('The retention policy was saved with audit evidence.')).toBeVisible();
  expect(requests.find((item) => item.method === 'PATCH')?.body).toMatchObject({
    retentionDays: 210,
    expectedVersion: 6,
  });
  await page.getByRole('button', { name: /source-policy\.updated/ }).click();
  await expect(page.getByText('Before/after policy diff', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Not provided by this audit API', { exact: true }).first()
  ).toBeVisible();
  await expect(page.getByText(/deletion complete|all records deleted/i)).toHaveCount(0);
});

for (const authority of ['EXPORT', 'MANAGE'] as const) {
  test(`A08 ${authority} exposes only its exact audit control`, async ({ page }) => {
    const { requests } = await mockDwaionAdminStitch(page, {
      auditPermissionCodes: ['VIEW', authority],
      retentionPermissionCodes: ['VIEW'],
    });
    await openScreen(page, SCREENS[7]);
    await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toHaveCount(
      authority === 'EXPORT' ? 1 : 0
    );
    await page.getByRole('button', { name: /source-policy\.updated/ }).click();
    await assertAccessible(page);
    expect(requests.filter((item) => item.method !== 'GET')).toHaveLength(0);
  });
}

for (const authority of ['UPDATE', 'MANAGE'] as const) {
  test(`A08 retention ${authority} changes only its exact field`, async ({ page }) => {
    const { requests } = await mockDwaionAdminStitch(page, {
      auditPermissionCodes: ['VIEW'],
      retentionPermissionCodes: ['VIEW', authority],
    });
    await openScreen(page, SCREENS[7]);
    const days = page.getByRole('spinbutton', { name: 'Retention period (days)' });
    const hold = page.getByRole('checkbox', { name: 'Enable legal hold' });
    if (authority === 'UPDATE') {
      await expect(days).toBeEnabled();
      await expect(hold).toBeDisabled();
      await days.fill('210');
    } else {
      await expect(days).toBeDisabled();
      await expect(hold).toBeEnabled();
      await hold.check();
    }
    await page
      .getByRole('textbox', { name: 'Change reason', exact: true })
      .fill(`Apply the reviewed ${authority.toLowerCase()} retention change.`);
    await page.getByRole('button', { name: 'Save policy', exact: true }).click();
    await expect.poll(() => requests.some((item) => item.method === 'PATCH')).toBe(true);
    const patch = requests.find((item) => item.method === 'PATCH');
    expect(patch?.body).toMatchObject({
      expectedVersion: 6,
      ...(authority === 'UPDATE' ? { retentionDays: 210 } : { legalHold: true }),
    });
    if (authority === 'UPDATE') expect(patch?.body).not.toHaveProperty('legalHold');
    else expect(patch?.body).not.toHaveProperty('retentionDays');
  });
}

test('A08 MANAGE initializes only a missing server retention policy', async ({ page }) => {
  const { requests } = await mockDwaionAdminStitch(page, {
    empty: true,
    auditPermissionCodes: ['VIEW'],
    retentionPermissionCodes: ['VIEW', 'MANAGE'],
  });
  await page.goto('/dwaion/admin/audit');
  await expect(
    page.getByRole('heading', { name: 'Data retention and audit', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Initialize retention policy', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Initialize retention policy',
    exact: true,
  });
  const reason = 'Initialize the reviewed tenant retention baseline.';
  await dialog.getByRole('textbox', { name: 'Change reason' }).fill(reason);
  await assertAccessible(page);
  await dialog.getByRole('button', { name: 'Initialize retention policy' }).click();
  await expect(page.getByText('Retention period (days)', { exact: true }).first()).toBeVisible();
  const request = requests.find((item) => item.path.endsWith('/retention/bootstrap'));
  expect(request?.method).toBe('POST');
  expect(request?.body).toMatchObject({
    expectedExistingCount: 0,
    retentionDays: 90,
    legalHold: false,
    changeReason: reason,
  });
  expect(request?.body?.idempotencyKey).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
});

test('A02-A08 VIEW alone exposes no mutation or export authority', async ({ page }) => {
  const { requests } = await mockDwaionAdminStitch(page, { readOnly: true });
  for (const screen of SCREENS.slice(1)) {
    await openScreen(page, screen);
    await inspectRegistry(page, screen.path);
    for (const action of [
      'New agent',
      'Edit policy',
      'Publish',
      'Retire',
      'Run evaluation',
      'Export results',
      'Export CSV',
      'Add evidence',
      'Record validation',
      'Review approval',
    ]) {
      await expect(page.getByRole('button', { name: action, exact: true })).toHaveCount(0);
    }
  }
  expect(requests.filter((item) => item.method !== 'GET')).toHaveLength(0);
});

for (const screen of SCREENS) {
  test(`${screen.id} empty or unmeasured data remains honest`, async ({ page }) => {
    await mockDwaionAdminStitch(page, { empty: true });
    await page.goto(`/dwaion/admin/${screen.path}`);
    await expect(page.getByRole('heading', { name: screen.title, exact: true })).toBeVisible();
    if (['agents', 'sources', 'actions'].includes(screen.path))
      await expect(page.getByText('There are no loaded items.')).toBeVisible();
    if (screen.path === 'evaluation')
      await expect(page.getByText('There are no evaluation sets')).toBeVisible();
    await expect(page.getByText(/100%|AI accuracy[: ]*[0-9]|Connection verified/)).toHaveCount(0);
  });
}

for (const variant of [
  { name: '1920-wide', width: 1920 },
  { name: '390-korean', width: 390, locale: 'ko' as const },
  { name: '320-dark', width: 320, dark: true },
  { name: '1280-forced', width: 1280, forced: true },
  { name: '640-text200', width: 640, largeText: true },
]) {
  for (const screen of SCREENS) {
    test(`${screen.id} reflow ${variant.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: variant.width, height: 1000 });
      const locale = 'locale' in variant ? variant.locale : 'en';
      await mockDwaionAdminStitch(page, { dark: 'dark' in variant, locale });
      if ('forced' in variant) await page.emulateMedia({ forcedColors: 'active' });
      if (locale === 'ko') {
        await page.goto(`/dwaion/admin/${screen.path}`);
        await expect(
          page.getByRole('heading', {
            name: koWork.dwaionAdmin[screen.path].title,
            exact: true,
          })
        ).toBeVisible();
        const ready =
          screen.path === 'overview'
            ? koWork.dwaionAdmin.overview.runs
            : screen.path === 'sources'
              ? koWork.dwaionAdmin.sources.sourceNames.CALENDAR
              : screen.path === 'safety'
                ? koWork.dwaionAdmin.safety.prompt.title
                : screen.path === 'gates'
                  ? koWork.dwaionAdmin.gates.gateNames.MODEL_CREDENTIALS.title
                  : screen.ready;
        await expect(
          page.getByRole('main').getByText(ready, { exact: true }).first()
        ).toBeVisible();
      } else await openScreen(page, screen);
      if ('largeText' in variant)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
      if (screen.path === 'evaluation') await assertEvaluationSetFields(page, locale);
      await assertAccessible(page);
      await page.screenshot({
        path: testInfo.outputPath(`${screen.id}-${variant.name}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
}
