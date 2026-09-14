import { createHash } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import { APPROVAL_FORM_FIXTURE, APPROVAL_WORKFLOW_FIXTURE } from './support/product-area-fixtures';

import type { ApprovalTypedWorkflowDefinition } from '../apps/dwp/src/features/approvals/approval-workflow-typed-model';

const workflowId = '88888888-8888-4888-8888-888888888888';
const formId = '11111111-1111-4111-8111-111111111111';
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b, 'en'))
        .map(([key, item]) => [key, canonical(item)])
    );
  return value;
}
const hash = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
const definition: ApprovalTypedWorkflowDefinition = {
  schemaContract: 'DWP_APPROVAL_WORKFLOW_QUORUM_V2',
  schemaVersion: 2,
  slaMinutes: 240,
  stages: [
    {
      key: 'FIRST_REVIEW',
      name: 'First review',
      candidateRole: 'APPROVAL_OPERATOR',
      quorum: { mode: 'ANY' },
      slaMinutes: 15,
      predecessors: [],
    },
    {
      key: 'SECURITY_REVIEW',
      name: 'Security review',
      candidateRole: 'SECURITY_APPROVER',
      quorum: { mode: 'COUNT', value: 2 },
      slaMinutes: 30,
      predecessors: ['FIRST_REVIEW'],
    },
    {
      key: 'FINANCE_REVIEW',
      name: 'Finance review',
      candidateRole: 'FINANCE_APPROVER',
      quorum: { mode: 'ALL' },
      slaMinutes: 30,
      predecessors: ['FIRST_REVIEW'],
    },
    {
      key: 'FINAL_REVIEW',
      name: 'Final review',
      candidateRole: 'APPROVAL_OPERATOR',
      quorum: { mode: 'PERCENT', value: 50 },
      slaMinutes: 15,
      predecessors: ['SECURITY_REVIEW', 'FINANCE_REVIEW'],
    },
  ],
};
const workflow = {
  ...APPROVAL_WORKFLOW_FIXTURE,
  workflowId,
  category: 'GENERAL',
  workflowKey: 'REVIEW_GRAPH',
  nameKo: 'Review graph',
  nameEn: 'Review graph',
  ownerGroupRef: 'APPROVAL_OPERATOR',
  lifecycleState: 'DRAFT',
  slaMinutes: 240,
};
const schema = {
  schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
  schemaVersion: 2,
  fields: [
    { key: 'summary', type: 'TEXTAREA', required: true, labelKo: 'Summary', labelEn: 'Summary' },
    { key: 'amount', type: 'NUMBER', required: true, labelKo: 'Amount', labelEn: 'Amount' },
  ],
};
function formDetail() {
  return {
    form: {
      ...APPROVAL_FORM_FIXTURE,
      formId,
      nameKo: 'Validation form',
      nameEn: 'Validation form',
    },
    formVersionId: '22222222-2222-4222-8222-222222222222',
    schema,
    schemaHash: hash(schema),
    routes: [],
  };
}
function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}
async function session(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_DESIGNER'], {
    locale: 'ko',
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      ...['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.APPROVAL_DESIGN',
        permissionCode,
        effect: 'ALLOW' as const,
      })),
    ],
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  await page.emulateMedia({ reducedMotion: 'reduce' });
}
async function fixture(page: Page, initial: ApprovalTypedWorkflowDefinition = definition) {
  let owner = { workflow, definition: initial, definitionHash: hash(initial) };
  let form = formDetail();
  let formFailure = 0;
  const writes: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/workflows',
    (route) => {
      if (route.request().method() === 'GET') return success(route, [owner.workflow]);
      const body: Record<string, unknown> = route.request().postDataJSON();
      writes.push({ method: 'POST', path: route.request().url(), body });
      return success(route, owner);
    }
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/admin/workflows/${workflowId}`,
    (route) => success(route, owner)
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/admin/workflows/${workflowId}/draft`,
    (route) => {
      const body: Record<string, unknown> = route.request().postDataJSON();
      writes.push({ method: 'PUT', path: route.request().url(), body });
      return success(route, owner);
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/forms',
    (route) => success(route, [form.form])
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/admin/forms/${formId}`,
    (route) =>
      formFailure
        ? route.fulfill({
            status: formFailure,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'ERROR',
              errorCode: 'TEMPORARY_UNAVAILABLE',
              message: 'Form source unavailable',
            }),
          })
        : success(route, form)
  );
  return {
    writes,
    setFormFailure: (status: number) => {
      formFailure = status;
    },
    changeForm: () => {
      form = {
        ...form,
        form: {
          ...form.form,
          version: form.form.version + 1,
          currentVersion: form.form.currentVersion + 1,
        },
        formVersionId: '33333333-3333-4333-8333-333333333333',
      };
    },
    changeOwner: () => {
      const next = {
        ...owner.definition,
        stages: owner.definition.stages.map((stage) => ({
          ...stage,
          name: `${stage.name} latest`,
        })),
      };
      owner = { ...owner, definition: next, definitionHash: hash(next) };
    },
  };
}
const editor = (page: Page) =>
  page.getByRole('region', { name: '프로세스 초안 편집', exact: true });
async function inspect(page: Page, isMobile: boolean, key = 'SECURITY_REVIEW') {
  const pane = editor(page);
  if (isMobile) await pane.getByRole('button', { name: '결재 경로', exact: true }).click();
  await pane.locator(`[data-approval-typed-stage="${key}"]`).click();
  return pane;
}
async function selectForm(page: Page) {
  const pane = editor(page);
  await pane.getByLabel('검증 양식', { exact: true }).click();
  await page.getByRole('option', { name: /Validation form/ }).click();
  await expect(pane.getByRole('button', { name: '조건 추가', exact: true })).toBeEnabled();
}

test('typed DAG editor preserves parallel edges, exact quorum and exclusive owner payload', async ({
  page,
  isMobile,
}) => {
  await session(page);
  const state = await fixture(page);
  await page.goto('/approvals/admin/workflows');
  await expect(page.getByRole('button', { name: '단계 그래프', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.getByRole('button', { name: '초안 편집', exact: true }).click();
  const pane = await inspect(page, isMobile);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(pane.getByLabel('필요 인원 또는 비율')).toHaveValue('2');
  await pane.getByLabel('정족수 방식', { exact: true }).click();
  await page.getByRole('option', { name: '전원 승인', exact: true }).click();
  await expect(pane.getByLabel('필요 인원 또는 비율')).toHaveCount(0);
  await expect(pane.getByRole('checkbox', { name: 'First review · FIRST_REVIEW' })).toBeChecked();
  await expect(pane.getByRole('checkbox', { name: 'Final review · FINAL_REVIEW' })).toBeDisabled();
  await pane.getByLabel('단계 이름').fill('Preserved security review');
  await expect(pane.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath('typed-workflow-inspector.png'),
    fullPage: true,
  });
  if (isMobile) {
    await pane.getByRole('button', { name: '결재선으로 돌아가기' }).click();
    await expect(pane.locator('[data-approval-typed-stage="SECURITY_REVIEW"]')).toBeFocused();
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ).toBeLessThanOrEqual(1);
    const finalTitle = pane.locator(
      '[data-approval-typed-stage="FINAL_REVIEW"] [data-approval-typed-stage-title]'
    );
    expect((await finalTitle.boundingBox())?.width).toBeGreaterThanOrEqual(100);
    await page.screenshot({
      path: test.info().outputPath('typed-workflow-320-text200.png'),
      fullPage: true,
    });
  }
  await pane.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  const body = state.writes[0].body;
  expect(body).toMatchObject({
    expectedVersion: workflow.version,
    slaMinutes: 240,
    typedDefinition: {
      schemaContract: definition.schemaContract,
      stages: expect.arrayContaining([
        expect.objectContaining({
          key: 'SECURITY_REVIEW',
          name: 'Preserved security review',
          quorum: { mode: 'ALL' },
          predecessors: ['FIRST_REVIEW'],
        }),
        expect.objectContaining({
          key: 'FINAL_REVIEW',
          quorum: { mode: 'PERCENT', value: 50 },
          predecessors: ['SECURITY_REVIEW', 'FINANCE_REVIEW'],
        }),
      ]),
    },
  });
  expect(Object.hasOwn(body, 'steps')).toBe(false);
});

test('actual published form conditions keep decimal strings and all clauses', async ({
  page,
  isMobile,
}) => {
  await session(page);
  const state = await fixture(page);
  await page.goto('/approvals/admin/workflows');
  await page.getByRole('button', { name: '초안 편집', exact: true }).click();
  const pane = await inspect(page, isMobile);
  await selectForm(page);
  await pane.getByRole('button', { name: '조건 추가', exact: true }).click();
  await pane.getByLabel('양식 필드').click();
  await page.getByRole('option', { name: 'Amount · amount' }).click();
  await pane.getByLabel('비교 연산').click();
  await page.getByRole('option', { name: '이상', exact: true }).click();
  await pane.getByLabel('비교 값').fill('1234567890123456789012345678');
  await expect(pane.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  await pane.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].body).toMatchObject({
    typedDefinition: {
      stages: expect.arrayContaining([
        expect.objectContaining({
          key: 'SECURITY_REVIEW',
          routeCondition: {
            all: [{ field: 'amount', operator: 'GTE', value: '1234567890123456789012345678' }],
          },
        }),
      ]),
    },
  });
  expect(Object.hasOwn(state.writes[0].body, 'steps')).toBe(false);
});

for (const change of ['503', '403', 'VERSION'] as const) {
  test(`fresh form ${change} fences conditional write and preserves inputs until explicit recovery`, async ({
    page,
    isMobile,
  }) => {
    await session(page);
    const state = await fixture(page);
    await page.goto('/approvals/admin/workflows');
    await page.getByRole('button', { name: '초안 편집', exact: true }).click();
    const pane = await inspect(page, isMobile);
    await selectForm(page);
    await pane.getByRole('button', { name: '조건 추가', exact: true }).click();
    await pane.getByLabel('비교 값').fill('Preserved condition input');
    await pane.getByLabel('단계 이름').fill('Preserved stage input');
    if (change === 'VERSION') state.changeForm();
    else state.setFormFailure(Number(change));
    await pane.getByRole('button', { name: '저장', exact: true }).click();
    await expect(
      pane.getByText(
        change === 'VERSION'
          ? '양식 버전 또는 스키마가 변경되었습니다. 최신 원본 확인 후 저장하세요.'
          : '게시 양식 원본을 확인하지 못했습니다.'
      )
    ).toBeVisible();
    await expect(pane.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
    expect(state.writes).toHaveLength(0);
    await expect(pane.getByLabel('단계 이름')).toHaveValue('Preserved stage input');
    await expect(pane.getByLabel('비교 값')).toHaveValue('Preserved condition input');
    state.setFormFailure(0);
    await pane.getByRole('button', { name: '최신 양식 확인', exact: true }).click();
    await expect(pane.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
    await pane.getByRole('button', { name: '저장', exact: true }).click();
    await expect.poll(() => state.writes.length).toBe(1);
  });
}

test('same-version owner hash change fences typed draft save without losing its stage', async ({
  page,
  isMobile,
}) => {
  await session(page);
  const state = await fixture(page);
  await page.goto('/approvals/admin/workflows');
  await page.getByRole('button', { name: '초안 편집', exact: true }).click();
  const pane = await inspect(page, isMobile);
  await pane.getByLabel('단계 이름').fill('Preserved owner edit');
  state.changeOwner();
  await pane.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(pane.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await expect(pane.getByLabel('단계 이름')).toHaveValue('Preserved owner edit');
  expect(state.writes).toHaveLength(0);
});

test('stage copy uses a fresh key, retains graph references and never downgrades its quorum', async ({
  page,
  isMobile,
}) => {
  await session(page);
  const state = await fixture(page);
  await page.goto('/approvals/admin/workflows');
  await page.getByRole('button', { name: '초안 편집', exact: true }).click();
  const pane = await inspect(page, isMobile);
  if (isMobile) await pane.getByRole('button', { name: '결재 경로', exact: true }).click();
  await pane.getByRole('button', { name: '단계 복제', exact: true }).click();
  await expect(pane.getByLabel('단계 키')).toHaveValue('SECURITY_REVIEW_COPY_1');
  await expect(pane.getByLabel('필요 인원 또는 비율')).toHaveValue('2');
  await pane.getByLabel('단계 이름').fill('Copied security review');
  await pane.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].body).toMatchObject({
    typedDefinition: {
      stages: expect.arrayContaining([
        expect.objectContaining({
          key: 'SECURITY_REVIEW_COPY_1',
          name: 'Copied security review',
          quorum: { mode: 'COUNT', value: 2 },
          predecessors: ['FIRST_REVIEW'],
        }),
        expect.objectContaining({
          key: 'FINAL_REVIEW',
          predecessors: ['SECURITY_REVIEW', 'FINANCE_REVIEW'],
        }),
      ]),
    },
  });
  expect(Object.hasOwn(state.writes[0].body, 'steps')).toBe(false);
});

test('new typed draft requires explicit role and metadata and preserves unsaved mode inputs', async ({
  page,
  isMobile,
}) => {
  await session(page);
  const state = await fixture(page);
  await page.goto('/approvals/admin/workflows');
  if (isMobile) await page.getByRole('button', { name: '결재 프로세스', exact: true }).click();
  await page.getByRole('button', { name: '새 프로세스 초안', exact: true }).click();
  await page.getByRole('button', { name: '단계 그래프', exact: true }).click();
  const pane = page.getByRole('region', { name: '새 프로세스 초안', exact: true });
  if (isMobile) await pane.getByRole('button', { name: '프로세스·단계 상세', exact: true }).click();
  await expect(pane.getByLabel('결재 후보 역할')).toHaveValue('');
  await expect(pane.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await pane.getByLabel('프로세스 키', { exact: true }).fill('NEW_REVIEW_GRAPH');
  for (const [label, value] of [
    ['한국어 이름', 'New graph'],
    ['영어 이름', 'New graph'],
    ['한국어 설명', 'New graph review'],
    ['영어 설명', 'New graph review'],
  ] as const)
    await pane.getByLabel(label, { exact: true }).fill(value);
  await pane.getByLabel('담당 승인 역할', { exact: true }).fill('APPROVAL_OPERATOR');
  await pane.getByLabel('단계 이름').fill('Initial review');
  await pane.getByLabel('결재 후보 역할').fill('APPROVAL_OPERATOR');
  await expect(pane.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '순차 경로', exact: true }).click();
  await page.getByRole('button', { name: '단계 그래프', exact: true }).click();
  if (isMobile) await pane.getByRole('button', { name: '프로세스·단계 상세', exact: true }).click();
  await expect(pane.getByLabel('프로세스 키', { exact: true })).toHaveValue('NEW_REVIEW_GRAPH');
  await expect(pane.getByLabel('단계 이름')).toHaveValue('Initial review');
  await pane.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].method).toBe('POST');
  expect(state.writes[0].body).toMatchObject({
    workflowKey: 'NEW_REVIEW_GRAPH',
    typedDefinition: {
      stages: [
        {
          key: 'REVIEW_1',
          name: 'Initial review',
          candidateRole: 'APPROVAL_OPERATOR',
          quorum: { mode: 'ANY' },
          slaMinutes: 15,
          predecessors: [],
        },
      ],
    },
  });
  expect(Object.hasOwn(state.writes[0].body, 'steps')).toBe(false);
});
