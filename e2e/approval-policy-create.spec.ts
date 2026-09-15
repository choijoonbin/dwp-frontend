import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_POLICIES_FIXTURE } from './support/product-area-approval-fixtures';

const OPEN_CREATE = /정책 초안 만들기|admin\.policyCreate\.open/iu;
const CREATE_TITLE = /통제된 결재 정책 만들기|admin\.policyCreate\.title/iu;
const POLICY_KEY = /정책.*(?:키|식별)|policy key|admin\.policyCreate\.policyKey/iu;
const RULE_KEY = /규칙.*(?:키|식별)|rule key|admin\.policyCreate\.ruleKey/iu;
const RETRY_ORIGINAL = /원(?:래|본).*재시도|retry.*original|admin\.policyCreate\.retryOriginal/iu;
const EDIT_PRESERVED = /입력.*편집|edit.*preserved|admin\.policyCreate\.editPreserved/iu;
const contextScopeKey = 'scope:approvals:tenant';
const makerId = 7;

const input = {
  policyKey: 'SOD.FINANCE.REQUESTER_MAKER',
  nameKo: '재무 기안자와 게시자 분리',
  nameEn: 'Finance requester and publisher separation',
  ruleKey: 'requesterCannotPublish',
  changeReason: '재무 결재의 기안자와 게시자를 독립된 사용자로 분리합니다.',
};

function createdPolicy(body: Record<string, unknown>) {
  return {
    policyId: '22222222-2222-4222-8222-222222222222',
    policyKey: body.policyKey,
    nameKo: body.nameKo,
    nameEn: body.nameEn,
    policyType: body.policyType,
    enforcementMode: 'MONITOR',
    severity: 'LOW',
    lifecycleState: 'DISABLED',
    rule: body.rule,
    version: 0,
    pendingReview: true,
    pendingEnforcementMode: body.enforcementMode,
    pendingSeverity: body.severity,
    pendingLifecycleState: body.lifecycleState,
    pendingRule: body.rule,
    pendingChangeReason: body.changeReason,
    pendingBy: makerId,
    pendingAt: '2026-09-15T01:00:00Z',
  };
}

function success(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', data }),
  });
}

async function setup(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: makerId,
    locale: 'ko',
    permissions: [],
  });
  const authority = await mockApprovalProductSurfaceAuthority(page, {
    decisionRevisionFormat: 'sha256',
  });
  const state = {
    policies: [{ ...APPROVAL_POLICIES_FIXTURE[0] }],
    posts: [] as Array<{
      body: Record<string, unknown>;
      headers: Record<string, string>;
      url: string;
    }>,
    postMode: 'SUCCESS' as 'SUCCESS' | 'NETWORK' | 'DENIED' | 'CONFLICT' | 'UNAVAILABLE',
    injectDuplicate: false,
  };
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/policies',
    async (route) => {
      if (route.request().method() === 'GET') {
        const policies = state.injectDuplicate
          ? [
              ...state.policies,
              {
                ...state.policies[0]!,
                policyId: '33333333-3333-4333-8333-333333333333',
                policyKey: input.policyKey,
              },
            ]
          : state.policies;
        return success(route, policies);
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      state.posts.push({ body, headers: route.request().headers(), url: route.request().url() });
      if (state.postMode === 'NETWORK') return route.abort('connectionreset');
      if (state.postMode !== 'SUCCESS') {
        const status = { DENIED: 403, CONFLICT: 409, UNAVAILABLE: 503 }[state.postMode];
        return route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: state.postMode }),
        });
      }
      const created = createdPolicy(body);
      state.policies = [created, ...state.policies];
      return success(route, created);
    }
  );
  await page.route(
    (url) => /^\/api\/approvals\/v1\/admin\/policies\/[^/]+\/versions$/u.test(url.pathname),
    (route) => success(route, [])
  );
  await page.route(
    (url) => /^\/api\/approvals\/v1\/admin\/policies\/[^/]+\/impact$/u.test(url.pathname),
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Impact source unavailable' }),
      })
  );
  await page.goto('/approvals/admin/policies');
  await expect(page.getByRole('button', { name: OPEN_CREATE })).toBeEnabled();
  return { state, authority };
}

async function openAndFill(page: Page) {
  const opener = page.getByRole('button', { name: OPEN_CREATE });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: CREATE_TITLE });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: POLICY_KEY }).fill(input.policyKey);
  await dialog.getByRole('textbox', { name: '한국어 이름', exact: true }).fill(input.nameKo);
  await dialog.getByRole('textbox', { name: '영어 이름', exact: true }).fill(input.nameEn);
  await dialog.getByRole('textbox', { name: RULE_KEY }).fill(input.ruleKey);
  await dialog.getByRole('textbox', { name: '변경 사유', exact: true }).fill(input.changeReason);
  return { dialog, opener };
}

for (const width of [390, 320] as const) {
  test(`APR15 ${width}px 정책 생성은 maker draft만 만들고 실제 목록 항목을 선택한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const { state, authority } = await setup(page);
    const { dialog, opener } = await openAndFill(page);

    await expect(dialog.getByRole('button', { name: '임시 저장', exact: true })).toBeEnabled();
    for (let index = 0; index < 12; index += 1) await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false
    );

    await dialog.getByRole('button', { name: '임시 저장', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: input.nameKo, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '검토 및 게시', exact: true })).toBeDisabled();
    await expect(opener).toBeFocused();

    expect(state.posts).toHaveLength(1);
    expect(state.posts[0]?.body).toEqual({
      policyKey: input.policyKey,
      nameKo: input.nameKo,
      nameEn: input.nameEn,
      policyType: 'SEGREGATION_OF_DUTIES',
      enforcementMode: 'BLOCK',
      severity: 'HIGH',
      lifecycleState: 'ACTIVE',
      rule: { [input.ruleKey]: true },
      changeReason: input.changeReason,
    });
    expect(state.posts[0]?.url).toContain(`contextScopeKey=${encodeURIComponent(contextScopeKey)}`);
    expect(state.posts[0]?.headers['idempotency-key']).toMatch(/^approval-policy-create-/u);
    expect(state.posts[0]?.headers['x-dwp-expected-decision-revision']).toBe(authority.revision());
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false
    );
  });
}

test('APR15 UNKNOWN/503 복구는 입력을 잠그고 동일 원본과 key만 명시적으로 재시도한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { state } = await setup(page);
  state.postMode = 'NETWORK';
  const { dialog } = await openAndFill(page);
  await dialog.getByRole('button', { name: '임시 저장', exact: true }).click();
  await expect(
    dialog.getByText(/UNKNOWN|결과.*확인|admin\.policyCreate\.feedback\.UNKNOWN/iu)
  ).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: POLICY_KEY })).toBeDisabled();
  await expect(dialog.getByRole('textbox', { name: POLICY_KEY })).toHaveValue(input.policyKey);
  const first = state.posts[0]!;

  state.postMode = 'UNAVAILABLE';
  await dialog.getByRole('button', { name: RETRY_ORIGINAL }).click();
  await expect(
    dialog.getByText(
      /현재 권한 또는 정책 카탈로그를 검증하지 못했습니다|admin\.policyCreate\.feedback\.UNAVAILABLE/iu
    )
  ).toBeVisible();
  expect(state.posts).toHaveLength(2);
  expect(state.posts[1]?.body).toEqual(first.body);
  expect(state.posts[1]?.headers['idempotency-key']).toBe(first.headers['idempotency-key']);

  state.postMode = 'SUCCESS';
  await dialog.getByRole('button', { name: RETRY_ORIGINAL }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: input.nameKo, exact: true })).toBeVisible();
  expect(state.posts).toHaveLength(3);
  expect(new Set(state.posts.map((post) => post.headers['idempotency-key'])).size).toBe(1);
  expect(
    state.posts.every((post) => JSON.stringify(post.body) === JSON.stringify(first.body))
  ).toBe(true);
});

test('APR15 최신 catalog 중복은 POST 0, 입력 보존, 명시적 재편집으로 닫힌다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { state } = await setup(page);
  const { dialog } = await openAndFill(page);
  state.injectDuplicate = true;
  await dialog.getByRole('button', { name: '임시 저장', exact: true }).click();

  await expect(
    dialog.getByText(
      /정책 카탈로그가 변경되었거나 같은 키가 생겼습니다|admin\.policyCreate\.feedback\.CONFLICT/iu
    )
  ).toBeVisible();
  expect(state.posts).toHaveLength(0);
  await expect(dialog.getByRole('textbox', { name: POLICY_KEY })).toHaveValue(input.policyKey);
  await expect(dialog.getByRole('textbox', { name: POLICY_KEY })).toBeDisabled();
  await dialog.getByRole('button', { name: EDIT_PRESERVED }).click();
  await expect(dialog.getByRole('textbox', { name: POLICY_KEY })).toBeEnabled();
  await expect(dialog.getByRole('textbox', { name: POLICY_KEY })).toHaveValue(input.policyKey);
});
