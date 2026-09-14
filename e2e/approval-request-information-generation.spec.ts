import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import {
  approvalInformationDetail,
  INFORMATION_SOURCE_CHANGES,
  ORIGINAL_INFORMATION_USER,
  OTHER_INFORMATION_USER,
} from './support/approval-information-generation-fixtures';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import {
  APPROVAL_ACTION_CAPABILITY,
  mockApprovalProductSurfaceAuthority,
} from './support/product-surface-authority';
import { mockShellSession } from './support/shell-session';

import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';

function success(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}
function failure(route: Route, status: number) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ERROR', message: 'Information source unavailable' }),
  });
}

async function informationSession(page: Page, withUser = false) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  const authority = await mockApprovalProductSurfaceAuthority(page, { surfaceUi: withUser });
  if (withUser) {
    await page.route('**/api/auth/product-surface-access/evaluate', async (route) => {
      const body = route.request().postDataJSON() as {
        routeContractKey: string;
        contextScopeKey: string;
      };
      const capability =
        APPROVAL_ACTION_CAPABILITY[
          body.routeContractKey as keyof typeof APPROVAL_ACTION_CAPABILITY
        ];
      if (!capability) return route.fallback();
      const envelope = (await page.evaluate(async () =>
        (await fetch('/api/auth/product-surface-contexts')).json()
      )) as {
        data: {
          contexts: {
            surfaceKey: string;
            effectiveGrants: { grantKind: string; capabilityContractKey?: string }[];
            scopes: { key: string }[];
          }[];
        };
      };
      const current = envelope.data.contexts.find(
        (context) => context.surfaceKey === 'approvals.work'
      )!;
      return success(route, {
        decision: 'ALLOWED',
        reasonCode: null,
        decisionRevision: authority.revision(),
        context: {
          ...current,
          effectiveGrants: current.effectiveGrants.filter(
            (grant) =>
              grant.grantKind === 'CAPABILITY' && grant.capabilityContractKey === capability
          ),
        },
        routeGrantRef: `grant:${body.routeContractKey}`,
        scope: current.scopes.find((scope) => scope.key === body.contextScopeKey),
        effectiveReadOnly: false,
        validUntil: null,
        revalidateAt: '2026-08-25T00:00:00Z',
      });
    });
  }
  const original = await approvalInformationDetail(withUser);
  const state = {
    detail: original,
    detailFailure: 0,
    postFailure: 0,
    list: [original.request],
    commands: [] as Array<{ key: string | undefined; body: Record<string, unknown> }>,
    directoryFailure: 0,
    directoryPeople: [ORIGINAL_INFORMATION_USER, OTHER_INFORMATION_USER],
    directoryReads: 0,
    directoryTtlMs: 60_000,
  };
  if (withUser) {
    await page.route(
      (url) =>
        url.pathname ===
        `/api/approvals/v1/catalog/forms/${original.formId}/versions/${original.formVersionId}/field-candidates`,
      (route) => {
        const query = new URL(route.request().url()).searchParams;
        expect(query.get('requestId')).toBe(original.request.requestId);
        expect(query.get('schemaSha256')).toBe(original.formSchemaSha256);
        expect(query.get('fieldKey')).toBe('reviewer');
        state.directoryReads += 1;
        return state.directoryFailure
          ? failure(route, state.directoryFailure)
          : success(route, {
              formVersionId: original.formVersionId,
              schemaSha256: original.formSchemaSha256,
              fieldPath: 'reviewer',
              decisionRevision: authority.revision(),
              validUntil: new Date(Date.now() + state.directoryTtlMs).toISOString(),
              people: state.directoryPeople,
              mayBeTruncated: false,
              requestId: original.request.requestId,
              requestVersion: original.request.version,
            });
      }
    );
  }
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/search',
    (route) =>
      success(route, {
        items: state.list,
        totalElements: state.list.length,
        totalPages: 1,
        page: 0,
        size: 20,
        hasNext: false,
        evaluatedAt: new Date().toISOString(),
      })
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/requests/${original.request.requestId}/detail`,
    (route) =>
      state.detailFailure ? failure(route, state.detailFailure) : success(route, state.detail)
  );
  await page.route(
    (url) =>
      url.pathname ===
      `/api/approvals/v1/requests/${original.request.requestId}/information-response`,
    (route) => {
      const key = route.request().headers()['idempotency-key'];
      expect(key).toMatch(/^[A-Za-z0-9._:-]{1,120}$/u);
      state.commands.push({ key, body: route.request().postDataJSON() as Record<string, unknown> });
      return state.postFailure
        ? failure(route, state.postFailure)
        : success(route, { ...original.request, status: 'IN_REVIEW', version: 4 });
    }
  );
  await page.goto('/approvals/requests/needs-info');
  await page.getByRole('button', { name: '보완 답변', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '보완 답변을 제출할까요?' });
  await expect(dialog.getByRole('textbox', { name: '비용 센터', exact: true })).toHaveValue(
    'original-center'
  );
  await dialog.getByRole('textbox', { name: '비용 센터', exact: true }).fill('verified-center');
  await dialog
    .getByRole('textbox', { name: '보완 답변', exact: true })
    .fill('원래 라운드의 비용 센터를 보완했습니다.');
  if (withUser) await verifyOriginalUser(page, dialog);
  await expect(dialog.getByRole('button', { name: '답변 제출', exact: true })).toBeEnabled();
  return { state, original, dialog };
}

async function verifyOriginalUser(
  page: Page,
  dialog: ReturnType<Page['getByRole']>,
  term = '김결'
) {
  const picker = dialog.getByRole('combobox', { name: '검토자', exact: true });
  const lookup = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/field-candidates') && response.status() === 200
  );
  await picker.scrollIntoViewIfNeeded();
  await picker.click();
  await picker.fill('');
  await picker.fill(term);
  const refresh = dialog.getByRole('button', { name: '사용자 참조 새로 확인', exact: true });
  if (await refresh.count()) {
    await expect(refresh).toBeEnabled();
    await refresh.click();
  }
  await lookup;
  await picker.click();
  await picker.press('ArrowDown');
  await page.getByRole('option', { name: ORIGINAL_INFORMATION_USER.displayName }).click();
}

async function unknownUserSession(page: Page) {
  const session = await informationSession(page, true);
  session.state.postFailure = 503;
  await session.dialog.getByRole('button', { name: '답변 제출', exact: true }).click();
  await expect(
    session.dialog.getByRole('button', { name: '원래 보완 요청 재시도' })
  ).toBeDisabled();
  expect(session.state.commands).toHaveLength(1);
  return { ...session, originalCommand: structuredClone(session.state.commands[0]) };
}

async function qualifyOriginalUser(dialog: ReturnType<Page['getByRole']>) {
  await dialog.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: '검토자', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('textbox', { name: '비용 센터', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('textbox', { name: '보완 답변', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeDisabled();
}

test('API9 보완은 원래 generation과 단일 original key 및 canonical payload를 실제 HTTP로 전송한다', async ({
  page,
}, testInfo) => {
  const { state, dialog } = await informationSession(page);
  await expect(dialog).toContainText('보완 라운드 1');
  await dialog.getByRole('button', { name: '답변 제출', exact: true }).evaluate(async (button) => {
    await Promise.all(
      button.getAnimations().map((animation) => animation.finished.catch(() => undefined))
    );
  });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('information-round-current.png'),
    fullPage: false,
  });
  await dialog.getByRole('button', { name: '답변 제출', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.commands).toHaveLength(1);
  expect(state.commands[0]!.body).toEqual({
    message: '원래 라운드의 비용 센터를 보완했습니다.',
    expectedVersion: 3,
    sourceGeneration: 1,
    payload: {
      summary: '원래 요청 내용',
      costCenter: 'verified-center',
      createdFrom: 'DWP_APPROVALS',
    },
  });
});

for (const { key, change } of INFORMATION_SOURCE_CHANGES) {
  test(`API9 ${key} 변경은 원래 보완 입력을 보존하고 POST 0으로 닫는다`, async ({ page }) => {
    const { state, original, dialog } = await informationSession(page);
    state.detail = change(original);
    await dialog.getByRole('button', { name: '답변 제출', exact: true }).click();
    await expect(dialog).toContainText('요청을 처리하지 못했습니다.');
    await expect(dialog.getByRole('button', { name: '답변 제출', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('textbox', { name: '비용 센터', exact: true })).toHaveValue(
      'verified-center'
    );
    await expect(dialog.getByRole('textbox', { name: '보완 답변', exact: true })).toHaveValue(
      '원래 라운드의 비용 센터를 보완했습니다.'
    );
    expect(state.commands).toHaveLength(0);
  });
}

test('API9 UNKNOWN은 닫기/재개와 403 마스킹 이후 원래 라운드 확인 시 같은 key/body로만 명시 재시도한다', async ({
  page,
}, testInfo) => {
  const { state, dialog } = await informationSession(page);
  state.postFailure = 503;
  await dialog.getByRole('button', { name: '답변 제출', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeDisabled();
  expect(state.commands).toHaveLength(1);
  const originalCommand = structuredClone(state.commands[0]);
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: '미확인 보완 요청 다시 열기' }).click();
  state.detailFailure = 403;
  await dialog.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: '보완 답변', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('textbox', { name: '비용 센터', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeDisabled();
  state.detailFailure = 0;
  state.postFailure = 0;
  await dialog.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeEnabled();
  await expect(dialog.getByRole('textbox', { name: '비용 센터', exact: true })).toHaveValue(
    'verified-center'
  );
  await expect(dialog.getByRole('textbox', { name: '보완 답변', exact: true })).toHaveValue(
    '원래 라운드의 비용 센터를 보완했습니다.'
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({
    path: testInfo.outputPath('information-round-recovered-dark.png'),
    fullPage: false,
  });
  await dialog.getByRole('button', { name: '원래 보완 요청 재시도' }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.commands).toHaveLength(2);
  expect(state.commands[1]).toEqual(originalCommand);
});

test('API9 첫 503은 draft를 readonly로 보존하고 정확한 원래 source 회복 전 POST 0을 유지한다', async ({
  page,
}) => {
  const { state, dialog } = await informationSession(page);
  state.detailFailure = 503;
  await dialog.getByRole('button', { name: '답변 제출', exact: true }).click();
  await expect(dialog).toContainText('요청을 처리하지 못했습니다.');
  await expect(dialog.getByRole('textbox', { name: '비용 센터', exact: true })).toHaveValue(
    'verified-center'
  );
  await expect(dialog.getByRole('textbox', { name: '비용 센터', exact: true })).toBeDisabled();
  expect(state.commands).toHaveLength(0);
  state.detailFailure = 0;
  await dialog.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '답변 제출', exact: true })).toBeEnabled();
  expect(state.commands).toHaveLength(0);
});

test('API9 새 generation을 GET으로 확인해도 UNKNOWN을 성공으로 간주하거나 이전 입력을 새 라운드에 전송하지 않는다', async ({
  page,
}) => {
  const { state, original, dialog } = await informationSession(page);
  state.postFailure = 503;
  await dialog.getByRole('button', { name: '답변 제출', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeDisabled();
  state.detail = {
    ...original,
    request: { ...original.request, version: 4 },
    informationGeneration: 2,
    informationRound: { ...original.informationRound!, sourceGeneration: 2, targetGeneration: 3 },
  } satisfies ApprovalRequestDetail;
  state.list = [state.detail.request];
  await dialog.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeDisabled();
  await expect(dialog.getByRole('textbox', { name: '비용 센터', exact: true })).toHaveValue(
    'verified-center'
  );
  await expect(dialog).toContainText('보완 라운드 1');
  expect(state.commands).toHaveLength(1);
});

test('API9 USER UNKNOWN은 닫기/403 후 원래 UUID 조회만 재개하고 같은 key/body로 재시도한다', async ({
  page,
}, testInfo) => {
  const { state, dialog, originalCommand } = await unknownUserSession(page);
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '미확인 보완 요청 다시 열기' }).click();
  state.detailFailure = 403;
  await dialog.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: '검토자', exact: true })).toHaveCount(0);
  const readsBeforeRecovery = state.directoryReads;
  expect(state.commands).toHaveLength(1);
  state.detailFailure = 0;
  await qualifyOriginalUser(dialog);
  expect(state.directoryReads).toBe(readsBeforeRecovery);
  await verifyOriginalUser(page, dialog);
  await expect(page.getByRole('option', { name: OTHER_INFORMATION_USER.displayName })).toHaveCount(
    0
  );
  await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeEnabled();
  await expect(dialog.getByRole('textbox', { name: '비용 센터', exact: true })).toHaveValue(
    'verified-center'
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({
    path: testInfo.outputPath('information-user-original-recovery-dark.png'),
  });
  state.postFailure = 0;
  await dialog.getByRole('button', { name: '원래 보완 요청 재시도' }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.commands).toHaveLength(2);
  expect(state.commands[1]).toEqual(originalCommand);
  expect(state.commands[1]!.body).toMatchObject({
    sourceGeneration: 1,
    payload: { reviewer: ORIGINAL_INFORMATION_USER.personPublicId },
  });
});

for (const status of [403, 503]) {
  test(`API9 USER 첫 directory ${status}는 원래 입력을 보존하고 실제 재전송 0을 유지한다`, async ({
    page,
  }) => {
    const { state, dialog } = await unknownUserSession(page);
    await qualifyOriginalUser(dialog);
    state.directoryFailure = status;
    await dialog.getByRole('combobox', { name: '검토자', exact: true }).fill('김결');
    await expect(dialog.getByText(/현재 사용자 조회 권한을 확인할 수 없습니다/u)).toBeVisible();
    await expect(
      page.getByRole('option', { name: ORIGINAL_INFORMATION_USER.displayName })
    ).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeDisabled();
    await expect(dialog.getByRole('textbox', { name: '비용 센터', exact: true })).toHaveValue(
      'verified-center'
    );
    await expect(dialog.getByRole('textbox', { name: '보완 답변', exact: true })).toHaveValue(
      '원래 라운드의 비용 센터를 보완했습니다.'
    );
    expect(state.commands).toHaveLength(1);
    state.directoryFailure = 0;
    await verifyOriginalUser(page, dialog, '김결재');
    await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeEnabled();
    expect(state.commands).toHaveLength(1);
  });
}

test('API9 USER 다른 UUID 후보는 원래 미확인 입력을 바꾸거나 write를 복구할 수 없다', async ({
  page,
}) => {
  const { state, dialog } = await unknownUserSession(page);
  await qualifyOriginalUser(dialog);
  state.directoryPeople = [OTHER_INFORMATION_USER];
  const reads = state.directoryReads;
  await dialog.getByRole('combobox', { name: '검토자', exact: true }).fill('김다');
  await expect.poll(() => state.directoryReads).toBeGreaterThan(reads);
  await expect(page.getByRole('option', { name: OTHER_INFORMATION_USER.displayName })).toHaveCount(
    0
  );
  await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeDisabled();
  await expect(dialog.getByRole('textbox', { name: '비용 센터', exact: true })).toHaveValue(
    'verified-center'
  );
  expect(state.commands).toHaveLength(1);
});

test('API9 USER TTL 만료는 HTTP write를 닫고 같은 UUID의 새 조회 증적만 복구한다', async ({
  page,
}) => {
  const { state, dialog, originalCommand } = await unknownUserSession(page);
  await qualifyOriginalUser(dialog);
  state.directoryTtlMs = 1_200;
  await verifyOriginalUser(page, dialog);
  await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeDisabled();
  state.directoryFailure = 503;
  const readsBeforeFailure = state.directoryReads;
  await dialog.getByRole('combobox', { name: '검토자', exact: true }).fill('김결재 ');
  await expect.poll(() => state.directoryReads).toBeGreaterThan(readsBeforeFailure);
  await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeDisabled();
  await expect(dialog.getByText(/현재 사용자 조회 권한을 확인할 수 없습니다/u)).toBeVisible();
  expect(state.commands).toHaveLength(1);
  state.directoryFailure = 0;
  state.directoryTtlMs = 60_000;
  await verifyOriginalUser(page, dialog, '김결');
  await expect(dialog.getByRole('button', { name: '원래 보완 요청 재시도' })).toBeEnabled();
  state.postFailure = 0;
  await dialog.getByRole('button', { name: '원래 보완 요청 재시도' }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.commands).toHaveLength(2);
  expect(state.commands[1]).toEqual(originalCommand);
});
