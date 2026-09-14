import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { APPROVAL_MEMBER_PERMISSIONS } from './support/approval-command-center-fixtures';
import {
  APPROVAL_POLICIES_FIXTURE,
  APPROVAL_FORM_CATEGORY_FIXTURES,
  APPROVAL_FORM_FIXTURE,
  APPROVAL_FORM_DETAIL_FIXTURE,
  APPROVAL_WORKFLOW_FIXTURE,
  APPROVAL_WORKFLOW_DETAIL_FIXTURE,
} from './support/product-area-fixtures';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';

import { ADMIN_PERSONAS } from './support/approval-admin-personas';

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
  isMobile,
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

  await page.route('**/api/approvals/v1/admin/form-categories', (route) =>
    fulfillSuccess(route, [
      ...APPROVAL_FORM_CATEGORY_FIXTURES,
      {
        ...APPROVAL_FORM_CATEGORY_FIXTURES[0],
        categoryId: 'security-child',
        categoryKey: 'SECURITY_CHILD',
        parentCategoryId: APPROVAL_FORM_CATEGORY_FIXTURES[0].categoryId,
        nameKo: '보안 검토',
        nameEn: 'Security review',
        formCount: 0,
      },
    ])
  );

  await page.goto('/approvals/admin/forms');

  await expect(page.getByRole('heading', { name: '양식 카탈로그', level: 1 })).toBeVisible();
  if (isMobile)
    await page.getByRole('button').filter({ hasText: '데이터 접근 예외 신청서' }).click();
  if (!isMobile) await expect(page.getByText('업무 분류', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '데이터 접근 예외 신청서', level: 2 })
  ).toBeVisible();
  await expect(page.getByText('결재 단계 2개')).toBeVisible();
  await expect(page.getByText('SECURITY_APPROVER', { exact: true })).toBeVisible();

  if (isMobile) {
    await page.getByRole('button', { name: '양식 목록으로 돌아가기' }).click();
    await expect(
      page.getByRole('button').filter({ hasText: '데이터 접근 예외 신청서' })
    ).toBeFocused();
    await page.getByRole('button', { name: '업무 분류', exact: true }).click();
  }

  const category = page.getByRole('treeitem', { name: '접근·보안', exact: true });
  await expect(category).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: '접근·보안 접기' }).click();
  await expect(page.getByRole('treeitem', { name: '보안 검토' })).toHaveCount(0);
  await category.press('ArrowRight');
  await expect(page.getByRole('treeitem', { name: '보안 검토' })).toBeVisible();
  await category.press('ArrowDown');
  await expect(page.getByRole('treeitem', { name: '보안 검토' })).toBeFocused();
  await page.getByRole('treeitem', { name: '보안 검토' }).press('ArrowLeft');
  await expect(category).toBeFocused();

  await category.click();
  if (isMobile) await page.getByRole('button', { name: '업무 분류', exact: true }).click();
  await page.getByRole('button', { name: '접근·보안 카테고리 편집' }).click();
  await expect(page.getByRole('dialog')).toContainText('양식 카테고리 편집');
  await expect(page.getByRole('dialog').getByLabel('운영 상태')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();

  await page.getByRole('treeitem', { name: '접근·보안' }).first().click();
  await page
    .getByRole('textbox', { name: '양식명, 키, 소유 역할, 설명 검색' })
    .fill('SECURITY_APPROVER');
  await expect(
    page.getByRole('button').filter({ hasText: '데이터 접근 예외 신청서' })
  ).toBeVisible();

  await page.getByRole('button', { name: '양식 초안 만들기' }).click();
  await expect(page.getByRole('dialog')).toContainText('새 결재 양식');
  await expect(page.getByRole('dialog')).toContainText('기본 결재선');

  if (isMobile)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: '양식 미리보기', exact: true })
      .click();
  await page.getByRole('dialog').getByRole('button', { name: '모바일 미리보기' }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '모바일 미리보기' })
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('dialog').getByRole('button', { name: '영어 미리보기' }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '영어 미리보기' })
  ).toHaveAttribute('aria-pressed', 'true');

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('양식 참조 조회 실패는 성공한 카탈로그를 보존하고 복구 전 쓰기를 닫는다', async ({
  page,
  isMobile,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_DESIGNER'], {
    locale: 'ko',
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      ...['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.APPROVAL_DESIGN',
        permissionCode,
        effect: 'ALLOW' as const,
      })),
    ],
  });
  await mockLegacyApprovalSurface(page);
  let unavailable = true;
  await page.route(
    (url) =>
      url.pathname === '/api/approvals/v1/admin/workflows' &&
      url.searchParams.get('view') === 'reference',
    (route) =>
      unavailable
        ? route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'ERROR',
              errorCode: 'TEMPORARY_UNAVAILABLE',
              message: 'Reference temporarily unavailable',
            }),
          })
        : fulfillSuccess(route, [APPROVAL_WORKFLOW_FIXTURE])
  );
  await page.goto('/approvals/admin/forms');
  if (isMobile)
    await page.getByRole('button').filter({ hasText: '데이터 접근 예외 신청서' }).click();
  await expect(
    page.getByRole('heading', { name: '데이터 접근 예외 신청서', level: 2 })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '양식 초안 만들기' })).toHaveCount(0);
  if (isMobile) await page.getByRole('button', { name: '업무 분류', exact: true }).click();
  await expect(page.getByRole('treeitem', { name: '접근·보안' })).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).first().click();
  if (isMobile) await page.getByRole('button', { name: '양식 카탈로그', exact: true }).click();
  await expect(page.getByRole('button', { name: '양식 초안 만들기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '초안 양식 편집' })).toHaveCount(0);
});

test('프로세스 설계 툴팁은 어두운 모드의 실제 hover와 forced-colors에서도 읽을 수 있다', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_DESIGNER'], {
    locale: 'ko',
    appearance: { mode: 'dark', density: 'standard', highContrast: false, reduceMotion: true },
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.APPROVAL_DESIGN',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
    ],
  });
  await mockLegacyApprovalSurface(page);
  const workflow = { ...APPROVAL_WORKFLOW_FIXTURE, category: 'ACCESS', slaMinutes: 720 };
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/workflows',
    (route) => fulfillSuccess(route, [workflow])
  );
  await page.route(
    (url) => url.pathname === `/api/approvals/v1/admin/workflows/${workflow.workflowId}`,
    (route) => fulfillSuccess(route, { ...APPROVAL_WORKFLOW_DETAIL_FIXTURE, workflow })
  );
  await page.goto('/approvals/admin/workflows');
  const retry = page
    .getByRole('region', { name: '결재 경로', exact: true })
    .getByRole('button', { name: '다시 시도', exact: true });
  await expect(retry).toBeEnabled();
  await retry.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect.poll(() => tooltip.locator('.MuiTooltip-tooltip').count()).toBe(1);
  await expect
    .poll(() =>
      tooltip.locator('.MuiTooltip-tooltip').evaluate((node) => getComputedStyle(node).opacity)
    )
    .toBe('1');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath('workflow-tooltip-dark.png'),
  });
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(tooltip).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const kind of ['form', 'workflow'] as const) {
  test(`${kind} 편집 시작 버전이 바뀌면 이전 입력을 새 버전에 재결속하지 않는다`, async ({
    page,
    isMobile,
  }) => {
    await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_DESIGNER'], {
      locale: 'ko',
      permissions: [
        ...APPROVAL_MEMBER_PERMISSIONS,
        ...['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
          resourceType: 'ADMIN',
          resourceKey: 'ADMIN.APPROVAL_DESIGN',
          permissionCode,
          effect: 'ALLOW' as const,
        })),
      ],
    });
    await mockLegacyApprovalSurface(page);
    const original = kind === 'form' ? APPROVAL_FORM_FIXTURE : APPROVAL_WORKFLOW_FIXTURE;
    const id =
      kind === 'form' ? APPROVAL_FORM_FIXTURE.formId : APPROVAL_WORKFLOW_FIXTURE.workflowId;
    const collection = kind === 'form' ? 'forms' : 'workflows';
    let version = original.version;
    let nameKo: string = original.nameKo;
    let writes = 0;
    let savedBody: Record<string, unknown> | undefined;
    const record = () =>
      kind === 'form'
        ? { ...APPROVAL_FORM_FIXTURE, lifecycleState: 'DRAFT', version, nameKo }
        : {
            ...APPROVAL_WORKFLOW_FIXTURE,
            lifecycleState: 'DRAFT',
            category: 'ACCESS',
            slaMinutes: 720,
            version,
            nameKo,
          };
    const detailRecord = () =>
      kind === 'form'
        ? { ...APPROVAL_FORM_DETAIL_FIXTURE, form: record() }
        : { ...APPROVAL_WORKFLOW_DETAIL_FIXTURE, workflow: record() };
    await page.route(
      (url) => url.pathname === `/api/approvals/v1/admin/${collection}`,
      (route) => fulfillSuccess(route, [record()])
    );
    await page.route(
      (url) =>
        [
          `/api/approvals/v1/admin/${collection}/${id}`,
          `/api/approvals/v1/admin/${collection}/${id}/draft`,
        ].includes(url.pathname),
      (route) => {
        if (route.request().method() !== 'GET') {
          writes += 1;
          savedBody = route.request().postDataJSON() as Record<string, unknown>;
        }
        return fulfillSuccess(route, detailRecord());
      }
    );
    await page.goto(`/approvals/admin/${collection}`);
    if (kind === 'form' && isMobile)
      await page.getByRole('button').filter({ hasText: original.nameKo }).click();
    const editor =
      kind === 'form'
        ? page.getByRole('dialog', { name: '양식 초안 편집', exact: true })
        : page.getByRole('region', { name: '프로세스 초안 편집', exact: true });
    const openEditor = async () => {
      await page
        .getByRole('button', {
          name: kind === 'form' ? '양식 초안 편집' : '초안 편집',
          exact: true,
        })
        .click();
      await expect(editor).toBeVisible();
      if (kind === 'workflow') {
        if (isMobile)
          await editor.getByRole('button', { name: '프로세스·단계 상세', exact: true }).click();
        const nameInput = editor.getByRole('textbox', { name: '한국어 이름', exact: true });
        if (!(await nameInput.isVisible()))
          await editor.getByRole('button', { name: '기본 정보', exact: true }).click();
      }
    };
    await openEditor();
    await editor
      .getByRole('textbox', { name: '한국어 이름', exact: true })
      .fill('Preserved editor-start input');
    await expect(editor.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
    version += 1;
    nameKo = 'Latest independently updated definition';
    await editor.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(
      editor.getByText('다른 사용자가 먼저 변경했습니다. 최신 버전을 불러온 뒤 다시 시도하세요.')
    ).toBeVisible();
    await expect(editor.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
    await expect(editor.getByRole('textbox', { name: '한국어 이름', exact: true })).toHaveValue(
      'Preserved editor-start input'
    );
    expect(writes).toBe(0);
    await editor.getByRole('button', { name: '취소', exact: true }).click();
    await openEditor();
    await expect(editor.getByRole('textbox', { name: '한국어 이름', exact: true })).toHaveValue(
      nameKo
    );
    await editor
      .getByRole('textbox', { name: '한국어 이름', exact: true })
      .fill('Fresh version input');
    await expect(editor.locator('input:invalid, textarea:invalid, select:invalid')).toHaveCount(0);
    await editor.getByRole('button', { name: '저장', exact: true }).click();
    await expect.poll(() => writes).toBe(1);
    expect(savedBody).toMatchObject({ expectedVersion: version, nameKo: 'Fresh version input' });
  });
}

test('결재선 편집은 단계 복제를 제공하고 캐시 재조회 실패 동안 입력을 보존하며 저장을 닫는다', async ({
  page,
  isMobile,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'APPROVAL_DESIGNER'], {
    locale: 'ko',
    permissions: [
      ...APPROVAL_MEMBER_PERMISSIONS,
      ...['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.APPROVAL_DESIGN',
        permissionCode,
        effect: 'ALLOW' as const,
      })),
    ],
  });
  await mockLegacyApprovalSurface(page);
  const workflow = {
    ...APPROVAL_WORKFLOW_FIXTURE,
    category: 'ACCESS',
    slaMinutes: 720,
    lifecycleState: 'DRAFT',
  };
  let unavailable = false;
  let reads = 0;
  let writes = 0;
  let savedBody: Record<string, unknown> | undefined;
  await page.route(
    (url) => url.pathname === '/api/approvals/v1/admin/workflows',
    (route) => fulfillSuccess(route, [workflow])
  );
  await page.route(
    (url) =>
      [
        `/api/approvals/v1/admin/workflows/${workflow.workflowId}`,
        `/api/approvals/v1/admin/workflows/${workflow.workflowId}/draft`,
      ].includes(url.pathname),
    (route) => {
      if (route.request().method() !== 'GET') {
        writes += 1;
        savedBody = route.request().postDataJSON() as Record<string, unknown>;
        return fulfillSuccess(route, { ...APPROVAL_WORKFLOW_DETAIL_FIXTURE, workflow });
      }
      reads += 1;
      return unavailable
        ? route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'ERROR',
              errorCode: 'TEMPORARY_UNAVAILABLE',
              message: 'Temporary service interruption',
            }),
          })
        : fulfillSuccess(route, { ...APPROVAL_WORKFLOW_DETAIL_FIXTURE, workflow });
    }
  );
  await page.goto('/approvals/admin/workflows');
  await page.getByRole('button', { name: '초안 편집', exact: true }).click();
  const dialog = page.getByRole('region', { name: '프로세스 초안 편집', exact: true });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  if (isMobile)
    await dialog.getByRole('button', { name: '프로세스·단계 상세', exact: true }).click();
  await dialog.getByRole('button', { name: '기본 정보', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  if (isMobile) await dialog.getByRole('button', { name: '결재 경로', exact: true }).click();
  await dialog.getByRole('button', { name: '단계 복제', exact: true }).click();
  if (isMobile)
    await dialog.getByRole('button', { name: '프로세스·단계 상세', exact: true }).click();
  await expect(dialog.getByLabel('단계 키')).toHaveValue('MANAGER_REVIEW_COPY_1');
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await dialog.getByLabel('전체 SLA(분)', { exact: true }).fill('960');
  await dialog.getByLabel('단계 이름', { exact: true }).fill('Preserved review input');
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  unavailable = true;
  const initialReads = reads;
  await dialog.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect.poll(() => reads).toBeGreaterThan(initialReads);
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('단계 이름', { exact: true })).toHaveValue(
    'Preserved review input'
  );
  expect(writes).toBe(0);
  unavailable = false;
  await dialog.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  await expect(dialog.getByLabel('단계 이름', { exact: true })).toHaveValue(
    'Preserved review input'
  );
  expect(writes).toBe(0);
  if (isMobile) {
    await dialog.getByLabel('단계 이름', { exact: true }).focus();
    await expect(dialog.getByLabel('단계 이름', { exact: true })).toBeFocused();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  } else {
    await dialog.getByRole('button', { name: '다시 시도', exact: true }).hover();
    await expect(page.getByRole('tooltip', { name: '다시 시도', exact: true })).toBeVisible();
    const tooltipBubble = page.locator('.MuiTooltip-tooltip');
    await expect(tooltipBubble).toHaveCount(1);
    await expect
      .poll(() => tooltipBubble.evaluate((node) => getComputedStyle(node).opacity))
      .toBe('1');
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath('workflow-inline-inspector.png'),
    fullPage: true,
  });
  if (isMobile) {
    await dialog.getByRole('button', { name: '결재선으로 돌아가기', exact: true }).click();
    await expect(dialog.locator('[data-approval-stage="1"]')).toBeFocused();
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: test.info().outputPath('workflow-inline-320-text200.png'),
      fullPage: true,
    });
  }
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  expect(savedBody).toMatchObject({ expectedVersion: workflow.version, slaMinutes: 960 });
  expect(savedBody?.steps).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: 'MANAGER_REVIEW_COPY_1',
        name: 'Preserved review input',
        mode: 'ANY',
      }),
    ])
  );
});
