import { expect, test, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_POLICIES_FIXTURE } from './support/product-area-approval-fixtures';
import {
  policyImpactFixture,
  policyImpactId,
} from '../libs/shared-utils/src/test-utils/approval-policy-impact-fixtures';

const initial = {
  ...APPROVAL_POLICIES_FIXTURE[0],
  policyId: policyImpactId,
  policyKey: 'BLOCK_SELF_APPROVAL',
  rule: { requesterCannotDecide: true },
  version: 2,
  pendingReview: true,
  pendingSeverity: 'CRITICAL',
  pendingEnforcementMode: 'BLOCK',
  pendingLifecycleState: 'ACTIVE',
  pendingRule: { requesterCannotDecide: true },
  pendingBy: 31,
  pendingAt: '2026-09-14T00:00:00Z',
};
const success = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', data }),
  });
async function setup(page: Page, status = 'COMPLETE') {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    decisionRevisionFormat: 'sha256',
    generatedAt: new Date().toISOString(),
    revalidateAt: new Date(Date.now() + 600000).toISOString(),
  });
  const state = {
    policy: { ...initial },
    status,
    failure: 0,
    reads: 0,
    writes: 0,
    wait: null as Promise<void> | null,
    requests: [] as Array<{ url: string; headers: Record<string, string> }>,
  };
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/policies',
    (route) => {
      state.reads++;
      return success(route, [state.policy]);
    }
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/admin/policies/${policyImpactId}/versions`,
    (route) => success(route, [])
  );
  await page.route(
    (url) =>
      url.pathname.startsWith(`/api/approvals/v1/admin/policies/${policyImpactId}/`) &&
      !url.pathname.endsWith('/versions'),
    async (route) => {
      if (route.request().method() !== 'GET') {
        state.writes++;
        return success(route, []);
      }
      state.requests.push({ url: route.request().url(), headers: route.request().headers() });
      if (state.wait) await state.wait;
      if (state.failure)
        return route.fulfill({
          status: state.failure,
          contentType: 'application/json',
          body: JSON.stringify({ errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' }),
        });
      const result = policyImpactFixture();
      result.status = state.status;
      result.authority.actorId = 1;
      result.authority.contextKey = 'ctx:approvals:admin';
      result.authority.contextScopeKey = 'scope:approvals:tenant';
      result.authority.resourceSetKey = 'RS_APPROVALS';
      result.authority.decisionRevision = authority.revision();
      for (const grant of Object.values(result.authority.grants))
        grant.resourceSetKey = 'RS_APPROVALS';
      if (state.status === 'PARTIAL') {
        result.tasks.counts = {
          examined: 1,
          constraintChanged: 0,
          pinConflict: 0,
          configurationOnly: 0,
          unknown: 1,
          complete: false,
          countKind: 'OBSERVED_LOWER_BOUND',
        };
        result.tasks.items = [
          {
            id: '22222222-2222-4222-8222-222222222222',
            version: 0,
            effect: {
              reasons: ['RUNTIME_SOURCE_OR_EVALUATION_BUDGET_UNAVAILABLE'],
              constraintChanged: false,
              pinConflict: false,
              configurationOnly: false,
              unknown: true,
            },
          },
        ];
      }
      if (state.status === 'NO_PROPOSAL')
        return success(route, {
          ...result,
          policy: { ...result.policy, pending: null },
          semanticDiff: [],
        });
      return success(route, result);
    }
  );
  await page.goto('/approvals/admin/policies');
  const panel = page.getByRole('region', { name: '정책 변경 영향 분석', exact: true });
  await expect(panel.getByRole('button', { name: '영향 분석', exact: true })).toBeEnabled();
  return { state, panel, authority };
}

test('실제 계약과 동일한 GET으로 저장된 변경안의 영향과 기준 시각을 표시한다', async ({
  page,
}, testInfo) => {
  const { state, panel } = await setup(page);
  await panel.getByRole('button', { name: '영향 분석', exact: true }).click();
  await expect(panel.getByText(/조회된 항목은 기준 시각에 모두 평가/u)).toBeVisible();
  await expect(panel.getByRole('region', { name: '결재 프로세스', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: '현재 정책과 저장된 변경안' })).toBeVisible();
  expect(state.requests).toHaveLength(1);
  const request = state.requests[0];
  expect(new URL(request.url).searchParams.get('expectedVersion')).toBe('2');
  expect(new URL(request.url).searchParams.get('contextScopeKey')).toBe('scope:approvals:tenant');
  for (const header of [
    'idempotency-key',
    'x-dwp-step-up-challenge',
    'x-dwp-expected-object-version',
  ])
    expect(request.headers[header]).toBeUndefined();
  expect(state.writes).toBe(0);
  const screenshot = testInfo.outputPath('policy-impact.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('policy-impact', { path: screenshot, contentType: 'image/png' });
  const accessibility = await new AxeBuilder({ page })
    .include('section[aria-label="정책 변경 영향 분석"]')
    .analyze();
  expect(
    accessibility.violations.filter((issue) => ['critical', 'serious'].includes(issue.impact ?? ''))
  ).toEqual([]);
});

for (const failure of [403, 409, 503]) {
  test(`첫 ${failure} 실패 즉시 이전 분석을 숨기고 자동 재시도하지 않는다`, async ({ page }) => {
    const { state, panel } = await setup(page);
    await panel.getByRole('button', { name: '영향 분석', exact: true }).click();
    await expect(panel.getByText(/조회된 항목은 기준 시각에 모두 평가/u)).toBeVisible();
    state.failure = failure;
    await panel.getByRole('button', { name: '분석 새로고침', exact: true }).click();
    await expect(panel.getByText('정책 영향을 확인하지 못했습니다', { exact: true })).toBeVisible();
    await expect(panel.getByRole('heading', { name: '현재 정책과 저장된 변경안' })).toHaveCount(0);
    expect(state.requests).toHaveLength(2);
    expect(state.writes).toBe(0);
  });
}

test('평가 미완료 결과를 전체 통과로 표현하지 않는다', async ({ page }) => {
  const { state, panel } = await setup(page, 'PARTIAL');
  await panel.getByRole('button', { name: '영향 분석', exact: true }).click();
  await expect(panel.getByText(/수치는 확인된 하한이며 전체 영향 건수가 아닙니다/u)).toBeVisible();
  await expect(panel.getByText('확인 불가', { exact: true })).toHaveCount(3);
  expect(state.writes).toBe(0);
});

test('조회 중 정책 버전이 변경되면 늦게 도착한 결과를 표시하지 않는다', async ({ page }) => {
  const { state, panel } = await setup(page);
  let release!: () => void;
  state.wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await panel.getByRole('button', { name: '영향 분석', exact: true }).click();
  await expect.poll(() => state.requests.length).toBe(1);
  state.policy = { ...state.policy, version: 3 };
  const policies = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '결재 정책', exact: true }) });
  await policies.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect.poll(() => state.reads).toBeGreaterThan(1);
  release();
  await expect(panel.getByText(/정책 또는 관리 권한이 변경되었습니다/u)).toBeVisible();
  await expect(panel.getByRole('heading', { name: '현재 정책과 저장된 변경안' })).toHaveCount(0);
  expect(state.writes).toBe(0);
});

test('저장된 변경안이 없는 상태를 사실대로 표시한다', async ({ page }) => {
  const { panel } = await setup(page, 'NO_PROPOSAL');
  await panel.getByRole('button', { name: '영향 분석', exact: true }).click();
  await expect(panel.getByText(/저장된 변경안이 없습니다/u)).toBeVisible();
  await expect(panel.getByRole('heading', { name: '현재 정책과 저장된 변경안' })).toHaveCount(0);
});

test('320px 어두운 테마에서도 영향 분석과 비교가 겹치지 않는다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark' });
  const { panel } = await setup(page);
  await panel.getByRole('button', { name: '영향 분석', exact: true }).click();
  await expect(panel.getByText(/조회된 항목은 기준 시각에 모두 평가/u)).toBeVisible();
  const overflow = await panel.evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(overflow).toBe(false);
  const screenshot = testInfo.outputPath('policy-impact-320-dark.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('policy-impact-320-dark', { path: screenshot, contentType: 'image/png' });
});

test('유효기간이 지난 분석은 자동 요청 없이 숨긴다', async ({ page }) => {
  await page.clock.install({ time: new Date() });
  const { state, panel } = await setup(page);
  await panel.getByRole('button', { name: '영향 분석', exact: true }).click();
  await expect(panel.getByText(/조회된 항목은 기준 시각에 모두 평가/u)).toBeVisible();
  await page.clock.fastForward(31000);
  await expect(panel.getByText(/분석의 유효기간이 지났습니다/u)).toBeVisible();
  await expect(panel.getByRole('heading', { name: '현재 정책과 저장된 변경안' })).toHaveCount(0);
  expect(state.requests).toHaveLength(1);
  expect(state.writes).toBe(0);
});
