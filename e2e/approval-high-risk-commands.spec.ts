import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import {
  mockApprovalHighRiskNetwork,
  type ApprovalHighRiskCommandOutcome,
} from './support/approval-high-risk';
import {
  APPROVAL_ACTION_ROUTE_CONTRACT_KEYS,
  APPROVAL_HIGH_RISK_ACTION_ROUTE_CONTRACT_KEYS,
  mockApprovalProductSurfaceAuthority,
} from './support/product-surface-authority';
import {
  APPROVAL_FORM_CATEGORY_FIXTURES,
  APPROVAL_FORM_DETAIL_FIXTURE,
  APPROVAL_FORM_FIXTURE,
  APPROVAL_ADMIN_FIXTURE,
  APPROVAL_OPERATIONS_FIXTURE,
  APPROVAL_POLICIES_FIXTURE,
  APPROVAL_WORKFLOW_DETAIL_FIXTURE,
  APPROVAL_WORKFLOW_FIXTURE,
} from './support/product-area-fixtures';
import { fulfillSuccess, mockShellSession } from './support/shell-session';

import type { Page } from '@playwright/test';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../apps/dwp/src/routes/product-surface-authorization.generated';
import { diagnosticOverview } from '../libs/shared-utils/src/api/approval-signature-diagnostics.test-support';

const draftWorkflow = { ...APPROVAL_WORKFLOW_FIXTURE, lifecycleState: 'DRAFT' };
const draftWorkflowDetail = {
  ...APPROVAL_WORKFLOW_DETAIL_FIXTURE,
  workflow: draftWorkflow,
};
const draftForm = { ...APPROVAL_FORM_FIXTURE, lifecycleState: 'DRAFT' };
const draftFormDetail = { ...APPROVAL_FORM_DETAIL_FIXTURE, form: draftForm };
const pendingPolicy = {
  ...APPROVAL_POLICIES_FIXTURE[0],
  pendingReview: true,
  pendingEnforcementMode: 'BLOCK',
  pendingSeverity: 'CRITICAL',
  pendingLifecycleState: 'ACTIVE',
  pendingRule: { requesterCannotApprove: true, evidenceRequired: true },
  pendingChangeReason: 'Strengthen evidence requirements for sensitive approvals.',
  pendingBy: 2,
  pendingAt: '2026-08-23T00:00:00Z',
};

async function mockDraftData(page: Page) {
  const operationsEvaluatedAt = new Date().toISOString();
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/workflows',
    (route) => fulfillSuccess(route, [draftWorkflow])
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/admin/workflows/${draftWorkflow.workflowId}`,
    (route) => fulfillSuccess(route, draftWorkflowDetail)
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/forms',
    (route) => fulfillSuccess(route, [draftForm])
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/form-categories',
    (route) => fulfillSuccess(route, APPROVAL_FORM_CATEGORY_FIXTURES)
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/admin/forms/${draftForm.formId}`,
    (route) => fulfillSuccess(route, draftFormDetail)
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/policies',
    (route) => fulfillSuccess(route, [pendingPolicy])
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/operations',
    (route) =>
      fulfillSuccess(route, {
        ...APPROVAL_OPERATIONS_FIXTURE,
        generatedAt: operationsEvaluatedAt,
        integrationDeliveries: APPROVAL_OPERATIONS_FIXTURE.integrationDeliveries.map(
          (delivery) => ({
            ...delivery,
            retryEligibility: delivery.retryEligibility
              ? { ...delivery.retryEligibility, evaluatedAt: operationsEvaluatedAt }
              : undefined,
          })
        ),
      })
  );
}

type HighRiskCase = Readonly<{
  name: string;
  path: string;
  routeContractKey: string;
  commandPath: string;
  expectedVersion: number;
  expectedPayload: Record<string, unknown>;
  expectedCommandBody?: unknown;
  commandResult: unknown;
  start: (page: Page) => Promise<void>;
  successText: string;
  objectVersionHeader: boolean;
}>;

const cases: readonly HighRiskCase[] = [
  {
    name: 'workflow publish',
    path: '/approvals/admin/workflows',
    routeContractKey: 'route.approvals.admin.workflow-publish.action',
    commandPath: `/api/approvals/v1/admin/workflows/${draftWorkflow.workflowId}/publish`,
    expectedVersion: draftWorkflow.version,
    expectedPayload: { expectedVersion: draftWorkflow.version },
    commandResult: [{ ...draftWorkflow, lifecycleState: 'PUBLISHED' }],
    start: async (page) => {
      await page.getByRole('button', { name: '게시', exact: true }).click();
    },
    successText: '프로세스를 게시했습니다.',
    objectVersionHeader: false,
  },
  {
    name: 'policy publish',
    path: '/approvals/admin/policies',
    routeContractKey: 'route.approvals.admin.policy-publish.action',
    commandPath: `/api/approvals/v1/admin/policies/${pendingPolicy.policyId}/publish`,
    expectedVersion: pendingPolicy.version,
    expectedPayload: {
      expectedVersion: pendingPolicy.version,
      reviewComment: '독립 검토 증적과 변경 범위를 모두 확인했습니다.',
    },
    commandResult: [{ ...pendingPolicy, pendingReview: false, version: pendingPolicy.version + 1 }],
    start: async (page) => {
      await page.getByRole('button', { name: '검토 및 게시' }).click();
      await page
        .getByRole('textbox', { name: '검토 의견' })
        .fill('독립 검토 증적과 변경 범위를 모두 확인했습니다.');
      await page.getByRole('button', { name: '정책 게시' }).click();
    },
    successText: '독립 검토를 완료하고 정책을 게시했습니다.',
    objectVersionHeader: false,
  },
  {
    name: 'delivery retry',
    path: '/approvals/admin/operations',
    routeContractKey: 'route.approvals.admin.operations.retry.action',
    commandPath: `/api/approvals/v1/admin/operations/events/${APPROVAL_OPERATIONS_FIXTURE.integrationDeliveries[0].outboxId}/retry`,
    expectedVersion: APPROVAL_OPERATIONS_FIXTURE.integrationDeliveries[0].version,
    expectedPayload: {},
    expectedCommandBody: null,
    commandResult: {
      ...APPROVAL_OPERATIONS_FIXTURE,
      integrationDeliveries: APPROVAL_OPERATIONS_FIXTURE.integrationDeliveries.map((delivery) => ({
        ...delivery,
        status: 'PENDING',
        manualRetryCount: 1,
      })),
    },
    start: async (page) => {
      await page.getByRole('button', { name: '이벤트 다시 전달' }).click();
    },
    successText: '대기',
    objectVersionHeader: true,
  },
];

test('정본14 Approval ACTION 80개가 exact surface에서 routine ALLOWED / HIGH STEP_UP으로 평가된다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
  await mockApprovalProductSurfaceAuthority(page);
  await page.goto('/approvals/home');
  const canonical = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
    (route) => route.productId === 'approvals' && route.routeKind === 'ACTION'
  ).map((route) => route.routeContractKey);
  expect([...APPROVAL_ACTION_ROUTE_CONTRACT_KEYS].sort()).toEqual(canonical.sort());
  expect(canonical).toHaveLength(80);
  expect(APPROVAL_HIGH_RISK_ACTION_ROUTE_CONTRACT_KEYS).toHaveLength(21);

  const results = await page.evaluate(async (routeContractKeys) => {
    const responses: Array<{ routeContractKey: string; decision: string }> = [];
    for (const routeContractKey of routeContractKeys) {
      const work = routeContractKey.includes('.work.');
      const response = await fetch('/api/auth/product-surface-access/evaluate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: {
            type: 'PRODUCT',
            productKey: 'approvals',
            surfaceKey: work ? 'approvals.work' : 'approvals.admin',
          },
          routeContractKey,
          contextKey: work ? 'ctx:approvals:work' : 'ctx:approvals:admin',
          contextScopeKey: work ? 'scope:approvals:self' : 'scope:approvals:tenant',
        }),
      });
      const body = (await response.json()) as { data: { decision: string } };
      responses.push({ routeContractKey, decision: body.data.decision });
    }
    return responses;
  }, canonical);

  const highRiskRouteKeys = new Set(APPROVAL_HIGH_RISK_ACTION_ROUTE_CONTRACT_KEYS);
  for (const result of results) {
    expect(result.decision, result.routeContractKey).toBe(
      highRiskRouteKeys.has(result.routeContractKey) ? 'STEP_UP_REQUIRED' : 'ALLOWED'
    );
  }
});

test('관리자 개요는 exact assurance 집합이 아니면 정상으로 승격하거나 미지 key를 렌더링하지 않는다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
  await mockApprovalProductSurfaceAuthority(page);
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/overview',
    (route) =>
      fulfillSuccess(route, {
        ...APPROVAL_ADMIN_FIXTURE,
        overdueTasks: 0,
        failedIntegrations: 0,
        assurance: [
          { key: 'identity', state: 'ENFORCED', exceptions: 0 },
          { key: 'identity', state: 'ENFORCED', exceptions: 0 },
          { key: 'evidence', state: 'ENFORCED', exceptions: 0 },
          { key: 'delivery', state: 'ENFORCED', exceptions: 0 },
          { key: 'release', state: 'ENFORCED', exceptions: 0 },
        ],
      })
  );

  await page.goto('/approvals/admin/overview');

  await expect(page.getByRole('heading', { name: '결재 운영 개요', level: 1 })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('결재 런타임 기본 보증 · 확인 필요');
  await expect(page.getByText('신뢰 경계', { exact: true })).toHaveCount(1);
  await expect(page.getByText('admin.assurance.release.title')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('전자서명 readiness는 레거시·비정본 provider payload를 소비하거나 노출하지 않고 닫힌다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    decisionRevisionFormat: 'sha256',
    generatedAt: '2026-09-15T00:00:00Z',
    revalidateAt: '2030-09-15T00:00:00Z',
  });
  let nativeReads = 0;
  let legacyReads = 0;
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/signatures/diagnostics',
    (route) => {
      nativeReads += 1;
      const overview = diagnosticOverview();
      return fulfillSuccess(route, {
        ...overview,
        scope: {
          ...overview.scope,
          contextScopeKey: 'scope:approvals:tenant',
          decisionRevision: authority.revision(),
          registrySha256: authority.revision().slice(4),
        },
        providers: overview.providers.map((provider, index) =>
          index === 1
            ? {
                ...provider,
                displayName: 'Enterprise e-signature',
                capabilities: {
                  credential: 'must-not-render',
                  privateKey: 'must-not-render',
                  auditEvidence: 'true',
                },
              }
            : provider
        ),
      });
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/signatures',
    (route) => {
      legacyReads += 1;
      return fulfillSuccess(route, [
        {
          displayName: 'Legacy provider must not render',
          capabilities: {
            credential: 'must-not-render',
            privateKey: 'must-not-render',
          },
        },
      ]);
    }
  );

  await page.goto('/approvals/admin/signatures');

  await expect(page.getByRole('heading', { name: '전자서명 연계', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '서명 제공자 진단' })).toBeVisible();
  await expect(page.getByText('소스 확인 불가', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Enterprise e-signature' })).toHaveCount(0);
  await expect(page.getByText('Legacy provider must not render')).toHaveCount(0);
  await expect(page.getByText('must-not-render')).toHaveCount(0);
  await expect(page.getByText('credential', { exact: true })).toHaveCount(0);
  await expect(page.getByText('privateKey', { exact: true })).toHaveCount(0);
  expect(nativeReads).toBeGreaterThan(0);
  expect(legacyReads).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const highRiskCase of cases) {
  test(`${highRiskCase.name}: ELIGIBLE → exact action → popup callback → reconfirm → mutation`, async ({
    page,
  }) => {
    await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
    const authority = await mockApprovalProductSurfaceAuthority(page);
    await mockDraftData(page);
    const network = await mockApprovalHighRiskNetwork(page, highRiskCase);

    await page.goto(highRiskCase.path);
    await highRiskCase.start(page);
    await expect(page.getByRole('heading', { name: '고위험 작업 본인 확인' })).toBeVisible();
    expect(authority.evaluations.at(-1)).toMatchObject({
      surfaceId: 'approvals.admin',
      routeContractKey: highRiskCase.routeContractKey,
    });

    await page.getByRole('button', { name: '본인 확인', exact: true }).click();
    await expect(page.getByRole('button', { name: '인증 공급자에서 계속' })).toBeVisible();
    expect(network.commandRequests).toHaveLength(0);

    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: '인증 공급자에서 계속' }).click();
    const popup = await popupPromise;
    await expect.poll(() => popup.isClosed()).toBe(true);
    await expect(page.getByText(/본인 확인이 완료되었습니다/u)).toBeVisible();
    expect(network.callbackRequests).toHaveLength(1);
    expect(network.issuerRequests).toHaveLength(2);
    expect(network.commandRequests).toHaveLength(0);

    const [initialIssuer, resumedIssuer] = network.issuerRequests;
    expect(initialIssuer?.body).toEqual(resumedIssuer?.body);
    expect(initialIssuer?.body).toMatchObject({
      commandMethod: 'POST',
      commandPath: highRiskCase.commandPath,
      expectedObjectVersion: highRiskCase.expectedVersion,
      payload: highRiskCase.expectedPayload,
    });
    expect(initialIssuer?.body.payload).toEqual(highRiskCase.expectedPayload);
    expect(initialIssuer?.body).not.toHaveProperty('expectedDecisionRevision');
    expect(initialIssuer?.body).toMatchObject({
      contextScopeKey: 'scope:approvals:tenant',
    });
    expect(initialIssuer?.body).not.toHaveProperty('contextKey');
    expect(initialIssuer?.headers['x-dwp-expected-decision-revision']).toBe(authority.revision());

    await page.getByRole('button', { name: '작업 확인' }).click();
    await expect.poll(() => network.commandRequests.length).toBe(1);
    const command = network.commandRequests[0]!;
    expect(command.body).toEqual(
      highRiskCase.expectedCommandBody === undefined
        ? highRiskCase.expectedPayload
        : highRiskCase.expectedCommandBody
    );
    expect(command.headers['x-dwp-expected-decision-revision']).toBe(authority.revision());
    expect(command.headers['x-dwp-step-up-challenge']).toBe('e2e-signed-step-up-challenge');
    expect(command.headers['idempotency-key']).toBe(initialIssuer?.body.idempotencyKey);
    expect(command.headers['x-dwp-expected-object-version']).toBe(
      highRiskCase.objectVersionHeader ? String(highRiskCase.expectedVersion) : undefined
    );
    const commandUrl = new URL(command.url);
    expect(commandUrl.searchParams.getAll('contextScopeKey')).toEqual(['scope:approvals:tenant']);
    expect(JSON.stringify(command.headers)).not.toContain('e2e-challenge-jti');
    await expect(page.getByText(highRiskCase.successText).first()).toBeVisible();
  });
}

async function prepareDirectIssuerWorkflow(
  page: Page,
  commandOutcomes: readonly ApprovalHighRiskCommandOutcome[],
  issuedExpiresAt?: readonly string[]
) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
  const authority = await mockApprovalProductSurfaceAuthority(page);
  await mockDraftData(page);
  const workflowCase = cases[0]!;
  const network = await mockApprovalHighRiskNetwork(page, {
    ...workflowCase,
    issuerContinuation: false,
    commandOutcomes,
    ...(issuedExpiresAt ? { issuedExpiresAt } : {}),
  });
  await page.goto(workflowCase.path);
  await workflowCase.start(page);
  await page.getByRole('button', { name: '본인 확인', exact: true }).click();
  await expect(page.getByText(/본인 확인이 완료되었습니다/u)).toBeVisible();
  return { authority, network, workflowCase };
}

for (const outcome of [
  { name: 'transport abort', value: { type: 'ABORT' } },
  { name: 'HTTP 408', value: { type: 'ERROR', status: 408 } },
  { name: 'HTTP 5xx', value: { type: 'ERROR', status: 503 } },
] as const) {
  test(`${outcome.name}만 동일 attempt로 한 번 재시도한다`, async ({ page }) => {
    const { network } = await prepareDirectIssuerWorkflow(page, [
      outcome.value,
      { type: 'SUCCESS' },
    ]);

    await page.getByRole('button', { name: '작업 확인' }).click();
    await expect(page.getByText(/네트워크 결과를 확인할 수 없습니다/u)).toBeVisible();
    expect(network.commandRequests).toHaveLength(1);
    await page.getByRole('button', { name: '작업 확인' }).click();
    await expect.poll(() => network.commandRequests.length).toBe(2);
    expect(network.commandRequests[1]?.headers['idempotency-key']).toBe(
      network.commandRequests[0]?.headers['idempotency-key']
    );
    expect(network.commandRequests[1]?.headers['x-dwp-step-up-challenge']).toBe(
      network.commandRequests[0]?.headers['x-dwp-step-up-challenge']
    );
  });
}

for (const outcome of [
  { name: 'HTTP 400', value: { type: 'ERROR', status: 400 } },
  { name: 'HTTP 403 non-step-up', value: { type: 'ERROR', status: 403 } },
  { name: 'HTTP 422', value: { type: 'ERROR', status: 422 } },
  {
    name: 'idempotency mismatch',
    value: { type: 'ERROR', status: 409, errorCode: 'IDEMPOTENCY_MISMATCH' },
  },
] as const) {
  test(`${outcome.name}은 결정적 거절로 자동 재시도하지 않는다`, async ({ page }) => {
    const { network } = await prepareDirectIssuerWorkflow(page, [outcome.value]);

    await page.getByRole('button', { name: '작업 확인' }).click();
    await expect(page.getByText(/작업이 거절되어 재시도하지 않았습니다/u)).toBeVisible();
    await page.waitForTimeout(300);
    expect(network.commandRequests).toHaveLength(1);
    await expect(page.getByRole('button', { name: '작업 확인' })).toHaveCount(0);
  });
}

test('typed revision 409는 authority를 재검사하고 command를 재시도하지 않는다', async ({
  page,
}) => {
  const { network } = await prepareDirectIssuerWorkflow(page, [
    { type: 'ERROR', status: 409, errorCode: 'DECISION_REVISION_CONFLICT' },
  ]);

  await page.getByRole('button', { name: '작업 확인' }).click();
  await expect.poll(() => network.commandRequests.length).toBe(1);
  await page.waitForTimeout(300);
  expect(network.commandRequests).toHaveLength(1);
});

test('typed replay-success 409는 완료로 수렴하고 command를 재시도하지 않는다', async ({ page }) => {
  const { network } = await prepareDirectIssuerWorkflow(page, [
    { type: 'ERROR', status: 409, errorCode: 'IDEMPOTENCY_REPLAY_SUCCESS' },
  ]);

  await page.getByRole('button', { name: '작업 확인' }).click();
  await expect(page.getByRole('heading', { name: '고위험 작업 본인 확인' })).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(network.commandRequests).toHaveLength(1);
});

test('expired proof는 network 전송 없이 폐기하고 새 attempt를 요구한다', async ({ page }) => {
  await page.clock.install({ time: new Date() });
  const { network } = await prepareDirectIssuerWorkflow(
    page,
    [{ type: 'SUCCESS' }],
    ['2026-08-24T00:01:00Z', '2026-08-25T00:00:00Z']
  );

  await page.clock.fastForward(60_001);
  await page.getByRole('button', { name: '작업 확인' }).click();
  await expect(page.getByText(/본인 확인 증명이 만료되었습니다/u)).toBeVisible();
  expect(network.commandRequests).toHaveLength(0);
  expect(network.issuerRequests).toHaveLength(1);

  await page.getByRole('button', { name: '본인 확인', exact: true }).click();
  await expect(page.getByText(/본인 확인이 완료되었습니다/u)).toBeVisible();
  expect(network.commandRequests).toHaveLength(0);
  expect(network.issuerRequests).toHaveLength(2);
  expect(network.issuerRequests[1]?.body.idempotencyKey).not.toBe(
    network.issuerRequests[0]?.body.idempotencyKey
  );

  await page.getByRole('button', { name: '작업 확인' }).click();
  await expect.poll(() => network.commandRequests.length).toBe(1);
  expect(network.commandRequests[0]?.headers['idempotency-key']).toBe(
    network.issuerRequests[1]?.body.idempotencyKey
  );
  await expect(page.getByText(/본인 확인 증명이 만료되었습니다/u)).toHaveCount(0);
});

test('command가 STEP_UP_REQUIRED를 반환하면 새 proof 전까지 두 번째 command를 보내지 않는다', async ({
  page,
}) => {
  const { network } = await prepareDirectIssuerWorkflow(page, [
    { type: 'ERROR', status: 403, errorCode: 'STEP_UP_REQUIRED' },
    { type: 'SUCCESS' },
  ]);

  await page.getByRole('button', { name: '작업 확인' }).click();
  await expect(page.getByText(/본인 확인 증명이 만료되었습니다/u)).toBeVisible();
  expect(network.commandRequests).toHaveLength(1);
  await page.waitForTimeout(300);
  expect(network.commandRequests).toHaveLength(1);

  await page.getByRole('button', { name: '본인 확인', exact: true }).click();
  await expect(page.getByText(/본인 확인이 완료되었습니다/u)).toBeVisible();
  expect(network.issuerRequests).toHaveLength(2);
  await page.getByRole('button', { name: '작업 확인' }).click();
  await expect.poll(() => network.commandRequests.length).toBe(2);
  expect(network.commandRequests[1]?.headers['idempotency-key']).toBe(
    network.issuerRequests[1]?.body.idempotencyKey
  );
  expect(network.commandRequests[1]?.headers['idempotency-key']).not.toBe(
    network.commandRequests[0]?.headers['idempotency-key']
  );
  expect(network.commandRequests[1]?.headers['x-dwp-step-up-challenge']).not.toBe(
    network.commandRequests[0]?.headers['x-dwp-step-up-challenge']
  );
});

async function prepareOidcContinuationWorkflow(
  page: Page,
  options: { oidcAuthorizationPath?: string; continuationExpiresAt?: string } = {}
) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
  await mockApprovalProductSurfaceAuthority(page);
  await mockDraftData(page);
  const workflowCase = cases[0]!;
  const network = await mockApprovalHighRiskNetwork(page, {
    ...workflowCase,
    ...options,
  });
  await page.goto(workflowCase.path);
  await workflowCase.start(page);
  await page.getByRole('button', { name: '본인 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '인증 공급자에서 계속' })).toBeVisible();
  return network;
}

test('popup 차단은 접근 가능한 오류로 남고 command network는 0건이다', async ({ page }) => {
  await page.addInitScript(() => {
    window.open = () => null;
  });
  const network = await prepareOidcContinuationWorkflow(page);

  await page.getByRole('button', { name: '인증 공급자에서 계속' }).click();
  await expect(page.getByText(/인증 팝업이 차단되었습니다/u)).toBeVisible();
  expect(network.commandRequests).toHaveLength(0);
  expect(network.issuerRequests).toHaveLength(1);
});

test('stale flow와 foreign-origin completion은 무시하고 닫힌 popup을 접근 가능하게 알린다', async ({
  page,
}) => {
  const network = await prepareOidcContinuationWorkflow(page, {
    oidcAuthorizationPath: '/sign-in',
  });

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: '인증 공급자에서 계속' }).click();
  const popup = await popupPromise;
  await popup.evaluate((origin) => {
    window.opener?.postMessage(
      {
        type: 'dwp:product-surface-step-up-oidc-complete',
        flowId: '64c6b25b-4aba-4b11-aa07-768632b0af64',
      },
      origin
    );
  }, new URL(page.url()).origin);
  await popup.goto('data:text/html,<title>foreign-origin</title>');
  await popup.evaluate((origin) => {
    window.opener?.postMessage(
      {
        type: 'dwp:product-surface-step-up-oidc-complete',
        flowId: '8f879f98-2476-4c33-a228-2984567ab889',
      },
      origin
    );
  }, new URL(page.url()).origin);
  await page.waitForTimeout(300);
  expect(network.issuerRequests).toHaveLength(1);
  expect(network.commandRequests).toHaveLength(0);

  await popup.close();
  await expect(page.getByText(/본인 확인 완료 전에 팝업이 닫혔습니다/u)).toBeVisible();
  expect(network.commandRequests).toHaveLength(0);
});

test('popup timeout은 popup을 닫고 자동 issuer·command 호출 없이 안내한다', async ({ page }) => {
  await page.clock.install({ time: new Date() });
  const network = await prepareOidcContinuationWorkflow(page, {
    oidcAuthorizationPath: '/sign-in',
    continuationExpiresAt: '2026-08-24T00:01:00Z',
  });

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: '인증 공급자에서 계속' }).click();
  const popup = await popupPromise;
  await page.clock.fastForward(60_001);
  await expect(page.getByText(/인증 창이 만료되었습니다/u)).toBeVisible({ timeout: 5_000 });
  await expect.poll(() => popup.isClosed()).toBe(true);
  expect(network.issuerRequests).toHaveLength(1);
  expect(network.commandRequests).toHaveLength(0);
});

test('복수 OIDC provider는 server allowlist 선택 후에만 challenge를 발급한다', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
  await mockApprovalProductSurfaceAuthority(page);
  await mockDraftData(page);
  const workflowCase = cases[0]!;
  const network = await mockApprovalHighRiskNetwork(page, {
    ...workflowCase,
    issuerContinuation: false,
    providerSelectionKeys: ['workforce-sso', 'secure-idp'],
  });
  await page.goto(workflowCase.path);
  await workflowCase.start(page);
  await page.getByRole('button', { name: '본인 확인', exact: true }).click();

  await expect(page.getByText('승인된 인증 공급자 선택')).toBeVisible();
  expect(network.commandRequests).toHaveLength(0);
  await page.getByRole('button', { name: 'secure-idp' }).click();
  await expect(page.getByText(/본인 확인이 완료되었습니다/u)).toBeVisible();
  expect(network.issuerRequests).toHaveLength(2);
  expect(network.issuerRequests[1]?.body.providerKey).toBe('secure-idp');
  expect(network.issuerRequests[1]?.body.idempotencyKey).toBe(
    network.issuerRequests[0]?.body.idempotencyKey
  );
  expect(network.commandRequests).toHaveLength(0);
});

test('비어 있는 provider selection은 지원 불가로 닫히고 command를 실행하지 않는다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
  await mockApprovalProductSurfaceAuthority(page);
  await mockDraftData(page);
  const workflowCase = cases[0]!;
  const network = await mockApprovalHighRiskNetwork(page, {
    ...workflowCase,
    issuerContinuation: false,
    providerSelectionKeys: [],
  });
  await page.goto(workflowCase.path);
  await workflowCase.start(page);
  await page.getByRole('button', { name: '본인 확인', exact: true }).click();

  await expect(page.getByText(/사용 가능한 추가 인증 공급자가 없습니다/u)).toBeVisible();
  expect(network.issuerRequests).toHaveLength(1);
  expect(network.commandRequests).toHaveLength(0);
});
