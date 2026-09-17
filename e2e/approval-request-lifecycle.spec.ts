import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import {
  APPROVAL_FORM_DETAIL_FIXTURE,
  APPROVAL_REQUEST_DETAIL_FIXTURE,
  APPROVAL_REQUEST_FIXTURE,
  APPROVAL_WORKFLOW_DETAIL_FIXTURE,
  APPROVAL_WORKFLOW_FIXTURE,
} from './support/product-area-fixtures';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import { installApprovalInformationWireCapture } from './support/approval-information-wire-fixtures';
import { assertApprovalSubmissionBlocked } from './support/approval-request-submission';

async function mockLegacyApprovalSurface(page: Page) {
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

function fulfillRequests(route: Route, items: unknown[]) {
  return fulfillSuccess(route, {
    items,
    totalElements: items.length,
    totalPages: 1,
    page: 0,
    size: 20,
    hasNext: false,
    evaluatedAt: new Date().toISOString(),
  });
}

test('기안자는 게시 양식을 선택하고 제출 전에 단계별 결재선을 확인한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
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
  const serverSafeguards = page.getByTestId('approval-request-server-safeguards');
  await expect(serverSafeguards.locator('.lucide-circle-dashed')).toHaveCount(4);
  await expect(serverSafeguards.locator('.lucide-circle-check')).toHaveCount(0);

  const desktopGrid = await page.locator('form').evaluate((form) => {
    const [catalog, canvas, preflight] = Array.from(form.children).slice(0, 3);
    const boxes = [catalog, canvas, preflight].map((element) => element.getBoundingClientRect());
    return {
      tops: boxes.map((box) => Math.round(box.top)),
      viewportWidth: document.documentElement.clientWidth,
      contentWidth: document.documentElement.scrollWidth,
    };
  });
  expect(new Set(desktopGrid.tops).size).toBe(1);
  expect(desktopGrid.contentWidth).toBeLessThanOrEqual(desktopGrid.viewportWidth);

  await page.setViewportSize({ width: 1280, height: 900 });
  const compactGrid = await page.locator('form').evaluate((form) => {
    const [catalog, canvas, preflight] = Array.from(form.children).slice(0, 3);
    const boxes = [catalog, canvas, preflight].map((element) => element.getBoundingClientRect());
    return {
      catalogTop: Math.round(boxes[0].top),
      canvasTop: Math.round(boxes[1].top),
      preflightTop: Math.round(boxes[2].top),
      viewportWidth: document.documentElement.clientWidth,
      contentWidth: document.documentElement.scrollWidth,
    };
  });
  expect(compactGrid.catalogTop).toBe(compactGrid.canvasTop);
  expect(compactGrid.preflightTop).toBeGreaterThan(compactGrid.canvasTop);
  expect(compactGrid.contentWidth).toBeLessThanOrEqual(compactGrid.viewportWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('기안 작성은 320px와 200% 글자에서도 핵심 작업과 검증 근거를 잃지 않는다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '이서연',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);

  await page.goto('/approvals/requests/new');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });

  await expect(page.getByLabel('결재 양식')).toBeVisible();
  await expect(page.getByRole('button', { name: '임시 저장' })).toBeVisible();
  await expect(page.getByRole('button', { name: '검토', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '상신 전 통제' })).toBeVisible();

  const geometry = await page.getByRole('heading', { name: '새 결재 작성' }).evaluate((title) => ({
    titleWidth: title.getBoundingClientRect().width,
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.titleWidth).toBeGreaterThan(100);
  expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.viewportWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('기안자는 상신 전 검증을 확인한 뒤 초안 생성과 상신을 한 번씩만 전송한다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  const focusedForm = {
    ...APPROVAL_FORM_DETAIL_FIXTURE,
    schema: {
      ...APPROVAL_FORM_DETAIL_FIXTURE.schema,
      fields: [APPROVAL_FORM_DETAIL_FIXTURE.schema.fields[0]],
    },
  };
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/catalog/forms/approval-form-data-access/template',
    (route) =>
      fulfillSuccess(route, {
        workflow: APPROVAL_WORKFLOW_FIXTURE,
        routeDefinition: APPROVAL_WORKFLOW_DETAIL_FIXTURE.definition,
        form: focusedForm,
      })
  );
  const createBodies: Record<string, unknown>[] = [];
  const submitBodies: Record<string, unknown>[] = [];
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests',
    (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      createBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      return fulfillSuccess(route, {
        ...APPROVAL_REQUEST_FIXTURE,
        status: 'DRAFT',
        version: 4,
      });
    }
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/submit',
    (route) => {
      submitBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      return fulfillSuccess(route, {
        ...APPROVAL_REQUEST_FIXTURE,
        status: 'SUBMITTED',
        version: 5,
      });
    }
  );

  await page.goto('/approvals/requests/new');
  await page.getByLabel('결재 양식').click();
  await page.getByRole('option', { name: /데이터 접근 예외 신청서/u }).click();
  await page.getByLabel('제목').fill('최소 권한 데이터 접근 요청');
  await page
    .getByLabel('요청 내용')
    .fill('운영 장애 조사에 필요한 최소 범위 접근을 승인해 주세요.');
  await page
    .getByLabel('업무 사유')
    .fill('승인된 장애 조사 시간 동안 읽기 전용 진단 정보가 필요합니다.');

  await page.getByRole('button', { name: '검토', exact: true }).click();
  const preflight = page.getByRole('dialog', { name: '상신 전 통제' });
  await expect(preflight).toBeVisible();
  await expect(preflight.getByRole('list', { name: '단계별 결재선' })).toContainText(
    'SECURITY_APPROVER'
  );
  expect(createBodies).toHaveLength(0);
  expect(submitBodies).toHaveLength(0);

  await preflight.getByRole('button', { name: '결재 상신' }).click();
  await expect(page).toHaveURL(/\/approvals\/requests\/submitted$/u);
  expect(createBodies).toHaveLength(1);
  expect(createBodies[0]).toEqual(
    expect.objectContaining({
      workflowId: APPROVAL_WORKFLOW_FIXTURE.workflowId,
      formId: APPROVAL_FORM_DETAIL_FIXTURE.form.formId,
      title: '최소 권한 데이터 접근 요청',
      payload: expect.objectContaining({
        businessReason: '승인된 장애 조사 시간 동안 읽기 전용 진단 정보가 필요합니다.',
        createdFrom: 'DWP_APPROVALS',
      }),
    })
  );
  expect(submitBodies).toEqual([{ expectedVersion: 4 }]);
});

test('Draft 409는 작성 내용을 보존하고 최신 버전 확인 뒤에만 명시적으로 재적용한다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  let latestVersion = 3;
  let updateAttempts = 0;
  const updateBodies: Record<string, unknown>[] = [];
  const draftRequest = () => ({
    ...APPROVAL_REQUEST_FIXTURE,
    status: 'DRAFT' as const,
    version: latestVersion,
  });
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/detail',
    (route) =>
      fulfillSuccess(route, {
        ...APPROVAL_REQUEST_DETAIL_FIXTURE,
        request: draftRequest(),
      })
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/draft',
    (route) => {
      updateAttempts += 1;
      updateBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      if (updateAttempts === 1) {
        latestVersion = 4;
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ERROR',
            errorCode: 'VERSION_CONFLICT',
            message: 'Draft changed',
          }),
        });
      }
      latestVersion = 5;
      return fulfillSuccess(route, {
        ...APPROVAL_REQUEST_DETAIL_FIXTURE,
        request: draftRequest(),
        payload: updateBodies.at(-1)?.payload,
      });
    }
  );

  await page.goto('/approvals/requests/new?draft=approval-request-001');
  const summary = page.getByLabel('요청 내용');
  await expect(summary).toHaveValue(APPROVAL_REQUEST_FIXTURE.summary);
  const draftGeometry = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(draftGeometry.contentWidth).toBeLessThanOrEqual(draftGeometry.viewportWidth);
  await summary.fill('로컬에서 보존해야 하는 충돌 이후 수정 내용입니다.');
  await page.getByRole('button', { name: '임시 저장' }).click();

  const conflict = page.getByRole('alert').filter({ hasText: '다른 곳에서 초안이 변경되었습니다' });
  await expect(conflict).toBeVisible();
  await expect(summary).toHaveValue('로컬에서 보존해야 하는 충돌 이후 수정 내용입니다.');
  expect(updateAttempts).toBe(1);
  await assertApprovalSubmissionBlocked(page);

  await conflict.getByRole('button', { name: '새로고침' }).click();
  const reapply = conflict.getByRole('button', { name: '내 입력 다시 적용' });
  await expect(reapply).toBeVisible();
  expect(updateAttempts).toBe(1);
  await reapply.click();

  await expect(page.getByRole('status').filter({ hasText: '초안 저장 완료' })).toContainText('5');
  await expect(page).toHaveURL(/\/approvals\/requests\/new\?draft=approval-request-001$/u);
  expect(updateAttempts).toBe(2);
  expect(updateBodies[1]).toEqual(
    expect.objectContaining({
      expectedVersion: 4,
      summary: '로컬에서 보존해야 하는 충돌 이후 수정 내용입니다.',
    })
  );
});

test('회수 전 최신 조회의 첫 503은 쓰기를 차단하고 명시적 복구 후에만 전송한다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  let authorityUnavailable = true;
  let withdrawPosts = 0;
  await page.route(
    (url) =>
      url.pathname === '/api/approvals/v1/requests/search' &&
      url.searchParams.get('view') === 'SUBMITTED',
    (route) => fulfillRequests(route, [APPROVAL_REQUEST_FIXTURE])
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/detail',
    (route) =>
      authorityUnavailable
        ? fulfillUnavailable(route, 'Approval request authority unavailable')
        : fulfillSuccess(route, APPROVAL_REQUEST_DETAIL_FIXTURE)
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/withdraw',
    (route) => {
      withdrawPosts += 1;
      return fulfillSuccess(route, {
        ...APPROVAL_REQUEST_FIXTURE,
        status: 'WITHDRAWN',
        version: 4,
      });
    }
  );

  await page.goto('/approvals/requests/submitted');
  await page.getByRole('button', { name: '회수' }).first().click();
  const dialog = page.getByRole('dialog', { name: '결재를 회수할까요?' });
  const confirm = dialog.getByRole('button', { name: '회수 확정' });
  await confirm.click();
  const recovery = dialog.getByRole('alert').filter({ hasText: '요청을 처리하지 못했습니다' });
  await expect(recovery).toBeVisible();
  await expect(confirm).toBeDisabled();
  expect(withdrawPosts).toBe(0);

  authorityUnavailable = false;
  await recovery.getByRole('button', { name: '새로고침' }).click();
  await expect(recovery).toHaveCount(0);
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  expect(withdrawPosts).toBe(1);
});

test('내 기안 수명주기는 데스크톱 inspector와 모바일 drill-in을 같은 선택 상태로 유지한다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  await page.route(
    (url) =>
      url.pathname === '/api/approvals/v1/requests/search' &&
      url.searchParams.get('view') === 'SUBMITTED',
    (route) => fulfillRequests(route, [APPROVAL_REQUEST_FIXTURE])
  );
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/requests/approval-request-001/detail',
    (route) => fulfillSuccess(route, APPROVAL_REQUEST_DETAIL_FIXTURE)
  );

  await page.goto('/approvals/requests/submitted');
  const openDetails = page.getByRole('button', { name: '결재 상세 열기' }).first();
  if ((page.viewportSize()?.width ?? 1280) >= 1200) {
    await expect(
      page.getByRole('heading', { name: APPROVAL_REQUEST_FIXTURE.title, level: 2 })
    ).toBeVisible();
  } else {
    await openDetails.click();
    const detail = page.getByRole('dialog', { name: APPROVAL_REQUEST_FIXTURE.title });
    await expect(detail).toBeVisible();
    await detail.getByRole('button', { name: '닫기' }).click();
    await expect(detail).toHaveCount(0);
    await expect(openDetails).toBeFocused();
  }

  const geometry = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
});

test('위임 후보 부분 조회 실패는 기존 위임을 유지하고 신규 권한 생성을 차단한다', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: APPROVAL_MEMBER_PERMISSIONS,
  });
  await mockLegacyApprovalSurface(page);
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/delegations/candidates',
    (route) => fulfillUnavailable(route, 'Delegation candidates unavailable')
  );

  await page.goto('/approvals/delegations');
  await expect(page.getByRole('button', { name: /김민준/u }).first()).toBeVisible();
  await page.getByRole('button', { name: '위임 추가' }).click();
  const editor = page.getByRole('dialog', { name: '결재 위임 추가' });
  await editor.getByLabel('대행자').fill('김민');
  const candidateError = editor
    .getByRole('alert')
    .filter({ hasText: '위임 가능한 구성원을 확인하지 못했습니다' });
  await expect(candidateError).toBeVisible();
  await expect(editor.getByRole('button', { name: '저장' })).toBeDisabled();
  await expect(page.getByText('활성 위임이 없습니다')).toHaveCount(0);
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
  await assertApprovalSubmissionBlocked(page);
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
  const delegationRow = page.getByRole('button', { name: /김민준/u }).first();
  await expect(delegationRow).toBeVisible();
  const row = delegationRow.locator('xpath=ancestor::tr | ancestor::li');
  await expect(row).toContainText('응답 계약 호환성 테스트');
  await expect(row.getByText('내가 위임', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '위임 철회' })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('보완 요청자는 검토한 버전에 답변과 수정 필드를 함께 제출한다', async ({ page }) => {
  const wireCaptures = await installApprovalInformationWireCapture(page);
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
  await page.route('**/api/approvals/v1/requests/search?view=NEEDS_INFO*', (route) =>
    fulfillRequests(route, [needsInformation])
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
      const capture = wireCaptures.at(-1);
      expect(capture?.pathname).toBe(
        '/api/approvals/v1/requests/approval-request-001/information-response'
      );
      responseBody = capture!.body;
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

  await expect
    .poll(() => responseBody)
    .toEqual(
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
