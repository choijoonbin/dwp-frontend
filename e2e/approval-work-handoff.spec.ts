import { expect, test, type Page, type Route } from '@playwright/test';

import {
  APPROVAL_HOME_FIXTURE,
  APPROVAL_MEMBER_PERMISSIONS,
} from './support/approval-command-center-fixtures';
import {
  APPROVAL_REQUEST_DETAIL_FIXTURE,
  APPROVAL_REQUEST_FIXTURE,
  APPROVAL_TASK_DETAIL_FIXTURE,
} from './support/product-area-fixtures';
import {
  broadcastProductSurfaceRevision,
  mockApprovalProductSurfaceAuthority,
} from './support/product-surface-authority';
import { mockShellSession } from './support/shell-session';

function fulfillSuccess(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

async function prepareApprovalHandoff(
  page: Page,
  includeWorkPermission: boolean,
  includeWorkDenial = false
) {
  const permissions = [
    ...APPROVAL_MEMBER_PERMISSIONS,
    ...(includeWorkPermission
      ? [
          {
            resourceType: 'APP',
            resourceKey: 'APP.WORK',
            permissionCode: 'VIEW',
            effect: 'ALLOW' as const,
          },
        ]
      : []),
    ...(includeWorkDenial
      ? [
          {
            resourceType: 'APP',
            resourceKey: 'APP.WORK',
            permissionCode: 'VIEW',
            effect: 'DENY' as const,
          },
        ]
      : []),
  ];
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions,
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/tasks' && url.searchParams.get('view') === 'INBOX',
    (route) => fulfillSuccess(route, APPROVAL_HOME_FIXTURE.focusQueue)
  );
  await page.route('**/api/approvals/v1/tasks/approval-task-1', (route) =>
    fulfillSuccess(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      task: APPROVAL_HOME_FIXTURE.focusQueue[0],
      canDecide: true,
    })
  );
  return {
    revokeWork: () => {
      const index = permissions.findIndex((permission) => permission.resourceKey === 'APP.WORK');
      if (index >= 0) permissions.splice(index, 1);
    },
  };
}

async function prepareApprovalRequestHandoff(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      {
        resourceType: 'APP',
        resourceKey: 'APP.WORK',
        permissionCode: 'VIEW',
        effect: 'ALLOW' as const,
      },
    ],
  });
  const authority = await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  const request = {
    ...APPROVAL_REQUEST_FIXTURE,
    status: 'NEEDS_INFO' as const,
    latestInformationRequest: '업무 사유와 만료일을 구체화해 주세요.',
  };
  let completed = false;
  await page.route(
    (url) =>
      url.pathname === '/api/approvals/v1/requests' &&
      url.searchParams.get('view') === 'NEEDS_INFO',
    (route) => fulfillSuccess(route, completed ? [] : [request])
  );
  await page.route(`**/api/approvals/v1/requests/${request.requestId}/detail`, (route) =>
    fulfillSuccess(route, {
      ...APPROVAL_REQUEST_DETAIL_FIXTURE,
      request,
      payload: { ...APPROVAL_REQUEST_DETAIL_FIXTURE.payload, riskLevel: 'HIGH' },
    })
  );
  return { authority, complete: () => (completed = true), request };
}

test('업무함에서 연 결재는 결정 뒤에도 검증된 복귀 위치를 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareApprovalHandoff(page, true);
  const decisions: Array<Record<string, unknown>> = [];
  await page.route('**/api/approvals/v1/tasks/approval-task-1/decisions', async (route) => {
    decisions.push(route.request().postDataJSON() as Record<string, unknown>);
    return fulfillSuccess(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      task: { ...APPROVAL_HOME_FIXTURE.focusQueue[0], status: 'APPROVED', version: 1 },
      canDecide: false,
    });
  });
  const returnTarget =
    '/work/queue?work=APPROVAL_TASK%3Aapproval-task-1%3ASECURITY_REVIEW#approval-task-1';
  const query = new URLSearchParams({ task: 'approval-task-1', returnTo: returnTarget });

  await page.goto(`/approvals/inbox?${query.toString()}`);
  await expect(page.getByRole('heading', { name: '고객 분석 환경 접근 연장' })).toBeVisible();
  const returnAction = page.getByRole('button', { name: '업무로 돌아가기', exact: true });
  await expect(returnAction).toBeVisible();

  await page.getByRole('button', { name: '승인', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '승인 확정' }).click();
  await expect.poll(() => decisions.length).toBe(1);
  expect(decisions).toEqual([{ decision: 'APPROVE', expectedVersion: 0 }]);
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(returnTarget);

  await returnAction.click();
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === returnTarget);
});

test('업무함 deep link는 비동기 권한 부트스트랩에도 요청한 결재를 보존한다', async ({ page }) => {
  await prepareApprovalHandoff(page, true);
  await page.route(
    '**/api/auth/product-surface-contexts',
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fallback();
    },
    { times: 1 }
  );
  const returnTarget =
    '/work/queue?work=APPROVAL_TASK%3Aapproval-task-1%3ASECURITY_REVIEW#approval-task-1';
  const query = new URLSearchParams({ task: 'approval-task-1', returnTo: returnTarget });

  await page.goto(`/approvals/inbox?${query.toString()}`);
  await expect(page.getByRole('heading', { name: '고객 분석 환경 접근 연장' })).toBeVisible();
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === '/approvals/inbox' &&
      url.searchParams.get('task') === 'approval-task-1' &&
      url.searchParams.get('returnTo') === returnTarget
    );
  });
});

test('전자결재 복귀 링크는 외부 또는 비정규 경로를 표시하지 않는다', async ({ page }) => {
  await prepareApprovalHandoff(page, false);

  await page.goto(
    `/approvals/inbox?${new URLSearchParams({ returnTo: 'https://evil.test/work' }).toString()}`
  );
  await expect(page.getByRole('button', { name: '업무로 돌아가기', exact: true })).toHaveCount(0);
});

test('유효한 업무 복귀 위치도 APP.WORK 권한 없이는 표시하지 않는다', async ({ page }) => {
  await prepareApprovalHandoff(page, false);

  await page.goto(
    `/approvals/inbox?${new URLSearchParams({ returnTo: '/work/queue?view=mine' }).toString()}`
  );

  await expect(page.getByRole('button', { name: '업무로 돌아가기', exact: true })).toHaveCount(0);
});

test('APP.WORK VIEW 거부는 동일 권한 허용보다 우선해 복귀를 닫는다', async ({ page }) => {
  await prepareApprovalHandoff(page, true, true);

  await page.goto(
    `/approvals/inbox?${new URLSearchParams({ returnTo: '/work/queue?view=mine' }).toString()}`
  );

  await expect(page.getByRole('button', { name: '업무로 돌아가기', exact: true })).toHaveCount(0);
});

test('열린 결재 화면은 APP.WORK 권한 회수 즉시 업무 복귀를 닫는다', async ({ page }) => {
  const session = await prepareApprovalHandoff(page, true);
  const returnTarget = '/work/queue?work=approval-task-1#approval-task-1';

  await page.goto(
    `/approvals/inbox?${new URLSearchParams({ task: 'approval-task-1', returnTo: returnTarget }).toString()}`
  );
  await expect(page.getByRole('button', { name: '업무로 돌아가기', exact: true })).toBeVisible();

  session.revokeWork();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(page.getByRole('button', { name: '업무로 돌아가기', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === '/approvals/inbox');
});

test('업무함에서 연 보완 요청은 답변 뒤에도 정확한 업무 위치로 돌아간다', async ({ page }) => {
  const state = await prepareApprovalRequestHandoff(page);
  const responses: Array<Record<string, unknown>> = [];
  await page.route(
    `**/api/approvals/v1/requests/${state.request.requestId}/information-response`,
    (route) => {
      responses.push(route.request().postDataJSON() as Record<string, unknown>);
      state.complete();
      return fulfillSuccess(route, { ...state.request, status: 'IN_REVIEW', version: 4 });
    }
  );
  const returnTarget =
    '/work/queue?work=APPROVAL_REQUEST%3Aapproval-request-001%3AINFORMATION_REQUIRED#approval-request-001';
  const query = new URLSearchParams({ request: state.request.requestId, returnTo: returnTarget });

  await page.goto(`/approvals/requests/needs-info?${query.toString()}`);
  const returnAction = page.getByRole('button', { name: '업무로 돌아가기', exact: true });
  await expect(returnAction).toBeVisible();
  await page.getByRole('button', { name: '보완 답변' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('textbox', { name: '보완 답변' })
    .fill('요청한 사유와 기간을 최신 정보로 보완했습니다.');
  await dialog.getByRole('button', { name: '답변 제출' }).click();

  await expect.poll(() => responses.length).toBe(1);
  expect(responses[0]).toEqual(expect.objectContaining({ expectedVersion: 3 }));
  await expect(page.getByText('보완 답변을 제출하고 결재를 재개했습니다.')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(returnTarget);

  await returnAction.click();
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === returnTarget);
});

test('보완 요청의 업무 복귀는 권한 회수 즉시 닫힌다', async ({ page }) => {
  const state = await prepareApprovalRequestHandoff(page);
  const returnTarget = '/work/queue?work=approval-request-001#approval-request-001';
  const query = new URLSearchParams({ request: state.request.requestId, returnTo: returnTarget });

  await page.goto(`/approvals/requests/needs-info?${query.toString()}`);
  await expect(page.getByRole('button', { name: '업무로 돌아가기', exact: true })).toBeVisible();

  state.authority.revoke('approvals.work');
  await broadcastProductSurfaceRevision(page, state.authority.revision());
  await expect(page.getByRole('button', { name: '업무로 돌아가기', exact: true })).toHaveCount(0);
});

test('409 이후에도 오염된 보완 요청 복귀 target은 사용할 수 없다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const state = await prepareApprovalRequestHandoff(page);
  let attempts = 0;
  await page.route(
    `**/api/approvals/v1/requests/${state.request.requestId}/information-response`,
    (route) => {
      attempts += 1;
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ERROR',
          message: 'The request changed.',
          errorCode: 'RESOURCE_CONFLICT',
        }),
      });
    }
  );
  const query = new URLSearchParams({
    request: state.request.requestId,
    returnTo: 'https://evil.test/work',
  });

  await page.goto(`/approvals/requests/needs-info?${query.toString()}`);
  await expect(page.getByRole('button', { name: '업무로 돌아가기', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '보완 답변' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('textbox', { name: '보완 답변' })
    .fill('충돌 검증을 위한 충분한 길이의 보완 답변입니다.');
  await dialog.getByRole('button', { name: '답변 제출' }).click();

  await expect.poll(() => attempts).toBe(1);
  await expect(
    page.getByText('요청을 처리하지 못했습니다. 최신 상태를 확인한 뒤 다시 시도하세요.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '업무로 돌아가기', exact: true })).toHaveCount(0);
  expect(new URL(page.url()).origin).not.toBe('https://evil.test');
});
