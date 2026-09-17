import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  DECISION_REVISION,
  IDS,
  MANAGEMENT_CONTEXT,
  MANAGEMENT_SCOPE,
  mockAdminV2,
  type CommandRecord,
  type FixtureState,
} from './support/approval-admin-v2-fixtures';

async function openMobileNavigation(page: Page) {
  const trigger = page.getByRole('button', { name: 'Open approval navigation' });
  const sidebar = page.getByTestId(
    (page.viewportSize()?.width ?? 1440) < 1200 ? 'approvals-mobile-sidebar' : 'approvals-sidebar'
  );
  if ((page.viewportSize()?.width ?? 1440) < 1200) {
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(sidebar).toBeVisible();
  }
  return sidebar;
}

async function noSeriousAxeViolations(
  page: Page,
  { forcedColors = false }: { forcedColors?: boolean } = {}
) {
  const builder = new AxeBuilder({ page });
  // Forced colors replace authored colors with user-agent system colors. Axe's
  // contrast sampler combines those overrides with the authored background.
  if (forcedColors) builder.disableRules(['color-contrast']);
  const result = await builder.analyze();
  expect(
    result.violations.filter((violation) =>
      violation.impact ? ['serious', 'critical'].includes(violation.impact) : false
    )
  ).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
        window.innerWidth
    )
  ).toBeLessThanOrEqual(1);
}

async function resetVerticalViewport(page: Page) {
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const reset = () => {
      window.scrollTo(0, 0);
      document.querySelectorAll<HTMLElement>('*').forEach((element) => {
        if (element.scrollTop !== 0) element.scrollTop = 0;
      });
    };
    reset();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    reset();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    reset();
  });
}

async function waitForManagementScopeUrl(page: Page) {
  await expect
    .poll(() => new URL(page.url()).searchParams.get('scope'), { timeout: 10_000 })
    .toBe(MANAGEMENT_SCOPE.key);
}

function workspaceHeading(page: Page, name: string) {
  return page.getByRole('heading', { name, exact: true, level: 1 }).last();
}

async function readCanonicalSource<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(
    async ({ requestPath, scopeKey }) => {
      const url = new URL(requestPath, window.location.origin);
      url.searchParams.set('contextScopeKey', scopeKey);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Canonical source ${url.pathname} returned ${response.status}`);
      }
      const envelope = (await response.json()) as { data: T };
      return envelope.data;
    },
    { requestPath: path, scopeKey: MANAGEMENT_SCOPE.key }
  );
}

async function completeHighRiskAction(page: Page, actionLabel: string) {
  await page.getByRole('button', { name: actionLabel, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Verify this high-risk action', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Verify identity', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Confirm action', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm action', exact: true }).click();
}

async function expectWriteCount(state: FixtureState, count: number) {
  await expect.poll(() => state.writes.length).toBe(count);
}

function expectCommandBinding(
  record: CommandRecord,
  expected: {
    method: string;
    path: string;
    version: number;
    stepUp: boolean;
  }
) {
  expect(record.method).toBe(expected.method);
  expect(record.path).toBe(expected.path);
  expect(record.query).toEqual({ contextScopeKey: MANAGEMENT_SCOPE.key });
  expect(record.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/u);
  expect(record.headers['x-dwp-expected-decision-revision']).toBe(DECISION_REVISION);
  expect(record.headers['x-dwp-expected-object-version']).toBe(String(expected.version));
  if (expected.stepUp) {
    expect(record.headers['x-dwp-step-up-challenge']).toBe('signed-apr-17-24-command');
  } else {
    expect(record.headers['x-dwp-step-up-challenge']).toBeUndefined();
  }
}

function expectIssuerBinding(
  state: FixtureState,
  expected: {
    method: string;
    path: string;
    targetId: string;
    targetType: string;
    version: number;
    payload: unknown;
  }
) {
  expect(state.issuerRequests).toHaveLength(1);
  expect(state.issuerRequests[0]?.body).toEqual({
    commandMethod: expected.method,
    commandPath: expected.path,
    targetType: expected.targetType,
    targetId: expected.targetId,
    expectedObjectVersion: expected.version,
    idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/u),
    payload: expected.payload,
    contextKey: MANAGEMENT_CONTEXT.contextKey,
    contextScopeKey: MANAGEMENT_SCOPE.key,
    returnTo: expect.any(String),
  });
}

async function expectUnavailableControl(page: Page, state: FixtureState, label: string) {
  const button = page.getByRole('button', { name: label, exact: true });
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
  const describedBy = await button.getAttribute('aria-describedby');
  const reason = describedBy
    ? page.locator(`xpath=//*[@id=${JSON.stringify(describedBy)}]`)
    : button.locator('xpath=following-sibling::*[normalize-space()][1]');
  await expect(reason).toBeVisible();
  expect((await reason.textContent())?.trim().length).toBeGreaterThan(0);
  await button.evaluate((element: HTMLButtonElement) => element.click());
  expect(state.writes).toEqual([]);
}

const SURFACES = [
  {
    id: 'APR-17',
    route: '/approvals/admin/forms',
    heading: 'Template library',
    selected: 'Enterprise expense approval template',
    prepare: async (page: Page) =>
      page.getByRole('tab', { name: 'Template library', exact: true }).click(),
  },
  {
    id: 'APR-18',
    route: '/approvals/admin/forms',
    heading: 'Form Studio V3',
    selected: 'Production access extension request',
    prepare: async (page: Page) =>
      page.getByRole('tab', { name: 'Form Studio V3', exact: true }).click(),
  },
  {
    id: 'APR-19',
    route: '/approvals/admin/routing',
    heading: 'Approver routing',
    selected: 'Finance and risk reviewers',
  },
  {
    id: 'APR-20',
    route: '/approvals/admin/policies',
    heading: 'Policy and notification studio',
    selected: 'Alex Delegate',
  },
  {
    id: 'APR-21',
    route: '/approvals/admin/policies',
    heading: 'Policy and notification studio',
    selected: 'High-risk expense SLA',
    prepare: async (page: Page) =>
      page
        .getByRole('tab')
        .filter({ hasText: /^Policies\s*1$/u })
        .click(),
  },
  {
    id: 'APR-22',
    route: '/approvals/admin/operations',
    heading: 'Operations incident recovery',
    selected: 'Approval delivery queue lag',
    prepare: async (page: Page) =>
      page.getByRole('tab', { name: 'Incident recovery', exact: true }).click(),
  },
  {
    id: 'APR-23',
    route: '/approvals/admin/audit',
    heading: 'Audit and records evidence',
    selected: 'REQUEST_APPROVED',
  },
  {
    id: 'APR-24',
    route: '/approvals/admin/deployments',
    heading: 'Approval asset deployment',
    selected: 'Approval finance core',
  },
] as const;

const SUPPLEMENTAL_SURFACES = [
  {
    id: 'integrations',
    route: '/approvals/admin/integrations',
    heading: 'Integration and automation hub',
    selected: 'ERP expense export',
    exercise: async (page: Page) => {
      await page.getByRole('tab', { name: /^Mapping/u }).click();
      await expect(
        page.getByRole('heading', { name: 'Mapping contract', exact: true })
      ).toBeVisible();
      await page.getByRole('tab', { name: /^Health/u }).click();
      await expect(
        page.getByRole('heading', { name: 'Probe evidence', exact: true })
      ).toBeVisible();
    },
  },
  {
    id: 'analytics',
    route: '/approvals/admin/analytics',
    heading: 'Process analytics and insights',
    selected: 'expense-workflow',
    exercise: async (page: Page) => {
      await page.getByRole('button', { name: 'Date range', exact: true }).click();
      await expect(page.getByText('expense-workflow', { exact: true }).first()).toBeVisible();
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
      await expect(page.getByText('Read-only intelligence', { exact: true })).toBeVisible();
    },
  },
] as const;

async function exerciseCanonicalIntent(page: Page, id: (typeof SURFACES)[number]['id']) {
  if (id === 'APR-17') {
    const search = page.getByRole('textbox', { name: 'Search templates', exact: true });
    await search.fill('enterprise expense');
    await expect(
      page.getByRole('heading', { name: 'Enterprise expense approval template', exact: true })
    ).toBeVisible();
    await search.clear();
    return;
  }
  if (id === 'APR-18') {
    await page.getByRole('tab', { name: /^Data & rules/u }).click();
    await expect(
      page.getByRole('heading', { name: 'Data and rules lab', exact: true })
    ).toBeVisible();
    await page.getByRole('tab', { name: /^Validation/u }).click();
    await expect(
      page.getByRole('heading', { name: 'Validation results', exact: true })
    ).toBeVisible();
    return;
  }
  if (id === 'APR-19') {
    await page.getByRole('tab', { name: /^Resolution/u }).click();
    await page
      .getByRole('region', { name: 'Resolution inputs', exact: true })
      .getByRole('button', { name: 'Resolve candidates', exact: true })
      .click();
    await expect(page.getByText('Server evidence updated', { exact: true })).toBeVisible();
    return;
  }
  if (id === 'APR-20') {
    await expect(page.getByRole('button', { name: 'Open delegation governance' })).toBeVisible();
    await expect(page.getByText(/ROLE_SNAPSHOT_NOT_VERIFIED/u)).toBeVisible();
    return;
  }
  if (id === 'APR-21') {
    await page
      .getByRole('tab')
      .filter({ hasText: /^Business calendars\s*1$/u })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Seoul business calendar', exact: true })
    ).toBeVisible();
    await page
      .getByRole('tab')
      .filter({ hasText: /^Notification readiness\s*1$/u })
      .click();
    await expect(page.getByText('approval-email', { exact: true })).toBeVisible();
    return;
  }
  if (id === 'APR-22') {
    await page.getByRole('tab', { name: /^Recovery plan/u }).click();
    await expect(page.getByText('Staged recovery plan', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /^Queues/u }).click();
    await expect(page.getByText('Processing queues', { exact: true })).toBeVisible();
    return;
  }
  if (id === 'APR-23') {
    await page.getByRole('tab', { name: /^Export evidence/u }).click();
    await expect(page.getByRole('heading', { name: 'Export receipt', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /^Retention linkage/u }).click();
    await expect(
      page.getByRole('heading', { name: 'Retention and legal hold linkage', exact: true })
    ).toBeVisible();
    return;
  }
  await page.getByRole('tab', { name: /^Promotion review/u }).click();
  await expect(page.getByRole('heading', { name: 'Promotion plan', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /^Activation evidence/u }).click();
  await expect(
    page.getByRole('heading', { name: 'Server-observed activation', exact: true })
  ).toBeVisible();
  await page.getByRole('tab', { name: /^Rollback assessment/u }).click();
  await expect(page.getByText('Rollback assessment', { exact: true }).first()).toBeVisible();
}

for (const surface of SURFACES) {
  test(`${surface.id} canonical route renders selected server state without serious accessibility or overflow defects`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: testInfo.project.name === 'mobile' ? 390 : 1440,
      height: testInfo.project.name === 'mobile' ? 844 : 1000,
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAdminV2(page);
    await page.goto(surface.route);
    await waitForManagementScopeUrl(page);
    await surface.prepare?.(page);
    await expect(workspaceHeading(page, surface.heading)).toBeVisible();
    await expect(page.getByText(surface.selected, { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expectNoHorizontalOverflow(page);
    await noSeriousAxeViolations(page);
    await resetVerticalViewport(page);
    await expect(page).toHaveScreenshot(`${surface.id.toLowerCase()}-canonical.png`, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
    });
    await exerciseCanonicalIntent(page, surface.id);
    await expectNoHorizontalOverflow(page);
  });
}

for (const surface of SUPPLEMENTAL_SURFACES) {
  test(`supplemental ${surface.id} route is directly verified with responsive visual evidence`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: testInfo.project.name === 'mobile' ? 390 : 1440,
      height: testInfo.project.name === 'mobile' ? 844 : 1000,
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockAdminV2(page);
    await page.goto(surface.route);
    await waitForManagementScopeUrl(page);
    await expect(workspaceHeading(page, surface.heading)).toBeVisible();
    await expect(page.getByText(surface.selected, { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await noSeriousAxeViolations(page);
    await resetVerticalViewport(page);
    await expect(page).toHaveScreenshot(`supplemental-${surface.id}.png`, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
    });
    await surface.exercise(page);
    await expectNoHorizontalOverflow(page);
  });
}

test('new administration navigation exposes every canonical and supplemental workspace', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === 'mobile' ? 390 : 1440,
    height: testInfo.project.name === 'mobile' ? 844 : 1000,
  });
  await mockAdminV2(page);
  await page.goto('/approvals/admin/routing');
  const navigation = await openMobileNavigation(page);
  for (const label of [
    'Forms & templates',
    'Approver routing',
    'Policies & notifications',
    'Integrations & automation',
    'Audit & records',
    'Operations & SLA',
    'Analytics & insights',
    'Deployments',
  ]) {
    await expect(navigation.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(
    navigation.getByRole('link', { name: 'Approver routing', exact: true })
  ).toHaveAttribute('aria-current', 'page');
});

test.describe('backend-public administration command contracts', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    void browserName;
    test.skip(testInfo.project.name !== 'chromium', 'governed commands are desktop-reviewed');
  });

  test('APR-17 compares the installed version and installs the selected template draft with exact fencing', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/forms');
    await page.getByRole('tab', { name: 'Template library', exact: true }).click();

    await page.getByRole('button', { name: 'Compare versions', exact: true }).click();
    await expect
      .poll(() =>
        state.requests.some(
          (request) =>
            request.method === 'GET' &&
            request.path === `/api/approvals/v1/admin/forms/templates/${IDS.template}/comparison` &&
            request.query.installedVersion === '3' &&
            request.query.contextScopeKey === MANAGEMENT_SCOPE.key
        )
      )
      .toBe(true);

    await page.getByRole('button', { name: 'Request governed install', exact: true }).click();
    await expectWriteCount(state, 1);
    const install = state.writes[0]!;
    expectCommandBinding(install, {
      method: 'POST',
      path: `/api/approvals/v1/admin/forms/templates/versions/${IDS.templateVersion}/install`,
      version: 4,
      stepUp: false,
    });
    expect(install.body).toEqual({
      formKey: 'EXPENSE_APPROVAL_ENTERPRISE',
      nameKo: '기업 비용 결재 템플릿',
      nameEn: 'Enterprise expense approval template',
      descriptionKo: '재무 통제와 독립 결재 검토를 포함합니다.',
      descriptionEn: 'Finance controls with independent approval review.',
      ownerGroupRef: 'FINANCE_OPERATIONS',
      categoryKey: 'FINANCE',
      defaultWorkflowKey: 'EXPENSE_APPROVAL',
      expectedTemplateVersion: 4,
    });
  });

  test('APR-18 saves, validates, and reviews the authoritative Form V3 draft with exact payloads', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/forms');
    await page.getByRole('tab', { name: 'Form Studio V3', exact: true }).click();
    const form = await readCanonicalSource<{ current: { schema: unknown } }>(
      page,
      `/api/approvals/v1/admin/forms/studio-v3/${IDS.form}`
    );

    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expectWriteCount(state, 1);
    const save = state.writes[0]!;
    expectCommandBinding(save, {
      method: 'PUT',
      path: `/api/approvals/v1/admin/forms/studio-v3/${IDS.form}/draft`,
      version: 4,
      stepUp: false,
    });
    expect(save.body).toEqual({ expectedWorkspaceVersion: 4, schema: form.current.schema });

    await page.getByRole('button', { name: 'Run validation', exact: true }).click();
    await expectWriteCount(state, 2);
    expect(state.writes[1]).toMatchObject({
      method: 'POST',
      path: '/api/approvals/v1/admin/forms/studio-v3/validate',
      query: { contextScopeKey: MANAGEMENT_SCOPE.key },
      body: { schema: form.current.schema },
    });

    await page.getByRole('button', { name: 'Submit governed review', exact: true }).click();
    await expectWriteCount(state, 3);
    expect(state.writes[2]).toMatchObject({
      method: 'POST',
      path: `/api/approvals/v1/admin/forms/studio-v3/${IDS.form}/review`,
      query: { contextScopeKey: MANAGEMENT_SCOPE.key },
      body: undefined,
    });
  });

  test('APR-19 resolves the selected group then retires it with command-bound step-up evidence', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/routing');
    await page.getByRole('tab', { name: /^Resolution/u }).click();
    await page
      .getByRole('region', { name: 'Resolution inputs', exact: true })
      .getByRole('button', { name: 'Resolve candidates', exact: true })
      .click();
    await expect
      .poll(() =>
        state.requests.some(
          (request) =>
            request.method === 'GET' &&
            request.path ===
              `/api/approvals/v1/admin/workflows/routing-directory/groups/${IDS.group}/resolution` &&
            request.query.contextScopeKey === MANAGEMENT_SCOPE.key
        )
      )
      .toBe(true);

    await page.getByRole('tab', { name: /^Directory/u }).click();
    await completeHighRiskAction(page, 'Retire group');
    await expectWriteCount(state, 1);
    const retire = state.writes[0]!;
    const path = `/api/approvals/v1/admin/workflows/routing-directory/groups/${IDS.group}/retire`;
    const payload = { expectedVersion: 5, acknowledgedImpact: 0 };
    expectCommandBinding(retire, { method: 'POST', path, version: 5, stepUp: true });
    expect(retire.body).toEqual(payload);
    expectIssuerBinding(state, {
      method: 'POST',
      path,
      targetId: IDS.group,
      targetType: 'ROUTING_GROUP',
      version: 5,
      payload,
    });
  });

  test('APR-19 saves a complete routing draft and independently publishes the exact version', async ({
    page,
  }) => {
    const state = await mockAdminV2(page, { routingDraft: true });
    await page.goto('/approvals/admin/routing');
    const source = await readCanonicalSource<{
      effectiveFrom: string;
      effectiveTo: string;
      members: unknown[];
    }>(page, `/api/approvals/v1/admin/workflows/routing-directory/groups/${IDS.group}`);
    await page.getByRole('button', { name: 'Edit group draft', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit routing group draft', exact: true });
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: 'Save group draft', exact: true }).click();
    await expectWriteCount(state, 1);
    const save = state.writes[0]!;
    const groupPath = `/api/approvals/v1/admin/workflows/routing-directory/groups/${IDS.group}`;
    expectCommandBinding(save, { method: 'PUT', path: groupPath, version: 5, stepUp: false });
    expect(save.body).toEqual({
      groupId: IDS.group,
      groupKey: 'FINANCE_RISK_REVIEWERS',
      displayName: 'Finance and risk reviewers',
      description: 'Reusable independent reviewers for financial risk requests.',
      lifecycle: 'DRAFT',
      effectiveFrom: source.effectiveFrom,
      effectiveTo: source.effectiveTo,
      members: source.members,
      expectedVersion: 5,
    });

    await completeHighRiskAction(page, 'Publish group');
    await expectWriteCount(state, 2);
    const publish = state.writes[1]!;
    const publishPath = `${groupPath}/publish`;
    const payload = { expectedVersion: 5 };
    expectCommandBinding(publish, {
      method: 'POST',
      path: publishPath,
      version: 5,
      stepUp: true,
    });
    expect(publish.body).toEqual(payload);
    expectIssuerBinding(state, {
      method: 'POST',
      path: publishPath,
      targetId: IDS.group,
      targetType: 'ROUTING_GROUP',
      version: 5,
      payload,
    });
  });

  test('supplemental connector probe dispatches the current revision and digest exactly once', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/integrations');
    const source = await readCanonicalSource<{ connector: { definitionSha256: string } }>(
      page,
      `/api/approvals/v1/admin/operations/connectors/${IDS.connector}`
    );
    await completeHighRiskAction(page, 'Start probe');
    await expectWriteCount(state, 1);
    const probe = state.writes[0]!;
    const path = `/api/approvals/v1/admin/operations/connectors/${IDS.connector}/probes`;
    expectCommandBinding(probe, { method: 'POST', path, version: 4, stepUp: true });
    expect(probe.body).toEqual({
      probeId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      revisionId: IDS.connectorRevision,
      probeKind: 'READINESS',
      requestSha256: source.connector.definitionSha256,
      expectedConnectorVersion: 4,
    });
    expectIssuerBinding(state, {
      method: 'POST',
      path,
      targetId: IDS.connector,
      targetType: 'CONNECTOR',
      version: 4,
      payload: probe.body,
    });
  });

  test('APR-22 executes only the dry-run-passed recovery stage with exact plan fencing', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/operations');
    await page.getByRole('tab', { name: 'Incident recovery', exact: true }).click();
    await page.getByRole('tab', { name: /^Recovery plan/u }).click();
    await completeHighRiskAction(page, 'Execute next recovery stage');
    await expectWriteCount(state, 1);
    const execute = state.writes[0]!;
    const path = `/api/approvals/v1/admin/operations/incidents/${IDS.incident}/recovery-plans/${IDS.plan}/stages/1/start`;
    expectCommandBinding(execute, { method: 'POST', path, version: 7, stepUp: true });
    expect(execute.body).toEqual({
      stageNumber: 1,
      expectedPlanVersion: 7,
      expectedStageVersion: 2,
      executionKey: expect.stringMatching(/^approval-admin-v2-[0-9a-f-]{36}$/u),
    });
    expectIssuerBinding(state, {
      method: 'POST',
      path,
      targetId: IDS.plan,
      targetType: 'INCIDENT_RECOVERY_PLAN',
      version: 7,
      payload: execute.body,
    });
  });

  test('APR-22 binds the selected second incident to its own detail and recovery command', async ({
    page,
  }) => {
    const state = await mockAdminV2(page, { multipleSelections: true });
    await page.goto('/approvals/admin/operations');
    await page.getByRole('tab', { name: 'Incident recovery', exact: true }).click();
    await page.getByRole('button', { name: /Approval secondary provider lag/u }).click();
    await expect
      .poll(() =>
        state.requests.some(
          (request) =>
            request.path === `/api/approvals/v1/admin/operations/incidents/${IDS.incidentB}`
        )
      )
      .toBe(true);
    await page.getByRole('tab', { name: /^Recovery plan/u }).click();
    await completeHighRiskAction(page, 'Execute next recovery stage');
    await expectWriteCount(state, 1);
    const execute = state.writes[0]!;
    const path = `/api/approvals/v1/admin/operations/incidents/${IDS.incidentB}/recovery-plans/${IDS.planB}/stages/1/start`;
    expectCommandBinding(execute, { method: 'POST', path, version: 9, stepUp: true });
    expect(execute.body).toEqual({
      stageNumber: 1,
      expectedPlanVersion: 9,
      expectedStageVersion: 3,
      executionKey: expect.stringMatching(/^approval-admin-v2-[0-9a-f-]{36}$/u),
    });
    expectIssuerBinding(state, {
      method: 'POST',
      path,
      targetId: IDS.planB,
      targetType: 'INCIDENT_RECOVERY_PLAN',
      version: 9,
      payload: execute.body,
    });
  });

  test('APR-23 exports the selected request evidence with exact bounded metadata filter', async ({
    page,
  }) => {
    const state = await mockAdminV2(page);
    await page.goto('/approvals/admin/audit');
    await page.getByRole('tab', { name: /^Export evidence/u }).click();
    await completeHighRiskAction(page, 'Prepare governed export');
    await expectWriteCount(state, 1);
    const exportCommand = state.writes[0]!;
    const path = '/api/approvals/v1/admin/operations/audit-records/exports';
    expectCommandBinding(exportCommand, { method: 'POST', path, version: 0, stepUp: true });
    expect(exportCommand.body).toEqual({
      exportId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      accessLevel: 'METADATA',
      filter: {
        from: '2026-09-16T03:59:00.000Z',
        to: '2026-09-16T04:01:00.000Z',
        eventTypes: [],
        outcomes: [],
        requestId: IDS.request,
        limit: 100,
      },
    });
    expectIssuerBinding(state, {
      method: 'POST',
      path,
      targetId: (exportCommand.body as { exportId: string }).exportId,
      targetType: 'APPROVAL_AUDIT_EXPORT',
      version: 0,
      payload: exportCommand.body,
    });
  });

  test('APR-23 binds the selected second event to its own evidence and export request', async ({
    page,
  }) => {
    const state = await mockAdminV2(page, { multipleSelections: true });
    await page.goto('/approvals/admin/audit');
    await page.getByRole('button', { name: /REQUEST_REJECTED/u }).click();
    await expect
      .poll(() =>
        state.requests.some(
          (request) =>
            request.path === `/api/approvals/v1/admin/operations/audit-records/events/${IDS.eventB}`
        )
      )
      .toBe(true);
    await page.getByRole('tab', { name: /^Export evidence/u }).click();
    await completeHighRiskAction(page, 'Prepare governed export');
    await expectWriteCount(state, 1);
    const exportCommand = state.writes[0]!;
    const path = '/api/approvals/v1/admin/operations/audit-records/exports';
    expectCommandBinding(exportCommand, { method: 'POST', path, version: 0, stepUp: true });
    expect(exportCommand.body).toEqual({
      exportId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      accessLevel: 'METADATA',
      filter: {
        from: '2026-09-16T03:59:00.000Z',
        to: '2026-09-16T04:01:00.000Z',
        eventTypes: [],
        outcomes: [],
        requestId: IDS.requestB,
        limit: 100,
      },
    });
  });

  test('APR-24 activates only an eligible promotion with an empty command body and exact version proof', async ({
    page,
  }) => {
    const state = await mockAdminV2(page, { activationReady: true });
    await page.goto('/approvals/admin/deployments');
    await page.getByRole('tab', { name: /^Promotion review/u }).click();
    await completeHighRiskAction(page, 'Submit promotion');
    await expectWriteCount(state, 1);
    const activation = state.writes[0]!;
    const path = `/api/approvals/v1/admin/operations/deployments/promotions/${IDS.promotion}/activation`;
    expectCommandBinding(activation, { method: 'POST', path, version: 7, stepUp: true });
    expect(activation.body).toBeUndefined();
    expectIssuerBinding(state, {
      method: 'POST',
      path,
      targetId: IDS.promotion,
      targetType: 'APPROVAL_DEPLOYMENT_PROMOTION',
      version: 7,
      payload: { operation: 'BEGIN_ACTIVATION' },
    });
  });
});

test('mobile command guardrails are disabled with visible reasons and zero posts across every canonical surface', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only command guardrail contract');
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mockAdminV2(page);
  const controls: readonly {
    route: string;
    label: string;
    prepare?: () => Promise<void>;
  }[] = [
    {
      route: '/approvals/admin/forms',
      prepare: () => page.getByRole('tab', { name: 'Template library', exact: true }).click(),
      label: 'Install requires desktop review',
    },
    {
      route: '/approvals/admin/forms',
      prepare: () => page.getByRole('tab', { name: 'Form Studio V3', exact: true }).click(),
      label: 'Publication review only',
    },
    {
      route: '/approvals/admin/routing',
      label: 'Retirement requires desktop review',
    },
    {
      route: '/approvals/admin/policies',
      label: 'Publication requires desktop review',
    },
    {
      route: '/approvals/admin/operations',
      prepare: async () => {
        await page.getByRole('tab', { name: 'Incident recovery', exact: true }).click();
        await page.getByRole('tab', { name: /^Recovery plan/u }).click();
      },
      label: 'Execution requires desktop review',
    },
    {
      route: '/approvals/admin/audit',
      prepare: () => page.getByRole('tab', { name: /^Export evidence/u }).click(),
      label: 'Export requires desktop review',
    },
    {
      route: '/approvals/admin/deployments',
      prepare: () => page.getByRole('tab', { name: /^Promotion review/u }).click(),
      label: 'Promotion requires desktop review',
    },
  ];
  for (const control of controls) {
    await page.goto(control.route);
    await control.prepare?.();
    await expectUnavailableControl(page, state, control.label);
  }
  expect(state.writes).toEqual([]);
});

for (const commandFailure of [
  { status: 409, text: 'Version conflict' },
  {
    status: 503,
    text: 'The network result is unknown. Retry once with the same protected attempt.',
  },
] as const) {
  test(`APR-19 command ${commandFailure.status} dispatches once and never performs an implicit retry`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop command outcome contract');
    const state = await mockAdminV2(page, { commandStatus: commandFailure.status });
    await page.goto('/approvals/admin/routing');
    await completeHighRiskAction(page, 'Retire group');
    await expectWriteCount(state, 1);
    await expect(page.getByText(commandFailure.text, { exact: true })).toBeVisible();
    await page.waitForTimeout(250);
    expect(state.writes).toHaveLength(1);
  });
}

for (const source of [
  { status: 403, title: 'Access denied' },
  { status: 409, title: 'Version conflict' },
  { status: 503, title: 'Source unavailable' },
] as const) {
  test(`routing source ${source.status} is fail-closed with zero command posts`, async ({
    page,
  }) => {
    const state = await mockAdminV2(page, { readStatus: source.status });
    await page.goto('/approvals/admin/routing');
    await expect(page.getByText(source.title, { exact: true })).toBeVisible();
    expect(state.writes).toEqual([]);
  });
}

test('empty and stale source states remain explicit and retain zero command posts', async ({
  page,
}) => {
  const empty = await mockAdminV2(page, { empty: true });
  await page.goto('/approvals/admin/routing');
  await expect(page.getByText('No records', { exact: true })).toBeVisible();
  expect(empty.writes).toEqual([]);

  await page.unrouteAll({ behavior: 'wait' });
  const stale = await mockAdminV2(page);
  await page.goto('/approvals/admin/routing');
  await expect(page.getByText('Finance and risk reviewers', { exact: true }).first()).toBeVisible();
  stale.readStatus = 503;
  await page.getByRole('button', { name: 'Refresh directory', exact: true }).click();
  await expect(page.getByText('Evidence is stale', { exact: true })).toBeVisible();
  expect(stale.writes).toEqual([]);
});

test('320px at 200 percent text keeps all canonical workspaces readable and contained', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'mobile', 'mobile-only reflow contract');
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockAdminV2(page);
  for (const surface of SURFACES) {
    await page.goto(surface.route);
    await surface.prepare?.(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect(workspaceHeading(page, surface.heading)).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalOverflow(page);
    await noSeriousAxeViolations(page);
  }
});

test('dark and forced-colors modes preserve canonical focus and status visibility', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === 'mobile' ? 390 : 1440,
    height: testInfo.project.name === 'mobile' ? 844 : 1000,
  });
  await mockAdminV2(page, { appearanceMode: 'dark' });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/approvals/admin/audit');
  await expect(workspaceHeading(page, 'Audit and records evidence')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await noSeriousAxeViolations(page);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await expect(page.getByText('No inferred immutability claims', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await noSeriousAxeViolations(page, { forcedColors: true });
});
