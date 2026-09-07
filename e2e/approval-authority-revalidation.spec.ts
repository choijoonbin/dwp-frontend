import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import {
  APPROVAL_REQUEST_DETAIL_FIXTURE,
  APPROVAL_REQUEST_FIXTURE,
  APPROVAL_TASK_DETAIL_FIXTURE,
} from './support/product-area-fixtures';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';

const APPROVAL_MEMBER_PERMISSIONS = [
  {
    resourceType: 'APP',
    resourceKey: 'APP.APPROVALS',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  ...[
    ['ACTION.APPROVAL_TASK', 'VIEW'],
    ['ACTION.APPROVAL_TASK', 'UPDATE'],
    ['ACTION.APPROVAL_TASK', 'APPROVE'],
    ['ACTION.APPROVAL_REQUEST', 'VIEW'],
    ['ACTION.APPROVAL_REQUEST', 'CREATE'],
    ['ACTION.APPROVAL_REQUEST', 'UPDATE'],
    ['ACTION.APPROVAL_DELEGATION', 'VIEW'],
    ['ACTION.APPROVAL_DELEGATION', 'MANAGE'],
  ].map(([resourceKey, permissionCode]) => ({
    resourceType: 'ACTION',
    resourceKey,
    permissionCode,
    effect: 'ALLOW' as const,
  })),
];

async function prepareApprovalSession(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
}

function fulfillSuccess(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

function fulfillUnavailable(route: Route, message: string) {
  return route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({
      status: 'ERROR',
      errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
      message,
    }),
  });
}

test('결재 상세 재검증 실패는 캐시된 증적과 결정 작업을 숨기고 복구 후에만 다시 연다', async ({
  page,
}) => {
  await prepareApprovalSession(page);
  const secondTask = {
    ...APPROVAL_TASK_DETAIL_FIXTURE.task,
    taskId: 'approval-task-002',
    requestId: 'approval-request-002',
    requestNumber: 'APR-2026-0811-002',
    title: '두 번째 결재 검토',
    version: 1,
  };
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/tasks' && url.searchParams.get('view') === 'INBOX',
    (route) => fulfillSuccess(route, [APPROVAL_TASK_DETAIL_FIXTURE.task, secondTask])
  );
  let firstDetailAvailable = true;
  let decisionPosts = 0;
  await page.route('**/api/approvals/v1/tasks/approval-task-001', (route) =>
    firstDetailAvailable
      ? fulfillSuccess(route, APPROVAL_TASK_DETAIL_FIXTURE)
      : fulfillUnavailable(route, 'Approval task authority unavailable')
  );
  await page.route('**/api/approvals/v1/tasks/approval-task-002', (route) =>
    fulfillSuccess(route, { ...APPROVAL_TASK_DETAIL_FIXTURE, task: secondTask })
  );
  await page.route('**/api/approvals/v1/tasks/approval-task-001/decisions', (route) => {
    decisionPosts += 1;
    return fulfillSuccess(route, APPROVAL_TASK_DETAIL_FIXTURE);
  });

  await page.goto('/approvals/inbox?task=approval-task-001');
  await expect(
    page.getByRole('heading', { name: APPROVAL_TASK_DETAIL_FIXTURE.task.title })
  ).toBeVisible();
  await expect(page.getByText(APPROVAL_TASK_DETAIL_FIXTURE.payload.businessReason)).toBeVisible();

  firstDetailAvailable = false;
  if ((page.viewportSize()?.width ?? 1280) < 900) {
    await page.getByRole('button', { name: '결재 목록으로 돌아가기' }).click();
  }
  await page.getByText(secondTask.title, { exact: true }).click();
  await expect(page.getByRole('heading', { name: secondTask.title })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) < 900) {
    await page.getByRole('button', { name: '결재 목록으로 돌아가기' }).click();
  }
  await page.getByText(APPROVAL_TASK_DETAIL_FIXTURE.task.title, { exact: true }).click();

  const error = page
    .getByRole('alert')
    .filter({ hasText: '선택한 결재의 최신 권한을 다시 확인하지 못했습니다' });
  await expect(error).toBeVisible();
  await expect(page.getByText(APPROVAL_TASK_DETAIL_FIXTURE.payload.businessReason)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '승인', exact: true })).toHaveCount(0);
  expect(decisionPosts).toBe(0);

  firstDetailAvailable = true;
  await error.getByRole('button', { name: '다시 시도' }).click();
  await expect(error).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: APPROVAL_TASK_DETAIL_FIXTURE.task.title })
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('결재 위임 조회 실패는 빈 목록으로 퇴화하지 않고 명시적 재시도로 복구한다', async ({
  page,
}) => {
  await prepareApprovalSession(page);
  let recovered = false;
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/delegations',
    (route) =>
      recovered
        ? fulfillSuccess(route, [])
        : fulfillUnavailable(route, 'Delegation authority is unavailable')
  );

  await page.goto('/approvals/delegations');
  const error = page.getByRole('alert').filter({ hasText: '결재 위임을 불러오지 못했습니다' });
  await expect(error).toBeVisible();
  await expect(page.getByText('활성 위임이 없습니다')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '위임 추가' })).toBeDisabled();

  recovered = true;
  await error.getByRole('button', { name: '다시 시도' }).click();
  await expect(error).toHaveCount(0);
  await expect(page.getByText('활성 위임이 없습니다')).toBeVisible();
  await expect(page.getByRole('button', { name: '위임 추가' })).toBeEnabled();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('보완 상세 권한 확인 실패는 이전 payload 제출을 막고 재검증 뒤에만 입력을 연다', async ({
  page,
}) => {
  await prepareApprovalSession(page);
  const needsInformation = {
    ...APPROVAL_REQUEST_FIXTURE,
    status: 'NEEDS_INFO' as const,
    latestInformationRequest: '업무 사유와 만료일을 구체화해 주세요.',
  };
  await page.route('**/api/approvals/v1/requests?view=NEEDS_INFO', (route) =>
    fulfillSuccess(route, [needsInformation])
  );
  let detailAvailable = false;
  let responsePosts = 0;
  await page.route('**/api/approvals/v1/requests/approval-request-001/detail', (route) =>
    detailAvailable
      ? fulfillSuccess(route, { ...APPROVAL_REQUEST_DETAIL_FIXTURE, request: needsInformation })
      : fulfillUnavailable(route, 'Approval request authority unavailable')
  );
  await page.route(
    '**/api/approvals/v1/requests/approval-request-001/information-response',
    (route) => {
      responsePosts += 1;
      return fulfillSuccess(route, needsInformation);
    }
  );

  await page.goto('/approvals/requests/needs-info');
  await page.getByRole('button', { name: '보완 답변' }).click();
  const dialog = page.getByRole('dialog');
  const error = dialog
    .getByRole('alert')
    .filter({ hasText: '문서 소유권과 최신 상태를 확인하세요' });
  await expect(error).toBeVisible();
  await expect(dialog.getByLabel('업무 사유')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '답변 제출' })).toBeDisabled();
  expect(responsePosts).toBe(0);

  detailAvailable = true;
  await error.getByRole('button', { name: '다시 시도' }).click();
  await expect(error).toHaveCount(0);
  await expect(dialog.getByLabel('업무 사유')).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: '위험 수준' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('요청 상세 재검증 실패는 캐시된 payload와 회수 작업을 숨기고 복구한다', async ({ page }) => {
  await prepareApprovalSession(page);
  await page.route('**/api/approvals/v1/requests?view=SUBMITTED', (route) =>
    fulfillSuccess(route, [APPROVAL_REQUEST_FIXTURE])
  );
  let detailAvailable = true;
  await page.route('**/api/approvals/v1/requests/approval-request-001/detail', (route) =>
    detailAvailable
      ? fulfillSuccess(route, APPROVAL_REQUEST_DETAIL_FIXTURE)
      : fulfillUnavailable(route, 'Approval request authority unavailable')
  );

  await page.goto('/approvals/requests/submitted');
  await page.getByRole('button', { name: '결재 상세 열기' }).click();
  let drawer = page.getByRole('dialog', {
    name: APPROVAL_REQUEST_DETAIL_FIXTURE.request.title,
  });
  await expect(
    drawer.getByText(APPROVAL_REQUEST_DETAIL_FIXTURE.payload.businessReason)
  ).toBeVisible();
  await drawer.getByRole('button', { name: '닫기' }).click();

  detailAvailable = false;
  await page.getByRole('button', { name: '결재 상세 열기' }).click();
  drawer = page.getByRole('dialog', { name: '결재 상세' });
  const error = drawer
    .getByRole('alert')
    .filter({ hasText: '결재 상세와 증적을 불러오지 못했습니다' });
  await expect(error).toBeVisible();
  await expect(
    drawer.getByText(APPROVAL_REQUEST_DETAIL_FIXTURE.payload.businessReason)
  ).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: '회수' })).toHaveCount(0);

  detailAvailable = true;
  await error.getByRole('button', { name: '다시 시도' }).click();
  await expect(error).toHaveCount(0);
  drawer = page.getByRole('dialog', {
    name: APPROVAL_REQUEST_DETAIL_FIXTURE.request.title,
  });
  await expect(
    drawer.getByText(APPROVAL_REQUEST_DETAIL_FIXTURE.payload.businessReason)
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
