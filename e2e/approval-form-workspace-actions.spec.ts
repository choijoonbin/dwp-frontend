import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { mockApprovalHighRiskNetwork } from './support/approval-high-risk';
import { PRODUCT_AUTHORIZATION_REGISTRY_REVISION } from '../apps/dwp/src/routes/product-surface-authorization.generated';
import {
  workspaceFixture,
  reviewFixture,
  diffFixture,
  formId,
  publishedId,
  draftId,
} from '../apps/dwp/src/features/approvals/approval-form-workspace.test-support';
import type {
  ApprovalForm,
  ApprovalFormDetail,
  ApprovalFormCategory,
  ApprovalWorkflow,
} from '../libs/shared-utils/src/api/approval-management-contract';
import type {
  ApprovalFormWorkspace,
  ApprovalFormWorkingDraftInput,
} from '../libs/shared-utils/src/api/approval-form-workspace-contract';

const base = `/api/approvals/v1/admin/forms/${formId}`;
const workflowId = '44444444-4444-4444-8444-444444444444';
const branchId = '55555555-5555-4555-8555-555555555555';
const success = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', data }),
  });
const category: ApprovalFormCategory = {
  categoryId: formId,
  categoryKey: 'REQUEST',
  nameKo: '요청',
  nameEn: 'Requests',
  descriptionKo: '요청 양식',
  descriptionEn: 'Request forms',
  iconKey: 'file',
  sortOrder: 0,
  lifecycleState: 'ACTIVE',
  formCount: 1,
  version: 1,
};
const workflow: ApprovalWorkflow = {
  workflowId,
  workflowKey: 'FINANCE',
  nameKo: '재무 검토',
  nameEn: 'Finance review',
  descriptionKo: '재무 검토',
  descriptionEn: 'Finance review',
  category: 'FINANCE',
  dataClassification: 'INTERNAL',
  lifecycleState: 'PUBLISHED',
  currentVersion: 1,
  slaMinutes: 60,
  allowSelfApproval: false,
  ownerGroupRef: 'FINANCE',
  version: 1,
  updatedAt: '2026-09-14T00:00:00Z',
};
function catalog(workspace: ApprovalFormWorkspace): ApprovalForm {
  return {
    formId,
    formKey: 'REQUEST',
    categoryId: formId,
    categoryKey: 'REQUEST',
    categoryNameKo: '요청',
    categoryNameEn: 'Requests',
    nameKo: '검토 요청서',
    nameEn: 'Review request',
    descriptionKo: '재무 검토 요청',
    descriptionEn: 'Finance review request',
    ownerGroupRef: 'FINANCE',
    formKind: 'REQUEST',
    lifecycleState: workspace.catalogAvailability === 'RETIRED' ? 'RETIRED' : 'PUBLISHED',
    currentVersion: workspace.published!.versionNumber,
    fieldCount: 1,
    routeCount: 1,
    usageCount: 0,
    version: workspace.formRevision,
    updatedAt: '2026-09-14T00:00:00Z',
  };
}
function detail(workspace: ApprovalFormWorkspace): ApprovalFormDetail {
  return {
    form: catalog(workspace),
    schema: workspace.published!.schema,
    schemaHash: workspace.published!.schemaSha256,
    formVersionId: workspace.published!.formVersionId,
    routes: [
      {
        bindingId: '66666666-6666-4666-8666-666666666666',
        workflowId,
        workflowKey: 'FINANCE',
        workflowNameKo: workflow.nameKo,
        workflowNameEn: workflow.nameEn,
        workflowLifecycleState: 'PUBLISHED',
        workflowVersion: 1,
        slaMinutes: 60,
        bindingType: 'DEFAULT',
        priority: 0,
      },
    ],
  };
}
async function setup(page: Page) {
  // Actual generated V9, real UI controllers/adapters. Auth and owner responses
  // below remain explicit fixtures, not persistent runtime authority evidence.
  expect(PRODUCT_AUTHORIZATION_REGISTRY_REVISION.version).toBe(9);
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    decisionRevisionFormat: 'sha256',
  });
  const state = {
    workspace: workspaceFixture(),
    historyPartial: false,
    diffComplete: true,
    checker: true,
    status: 0,
    versions: [workspaceFixture().workingDraft!, workspaceFixture().published!],
    writes: [] as Array<{
      path: string;
      method: string;
      body: unknown;
      headers: Record<string, string>;
    }>,
  };
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/form-categories',
    (route) => success(route, [category])
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/workflows',
    (route) => success(route, [workflow])
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/forms',
    (route) => success(route, [catalog(state.workspace)])
  );
  await page.route(
    (url) => url.pathname.startsWith(base),
    (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET') {
        if (path === base) return success(route, detail(state.workspace));
        if (state.status)
          return route.fulfill({
            status: state.status,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'ERROR',
              errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
            }),
          });
        if (path === `${base}/working-draft`) return success(route, state.workspace);
        if (path === `${base}/versions`)
          return success(route, { versions: state.versions, mayBeTruncated: state.historyPartial });
        if (path.includes('/versions/'))
          return success(
            route,
            state.versions.find((item) => item.formVersionId === path.split('/').at(-1))
          );
        if (path.endsWith('/diff')) {
          const query = new URL(request.url()).searchParams;
          const from = state.versions.find(
            (item) => item.formVersionId === query.get('fromVersionId')
          )!;
          const to = state.versions.find(
            (item) => item.formVersionId === query.get('toVersionId')
          )!;
          return success(route, {
            ...diffFixture(),
            fromVersionId: from.formVersionId,
            toVersionId: to.formVersionId,
            fromSchemaSha256: from.schemaSha256,
            toSchemaSha256: to.schemaSha256,
            complete: state.diffComplete,
            fromMetadataProvenance: from.metadataProvenance,
            toMetadataProvenance: to.metadataProvenance,
          });
        }
        if (path.endsWith('/publish-review'))
          return success(route, {
            ...reviewFixture(),
            formRevision: state.workspace.formRevision,
            workspaceRevision: state.workspace.workspaceRevision,
            draftFormVersionId: state.workspace.workingDraft!.formVersionId,
            schemaSha256: state.workspace.workingDraft!.schemaSha256,
            independentCheckerEligible: state.checker,
          });
        return route.fulfill({ status: 404, body: '{}' });
      }
      state.writes.push({
        path,
        method: request.method(),
        body: request.postDataJSON(),
        headers: request.headers(),
      });
      const next = {
        ...state.workspace,
        formRevision: state.workspace.formRevision + 1,
        workspaceRevision: state.workspace.workspaceRevision! + 1,
      };
      if (path.endsWith('/working-draft')) {
        const input = request.postDataJSON() as ApprovalFormWorkingDraftInput;
        next.workingDraft = {
          ...next.workingDraft!,
          schema: input.schema,
          metadata: { ...input.metadata },
          route: { workflowId: input.defaultWorkflowId },
          materialDigest: 'e'.repeat(64),
        };
        state.versions = [
          next.workingDraft,
          ...state.versions.filter(
            (item) => item.formVersionId !== next.workingDraft!.formVersionId
          ),
        ];
      }
      if (path.endsWith('/branch')) {
        const source = state.versions.find(
          (item) => item.formVersionId === path.split('/').at(-2)
        )!;
        next.workingDraft = {
          ...source,
          formVersionId: branchId,
          versionNumber: 3,
          lifecycleState: 'DRAFT',
          sourceVersionId: source.formVersionId,
          basePublishedVersionId: publishedId,
          publishedAt: null,
          publishedBy: null,
        };
        state.versions = [next.workingDraft, ...state.versions];
      }
      if (path.endsWith('/retire')) {
        next.catalogAvailability = 'RETIRED';
        next.catalogPolicyEligible = false;
      }
      if (path.endsWith('/reinstate')) {
        next.catalogAvailability = 'ACTIVE';
        next.catalogPolicyEligible = true;
      }
      state.workspace = next;
      return success(route, next);
    }
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/approvals/admin/forms');
  await expect(page.getByRole('heading', { name: '양식 카탈로그', level: 1 })).toBeVisible();
  return { state, authority };
}
async function workspacePanel(page: Page, mobile: boolean) {
  if (mobile) await page.getByRole('button').filter({ hasText: '검토 요청서' }).click();
  const panel = page.getByRole('region', { name: '양식 버전 작업 공간' });
  await expect(panel.getByRole('button', { name: '작업 초안 편집', exact: true })).toBeEnabled();
  return panel;
}

test('정본9 UI fixture Forms4: 작업 초안 저장·분기·사용 중지·재개는 각각 원본 CAS와 실제 신규 경로에 결속된다', async ({
  page,
  isMobile,
}) => {
  const { state, authority } = await setup(page);
  const panel = await workspacePanel(page, isMobile);
  await panel.getByRole('button', { name: '작업 초안 편집', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor
    .getByRole('textbox', { name: '영어 이름', exact: false })
    .fill('Edited working request');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByText('작업 초안을 저장했습니다.', { exact: true })).toBeVisible();
  expect(state.writes[0]).toMatchObject({
    path: `${base}/working-draft`,
    method: 'PUT',
    body: {
      expectedFormRevision: 4,
      expectedWorkspaceRevision: 2,
      draftFormVersionId: draftId,
      metadata: { nameEn: 'Edited working request' },
    },
  });
  await expect(
    panel.getByText('초안 편집 중에도 발행본은 계속 사용됩니다.', { exact: true })
  ).toBeVisible();
  await panel.locator('ul').first().getByText('v2', { exact: true }).click();
  const branch = panel.getByRole('button', { name: '작업 초안 만들기', exact: true });
  await expect(branch).toBeEnabled();
  await branch.click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '작업 초안 만들기', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.writes[1]).toMatchObject({
    path: `${base}/versions/${draftId}/branch`,
    method: 'POST',
    body: { expectedFormRevision: 5, expectedWorkspaceRevision: 3 },
  });
  await panel.getByRole('button', { name: '카탈로그에서 사용 중지', exact: true }).click();
  await expect(
    page.getByText('카탈로그 사용 중지는 신규 상신을 차단합니다.', { exact: false })
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '카탈로그에서 사용 중지', exact: true })
    .click();
  await expect.poll(() => state.writes.map((item) => item.path)).toContain(`${base}/retire`);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.writes[2]).toMatchObject({
    path: `${base}/retire`,
    method: 'POST',
    body: { expectedFormRevision: 6, expectedWorkspaceRevision: 4 },
  });
  await expect(
    panel.getByRole('button', { name: '카탈로그 사용 재개', exact: true })
  ).toBeEnabled();
  await panel.getByRole('button', { name: '카탈로그 사용 재개', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '카탈로그 사용 재개', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.writes[3]).toMatchObject({
    path: `${base}/reinstate`,
    method: 'POST',
    body: { expectedFormRevision: 7, expectedWorkspaceRevision: 5 },
  });
  expect(state.writes).toHaveLength(4);
  for (const command of state.writes) {
    expect(command.headers['idempotency-key']).toBeTruthy();
    expect(command.headers['x-dwp-expected-decision-revision']).toBe(authority.revision());
    expect(command.headers['x-dwp-step-up-challenge']).toBeUndefined();
  }
});

test('정본9 UI fixture Forms5 HIGH: 해시 검토 후 독립 본인 확인을 거쳐 publish-reviewed만 명시적으로 실행한다', async ({
  page,
  isMobile,
}) => {
  const { state, authority } = await setup(page);
  const panel = await workspacePanel(page, isMobile);
  const final: ApprovalFormWorkspace = {
    ...state.workspace,
    formRevision: 5,
    workspaceRevision: 3,
    workingDraft: null,
    published: {
      ...state.workspace.workingDraft!,
      lifecycleState: 'PUBLISHED',
      publishedAt: '2026-09-14T00:00:00Z',
      publishedBy: 1,
      metadataProvenance: 'PUBLISH_SNAPSHOT',
    },
  };
  const network = await mockApprovalHighRiskNetwork(page, {
    commandPath: `${base}/publish-reviewed`,
    commandResult: final,
    issuerContinuation: false,
    decisionRevision: authority.revision(),
  });
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === `${base}/publish-reviewed`) state.workspace = final;
  });
  await panel.getByRole('button', { name: '발행 검토', exact: true }).click();
  const review = page.getByRole('dialog', { name: '발행 검토', exact: true });
  await expect(review.getByText('b'.repeat(64), { exact: true })).toBeVisible();
  await expect(review.getByRole('button', { name: '게시', exact: true })).toBeEnabled();
  await review.getByRole('button', { name: '게시', exact: true }).click();
  const high = page.getByRole('dialog', { name: '고위험 작업 본인 확인', exact: true });
  await expect(high).toBeVisible();
  expect(network.commandRequests).toEqual([]);
  await high.getByRole('button', { name: '본인 확인', exact: true }).click();
  await expect(high.getByRole('button', { name: '작업 확인', exact: true })).toBeEnabled();
  expect(network.commandRequests).toEqual([]);
  await high.getByRole('button', { name: '작업 확인', exact: true }).click();
  await expect(high).toHaveCount(0);
  expect(network.commandRequests).toHaveLength(1);
  expect(network.issuerRequests[0]!.body).toMatchObject({
    commandMethod: 'POST',
    commandPath: `${base}/publish-reviewed`,
    targetType: 'FORM',
    targetId: formId,
    expectedObjectVersion: 4,
  });
  expect(network.commandRequests[0]!.body).toEqual({
    expectedFormRevision: 4,
    expectedWorkspaceRevision: 2,
    draftFormVersionId: draftId,
    basePublishedVersionId: publishedId,
    schemaSha256: 'b'.repeat(64),
    reviewContentDigest: 'd'.repeat(64),
  });
  expect(network.commandRequests[0]!.headers['x-dwp-expected-object-version']).toBe('4');
  expect(network.commandRequests[0]!.headers['x-dwp-step-up-challenge']).toBeTruthy();
  expect(network.commandRequests[0]!.headers['x-dwp-expected-decision-revision']).toBe(
    authority.revision()
  );
});

for (const issue of ['maker', 'partial history', 'partial diff'] as const)
  test(`정본9 UI fixture 발행 검토 ${issue}: 신규 게시 명령0`, async ({ page, isMobile }) => {
    const { state } = await setup(page);
    const panel = await workspacePanel(page, isMobile);
    if (issue === 'maker') state.checker = false;
    if (issue === 'partial history') state.historyPartial = true;
    if (issue === 'partial diff') state.diffComplete = false;
    await panel.getByRole('button', { name: '작업 공간 새로고침', exact: true }).first().click();
    await expect(panel.getByRole('button', { name: '발행 검토', exact: true })).toBeEnabled();
    await panel.getByRole('button', { name: '발행 검토', exact: true }).click();
    const review = page.getByRole('dialog', { name: '발행 검토', exact: true });
    await expect(review.getByRole('button', { name: '게시', exact: true })).toBeDisabled();
    expect(state.writes).toEqual([]);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
