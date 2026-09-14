import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import {
  mockApprovalProductSurfaceAuthority,
  type ApprovalAuthorityOptions,
} from './support/product-surface-authority';
import { mockApprovalHighRiskNetwork } from './support/approval-high-risk';
import type {
  ApprovalDocumentHold,
  ApprovalDocumentPolicy,
} from '../libs/shared-utils/src/api/approval-document-contract';

const policyId = '11111111-1111-1111-1111-111111111111';
const requestId = '22222222-2222-2222-2222-222222222222';
const proposalId = '33333333-3333-3333-3333-333333333333';
const base = '/api/approvals/v1/admin/document-tools';
const reviewComment = '독립 검토 증적과 문서 반출 제한 범위를 모두 확인했습니다.';
const policy: ApprovalDocumentPolicy = {
  policyId,
  resourceSetKey: 'ALL',
  version: 2,
  published: {
    revision: 0,
    rules: {
      allowComments: true,
      allowPrint: false,
      allowJsonExport: false,
      allowArchiveExport: false,
      includeComments: false,
      includeEvidence: false,
      allowedClassifications: [],
      fields: [],
      maxBatchItems: 20,
      maxBytes: 1048576,
      snapshotTtlSeconds: 300,
      evidenceRetentionDays: 365,
    },
    sha256: 'a'.repeat(64),
    makerUserId: null,
    createdAt: '2026-09-14T00:00:00Z',
  },
  pending: null,
};
const hold: ApprovalDocumentHold = {
  requestId,
  version: 3,
  active: false,
  pending: null,
  journal: [],
  purgeState: 'PURGE_WORKER_NOT_IMPLEMENTED',
  retainUntil: '2027-09-14T00:00:00Z',
  preservationPending: false,
  purgeEligible: false,
};
const pendingPolicy: ApprovalDocumentPolicy = {
  ...policy,
  pending: {
    ...policy.published,
    revision: 1,
    sha256: 'b'.repeat(64),
    makerUserId: 12,
    rules: { ...policy.published.rules, allowComments: false },
  },
};
const pendingHold: ApprovalDocumentHold = {
  ...hold,
  pending: {
    proposalId,
    operation: 'PLACE',
    reason: 'Independent preservation review required',
    makerUserId: 12,
    createdAt: '2026-09-14T00:00:00Z',
  },
  purgeState: 'LEGAL_HOLD_PENDING_APPROVAL',
  preservationPending: true,
};
const success = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });

async function admin(page: Page, options: ApprovalAuthorityOptions = {}) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
  const authority = await mockApprovalProductSurfaceAuthority(page, options);
  const state = {
    policy,
    hold,
    writes: [] as Array<{
      path: string;
      method: string;
      body: unknown;
      headers: Record<string, string>;
    }>,
  };
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/policies',
    (route) => success(route, [])
  );
  await page.route(
    (url) => url.pathname.startsWith(`${base}/`),
    (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET')
        return success(route, path.includes('/holds/') ? state.hold : state.policy);
      const body: unknown = request.postDataJSON();
      state.writes.push({ path, method: request.method(), body, headers: request.headers() });
      if (path === `${base}/policies/${policyId}/draft`) {
        state.policy = {
          ...pendingPolicy,
          version: 3,
          pending: {
            ...pendingPolicy.pending!,
            makerUserId: 1,
          },
        };
        return success(route, state.policy);
      }
      if (path === `${base}/holds/${requestId}/proposals`) {
        state.hold = {
          ...pendingHold,
          version: 4,
          pending: {
            ...pendingHold.pending!,
            makerUserId: 1,
            reason: reviewComment,
          },
        };
        return success(route, state.hold);
      }
      return route.fulfill({ status: 403, body: 'Unexpected document command' });
    }
  );
  return { state, authority };
}

async function loadHold(page: Page) {
  await page.getByRole('textbox', { name: '기안 식별자', exact: true }).fill(requestId);
  await page.getByRole('button', { name: '문서 제한 조회', exact: true }).click();
  await expect(
    page.getByText(hold.retainUntil.slice(0, 4), { exact: false }).first()
  ).toBeVisible();
}

test('ALL 정책 변경은 실제 UUID draft 경로에 버전과 멱등 키를 결속하고 반출 기본 차단을 유지한다', async ({
  page,
}) => {
  const { state, authority } = await admin(page);
  await page.goto('/approvals/admin/policies');
  await page.getByRole('button', { name: '변경 제안 편집', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '변경 제안 편집', exact: true });
  await expect(
    dialog.getByRole('switch', { name: 'JSON 반출 허용', exact: true })
  ).not.toBeChecked();
  await dialog.getByRole('switch', { name: '댓글 허용', exact: true }).uncheck();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(
    page.getByText('문서 정책 변경 제안을 저장했습니다.', { exact: true })
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  const write = state.writes[0]!;
  expect(write).toMatchObject({ path: `${base}/policies/${policyId}/draft`, method: 'PUT' });
  expect(write.body).toEqual({
    expectedVersion: 2,
    idempotencyKey: write.headers['idempotency-key'],
    rules: { ...policy.published.rules, allowComments: false },
  });
  expect(write.headers['idempotency-key']).toBeTruthy();
  expect(write.headers['x-dwp-expected-decision-revision']).toBe(authority.revision());
  expect(write.headers['x-dwp-step-up-challenge']).toBeUndefined();
  await expect(page.getByText('제안자는 자신의 변경을 직접 게시할 수 없습니다.')).toBeVisible();
});

test('보존 제안은 버전 결속 단건 명령이며 법적 보존 활성화나 purge 완료를 주장하지 않는다', async ({
  page,
  isMobile,
}) => {
  const { state, authority } = await admin(page);
  await page.goto('/approvals/admin/policies');
  await loadHold(page);
  await page.getByRole('button', { name: '제한 제안', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '제한 제안', exact: true });
  await dialog.getByRole('textbox', { name: '변경 사유', exact: true }).fill(reviewComment);
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('보존 변경 제안을 저장했습니다.', { exact: true })).toBeVisible();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  const write = state.writes[0]!;
  expect(write).toMatchObject({ path: `${base}/holds/${requestId}/proposals`, method: 'POST' });
  expect(write.body).toEqual({
    expectedVersion: 3,
    operation: 'PLACE',
    reason: reviewComment,
    idempotencyKey: write.headers['idempotency-key'],
  });
  expect(write.headers['idempotency-key']).toBeTruthy();
  expect(write.headers['x-dwp-expected-decision-revision']).toBe(authority.revision());
  await expect(page.getByText('보존 집행 대기', { exact: true })).toBeVisible();
  await expect(page.getByText('LEGAL_HOLD_PENDING_APPROVAL', { exact: true })).toBeVisible();
  await expect(page.getByText('반출 제한만으로 법적 보존', { exact: false })).toBeVisible();
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 780 });
  }
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  const successToast = page.getByText('보존 변경 제안을 저장했습니다.', { exact: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(successToast).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });
  await expect(successToast).toBeVisible();
  await test.info().attach('document-success-dark-200-percent', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(successToast).toBeVisible();
  await test.info().attach('document-success-forced-colors-200-percent', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const kind of ['policy', 'hold'] as const) {
  test(`문서 ${kind} 독립 HIGH 게시는 원본 작업과 COMMAND_BODY 버전을 확인 후에만 전송한다`, async ({
    page,
  }) => {
    const { state, authority } = await admin(page);
    state.policy = kind === 'policy' ? pendingPolicy : policy;
    state.hold = pendingHold;
    const publishedPolicy: ApprovalDocumentPolicy = {
      ...pendingPolicy,
      version: 3,
      published: pendingPolicy.pending!,
      pending: null,
    };
    const publishedHold: ApprovalDocumentHold = {
      ...pendingHold,
      version: 4,
      active: true,
      pending: null,
      purgeState: 'LEGAL_HOLD',
      preservationPending: false,
      journal: [
        {
          entryId: '44444444-4444-4444-4444-444444444444',
          version: 4,
          operation: 'PLACE',
          makerUserId: 12,
          checkerUserId: 1,
          reason: pendingHold.pending!.reason,
          reviewComment,
          occurredAt: '2026-09-14T01:00:00Z',
        },
      ],
    };
    const path = `${base}/${kind === 'policy' ? `policies/${policyId}` : `holds/${requestId}`}/publish`;
    const network = await mockApprovalHighRiskNetwork(page, {
      commandPath: path,
      commandResult: kind === 'policy' ? publishedPolicy : publishedHold,
      issuerContinuation: false,
    });
    await page.route(
      (url) =>
        url.pathname === (kind === 'policy' ? `${base}/policy` : `${base}/holds/${requestId}`),
      (route) =>
        success(
          route,
          network.commandRequests.length
            ? kind === 'policy'
              ? publishedPolicy
              : publishedHold
            : kind === 'policy'
              ? state.policy
              : state.hold
        )
    );
    await page.goto('/approvals/admin/policies');
    if (kind === 'hold') await loadHold(page);
    await page.getByRole('button', { name: '게시', exact: true }).click();
    const review = page.getByRole('dialog', { name: '게시', exact: true });
    await review.getByRole('textbox', { name: '독립 검토 의견', exact: true }).fill(reviewComment);
    await review.getByRole('button', { name: '게시', exact: true }).click();
    await expect(page.getByRole('heading', { name: '고위험 작업 본인 확인' })).toBeVisible();
    expect(authority.evaluations.at(-1)).toMatchObject({
      routeContractKey: `route.approvals.admin.document-${kind}-publish.action`,
      surfaceId: 'approvals.admin',
    });
    expect(network.commandRequests).toHaveLength(0);
    await page.getByRole('button', { name: '본인 확인', exact: true }).click();
    await expect(page.getByText(/본인 확인이 완료되었습니다/u)).toBeVisible();
    expect(network.issuerRequests).toHaveLength(1);
    const issuer = network.issuerRequests[0]!;
    expect(issuer.body).toMatchObject({
      commandMethod: 'POST',
      commandPath: path,
      targetType: kind === 'policy' ? 'DOCUMENT_POLICY' : 'DOCUMENT_HOLD',
      targetId: kind === 'policy' ? policyId : requestId,
      expectedObjectVersion: kind === 'policy' ? 2 : 3,
      contextScopeKey: 'scope:approvals:tenant',
    });
    const payload = {
      expectedVersion: kind === 'policy' ? 2 : 3,
      reviewComment,
      idempotencyKey: issuer.body.idempotencyKey,
      ...(kind === 'hold' ? { proposalId } : {}),
    };
    expect(issuer.body.payload).toEqual(payload);
    expect(issuer.headers['x-dwp-expected-decision-revision']).toBe(authority.revision());
    expect(network.commandRequests).toHaveLength(0);
    await page.getByRole('button', { name: '작업 확인', exact: true }).click();
    await expect.poll(() => network.commandRequests.length).toBe(1);
    const command = network.commandRequests[0]!;
    expect(new URL(command.url).pathname).toBe(path);
    expect(new URL(command.url).searchParams.getAll('contextScopeKey')).toEqual([
      'scope:approvals:tenant',
    ]);
    expect(command.body).toEqual(payload);
    expect(command.headers['x-dwp-expected-object-version']).toBeUndefined();
    expect(command.headers['x-dwp-expected-decision-revision']).toBe(authority.revision());
    expect(command.headers['idempotency-key']).toBe(issuer.body.idempotencyKey);
    expect(command.headers['x-dwp-step-up-challenge']).toBe('e2e-signed-step-up-challenge-1');
    await expect(
      page.getByText(kind === 'policy' ? '문서 정책을 게시했습니다.' : '보존 결정을 게시했습니다.')
    ).toBeVisible();
    if (kind === 'hold') {
      await expect(page.getByText('보존 집행 대기', { exact: true })).toHaveCount(0);
      await expect(page.getByText('반출 제한 적용', { exact: true })).toBeVisible();
      await expect(page.getByText(reviewComment, { exact: true })).toBeVisible();
      await expect(page.getByText('반출 제한만으로 법적 보존', { exact: false })).toBeVisible();
    }
    expect(state.writes).toEqual([]);
  });
}

test('문서 변경 작성자는 정책과 보존 제안을 자기 게시하지 못하며 issuer와 command 요청은 0건이다', async ({
  page,
}) => {
  const { state } = await admin(page);
  state.policy = { ...pendingPolicy, pending: { ...pendingPolicy.pending!, makerUserId: 1 } };
  state.hold = { ...pendingHold, pending: { ...pendingHold.pending!, makerUserId: 1 } };
  const network = await mockApprovalHighRiskNetwork(page, {
    commandPath: `${base}/policies/${policyId}/publish`,
    commandResult: policy,
    issuerContinuation: false,
  });
  await page.goto('/approvals/admin/policies');
  await loadHold(page);
  await expect(page.getByText('제안자는 자신의 변경을 직접 게시할 수 없습니다.')).toHaveCount(2);
  const buttons = page.getByRole('button', { name: '게시', exact: true });
  await expect(buttons).toHaveCount(2);
  for (const button of await buttons.all()) await expect(button).toBeDisabled();
  expect(network.issuerRequests).toEqual([]);
  expect(network.commandRequests).toEqual([]);
  expect(state.writes).toEqual([]);
});

test('독립 문서 게시 검토 취소는 focus를 복원하고 challenge나 mutation을 만들지 않는다', async ({
  page,
}) => {
  const { state } = await admin(page);
  state.policy = pendingPolicy;
  const network = await mockApprovalHighRiskNetwork(page, {
    commandPath: `${base}/policies/${policyId}/publish`,
    commandResult: policy,
    issuerContinuation: false,
  });
  await page.goto('/approvals/admin/policies');
  const publish = page.getByRole('button', { name: '게시', exact: true });
  await publish.click();
  const dialog = page.getByRole('dialog', { name: '게시', exact: true });
  await dialog.getByRole('textbox', { name: '독립 검토 의견', exact: true }).fill(reviewComment);
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(publish).toBeFocused();
  expect(network.issuerRequests).toEqual([]);
  expect(network.commandRequests).toEqual([]);
  expect(state.writes).toEqual([]);
});

test('정책 변경 권한 한 개가 없으면 설계 권한을 빌리지 않고 문서 조회만 유지한다', async ({
  page,
}) => {
  const { state } = await admin(page, {
    managementCapabilityKeys: [
      'approvals.policy.read',
      'approvals.policy.publish',
      'approvals.design.update',
    ],
  });
  await page.goto('/approvals/admin/policies');
  await loadHold(page);
  await expect(page.getByRole('heading', { name: '문서 접근 정책', exact: true })).toBeVisible();
  await expect(page.getByText('ALL', { exact: true })).toBeVisible();
  await expect(page.getByText('PURGE_WORKER_NOT_IMPLEMENTED', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '변경 제안 편집', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '제한 제안', exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test('읽기 전용 관리 범위는 정책과 보존 제안을 보여주되 모든 변경과 HIGH를 닫는다', async ({
  page,
}) => {
  const { state } = await admin(page, { managementReadOnly: true });
  state.policy = pendingPolicy;
  state.hold = pendingHold;
  const network = await mockApprovalHighRiskNetwork(page, {
    commandPath: `${base}/policies/${policyId}/publish`,
    commandResult: policy,
    issuerContinuation: false,
  });
  await page.goto('/approvals/admin/policies');
  await loadHold(page);
  await expect(page.getByText('ALL', { exact: true })).toBeVisible();
  await expect(page.getByText(pendingHold.pending!.reason, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '변경 제안 편집', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '제한 제안', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '게시', exact: true })).toHaveCount(0);
  expect(network.issuerRequests).toEqual([]);
  expect(network.commandRequests).toEqual([]);
  expect(state.writes).toEqual([]);
});
