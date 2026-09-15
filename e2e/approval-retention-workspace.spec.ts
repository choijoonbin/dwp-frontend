import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_RETENTION_BINDINGS } from '../libs/shared-utils/src/api/approval-retention-contract';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../apps/dwp/src/routes/product-surface-authorization.generated';
import type {
  ApprovalRetentionPolicy,
  ApprovalRetentionRecord,
  ApprovalRetentionRules,
} from '../libs/shared-utils/src/api/approval-retention-contract';

const requestId = '11111111-1111-4111-8111-111111111111';
const policyId = '22222222-2222-4222-8222-222222222222';
const base = '/api/approvals/v1/admin/retention';
function rules(): ApprovalRetentionRules {
  return {
    allowPurge: false,
    allowedClassifications: ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
    recordRetentionDays: 365,
    deletedDraftRecoveryDays: 30,
    receiptRetentionDays: 365,
    holdEvidenceRetentionDays: 365,
    auditEvidenceRetentionDays: 365,
    maxInventoryRows: 50000,
    maxObjectsPerRecord: 1000,
  };
}
function policy(): ApprovalRetentionPolicy {
  return {
    policyId,
    resourceSetKey: 'RS_APPROVALS',
    version: 0,
    publishedRevision: 0,
    pendingRevision: null,
    pendingMakerUserId: null,
    publishedRulesSha256: 'a'.repeat(64),
    pendingRulesSha256: null,
    published: rules(),
    pending: null,
    publishEligible: false,
    publishReason: 'NO_PENDING_REVISION',
    runtimeReadiness: 'RUNTIME_DISABLED_UNTIL_OWNER_FENCES_AND_PROVIDERS',
  };
}
function record(): ApprovalRetentionRecord {
  return {
    requestId,
    resourceSetKey: 'RS_APPROVALS',
    version: 0,
    policyId,
    policyVersion: 0,
    holdVersion: 0,
    state: 'LIVE',
    claimEligible: false,
    claimReason: 'INVENTORY_CAP_EXCEEDED',
    inventorySha256: 'b'.repeat(64),
    inventoryRows: 50001,
    inventoryTables: 37,
    objectCount: 1001,
    eligibleAfter: null,
    claimId: null,
    runtimeReadiness: 'RUNTIME_DISABLED_UNTIL_OWNER_FENCES_AND_PROVIDERS',
  };
}
function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', data }),
  });
}
async function showSection(page: Page, title: string) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  await heading.scrollIntoViewIfNeeded();
  await heading.evaluate((element) => {
    const header = document.querySelector('header');
    const top = header?.getBoundingClientRect().bottom ?? 0;
    window.scrollBy(0, element.getBoundingClientRect().top - top - 16);
  });
  await expect(heading).toBeInViewport();
}

// Canonical generated release-10 browser UI fixtures. No local route installation,
// live Auth grants, provider readiness, native execution or deletion claims.
async function setup(
  page: Page,
  mode: 'light' | 'dark' | 'forced' = 'light',
  nativeAbsent = false
) {
  for (const [key, method, path] of APPROVAL_RETENTION_BINDINGS) {
    const matches = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
      (route) => route.routeContractKey === `route.approvals.admin.${key}`
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]!.gatewayBindings).toEqual([{ method, path: `/api/approvals${path}` }]);
    expect(matches[0]!.surfaceId).toBe('approvals.admin');
  }
  await page.emulateMedia({
    colorScheme: mode === 'dark' ? 'dark' : 'light',
    forcedColors: mode === 'forced' ? 'active' : 'none',
    reducedMotion: 'reduce',
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: [],
    appearance: {
      mode: mode === 'dark' ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    decisionRevisionFormat: 'sha256',
    rolloutState: '111',
    generatedAt: new Date().toISOString(),
    revalidateAt: new Date(Date.now() + 600000).toISOString(),
  });
  const state = {
    policy: policy(),
    record: record(),
    policyFailure: 0,
    policyAbsent: nativeAbsent,
    unknownDraft: false,
    reads: [] as Array<{ path: string; headers: Record<string, string>; scope: string | null }>,
    writes: 0,
    commands: [] as Array<{
      method: string;
      path: string;
      body: string;
      headers: Record<string, string>;
    }>,
  };
  await page.route(
    (url) => url.pathname.startsWith(`${base}/`),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() !== 'GET') {
        state.writes++;
        state.commands.push({
          method: request.method(),
          path: url.pathname,
          body: request.postData() ?? '',
          headers: request.headers(),
        });
        if (nativeAbsent && request.method() === 'POST' && url.pathname === `${base}/policies`) {
          const input = request.postDataJSON();
          expect(input).toEqual({
            expectedAbsent: true,
            idempotencyKey: request.headers()['idempotency-key'],
          });
          expect(state.policyAbsent).toBe(true);
          state.policyAbsent = false;
          return success(route, state.policy);
        }
        if (
          nativeAbsent &&
          request.method() === 'PUT' &&
          url.pathname === `${base}/policies/${policyId}/draft`
        ) {
          const input = request.postDataJSON();
          expect(input.expectedVersion).toBe(state.policy.version);
          expect(input.idempotencyKey).toBe(request.headers()['idempotency-key']);
          state.policy = {
            ...state.policy,
            version: state.policy.version + 1,
            pendingRevision: 1,
            pendingMakerUserId: 1,
            pendingRulesSha256: 'c'.repeat(64),
            pending: input.rules,
            publishReason: 'INDEPENDENT_CHECKER_REQUIRED',
          };
          return success(route, state.policy);
        }
        if (state.unknownDraft && request.method() === 'PUT') return route.abort('failed');
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: '{"errorCode":"RESOURCE_CONFLICT"}',
        });
      }
      state.reads.push({
        path: url.pathname,
        headers: request.headers(),
        scope: url.searchParams.get('contextScopeKey'),
      });
      if (url.pathname === `${base}/policy`) {
        if (state.policyAbsent)
          return route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: '{"errorCode":"RETENTION_POLICY_NOT_CONFIGURED"}',
          });
        if (state.policyFailure)
          return route.fulfill({
            status: state.policyFailure,
            contentType: 'application/json',
            body: '{"errorCode":"RETENTION_SOURCE_UNAVAILABLE"}',
          });
        return success(route, state.policy);
      }
      if (url.pathname === `${base}/records/${requestId}`) return success(route, state.record);
      return route.fulfill({ status: 404 });
    }
  );
  await page.goto('/approvals/admin/operations?scope=scope%3Aapprovals%3Atenant');
  await expect(page).toHaveURL(/operations\?scope=scope%3Aapprovals%3Atenant$/);
  if (nativeAbsent)
    await expect(
      page.getByRole('button', { name: '미설정 보존 정책 초기화', exact: true })
    ).toBeVisible();
  else
    await expect(page.getByText(state.policy.publishedRulesSha256, { exact: false })).toBeVisible();
  return { state, authority };
}

// Positive business fixture only after native authorized HEADS.empty 409 was proven.
// It exercises the real UI/governed/API chain, not live Auth or native execution.
test('native business absence initializes once and accepts draft CAS version0 without reinitializing', async ({
  page,
}) => {
  const { state, authority } = await setup(page, 'light', true);
  const initialize = page.getByRole('button', { name: '미설정 보존 정책 초기화', exact: true });
  expect(state.commands).toHaveLength(0);
  await initialize.click();
  await expect(page.getByText(state.policy.publishedRulesSha256, { exact: false })).toBeVisible();
  await expect(initialize).toHaveCount(0);
  expect(Object.keys(state.policy)).toHaveLength(13);
  expect(state.policy).toMatchObject({
    version: 0,
    publishedRevision: 0,
    pending: null,
    pendingRevision: null,
    published: { allowPurge: false },
    publishEligible: false,
    publishReason: 'NO_PENDING_REVISION',
    runtimeReadiness: 'RUNTIME_DISABLED_UNTIL_OWNER_FENCES_AND_PROVIDERS',
  });
  expect(state.commands).toHaveLength(1);
  const initialized = state.commands[0]!;
  expect(initialized.method).toBe('POST');
  expect(initialized.path).toBe(`${base}/policies`);
  expect(JSON.parse(initialized.body)).toEqual({
    expectedAbsent: true,
    idempotencyKey: initialized.headers['idempotency-key'],
  });
  expect(initialized.headers['x-dwp-expected-decision-revision']).toBe(authority.revision());
  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '결재 기록 보존 정책', exact: true }) });
  const reads = state.reads.length;
  await section.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect.poll(() => state.reads.length).toBeGreaterThan(reads);
  await expect(initialize).toHaveCount(0);
  expect(state.policy.version).toBe(0);
  expect(state.commands).toHaveLength(1);
  await section.getByRole('button', { name: '보존 정책 변경안 작성', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '보존 정책 변경안 작성', exact: true });
  await dialog.getByRole('spinbutton', { name: '완료 기록 보존 일수', exact: true }).fill('123');
  await dialog.getByRole('button', { name: '보존 변경안 저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(section.getByText('365 → 123', { exact: true })).toBeVisible();
  expect(state.commands).toHaveLength(2);
  const saved = state.commands[1]!;
  expect(saved.method).toBe('PUT');
  expect(saved.path).toBe(`${base}/policies/${policyId}/draft`);
  expect(JSON.parse(saved.body)).toEqual({
    expectedVersion: 0,
    idempotencyKey: saved.headers['idempotency-key'],
    rules: { ...rules(), recordRetentionDays: 123 },
  });
  expect(saved.headers['idempotency-key']).not.toBe(initialized.headers['idempotency-key']);
  await expect(initialize).toHaveCount(0);
  expect(state.policy.version).toBe(1);
  expect(state.policy.published.allowPurge).toBe(false);
});

test('native initialized policy and truthful blocked inventory use scoped DATA without ACTION proof', async ({
  page,
}) => {
  const { state, authority } = await setup(page);
  await expect(
    page.getByRole('button', { name: '미설정 보존 정책 초기화', exact: true })
  ).toHaveCount(0);
  await page.getByRole('textbox', { name: '결재 요청 ID', exact: true }).fill(requestId);
  await page.getByRole('button', { name: '기록 확인', exact: true }).click();
  await expect(
    page.getByText('정책의 인벤토리 또는 저장 객체 상한을 초과했습니다.', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '검증된 파기 요청 등록', exact: true })
  ).toBeDisabled();
  await expect(page.getByText('50001', { exact: true })).toBeVisible();
  await expect(page.getByText('1001', { exact: true })).toBeVisible();
  expect(state.reads.some((read) => read.path === `${base}/records/${requestId}`)).toBe(true);
  for (const read of state.reads) {
    expect(read.scope).toBe('scope:approvals:tenant');
    expect(read.headers['x-dwp-expected-decision-revision']).toBe(authority.revision());
    for (const header of [
      'idempotency-key',
      'x-dwp-step-up-challenge',
      'x-dwp-expected-object-version',
    ])
      expect(read.headers[header]).toBeUndefined();
  }
  expect(state.writes).toBe(0);
});

test('entered policy draft survives actual503 refresh and same-source explicit recovery', async ({
  page,
}) => {
  const { state } = await setup(page);
  await page.getByRole('button', { name: '보존 정책 변경안 작성', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '보존 정책 변경안 작성', exact: true });
  const days = dialog.getByRole('spinbutton', { name: '완료 기록 보존 일수', exact: true });
  await days.fill('123');
  await expect(days).toHaveValue('123');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  // Reopen a fresh editor then fail its mounted source via a real GET; no forced
  // cache or fabricated success is used to recover the locally retained draft.
  await page.getByRole('button', { name: '보존 정책 변경안 작성', exact: true }).click();
  await days.fill('123');
  state.policyFailure = 503;
  await page.evaluate(() => {
    const policyHeading = Array.from(document.querySelectorAll('h2')).find(
      (heading) => heading.textContent === '결재 기록 보존 정책'
    );
    const refresh = Array.from(
      policyHeading?.parentElement?.parentElement?.querySelectorAll<HTMLButtonElement>('button') ??
        []
    ).find((button) => button.getAttribute('aria-label') === '새로고침');
    if (!refresh) throw new Error('Policy source refresh control is missing');
    refresh.click();
  });
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText('현재 보존 권한 또는 원본을 확인할 수 없습니다. 새로 확인한 뒤 진행해 주세요.', {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '미설정 보존 정책 초기화', exact: true })
  ).toHaveCount(0);
  state.policyFailure = 0;
  const failure = page
    .getByRole('alert')
    .filter({ hasText: '현재 보존 권한 또는 원본을 확인할 수 없습니다.' });
  await failure.getByRole('button').click();
  await expect(dialog).toBeVisible();
  await expect(days).toHaveValue('123');
  expect(state.writes).toBe(0);
});

for (const source of ['unchanged', 'advanced'] as const) {
  test(`UNKNOWN policy command locks its original wire for receipt lookup after ${source} source refresh`, async ({
    page,
  }) => {
    const { state } = await setup(page);
    state.unknownDraft = true;
    await page.getByRole('button', { name: '보존 정책 변경안 작성', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '보존 정책 변경안 작성', exact: true });
    const days = dialog.getByRole('spinbutton', { name: '완료 기록 보존 일수', exact: true });
    const save = dialog.getByRole('button', { name: '보존 변경안 저장', exact: true });
    await days.fill('123');
    await save.click();
    await expect(
      page.getByText(
        '명령 처리 결과가 불확실합니다. 정확한 원본 시도를 보존하며, 일치하는 커밋 증적을 확인하기 전까지 모든 신규 변경을 차단합니다.',
        { exact: true }
      )
    ).toBeVisible();
    await expect(days).toBeDisabled();
    expect(state.commands).toHaveLength(1);
    const original = state.commands[0]!;
    expect(original.method).toBe('PUT');
    expect(original.path).toBe(`${base}/policies/${policyId}/draft`);
    const wire = JSON.parse(original.body);
    expect(wire.expectedVersion).toBe(0);
    expect(wire.rules.recordRetentionDays).toBe(123);
    expect(wire.idempotencyKey).toBe(original.headers['idempotency-key']);
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    if (source === 'advanced') {
      // A current version can advance after UNKNOWN; it is not a receipt proving
      // this original command succeeded, so the retained attempt must stay blocked.
      state.policy = {
        ...state.policy,
        version: 1,
        pendingRevision: 1,
        pendingMakerUserId: 13,
        pendingRulesSha256: 'c'.repeat(64),
        pending: { ...rules(), recordRetentionDays: 123 },
        publishReason: 'INDEPENDENT_CHECKER_REQUIRED',
      };
    }
    const section = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: '결재 기록 보존 정책', exact: true }) });
    await expect(section.getByRole('button', { name: '새로고침', exact: true })).toBeDisabled();
    await expect(
      section.getByRole('button', { name: '보존 정책 변경안 작성', exact: true })
    ).toBeDisabled();
    const receiptLookup = page.getByRole('button', {
      name: '원본 명령 처리 증적 확인',
      exact: true,
    });
    await expect(receiptLookup).toBeEnabled();
    const reads = state.reads.length;
    await receiptLookup.click();
    await expect.poll(() => state.reads.length).toBe(reads + 1);
    expect(state.reads.at(-1)?.path).toBe(
      `${base}/policies/${policyId}/draft-commands/${original.headers['idempotency-key']}`
    );
    await expect(
      page.getByText(
        '처리 증적이 원본 명령의 커밋을 확정하지 못했습니다. 변경 명령은 재전송하지 않았으며 원본 시도는 불확실 상태로 유지됩니다.',
        { exact: true }
      )
    ).toBeVisible();
    expect(state.commands).toHaveLength(1);
    await expect(
      page.getByText('정책 명령이 완료되어 현재 정책 증적을 다시 확인합니다.', { exact: true })
    ).toHaveCount(0);
  });
}

for (const mode of ['light', 'dark', 'forced'] as const) {
  test(`retention inspector ${mode} has no overflow or inaccessible controls`, async ({
    page,
    isMobile,
  }, info) => {
    await page.setViewportSize({ width: isMobile ? 320 : 1440, height: 960 });
    const { state } = await setup(page, mode);
    await page.getByRole('textbox', { name: '결재 요청 ID', exact: true }).fill(requestId);
    await page.getByRole('button', { name: '기록 확인', exact: true }).click();
    await expect(
      page.getByRole('button', { name: '검증된 파기 요청 등록', exact: true })
    ).toBeDisabled();
    await showSection(page, '결재 기록 보존 정책');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ).toBeLessThanOrEqual(1);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`retention-gen10-${mode}-viewport.png`) });
    await showSection(page, '문서별 보존 및 파기');
    await page.screenshot({
      path: info.outputPath(`retention-gen10-${mode}-inspector-viewport.png`),
    });
    expect(state.writes).toBe(0);
  });
}
