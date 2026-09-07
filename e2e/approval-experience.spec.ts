import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import {
  APPROVAL_HOME_FIXTURE,
  APPROVAL_MEMBER_PERMISSIONS,
} from './support/approval-command-center-fixtures';
import {
  APPROVAL_POLICIES_FIXTURE,
  APPROVAL_REQUEST_DETAIL_FIXTURE,
  APPROVAL_REQUEST_FIXTURE,
  APPROVAL_TASK_DETAIL_FIXTURE,
} from './support/product-area-fixtures';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';

async function mockLegacyApprovalSurface(page: Page) {
  // This suite protects the rollout-off compatibility experience. Governed
  // 111 authority and mutation preconditions are exercised by the Pilot and
  // HIGH command suites, while 000 must keep the established product pages.
  // Register after mockShellSession so this exact authority route wins over
  // the shell fixture's final API fallback.
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

async function mockApprovalHome(page: Page) {
  await page.route('**/api/approvals/v1/home', (route) =>
    fulfillSuccess(route, APPROVAL_HOME_FIXTURE)
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/tasks' && url.searchParams.get('view') === 'INBOX',
    (route) => fulfillSuccess(route, APPROVAL_HOME_FIXTURE.focusQueue)
  );
  await page.route(
    (url) => /^\/api\/approvals\/v1\/tasks\/approval-task-[12]$/u.test(url.pathname),
    (route) => {
      const taskId = route.request().url().split('/').at(-1);
      const task = APPROVAL_HOME_FIXTURE.focusQueue.find(
        (candidate) => candidate.taskId === taskId
      );
      if (!task) return route.abort();
      return fulfillSuccess(route, {
        ...APPROVAL_TASK_DETAIL_FIXTURE,
        task,
        timeline: [
          {
            ...APPROVAL_TASK_DETAIL_FIXTURE.timeline[0],
            stepName: task.stepSequence === 2 ? '팀장 검토' : undefined,
            stepSequence: task.stepSequence === 2 ? 1 : undefined,
          },
        ],
        canDecide: task.taskId === 'approval-task-1',
      });
    }
  );
  await page.route('**/api/platform/v1/home-preferences/surfaces/approval-home', (route) =>
    fulfillSuccess(route, {
      schemaVersion: 2,
      surfaceKey: 'approval-home',
      customized: false,
      layout: {
        appLayout: null,
        presentation: 'balanced',
        widgets: [
          { widgetKey: 'decision-pulse', visible: true, size: 'full' },
          { widgetKey: 'focus-queue', visible: true, size: 'large' },
          { widgetKey: 'flow', visible: true, size: 'medium' },
          { widgetKey: 'my-requests', visible: true, size: 'medium' },
          { widgetKey: 'insights', visible: true, size: 'medium' },
          { widgetKey: 'admin-health', visible: false, size: 'full' },
        ],
      },
      version: 0,
      updatedAt: null,
    })
  );
}

async function openApprovalNavigation(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) >= 900) return;
  await page.getByRole('button', { name: '전자결재 메뉴 열기' }).click();
}

test('전자결재 홈은 사용자에게 우선 판단과 개인 결재 흐름을 반응형으로 제공한다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '이서연',
    jobTitle: 'Executive Strategy Officer',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  await mockApprovalHome(page);

  await page.goto('/approvals/home');

  await expect(page.getByRole('heading', { name: '안녕하세요, 이서연님', level: 1 })).toBeVisible();
  await expect(page.getByTestId('approval-daily-briefing')).toContainText(
    '오늘의 결재 워크플로 브리핑'
  );
  await expect(page.getByRole('heading', { name: '우선 심의 큐' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '의사결정 내비게이터' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '내 기안 진행 추적' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '실시간 결재 흐름' })).toBeVisible();
  await expect(page.getByRole('button', { name: '우선 결재 검토' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '전자결재 업무 센터' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '결재 큐 필터' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '프로세스 설계' })).toHaveCount(0);

  const geometry = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.viewportWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('전자결재 홈은 320px와 200% 글자 확대에서도 업무 내용을 잃지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '이서연',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  await mockApprovalHome(page);

  await page.goto('/approvals/home');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  await expect(page.getByRole('heading', { name: '안녕하세요, 이서연님', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '우선 심의 큐' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '의사결정 내비게이터' })).toBeVisible();

  const geometry = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.viewportWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('홈 기안 추적은 마지막 검토를 완료로 표시하지 않고 해당 상세를 열고 닫는다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  await mockApprovalHome(page);
  const request = { ...APPROVAL_HOME_FIXTURE.recentRequests[0], currentStepSequence: 3 };
  await page.route('**/api/approvals/v1/home', (route) =>
    fulfillSuccess(route, { ...APPROVAL_HOME_FIXTURE, recentRequests: [request] })
  );
  await page.route('**/api/approvals/v1/requests?view=SUBMITTED', (route) =>
    fulfillSuccess(route, [request])
  );
  await page.route(`**/api/approvals/v1/requests/${request.requestId}/detail`, (route) =>
    fulfillSuccess(route, { ...APPROVAL_REQUEST_DETAIL_FIXTURE, request })
  );

  await page.goto('/approvals/home');
  const requestRow = page.getByRole('button', { name: new RegExp(request.title, 'u') });
  await expect(requestRow.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '66');
  await requestRow.click();
  await expect(page).toHaveURL(new RegExp(`request=${request.requestId}`, 'u'));
  const detail = page.getByRole('dialog', { name: request.title });
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page).toHaveURL(/\/approvals\/requests\/submitted$/u);
  await expect(detail).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(request.title, { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('결재함 하위 메뉴는 사이드바에서 큐를 전환하고 우측 목록을 갱신한다', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '이서연',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  await mockApprovalHome(page);

  await page.goto('/approvals/inbox');
  await openApprovalNavigation(page);

  const queueNavigation = page.getByRole('navigation', { name: '결재 큐 필터' });
  await expect(queueNavigation).toBeVisible();
  await expect(queueNavigation.getByRole('button')).toHaveCount(4);
  await queueNavigation.getByRole('button', { name: /^긴급 결재/u }).click();

  await expect(page).toHaveURL(/\/approvals\/inbox\?queue=URGENT/u);
  const taskList = page.getByLabel('검토 대기 결재 목록');
  await expect(taskList.getByText('고객 분석 환경 접근 연장')).toBeVisible();
  await expect(page.getByText('신규 협력사 보안 예외')).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 1280) < 900) {
    await taskList.getByRole('button').filter({ hasText: '고객 분석 환경 접근 연장' }).click();
  }
  await expect(page.getByRole('heading', { name: '정책 및 위험 브리프' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('모바일 결재함은 목록과 상세을 전환하고 원래 결재 행으로 포커스를 복원한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '이서연',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  await mockApprovalHome(page);

  await page.goto('/approvals/inbox');
  const taskButton = page.getByRole('button', { name: /고객 분석 환경 접근 연장/u });
  await taskButton.click();

  await expect(page.getByRole('heading', { name: '고객 분석 환경 접근 연장' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '정책 및 위험 브리프' })).toBeVisible();
  await expect(page.getByRole('button', { name: '결재 목록으로 돌아가기' })).toBeVisible();
  await expect(page.getByLabel('검토 대기 결재 목록')).not.toBeVisible();

  await page.getByRole('button', { name: '결재 목록으로 돌아가기' }).click();
  await expect(page.getByLabel('검토 대기 결재 목록')).toBeVisible();
  await expect(taskButton).toBeFocused();

  const geometry = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.viewportWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('배치 승인은 각 결재를 다시 확인하고 처리 불가 항목을 건너뛴다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  await mockApprovalHome(page);
  const decisions: Array<Record<string, unknown>> = [];
  await page.route('**/api/approvals/v1/tasks/approval-task-1/decisions', async (route) => {
    decisions.push(route.request().postDataJSON() as Record<string, unknown>);
    return fulfillSuccess(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      task: { ...APPROVAL_HOME_FIXTURE.focusQueue[0], status: 'APPROVED', version: 1 },
      canDecide: false,
    });
  });

  await page.goto('/approvals/inbox');
  await page.getByLabel('고객 분석 환경 접근 연장 배치 승인 선택').check();
  await page.getByLabel('신규 협력사 보안 예외 배치 승인 선택').check();
  await page.getByRole('button', { name: '선택 항목 승인' }).click();
  await expect(page.getByRole('dialog')).toContainText('선택한 2건을 각각 다시 검증');
  await page.getByRole('dialog').getByRole('button', { name: '배치 승인 시작' }).click();

  await expect(
    page.getByRole('status').filter({ hasText: '승인 1건 · 처리 불가 1건 · 남음 0건' })
  ).toBeVisible();
  expect(decisions).toEqual([{ decision: 'APPROVE', expectedVersion: 0 }]);
});

test('결재함 단건 반려는 감사 사유와 최신 문서 버전을 함께 기록한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  await mockApprovalHome(page);
  const decisions: Array<Record<string, unknown>> = [];
  await page.route('**/api/approvals/v1/tasks/approval-task-1/decisions', async (route) => {
    decisions.push(route.request().postDataJSON() as Record<string, unknown>);
    return fulfillSuccess(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      task: { ...APPROVAL_HOME_FIXTURE.focusQueue[0], status: 'REJECTED', version: 1 },
      canDecide: false,
    });
  });

  await page.goto('/approvals/inbox?task=approval-task-1');
  await expect(page.getByRole('heading', { name: '고객 분석 환경 접근 연장' })).toBeVisible();
  await page.getByRole('button', { name: '반려' }).click();

  const dialog = page.getByRole('dialog', { name: '결재를 반려할까요?' });
  const submit = dialog.getByRole('button', { name: '반려 확정' });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel('결정 사유').fill('필수 보안 통제 증적을 먼저 보완해 주세요.');
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect.poll(() => decisions.length).toBe(1);
  expect(decisions).toEqual([
    {
      decision: 'REJECT',
      comment: '필수 보안 통제 증적을 먼저 보완해 주세요.',
      expectedVersion: 0,
    },
  ]);
});

test('홈 개인화 조회 실패는 기본 버전을 저장하지 않고 명시적 재시도로 복구한다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  await mockApprovalHome(page);
  let recovered = false;
  await page.route(
    (url) => url.pathname === '/api/platform/v1/home-preferences/surfaces/approval-home',
    (route) =>
      recovered ? route.fallback() : fulfillUnavailable(route, 'Preference authority unavailable')
  );

  await page.goto('/approvals/home');
  await expect(page.getByRole('heading', { name: /안녕하세요/u, level: 1 })).toBeVisible();
  const error = page
    .getByRole('alert')
    .filter({ hasText: '개인화 설정을 확인하지 못해 기본 구성을 표시합니다' });
  await expect(error).toBeVisible();
  await expect(page.getByRole('button', { name: '결재 홈 편집' })).toBeDisabled();

  recovered = true;
  await error.getByRole('button', { name: '다시 시도' }).click();
  await expect(error).toHaveCount(0);
  await expect(page.getByRole('button', { name: '결재 홈 편집' })).toBeEnabled();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('결재함 조회 실패는 0건으로 표시하지 않고 명시적 재시도로 복구한다', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  let recovered = false;
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/tasks' && url.searchParams.get('view') === 'INBOX',
    (route) =>
      recovered
        ? fulfillSuccess(route, [])
        : fulfillUnavailable(route, 'Approval task authority unavailable')
  );

  await page.goto('/approvals/inbox');
  const error = page.getByRole('alert').filter({ hasText: '결재 목록을 불러오지 못했습니다' });
  await expect(error).toBeVisible();
  await expect(page.getByText('처리할 결재가 없습니다')).toHaveCount(0);

  recovered = true;
  await error.getByRole('button', { name: '다시 시도' }).click();
  await expect(error).toHaveCount(0);
  await expect(page.getByText('처리할 결재가 없습니다')).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('결재 위임 응답의 방향이 누락되어도 권한을 열지 않고 행을 안전하게 표시한다', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/delegations',
    (route) =>
      fulfillSuccess(route, [
        {
          delegationId: 'partial-delegation',
          delegatorUserId: 1,
          delegateUserId: 2,
          delegateDisplayName: '김민준',
          scopeType: 'ALL',
          startsAt: '2026-08-17T00:00:00Z',
          endsAt: '2026-08-21T09:00:00Z',
          lifecycleState: 'ACTIVE',
          reason: '응답 계약 호환성 테스트',
          version: 1,
        },
      ])
  );

  await page.goto('/approvals/delegations');
  await expect(page.getByRole('heading', { name: '결재 위임', level: 1 })).toBeVisible();
  await expect(page.getByText('김민준')).toBeVisible();
  await expect(page.getByText('응답 계약 호환성 테스트')).toBeVisible();
  await expect(page.getByText('내가 위임', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '위임 철회' })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

const ADMIN_PERSONAS = [
  {
    name: '설계자',
    role: 'APPROVAL_DESIGNER',
    permissions: [
      ['ADMIN.APPROVAL_DESIGN', 'VIEW'],
      ['ADMIN.APPROVAL_DESIGN', 'CREATE'],
      ['ADMIN.APPROVAL_DESIGN', 'UPDATE'],
    ],
    visible: ['프로세스 설계', '양식 카탈로그'],
    hidden: ['운영 개요', '결재 정책', 'SLA 및 전달 운영', '전자서명 연계'],
    allowedPath: '/approvals/admin/workflows',
    forbiddenPath: '/approvals/admin/operations',
  },
  {
    name: '게시 책임자',
    role: 'APPROVAL_PUBLISHER',
    permissions: [
      ['ADMIN.APPROVAL_DESIGN', 'VIEW'],
      ['ADMIN.APPROVAL_DESIGN', 'APPROVE'],
      ['ADMIN.APPROVAL_POLICY', 'VIEW'],
      ['ADMIN.APPROVAL_POLICY', 'APPROVE'],
    ],
    visible: ['프로세스 설계', '양식 카탈로그', '결재 정책'],
    hidden: ['운영 개요', 'SLA 및 전달 운영', '전자서명 연계'],
    allowedPath: '/approvals/admin/workflows',
    forbiddenPath: '/approvals/admin/operations',
  },
  {
    name: '운영자',
    role: 'APPROVAL_OPERATOR',
    permissions: [
      ['ADMIN.APPROVAL_OPERATIONS', 'VIEW'],
      ['ADMIN.APPROVAL_OPERATIONS', 'UPDATE'],
    ],
    visible: ['운영 개요', 'SLA 및 전달 운영'],
    hidden: ['프로세스 설계', '양식 카탈로그', '결재 정책', '전자서명 연계'],
    allowedPath: '/approvals/admin/overview',
    forbiddenPath: '/approvals/admin/workflows',
  },
] as const;

test('정책 이력 조회 실패는 미게시 상태로 퇴화하지 않고 게시를 차단한 뒤 복구한다', async ({
  page,
}) => {
  const publisher = ADMIN_PERSONAS[1];
  await mockShellSession(page, ['WORKSPACE_MEMBER', publisher.role], {
    locale: 'ko',
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      ...publisher.permissions.map(([resourceKey, permissionCode]) => ({
        resourceType: 'ADMIN',
        resourceKey,
        permissionCode,
        effect: 'ALLOW' as const,
      })),
    ],
  });
  await mockLegacyApprovalSurface(page);
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/policies',
    (route) =>
      fulfillSuccess(route, [
        {
          ...APPROVAL_POLICIES_FIXTURE[0],
          pendingReview: true,
          pendingEnforcementMode: 'BLOCK',
          pendingSeverity: 'CRITICAL',
          pendingLifecycleState: 'ACTIVE',
          pendingRule: { requesterCannotApprove: true },
          pendingChangeReason: 'Independent review required',
          pendingBy: 31,
          pendingAt: '2026-08-31T00:00:00Z',
        },
      ])
  );
  let recovered = false;
  await page.route(
    (url) => /^\/api\/approvals\/v1\/admin\/policies\/[^/]+\/versions$/u.test(url.pathname),
    (route) =>
      recovered ? route.fallback() : fulfillUnavailable(route, 'Policy history unavailable')
  );

  await page.goto('/approvals/admin/policies');
  const error = page.getByRole('alert').filter({ hasText: '게시 이력을 확인하지 못했습니다' });
  await expect(error).toBeVisible();
  await expect(page.getByText('아직 게시 증적이 없습니다')).toHaveCount(0);
  await expect(page.getByText('버전 확인 실패')).toBeVisible();
  await expect(page.getByRole('button', { name: '검토 및 게시' })).toBeDisabled();

  recovered = true;
  await error.getByRole('button', { name: '다시 시도' }).click();
  await expect(error).toHaveCount(0);
  await expect(page.getByText('아직 게시 증적이 없습니다')).toBeVisible();
  await expect(page.getByText('버전 확인 실패')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '검토 및 게시' })).toBeEnabled();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('양식 설계자는 카테고리와 기본 결재선을 함께 관리하고 새 양식을 시작한다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_DESIGNER'], {
    locale: 'ko',
    displayName: '양식 설계자',
    jobTitle: 'Approval designer',
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      ...[
        ['ADMIN.APPROVAL_DESIGN', 'VIEW'],
        ['ADMIN.APPROVAL_DESIGN', 'CREATE'],
        ['ADMIN.APPROVAL_DESIGN', 'UPDATE'],
      ].map(([resourceKey, permissionCode]) => ({
        resourceType: 'ADMIN',
        resourceKey,
        permissionCode,
        effect: 'ALLOW' as const,
      })),
    ],
  });
  await mockLegacyApprovalSurface(page);

  await page.goto('/approvals/admin/forms');

  await expect(page.getByRole('heading', { name: '양식 카탈로그', level: 1 })).toBeVisible();
  await expect(page.getByText('업무 분류', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '데이터 접근 예외 신청서', level: 2 })
  ).toBeVisible();
  await expect(page.getByText('결재 단계 2개')).toBeVisible();
  await expect(page.getByText('SECURITY_APPROVER')).toBeVisible();

  await page
    .getByRole('button', { name: /접근·보안/u })
    .first()
    .click();
  await page.getByRole('button', { name: '접근·보안 카테고리 편집' }).click();
  await expect(page.getByRole('dialog')).toContainText('양식 카테고리 편집');
  await expect(page.getByLabel('운영 상태')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();

  await page.getByRole('button', { name: '양식 초안 만들기' }).click();
  await expect(page.getByRole('dialog')).toContainText('새 결재 양식');
  await expect(page.getByRole('dialog')).toContainText('기본 결재선');

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('기안자는 게시 양식을 선택하고 제출 전에 단계별 결재선을 확인한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '이서연',
    jobTitle: 'Executive Strategy Officer',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);

  await page.goto('/approvals/requests/new');
  await page.getByLabel('결재 양식').click();
  await page.getByRole('option', { name: /데이터 접근 예외 신청서/u }).click();

  await expect(page.getByRole('heading', { name: '결재 경로 안내' })).toBeVisible();
  await expect(page.getByRole('list', { name: '단계별 결재선' })).toContainText('Manager review');
  await expect(page.getByRole('list', { name: '단계별 결재선' })).toContainText(
    'SECURITY_APPROVER'
  );

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('게시 양식 목록 조회 실패는 빈 선택기로 퇴화하지 않고 재시도로 복구한다', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  let recovered = false;
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/catalog/forms',
    (route) =>
      recovered ? route.fallback() : fulfillUnavailable(route, 'Published forms unavailable')
  );

  await page.goto('/approvals/requests/new');
  const error = page
    .getByRole('alert')
    .filter({ hasText: '게시된 결재 양식 목록을 불러오지 못했습니다' });
  await expect(error).toBeVisible();
  await expect(page.getByLabel('결재 양식')).toBeDisabled();

  recovered = true;
  await error.getByRole('button', { name: '다시 시도' }).click();
  await expect(error).toHaveCount(0);
  await expect(page.getByLabel('결재 양식')).toBeEnabled();
  await page.getByLabel('결재 양식').click();
  await page.getByRole('option', { name: /데이터 접근 예외 신청서/u }).click();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('기안자는 필수 업무값이 비어 있어도 초안을 저장하고 상신은 할 수 없다', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  let draftBody: Record<string, unknown> | undefined;
  await page.route('**/api/approvals/v1/requests', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    draftBody = route.request().postDataJSON() as Record<string, unknown>;
    return fulfillSuccess(route, { ...APPROVAL_REQUEST_FIXTURE, status: 'DRAFT', version: 0 });
  });

  await page.goto('/approvals/requests/new');
  await page.getByLabel('결재 양식').click();
  await page.getByRole('option', { name: /데이터 접근 예외 신청서/u }).click();

  await expect(page.getByRole('button', { name: '임시 저장' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '결재 상신' })).toBeDisabled();
  await page.getByRole('button', { name: '임시 저장' }).click();

  await expect(page).toHaveURL(/\/approvals\/requests\/drafts$/u);
  expect(draftBody).toEqual(
    expect.objectContaining({
      title: '',
      summary: '',
      payload: expect.objectContaining({ summary: '' }),
    })
  );
});

test('AI 딥링크 대상 결재를 자동 선택하고 후보 업무를 명시적으로 가져온다', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  await page.route('**/api/approvals/v1/tasks/approval-task-001', (route) =>
    fulfillSuccess(route, { ...APPROVAL_TASK_DETAIL_FIXTURE, canClaim: true, canDecide: false })
  );
  let claimBody: Record<string, unknown> | undefined;
  await page.route('**/api/approvals/v1/tasks/approval-task-001/claim', (route) => {
    claimBody = route.request().postDataJSON() as Record<string, unknown>;
    return fulfillSuccess(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      task: { ...APPROVAL_TASK_DETAIL_FIXTURE.task, status: 'CLAIMED', version: 4 },
      canClaim: false,
      canDecide: true,
    });
  });

  await page.goto('/approvals/inbox?task=approval-task-001');

  await expect(page.getByRole('heading', { name: 'Customer data access exception' })).toBeVisible();
  await page.getByRole('button', { name: '내 업무로 가져오기' }).click();
  await expect(page.getByRole('button', { name: '내 업무로 가져오기' })).toHaveCount(0);
  expect(claimBody).toEqual({ expectedVersion: 3 });
});

test('내 처리 완료함은 실제 완료 결정 증적을 읽기 전용으로 제공한다', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  const completedTask = {
    ...APPROVAL_TASK_DETAIL_FIXTURE.task,
    status: 'APPROVED' as const,
    version: 4,
  };
  await page.route('**/api/approvals/v1/tasks?view=COMPLETED*', (route) =>
    fulfillSuccess(route, [completedTask])
  );
  await page.route('**/api/approvals/v1/tasks/approval-task-001', (route) =>
    fulfillSuccess(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      task: completedTask,
      timeline: APPROVAL_TASK_DETAIL_FIXTURE.timeline.map((event) => ({
        ...event,
        actorDisplayName: '박지호',
        stepName: '보안 검토',
        stepSequence: 2,
        delegated: false,
      })),
      canClaim: false,
      canDecide: false,
    })
  );

  await page.goto('/approvals/completed');

  await expect(page.getByRole('heading', { name: '내 처리 완료함', level: 1 })).toBeVisible();
  await expect(page.getByText('실제 결정자 증거를 기준으로 표시')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Customer data access exception' })).toBeVisible();
  await expect(page.getByText(/2단계 보안 검토 · 박지호/u)).toBeVisible();
  await expect(page.getByRole('button', { name: '승인' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '반려' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '보완 요청' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '내 업무로 가져오기' })).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('completed decision history is fully localized and read-only in English', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  const completedTask = {
    ...APPROVAL_TASK_DETAIL_FIXTURE.task,
    status: 'APPROVED' as const,
    version: 4,
  };
  await page.route('**/api/approvals/v1/tasks?view=COMPLETED*', (route) =>
    fulfillSuccess(route, [completedTask])
  );
  await page.route('**/api/approvals/v1/tasks/approval-task-001', (route) =>
    fulfillSuccess(route, {
      ...APPROVAL_TASK_DETAIL_FIXTURE,
      task: completedTask,
      timeline: APPROVAL_TASK_DETAIL_FIXTURE.timeline.map((event) => ({
        ...event,
        actorDisplayName: 'Jihun Park',
        stepName: 'Security review',
        stepSequence: 2,
        delegated: false,
      })),
      canClaim: false,
      canDecide: false,
    })
  );

  await page.goto('/approvals/completed');

  await expect(
    page.getByRole('heading', { name: 'My completed decisions', level: 1 })
  ).toBeVisible();
  await expect(page.getByText('Scoped by recorded decision actor')).toBeVisible();
  await expect(page.getByText(/Step 2 · Security review · Jihun Park/u)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('보완 요청자는 검토한 버전에 답변과 수정 필드를 함께 제출한다', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  const needsInformation = {
    ...APPROVAL_REQUEST_FIXTURE,
    status: 'NEEDS_INFO' as const,
    latestInformationRequest: '업무 사유와 만료일을 구체화해 주세요.',
  };
  await page.route('**/api/approvals/v1/requests?view=NEEDS_INFO', (route) =>
    fulfillSuccess(route, [needsInformation])
  );
  await page.route('**/api/approvals/v1/requests/approval-request-001/detail', (route) =>
    fulfillSuccess(route, {
      ...APPROVAL_REQUEST_DETAIL_FIXTURE,
      request: needsInformation,
    })
  );
  let responseBody: Record<string, unknown> | undefined;
  await page.route(
    '**/api/approvals/v1/requests/approval-request-001/information-response',
    (route) => {
      responseBody = route.request().postDataJSON() as Record<string, unknown>;
      return fulfillSuccess(route, { ...needsInformation, status: 'IN_REVIEW', version: 4 });
    }
  );

  await page.goto('/approvals/requests/needs-info?request=approval-request-001');
  await page.getByRole('button', { name: '보완 답변' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('textbox', { name: '보완 답변' })
    .fill('요청하신 업무 사유와 기간을 보완했습니다.');
  await dialog
    .getByLabel('업무 사유')
    .fill('Production investigation approved for the minimum required support window.');
  await expect(dialog.getByRole('group', { name: '만료일' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '답변 제출' })).toBeDisabled();
  await dialog.getByRole('combobox', { name: '위험 수준' }).click();
  await page.getByRole('option', { name: 'HIGH' }).click();
  await dialog.getByRole('button', { name: '답변 제출' }).click();

  expect(responseBody).toEqual(
    expect.objectContaining({
      expectedVersion: 3,
      message: '요청하신 업무 사유와 기간을 보완했습니다.',
      payload: expect.objectContaining({
        businessReason:
          'Production investigation approved for the minimum required support window.',
        riskLevel: 'HIGH',
      }),
    })
  );
});

test('결재 운영자는 격리된 통합 이벤트의 원인을 확인하고 감사 가능한 재처리를 실행한다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_OPERATOR'], {
    locale: 'ko',
    displayName: '결재 운영자',
    jobTitle: 'Approval operator',
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      ...[
        ['ADMIN.APPROVAL_OPERATIONS', 'VIEW'],
        ['ADMIN.APPROVAL_OPERATIONS', 'MANAGE'],
      ].map(([resourceKey, permissionCode]) => ({
        resourceType: 'ADMIN',
        resourceKey,
        permissionCode,
        effect: 'ALLOW' as const,
      })),
    ],
  });
  await mockLegacyApprovalSurface(page);
  let retryWire: { body: string | null; headers: Record<string, string> } | null = null;
  await page.route('**/api/approvals/v1/admin/operations/events/*/retry', async (route) => {
    retryWire = {
      body: route.request().postData(),
      headers: route.request().headers(),
    };
    await route.fallback();
  });

  await page.goto('/approvals/admin/operations');

  const deliveryRow = page.getByRole('row', { name: /approval\.request\.approved/u });
  await expect(deliveryRow).toContainText('실패');
  await expect(deliveryRow).toContainText('Downstream endpoint returned 503');
  await deliveryRow.getByRole('button', { name: '이벤트 다시 전달' }).click();
  await expect(deliveryRow).toContainText('대기');
  expect(retryWire?.body).toBeNull();
  expect(retryWire?.headers['content-type']).toBeUndefined();
  for (const header of [
    'x-dwp-expected-object-version',
    'x-dwp-expected-decision-revision',
    'x-dwp-step-up-challenge',
    'idempotency-key',
  ]) {
    expect(retryWire?.headers[header]).toBeUndefined();
  }
});

for (const persona of ADMIN_PERSONAS) {
  test(`전자결재 ${persona.name}는 자신의 관리 메뉴만 보고 금지 URL은 홈으로 복귀한다`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockShellSession(page, ['WORKSPACE_MEMBER', persona.role], {
      locale: 'ko',
      displayName: persona.name,
      jobTitle: persona.name,
      permissions: [
        ...APPROVAL_MEMBER_PERMISSIONS,
        ...persona.permissions.map(([resourceKey, permissionCode]) => ({
          resourceType: 'ADMIN',
          resourceKey,
          permissionCode,
          effect: 'ALLOW' as const,
        })),
      ],
    });
    await mockLegacyApprovalSurface(page);
    await mockApprovalHome(page);

    await page.goto('/approvals/home');
    await expect(page.getByRole('link', { name: '앱 관리: 전자결재', exact: true })).toBeVisible();
    for (const label of persona.visible) {
      await expect(page.getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }

    await page.goto(persona.allowedPath);
    await openApprovalNavigation(page);
    for (const label of persona.visible) {
      await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    for (const label of persona.hidden) {
      await expect(page.getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }

    await page.goto(persona.forbiddenPath);
    await expect(page).toHaveURL(/\/approvals\/home$/u);
  });
}
