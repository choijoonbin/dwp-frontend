import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { APPROVAL_POLICIES_FIXTURE } from './support/product-area-approval-fixtures';

const policyId = '11111111-1111-1111-1111-111111111111';
const initial = {
  ...APPROVAL_POLICIES_FIXTURE[0],
  policyId,
  pendingReview: true,
  pendingSeverity: 'CRITICAL',
  pendingEnforcementMode: 'BLOCK',
  pendingLifecycleState: 'ACTIVE',
  pendingRule: { requesterCannotApprove: true },
  pendingChangeReason: 'Previously reviewed policy proposal',
  pendingBy: 31,
  pendingAt: '2026-09-14T00:00:00Z',
};
const success = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', data }),
  });

async function policySource(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], { locale: 'ko', permissions: [] });
  await mockApprovalProductSurfaceAuthority(page);
  const state = { policy: initial, reads: 0, writes: [] as unknown[] };
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/policies',
    (route) => {
      state.reads += 1;
      return success(route, [state.policy]);
    }
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/admin/policies/${policyId}/versions`,
    (route) =>
      success(route, [
        {
          policyVersionId: '22222222-2222-2222-2222-222222222222',
          versionNumber: 1,
          enforcementMode: 'BLOCK',
          severity: 'HIGH',
          lifecycleState: 'ACTIVE',
          rule: initial.rule,
          changeReason: 'Published policy',
          submittedBy: 30,
          submittedAt: '2026-09-13T00:00:00Z',
          publishedBy: 32,
          publishedAt: '2026-09-13T00:00:00Z',
          reviewComment: 'Independent review complete',
        },
      ])
  );
  await page.route(
    (url) =>
      url.pathname.startsWith(`/api/approvals/v1/admin/policies/${policyId}`) &&
      !url.pathname.endsWith('/versions'),
    (route) => {
      state.writes.push(route.request().postDataJSON());
      return success(route, [{ ...state.policy, version: state.policy.version + 1 }]);
    }
  );
  await page.goto('/approvals/admin/policies');
  await expect(page.getByRole('button', { name: '정책 구성', exact: true })).toBeVisible();
  return state;
}

async function refreshSource(page: Page, state: { reads: number }) {
  const before = state.reads;
  await page.getByRole('dialog').getByRole('button', { name: '새로고침', exact: true }).click();
  await expect.poll(() => state.reads).toBeGreaterThan(before);
}

test('정책 편집은 제안값을 유지하며 현재 원본에만 저장한다', async ({ page }) => {
  const state = await policySource(page);
  await page.getByRole('button', { name: '정책 구성', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '정책 구성', exact: true });
  await expect(dialog.getByRole('combobox', { name: /^위험 등급/u })).toHaveText('CRITICAL');
  await dialog
    .getByRole('textbox', { name: '변경 사유', exact: true })
    .fill('Current source and independent review confirmed');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({ expectedVersion: initial.version, severity: 'CRITICAL' });
});

for (const change of ['version', 'proposal'] as const) {
  test(`열린 정책 편집 중 ${change} 변경은 입력을 보존하고 변경을 전송하지 않는다`, async ({
    page,
  }) => {
    const state = await policySource(page);
    await page.getByRole('button', { name: '정책 구성', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '정책 구성', exact: true });
    const reason = dialog.getByRole('textbox', { name: '변경 사유', exact: true });
    await reason.fill('Preserve this original proposal without retargeting');
    state.policy =
      change === 'version'
        ? { ...initial, version: initial.version + 1 }
        : { ...initial, pendingSeverity: 'HIGH' };
    await refreshSource(page, state);
    await expect(dialog.getByText(/이전 변경안은 저장하거나 게시할 수 없습니다/u)).toBeVisible();
    await expect(reason).toHaveValue('Preserve this original proposal without retargeting');
    await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
    expect(state.writes).toHaveLength(0);
  });
}

test('검토 중 바뀐 정책은 새 제안으로 자동 전환하거나 게시하지 않는다', async ({ page }) => {
  const state = await policySource(page);
  await page.getByRole('button', { name: '검토 및 게시', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '검토 및 게시', exact: true });
  await dialog
    .getByRole('textbox', { name: '검토 의견', exact: true })
    .fill('Keep original independent review unchanged');
  state.policy = {
    ...initial,
    version: initial.version + 1,
    pendingChangeReason: 'Unreviewed replacement proposal',
  };
  await refreshSource(page, state);
  await expect(dialog.getByText(initial.pendingChangeReason, { exact: true })).toBeVisible();
  await expect(dialog.getByText('Unreviewed replacement proposal', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '정책 게시', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('textbox', { name: '검토 의견', exact: true })).toHaveValue(
    'Keep original independent review unchanged'
  );
  expect(state.writes).toHaveLength(0);
});
