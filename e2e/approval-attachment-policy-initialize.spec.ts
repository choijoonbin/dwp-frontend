import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import {
  PRODUCT_AUTHORIZATION_REGISTRY_REVISION,
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
} from '../apps/dwp/src/routes/product-surface-authorization.generated';
import type { ApprovalAttachmentPolicy } from '../libs/shared-utils/src/api/approval-attachment-policy-contract';

const base = '/api/approvals/v1/admin/attachments';
const routeKey = 'route.approvals.admin.attachment-policy-initialize.action';
const success = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', data }),
  });
function policy(): ApprovalAttachmentPolicy {
  return {
    policyId: '11111111-1111-4111-8111-111111111111',
    resourceSetKey: 'RS_APPROVALS',
    version: 1,
    published: {
      allowUpload: false,
      allowDownload: false,
      maxFileBytes: 10_485_760,
      maxFiles: 5,
      maxRequestBytes: 52_428_800,
      maxConcurrentUploads: 1,
      allowedMediaTypes: ['application/pdf'],
      grantTtlSeconds: 300,
      retentionDays: 365,
    },
    pending: null,
    providerReadiness: 'NOT_CONFIGURED',
    publishedRevision: 1,
    pendingRevision: null,
    pendingMakerUserId: null,
    publishedRulesSha256: 'b'.repeat(64),
    pendingRulesSha256: null,
    downloadReadiness: 'NOT_CONFIGURED',
    publishEligible: false,
    publishReason: 'PENDING_POLICY_REQUIRED',
  };
}

async function setup(page: Page, options: { update?: boolean; readOnly?: boolean } = {}) {
  // Only Auth/API responses are fixtures. The browser uses the actual sealed
  // generated V14 module; this is UI integration proof, not live Auth activation.
  expect(PRODUCT_AUTHORIZATION_REGISTRY_REVISION.version).toBe(14);
  const route = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
    (item) => item.routeContractKey === routeKey
  );
  expect(route).toHaveLength(1);
  expect(route[0]!.gatewayBindings).toEqual([{ method: 'POST', path: `${base}/policies` }]);
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
  const keys = [
    'approvals.signature.read',
    'approvals.policy.read',
    ...(options.update === false ? [] : ['approvals.policy.update']),
  ];
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    decisionRevisionFormat: 'sha256',
    managementCapabilityKeys: keys,
    managementReadOnly: options.readOnly ?? false,
  });
  const state = {
    authority,
    status: 404,
    code: 'RESOURCE_NOT_AVAILABLE',
    configured: false,
    abort: false,
    reads: 0,
    writes: [] as Array<{ url: string; body: unknown; headers: Record<string, string> }>,
  };
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/signatures',
    (route) => success(route, [])
  );
  await page.route(
    (url) => url.pathname.startsWith(`${base}/`),
    (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        state.reads += 1;
        return state.configured
          ? success(route, { ...policy(), version: 2 })
          : route.fulfill({
              status: state.status,
              contentType: 'application/json',
              body: JSON.stringify({ status: 'ERROR', errorCode: state.code }),
            });
      }
      state.writes.push({
        url: request.url(),
        body: request.postDataJSON(),
        headers: request.headers(),
      });
      if (state.abort) return route.abort('connectionreset');
      state.configured = true;
      return success(route, policy());
    }
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/approvals/admin/signatures');
  await expect(page.getByRole('heading', { name: '첨부 파일 정책', exact: true })).toBeVisible();
  return state;
}

test('정본14 UI fixture: 최초 설정은 명시적 단건 쓰기이며 현재 조회로 복구하고 업로드·다운로드를 열지 않는다', async ({
  page,
}) => {
  const state = await setup(page);
  const initialReads = state.reads;
  expect(initialReads).toBeGreaterThanOrEqual(1);
  expect(state.writes).toEqual([]);
  const initialize = page.getByRole('button', { name: '정책 최초 설정', exact: true });
  await expect(initialize).toBeEnabled();
  await initialize.click();
  await expect(page.getByText('첨부 정책을 최초 설정했습니다.', { exact: false })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.authority.evaluations.some((item) => item.routeContractKey === routeKey)).toBe(true);
  const command = state.writes[0]!;
  expect(new URL(command.url).pathname).toBe(`${base}/policies`);
  expect(new URL(command.url).searchParams.get('contextScopeKey')).toBe('scope:approvals:tenant');
  expect(command.body).toEqual({ expectedAbsent: true, idempotencyKey: expect.any(String) });
  expect(command.headers['idempotency-key']).toBe(
    (command.body as { idempotencyKey: string }).idempotencyKey
  );
  expect(command.headers['x-dwp-expected-decision-revision']).toBe(state.authority.revision());
  expect(command.headers['x-dwp-expected-object-version']).toBeUndefined();
  expect(command.headers['x-dwp-step-up-challenge']).toBeUndefined();
  expect(state.reads).toBeGreaterThan(initialReads);
  await expect(initialize).toHaveCount(0);
  await expect(page.getByText('게시할 제안본이 없습니다.', { exact: true })).toBeVisible();
  for (const name of ['업로드 허용', '다운로드 허용']) {
    const row = page
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name, exact: true }) });
    await expect(row.getByRole('img', { name: '차단', exact: true })).toBeVisible();
  }
  await expect(page.getByText('준비 완료', { exact: true })).toHaveCount(0);
});

test('정본14 UI fixture: 연결 결과 불명확은 자동 재시도 없이 원본 body/key만 명시적으로 재확인한다', async ({
  page,
}) => {
  const state = await setup(page);
  state.abort = true;
  await page.getByRole('button', { name: '정책 최초 설정', exact: true }).click();
  const retry = page.getByRole('button', { name: '원본 설정 요청 재확인', exact: true });
  await expect(retry).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  const original = state.writes[0]!;
  await page.waitForTimeout(1100);
  expect(state.writes).toHaveLength(1);
  state.abort = false;
  await retry.click();
  await expect(page.getByText('첨부 정책을 최초 설정했습니다.', { exact: false })).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]!.body).toEqual(original.body);
  expect(state.writes[1]!.headers['idempotency-key']).toBe(original.headers['idempotency-key']);
});

for (const options of [{ update: false }, { readOnly: true }])
  test(`정본14 UI fixture: ${options.update === false ? 'UPDATE 부재' : '읽기 전용'} 최초 설정 POST0`, async ({
    page,
  }) => {
    const state = await setup(page, options);
    await expect(page.getByRole('button', { name: '정책 최초 설정', exact: true })).toBeDisabled();
    expect(state.writes).toEqual([]);
  });

for (const status of [403, 503])
  test(`정본14 UI fixture: 첫 ${status}는 미설정으로 오인하지 않고 화면과 쓰기를 닫는다`, async ({
    page,
  }) => {
    const state = await setup(page);
    state.status = status;
    state.code = 'AUTHORITY_RESOLUTION_UNAVAILABLE';
    const policy = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: '첨부 파일 정책', exact: true }) });
    await policy.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect(
      page.getByText('현재 권한으로 첨부 정책을 확인하지 못했습니다.', { exact: true })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '정책 최초 설정', exact: true })).toHaveCount(0);
    expect(state.writes).toEqual([]);
  });

for (const mode of ['light', 'dark', 'forced'] as const)
  test(`정본14 UI fixture 최초 설정 ${mode}: 실제 tooltip·200%·320px 및 성공 Toast 접근성`, async ({
    page,
    isMobile,
  }, testInfo) => {
    await page.emulateMedia({
      colorScheme: mode === 'dark' ? 'dark' : 'light',
      forcedColors: mode === 'forced' ? 'active' : 'none',
      reducedMotion: 'reduce',
    });
    const state = await setup(page);
    if (isMobile) await page.setViewportSize({ width: 320, height: 844 });
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const refresh = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: '첨부 파일 정책', exact: true }) })
      .getByRole('button', { name: '새로고침', exact: true });
    await expect(refresh).toBeEnabled();
    const tooltip = page.getByRole('tooltip');
    await expect(async () => {
      await page.mouse.move(0, 0);
      await refresh.hover();
      await expect.poll(() => refresh.evaluate((element) => element.matches(':hover'))).toBe(true);
      await expect(tooltip).toBeVisible({ timeout: 1500 });
      await expect(tooltip).toHaveCSS('opacity', '1', { timeout: 1500 });
    }).toPass({ timeout: 8000, intervals: [1500] });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false
    );
    await testInfo.attach(`initialize-${mode}-before`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    await page.getByRole('button', { name: '정책 최초 설정', exact: true }).click();
    await expect(page.getByText('첨부 정책을 최초 설정했습니다.', { exact: false })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false
    );
    expect(state.writes).toHaveLength(1);
    await testInfo.attach(`initialize-${mode}-success`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
