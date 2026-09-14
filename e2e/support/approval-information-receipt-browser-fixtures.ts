import { expect, test, type Page, type Route } from '@playwright/test';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../apps/dwp/src/routes/product-surface-authorization.generated';

import { approvalInformationDetail } from './approval-information-generation-fixtures';
import { APPROVAL_MEMBER_PERMISSIONS } from './approval-command-center-fixtures';
import { mockApprovalProductSurfaceAuthority } from './product-surface-authority';
import { mockShellSession } from './shell-session';
import { startApprovalWireTestServer } from './approval-wire-test-server';

import type {
  ApprovalRequestDetail,
  ProductSurfaceEffectiveContext,
} from '@dwp-frontend/shared-utils';

const envelope = (route: Route, data: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: status === 200 ? 'SUCCESS' : 'ERROR', data }),
  });
const receiptRoute = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.find(
  (entry) => entry.routeContractKey === 'route.approvals.work.information-command-receipt.data'
)?.routeContractKey;

// Client contract fixtures, never an installed server profile or live Auth proof.
export async function approvalInformationReceiptBrowserSession(
  page: Page,
  rolloutState: '110' | '111' = '111'
) {
  if (!receiptRoute) throw new Error('Canonical receipt DATA contract is not installed.');
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    surfaceUi: true,
    rolloutState,
    decisionRevisionFormat: 'sha256',
    generatedAt: new Date().toISOString(),
    revalidateAt: new Date(Date.now() + 120_000).toISOString(),
  });
  const original = await approvalInformationDetail();
  const commands: { key: string; bytes: Buffer }[] = [];
  const receipts: { key: string; bytes: Buffer }[] = [];
  const evaluations: string[] = [];
  const state: {
    detail: ApprovalRequestDetail;
    list: ApprovalRequestDetail['request'][];
    receiptStatus: number;
    receipt: unknown;
    invalidReadGrant: boolean;
    actionDenied: boolean;
    detailStatus: number;
    beforeReceiptEvaluation?: () => Promise<void>;
  } = {
    detail: original,
    list: [original.request],
    receiptStatus: 200,
    receipt: {
      status: 'COMPLETED',
      roundId: original.informationRound!.roundId,
      generation: 2,
      requestVersion: 8,
      payloadRevision: 3,
      payloadSha256: 'd'.repeat(64),
      materialChange: true,
    },
    invalidReadGrant: false,
    actionDenied: false,
    detailStatus: 200,
  };
  const wireUrl = await startApprovalWireTestServer(
    new URL(test.info().project.use.baseURL!).origin,
    (request) => {
      if (request.url.pathname.endsWith('/information-response')) {
        const key = request.headers['idempotency-key'];
        if (!request.bytes.length || typeof key !== 'string')
          throw new Error('Original wire/key is missing.');
        commands.push({ key, bytes: request.bytes });
        return { status: 503, data: null };
      }
      const key = decodeURIComponent(request.url.pathname.split('/').at(-2)!);
      const body = JSON.parse(request.bytes.toString('utf8')) as {
        operation: string;
        originalBodyBase64: string;
      };
      const bytes = Buffer.from(body.originalBodyBase64, 'base64');
      expect(Object.keys(body).sort()).toEqual(['operation', 'originalBodyBase64']);
      expect(body.operation).toBe('REPLY');
      expect(commands).toHaveLength(1);
      expect(key).toBe(commands[0]!.key);
      expect(bytes).toEqual(commands[0]!.bytes);
      expect(bytes.toString('base64')).toBe(body.originalBodyBase64);
      const headers = request.headers;
      expect(headers['x-dwp-expected-decision-revision']).toBe(authority.revision());
      for (const header of [
        'idempotency-key',
        'x-dwp-step-up-token',
        'x-dwp-expected-object-version',
      ])
        expect(headers[header]).toBeUndefined();
      receipts.push({ key, bytes });
      return {
        status: state.receiptStatus,
        data: state.receiptStatus === 200 ? state.receipt : null,
      };
    }
  );
  await page.route('**/api/auth/product-surface-access/evaluate', async (route) => {
    const body = route.request().postDataJSON() as {
      routeContractKey: string;
      contextScopeKey: string;
    };
    evaluations.push(body.routeContractKey);
    if (state.actionDenied && body.routeContractKey.endsWith('.action'))
      return envelope(route, {
        decision: 'ROUTE_DENIED',
        reasonCode: 'ROUTE_CAPABILITY_REQUIRED',
        decisionRevision: authority.revision(),
      });
    if (body.routeContractKey !== receiptRoute) return route.fallback();
    const contexts = await page.evaluate(async () =>
      (await fetch('/api/auth/product-surface-contexts')).json()
    );
    const context = (
      contexts as { data: { contexts: ProductSurfaceEffectiveContext[] } }
    ).data.contexts.find((entry) => entry.surfaceKey === 'approvals.work');
    if (!context) throw new Error('Current fixture context is missing.');
    const scope = context.scopes.find((entry) => entry.key === body.contextScopeKey);
    if (!scope) throw new Error('Receipt must select the current direct scope.');
    await state.beforeReceiptEvaluation?.();
    return envelope(route, {
      decision: 'ALLOWED',
      decisionRevision: authority.revision(),
      context: {
        ...context,
        effectiveGrants: [
          {
            grantKind: 'CAPABILITY',
            capabilityContractKey: 'approvals.work.information-command-receipt.read',
            resolvedCapabilityCode: 'ACTION.APPROVAL_REQUEST:VIEW',
            authorityMode: 'PERMISSION',
            predicatePolicyKeys: ['predicate.approval.original-information-command-receipt.v1'],
            responsibilityRequirement: 'NOT_REQUIRED',
            scopeKeys: [scope.key],
            requiresProductEntitlement: true,
            readOnly: !state.invalidReadGrant,
            activationState: 'ACTIVE',
            validUntil: null,
          },
        ],
      },
      scope,
      routeGrantRef: 'client-contract-receipt-read-grant',
      effectiveReadOnly: true,
      revalidateAt: context.revalidateAt,
    });
  });
  await page.route('**/api/approvals/v1/requests/search*', (route) =>
    envelope(route, {
      items: state.list,
      totalElements: state.list.length,
      totalPages: 1,
      page: 0,
      size: 20,
      hasNext: false,
      evaluatedAt: new Date().toISOString(),
    })
  );
  await page.route(`**/api/approvals/v1/requests/${original.request.requestId}/detail*`, (route) =>
    envelope(route, state.detailStatus === 200 ? state.detail : null, state.detailStatus)
  );
  await page.route(
    `**/api/approvals/v1/requests/${original.request.requestId}/information-response*`,
    (route) => {
      const url = new URL(route.request().url());
      return route.continue({ url: wireUrl + url.pathname + url.search });
    }
  );
  await page.route(
    (url) => url.pathname.endsWith('/receipt'),
    (route) => {
      const url = new URL(route.request().url());
      return route.continue({ url: wireUrl + url.pathname + url.search });
    }
  );
  await page.goto('/approvals/requests/needs-info');
  await page.getByRole('button', { name: '보완 답변', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '보완 답변을 제출할까요?' });
  await dialog.getByRole('textbox', { name: '비용 센터', exact: true }).fill('verified-center');
  await dialog
    .getByRole('textbox', { name: '보완 답변', exact: true })
    .fill('원래 라운드의 비용 센터를 보완했습니다.');
  await expect(dialog.getByRole('button', { name: '답변 제출', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '답변 제출', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: '원래 보완 요청 재시도', exact: true })
  ).toBeVisible();
  expect(commands).toHaveLength(1);
  return {
    state,
    original,
    commands,
    receipts,
    evaluations,
    dialog,
    lookup: async () => {
      const button = dialog.getByRole('button', { name: '원본 처리 결과 확인', exact: true });
      await expect(button).toBeEnabled();
      await button.click();
    },
    resume: async () => {
      await dialog.getByRole('button', { name: '취소', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await page.getByRole('button', { name: '미확인 보완 요청 다시 열기', exact: true }).click();
      await expect(dialog).toBeVisible();
    },
    advance: () => {
      state.actionDenied = true;
      state.list = [];
      state.detail = {
        ...original,
        request: { ...original.request, status: 'APPROVED', version: 12 },
        informationGeneration: 4,
        informationRound: null,
        payload: { summary: 'Latest saved content', costCenter: 'latest-center' },
      };
    },
  };
}
