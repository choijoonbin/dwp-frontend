import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import { approvalSignatureCanonicalJson } from '../libs/shared-utils/src/api/approval-signature-verification';
import { expect, test, type Page, type Route } from '@playwright/test';
import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { mockApprovalHighRiskNetwork } from './support/approval-high-risk';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import {
  approvalDocumentRequestDetail,
  approvalDocumentRequestId,
} from './support/approval-request-document-fixtures';
import {
  approvalSignatureContextFixture,
  approvalSignatureCeremonyFixture,
  approvalSignatureReceiptFixture,
  signatureRequestId,
} from './support/approval-signature-fixtures';

const base = '/api/approvals/v1';
const success = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', data }),
  });
async function setup(page: Page, options: { update?: boolean; sign?: boolean } = {}) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    userId: 1,
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      ...['UPDATE', 'SIGN'].map((permissionCode) => ({
        resourceType: 'ACTION',
        resourceKey: 'ACTION.APPROVAL_SIGNATURE',
        permissionCode,
        effect: 'ALLOW' as const,
      })),
    ],
  });
  const capabilities = [
    'approvals.work.request.read',
    'approvals.work.request.update',
    'approvals.work.signature.read',
    ...(options.update === false ? [] : ['approvals.work.signature.update']),
    ...(options.sign === false ? [] : ['approvals.work.signature.sign']),
  ];
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    workCapabilityKeys: capabilities,
    decisionRevisionFormat: 'sha256',
  });
  const context = approvalSignatureContextFixture();
  const state = {
    context,
    ceremony: approvalSignatureCeremonyFixture(context),
    sourceStatus: 200,
    response: 'SUCCESS' as 'SUCCESS' | 'EMPTY_403' | 'UNKNOWN',
    sourceCurrent: true,
    writes: [] as Array<{
      path: string;
      body: Record<string, unknown>;
      headers: Record<string, string>;
    }>,
    reads: [] as string[],
  };
  const detail = approvalDocumentRequestDetail();
  await page.route(
    (url) => url.pathname === `${base}/requests/search`,
    (route) =>
      success(route, {
        items: [detail.request],
        totalElements: 1,
        totalPages: 1,
        page: 0,
        size: 20,
        hasNext: false,
        evaluatedAt: new Date().toISOString(),
      })
  );
  await page.route(
    (url) => url.pathname === `${base}/requests/${approvalDocumentRequestId}/detail`,
    (route) => success(route, detail)
  );
  await page.route(
    (url) =>
      /\/document-tools$|\/comments$|\/attachments$/.test(url.pathname) &&
      url.pathname.startsWith(base),
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' }),
      })
  );
  await page.route(
    (url) => url.pathname.includes('/signature-') || url.pathname.includes('/signature-context'),
    (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (request.method() === 'GET') {
        state.reads.push(path);
        if (path.includes('/signature-command-receipts/'))
          return success(route, {
            receiptId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            originalOperation: 'CREATE',
            requestId: approvalDocumentRequestId,
            signatureRequestId,
            committedAt: new Date().toISOString(),
            eventSequence: 1,
            resultState: 'AWAITING_CONSENT',
            resultVersion: 0,
            sourceCurrent: state.sourceCurrent,
          });
        if (state.sourceStatus !== 200)
          return route.fulfill({
            status: state.sourceStatus,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'ERROR',
              errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
            }),
          });
        if (path.endsWith('/signature-context')) return success(route, state.context);
        if (path.endsWith('/audit'))
          return success(route, {
            items: [
              {
                eventId: approvalDocumentRequestId,
                sequence: 1,
                action: 'CREATE',
                sourceDigest: state.context.sourceDigest,
                occurredAt: new Date().toISOString(),
              },
            ],
            truncated: true,
          });
        return success(route, state.ceremony);
      }
      state.writes.push({ path, body: request.postDataJSON(), headers: request.headers() });
      if (state.response === 'EMPTY_403') return route.fulfill({ status: 403, body: '' });
      if (path.endsWith('/consents'))
        state.ceremony = approvalSignatureCeremonyFixture(context, 'CONSENTED');
      if (path.endsWith('/cancel'))
        state.ceremony = approvalSignatureCeremonyFixture(
          context,
          'CANCELLED',
          state.ceremony.version + 1
        );
      return success(
        route,
        state.response === 'UNKNOWN' ? {} : approvalSignatureReceiptFixture(state.ceremony)
      );
    }
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/approvals/requests/archive?request=${approvalDocumentRequestId}`);
  const panel = page.locator('[data-approval-signature-panel]');
  await expect(panel.getByRole('heading', { name: '결재 문서 서명', exact: true })).toBeVisible();
  if (options.update !== false)
    await expect(panel.getByRole('button', { name: '서명 확인 시작', exact: true })).toBeEnabled();
  return { state, panel, authority };
}

test.describe('officially contracted internal signature ceremony', () => {
  test('Source10 UI fixture: 원본·약관 고정, 동의 기본false와 focus복원, 단건 생성/동의/취소 및 부분 감사', async ({
    page,
  }) => {
    const { state, panel, authority } = await setup(page);
    expect(state.writes).toEqual([]);
    await panel.getByRole('button', { name: '서명 확인 시작', exact: true }).click();
    const consent = panel.getByRole('button', { name: '동의 기록', exact: true });
    await expect(consent).toBeEnabled();
    await consent.click();
    const dialog = page.getByRole('dialog', { name: '서명 확인 약관', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('checkbox')).not.toBeChecked();
    await expect(dialog.getByRole('button', { name: '동의 기록', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(consent).toBeFocused();
    expect(state.writes).toHaveLength(1);
    await consent.click();
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: '동의 기록', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      panel.getByRole('button', { name: '본인 인증 후 서명', exact: true })
    ).toBeEnabled();
    const body = state.writes[1]!.body;
    expect(body).toMatchObject({
      accepted: true,
      expectedVersion: 0,
      sourceDigest: state.context.sourceDigest,
      termsId: state.context.terms.termsId,
      termsVersion: state.context.terms.version,
      termsSha256: state.context.terms.sha256,
      locale: 'ko',
    });
    for (const command of state.writes) {
      expect(command.headers['idempotency-key']).toBe(command.body.idempotencyKey);
      expect(command.headers['x-dwp-expected-decision-revision']).toBe(authority.revision());
      expect(command.headers['x-dwp-expected-object-version']).toBeUndefined();
      expect(command.headers['x-dwp-step-up-challenge']).toBeUndefined();
    }
    await panel.getByRole('button', { name: '서명 취소', exact: true }).click();
    await expect(panel.getByText('취소됨', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: '서명 이력', exact: true }).click();
    await expect(
      panel.getByText('일부 이력이며 추가 기록이 존재할 수 있습니다.', { exact: true })
    ).toBeVisible();
  });

  test('Source10 UI fixture: 독립 HIGH 후 실제 RSA 검증 증거만 표시하고 외부공인/보존완료를 주장하지 않는다', async ({
    page,
  }) => {
    const { state, panel, authority } = await setup(page);
    await panel.getByRole('button', { name: '서명 확인 시작', exact: true }).click();
    await panel.getByRole('button', { name: '동의 기록', exact: true }).click();
    const consent = page.getByRole('dialog', { name: '서명 확인 약관', exact: true });
    await consent.getByRole('checkbox').check();
    await consent.getByRole('button', { name: '동의 기록', exact: true }).click();
    const attested = approvalSignatureCeremonyFixture(state.context, 'ATTESTED');
    const network = await mockApprovalHighRiskNetwork(page, {
      commandPath: `${base}/signature-requests/${signatureRequestId}/sign`,
      commandResult: approvalSignatureReceiptFixture(attested),
      issuerContinuation: false,
      decisionRevision: authority.revision(),
      issuedExpiresAt: ['2030-01-01T00:00:00Z'],
    });
    await panel.getByRole('button', { name: '본인 인증 후 서명', exact: true }).click();
    const high = page.getByRole('dialog', { name: '고위험 작업 본인 확인', exact: true });
    await expect(high).toBeVisible();
    expect(network.commandRequests).toEqual([]);
    await high.getByRole('button', { name: '본인 확인', exact: true }).click();
    await expect(high.getByRole('button', { name: '작업 확인', exact: true })).toBeEnabled();
    expect(network.commandRequests).toEqual([]);
    await high.getByRole('button', { name: '작업 확인', exact: true }).click();
    await expect(high).toHaveCount(0);
    await expect(panel.locator('[data-approval-signature-evidence]')).toBeVisible();
    expect(network.commandRequests).toHaveLength(1);
    expect(network.issuerRequests[0]!.body).toMatchObject({
      targetType: 'APPROVAL_SIGNATURE_REQUEST',
      targetId: signatureRequestId,
      expectedObjectVersion: 1,
    });
    expect(network.commandRequests[0]!.headers['x-dwp-expected-object-version']).toBeUndefined();
    expect(network.commandRequests[0]!.headers['x-dwp-step-up-challenge']).toBeTruthy();
    await expect(
      panel.getByText('고정된 내부 서명 키로 암호학적 검증 완료', { exact: true })
    ).toBeVisible();
    await expect(
      panel.getByText('내부 확인 서명이며 공인·외부 제공자 전자서명이 아닙니다.', { exact: true })
    ).toBeVisible();
  });

  test('Source10 UI fixture: empty403는1POST/자동재전송0, 원본key/body 메타 조회 sourceCurrentfalse 때 원문조회0', async ({
    page,
  }) => {
    const { state, panel } = await setup(page);
    state.response = 'EMPTY_403';
    await panel.getByRole('button', { name: '서명 확인 시작', exact: true }).click();
    await expect(
      panel.getByRole('button', { name: '원래 명령 결과 확인', exact: true })
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
    const original = state.writes[0]!.body;
    state.sourceCurrent = false;
    const reads = state.reads.length;
    await panel.getByRole('button', { name: '원래 명령 결과 확인', exact: true }).click();
    await expect(
      panel.getByText('명령 메타데이터만 표시하며 문서 본문과 서명 증거는 포함하지 않습니다.', {
        exact: true,
      })
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]!.body).toEqual(original);
    expect(state.reads.slice(reads)).toHaveLength(1);
    await expect(panel.getByRole('heading', { name: '승인된 원본 문서' })).toHaveCount(0);
  });

  test('Source10 UI fixture: 403/503 원본은 failclosed, 320px/200%/visible tooltip Axe와 최신200만 복구', async ({
    page,
  }) => {
    const { state, panel } = await setup(page);
    state.sourceStatus = 403;
    await panel.getByRole('button', { name: '원본 새로고침', exact: true }).click();
    await expect(panel.getByRole('button', { name: '서명 확인 시작', exact: true })).toHaveCount(0);
    state.sourceStatus = 503;
    await panel.getByRole('button', { name: '원본 새로고침', exact: true }).click();
    expect(state.writes).toEqual([]);
    state.sourceStatus = 200;
    await panel.getByRole('button', { name: '원본 새로고침', exact: true }).click();
    await expect(panel.getByRole('button', { name: '서명 확인 시작', exact: true })).toBeEnabled();
    await page.setViewportSize({ width: 320, height: 760 });
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    );
    await page.setViewportSize({ width: 640, height: 1520 });
    const heading = panel.getByRole('heading', { name: '결재 문서 서명', exact: true });
    const initialFont = await heading.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize)
    );
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect
      .poll(() => heading.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)))
      .toBeGreaterThanOrEqual(initialFont * 2);
    const refresh = panel.getByRole('button', { name: '원본 새로고침', exact: true });
    await expect(refresh).toBeEnabled();
    await refresh.scrollIntoViewIfNeeded();
    const tooltip = page.getByRole('tooltip');
    await expect(async () => {
      await page.mouse.move(0, 0);
      await refresh.hover();
      await expect.poll(() => refresh.evaluate((element) => element.matches(':hover'))).toBe(true);
      await expect(tooltip).toBeVisible({ timeout: 1500 });
      await expect(tooltip).toHaveCSS('opacity', '1', { timeout: 1500 });
    }).toPass({ timeout: 8000, intervals: [1500] });
    const result = await new AxeBuilder({ page })
      .include('[data-approval-signature-panel]')
      .analyze();
    expect(result.violations).toEqual([]);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    );
    expect(
      await panel.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= window.innerWidth;
      })
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/dwp-signature-ceremony-${test.info().project.name}-320-zoom200.png`,
      fullPage: true,
    });
  });

  test('Source10 UI fixture: 실제capability UPDATE 또는 SIGN 부재는 해당write/HIGH를 열지 않는다', async ({
    page,
  }) => {
    const denied = await setup(page, { update: false });
    await expect(
      denied.panel.getByRole('button', { name: '서명 확인 시작', exact: true })
    ).toBeDisabled();
    expect(denied.state.writes).toEqual([]);
    await page.unrouteAll({ behavior: 'wait' });
    const { state, panel } = await setup(page, { sign: false });
    await panel.getByRole('button', { name: '서명 확인 시작', exact: true }).click();
    await panel.getByRole('button', { name: '동의 기록', exact: true }).click();
    const consent = page.getByRole('dialog', { name: '서명 확인 약관', exact: true });
    await consent.getByRole('checkbox').check();
    await consent.getByRole('button', { name: '동의 기록', exact: true }).click();
    await expect(
      panel.getByRole('button', { name: '본인 인증 후 서명', exact: true })
    ).toBeDisabled();
    expect(state.writes).toHaveLength(2);
    await expect(
      page.getByRole('dialog', { name: '고위험 작업 본인 확인', exact: true })
    ).toHaveCount(0);
  });

  test('Source10 UI fixture: submit 직전 fresh native200 새policySHA는 원래 동의창을 재결속하지 않고 동의write0', async ({
    page,
  }) => {
    const { state, panel } = await setup(page);
    await panel.getByRole('button', { name: '서명 확인 시작', exact: true }).click();
    await panel.getByRole('button', { name: '동의 기록', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '서명 확인 약관', exact: true });
    await dialog.getByRole('checkbox').check();
    const termsSha = state.context.terms.sha256;
    const reads = state.reads.length;
    const source = {
      ...state.context.source,
      documentPolicyVersion: 3,
      documentPolicySha256: '0'.repeat(64),
    };
    state.context = {
      ...state.context,
      source,
      sourceDigest: createHash('sha256')
        .update(approvalSignatureCanonicalJson({ source, terms: state.context.terms }))
        .digest('hex'),
    };
    await dialog.getByRole('button', { name: '동의 기록', exact: true }).click();
    await expect.poll(() => state.reads.length).toBeGreaterThan(reads);
    await expect(dialog.getByRole('button', { name: '동의 기록', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('checkbox')).toBeChecked();
    await expect(dialog.getByText(termsSha, { exact: true })).toBeVisible();
    expect(state.writes).toHaveLength(1);
  });

  test('Source10 UI fixture: UNKNOWN 명시적retry만 원래동일key/body를 사용한다', async ({
    page,
  }) => {
    const { state, panel } = await setup(page);
    state.response = 'UNKNOWN';
    await panel.getByRole('button', { name: '서명 확인 시작', exact: true }).click();
    await expect(
      panel.getByRole('button', { name: '원래 명령 재시도', exact: true })
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
    const original = state.writes[0]!;
    state.response = 'SUCCESS';
    await panel.getByRole('button', { name: '원래 명령 재시도', exact: true }).click();
    await expect(panel.getByRole('button', { name: '동의 기록', exact: true })).toBeEnabled();
    expect(state.writes).toHaveLength(2);
    expect(state.writes[1]!.body).toEqual(original.body);
    expect(state.writes[1]!.headers['idempotency-key']).toBe(original.headers['idempotency-key']);
  });
});
