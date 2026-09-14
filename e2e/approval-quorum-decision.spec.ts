import { expect, test, type Page, type Route } from '@playwright/test';
import type { ApprovalQuorumTaskSnapshot } from '@dwp-frontend/shared-utils/api/approval-quorum-contract';
import {
  APPROVAL_HOME_FIXTURE,
  APPROVAL_MEMBER_PERMISSIONS,
} from './support/approval-command-center-fixtures';
import { APPROVAL_TASK_DETAIL_FIXTURE } from './support/product-area-fixtures';
import { approvalTaskSearchPage } from './support/approval-search-fixtures';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { mockShellSession } from './support/shell-session';

const taskId = '22222222-2222-4222-8222-222222222222';
const snapshot: ApprovalQuorumTaskSnapshot = {
  requestVersion: 8,
  generation: 2,
  stageVersion: 7,
  pins: {
    workflowVersionId: '33333333-3333-4333-8333-333333333333',
    workflowVersion: 4,
    workflowDefinitionSha256: 'a'.repeat(64),
    formSchemaSha256: 'b'.repeat(64),
    policyVersion: 3,
    policySha256: 'c'.repeat(64),
  },
  payloadRevision: 5,
  payloadSha256: 'd'.repeat(64),
  principalPersonPublicId: '44444444-4444-4444-8444-444444444444',
};
const task = {
  ...APPROVAL_HOME_FIXTURE.focusQueue[0],
  taskId,
  status: 'CLAIMED' as const,
  version: 3,
};
const success = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });

async function openDecision(page: Page) {
  let current = snapshot;
  const decisions: unknown[] = [];
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  // Real component/API wiring with rollout-off compatibility; this fixture
  // is not evidence that the governed runtime registry has been activated.
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  await page.route('**/api/approvals/v1/tasks/search?*', (route) =>
    success(route, approvalTaskSearchPage(new URL(route.request().url()), [task]))
  );
  await page.route(`**/api/approvals/v1/tasks/${taskId}`, (route) =>
    success(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      task,
      quorum: current,
    })
  );
  await page.route(`**/api/approvals/v1/tasks/${taskId}/decisions`, (route) => {
    decisions.push(route.request().postDataJSON());
    return success(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      task: { ...task, status: 'APPROVED', version: 4 },
      canDecide: false,
      quorum: current,
    });
  });
  await page.goto(`/approvals/inbox?task=${taskId}`);
  await expect(page.getByRole('heading', { name: task.title })).toBeVisible();
  await page.getByRole('button', { name: '승인', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '결재를 승인할까요?' });
  await expect(dialog).toBeVisible();
  return {
    dialog,
    decisions,
    change: (next: ApprovalQuorumTaskSnapshot) => {
      current = next;
    },
  };
}

test('병렬 결재 승인은 확인한 회차와 결재선·문서 핀을 그대로 전송한다', async ({ page }) => {
  const { dialog, decisions } = await openDecision(page);
  await dialog.getByRole('button', { name: '승인 확정' }).click();
  await expect.poll(() => decisions.length).toBe(1);
  expect(decisions).toEqual([
    {
      decision: 'APPROVE',
      expectedVersion: 3,
      quorum: {
        expectedRequestVersion: snapshot.requestVersion,
        generation: snapshot.generation,
        expectedStageVersion: snapshot.stageVersion,
        pins: snapshot.pins,
        payloadRevision: snapshot.payloadRevision,
        payloadSha256: snapshot.payloadSha256,
      },
    },
  ]);
});

const changedSnapshots: Array<[string, ApprovalQuorumTaskSnapshot]> = [
  ['요청 버전', { ...snapshot, requestVersion: 9 }],
  ['회차', { ...snapshot, generation: 3 }],
  ['단계 버전', { ...snapshot, stageVersion: 8 }],
  ['문서 리비전', { ...snapshot, payloadRevision: 6 }],
  ['문서 해시', { ...snapshot, payloadSha256: 'e'.repeat(64) }],
  ['원 결재자', { ...snapshot, principalPersonPublicId: '55555555-5555-4555-8555-555555555555' }],
  [
    '결재선 버전 ID',
    {
      ...snapshot,
      pins: { ...snapshot.pins, workflowVersionId: '66666666-6666-4666-8666-666666666666' },
    },
  ],
  ['결재선 버전', { ...snapshot, pins: { ...snapshot.pins, workflowVersion: 5 } }],
  [
    '결재선 해시',
    { ...snapshot, pins: { ...snapshot.pins, workflowDefinitionSha256: 'e'.repeat(64) } },
  ],
  ['양식 해시', { ...snapshot, pins: { ...snapshot.pins, formSchemaSha256: 'e'.repeat(64) } }],
  ['정책 버전', { ...snapshot, pins: { ...snapshot.pins, policyVersion: 4 } }],
  ['정책 해시', { ...snapshot, pins: { ...snapshot.pins, policySha256: 'e'.repeat(64) } }],
];
for (const [label, changed] of changedSnapshots) {
  test(`승인 확인 뒤 ${label} 변경은 최신 200 응답이어도 POST 없이 재검토한다`, async ({
    page,
  }) => {
    const { dialog, decisions, change } = await openDecision(page);
    change(changed);
    await dialog.getByRole('button', { name: '승인 확정' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: '결재 내용이 변경되었습니다' })
    ).toBeVisible();
    expect(decisions).toEqual([]);
    await expect(page.getByRole('button', { name: '최신본 검토' })).toBeVisible();
  });
}
