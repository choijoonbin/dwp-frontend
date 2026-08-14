import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

const APPROVAL_MEMBER_PERMISSIONS = [
  {
    resourceType: 'APP',
    resourceKey: 'APP.APPROVALS',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  ...[
    ['ACTION.APPROVAL_TASK', 'VIEW'],
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

const HOME_FIXTURE = {
  generatedAt: '2026-08-14T02:30:00Z',
  metrics: {
    pending: 4,
    dueToday: 3,
    overdue: 1,
    needsInformation: 1,
    myRequestsInFlight: 2,
    averageCycleHours: 5.4,
    slaCompliancePercent: 96,
  },
  focusQueue: [
    {
      taskId: 'approval-task-1',
      requestId: 'approval-request-1',
      requestNumber: 'APR-20260814-001',
      title: '고객 분석 환경 접근 연장',
      summary: '보안 정책 만료 전 접근 권한을 재검토합니다.',
      workflowNameKo: '시스템 접근 예외',
      workflowNameEn: 'Access exception',
      stepKey: 'SECURITY_REVIEW',
      stepName: '보안 검토',
      stepSequence: 1,
      requesterName: '김태현',
      requesterOrgName: 'AI Platform팀',
      status: 'PENDING',
      priority: 'URGENT',
      dataClassification: 'CONFIDENTIAL',
      riskScore: 91,
      submittedAt: '2026-08-14T00:30:00Z',
      dueAt: '2026-08-14T03:30:00Z',
      version: 0,
    },
    {
      taskId: 'approval-task-2',
      requestId: 'approval-request-2',
      requestNumber: 'APR-20260814-002',
      title: '신규 협력사 보안 예외',
      summary: '협력사 온보딩 전에 보안 통제를 검토합니다.',
      workflowNameKo: '협력사 등록',
      workflowNameEn: 'Supplier onboarding',
      stepKey: 'SECURITY_REVIEW',
      stepName: '보안 검토',
      stepSequence: 2,
      requesterName: '박지호',
      requesterOrgName: '구매혁신팀',
      status: 'PENDING',
      priority: 'HIGH',
      dataClassification: 'INTERNAL',
      riskScore: 72,
      submittedAt: '2026-08-13T08:00:00Z',
      dueAt: '2026-08-14T07:00:00Z',
      version: 0,
    },
  ],
  recentRequests: [
    {
      requestId: 'approval-request-3',
      requestNumber: 'APR-20260813-003',
      title: 'GPU 증설 투자 검토',
      summary: 'AI 개발 환경의 GPU 증설 예산을 검토합니다.',
      workflowNameKo: '구매·비용 승인',
      workflowNameEn: 'Capital expenditure',
      currentStepKey: 'PROCUREMENT_REVIEW',
      currentStepName: '구매 조건 검토',
      currentStepSequence: 2,
      totalSteps: 3,
      status: 'IN_REVIEW',
      priority: 'HIGH',
      dataClassification: 'CONFIDENTIAL',
      latestInformationRequest: null,
      submittedAt: '2026-08-13T05:00:00Z',
      dueAt: '2026-08-15T05:00:00Z',
      completedAt: null,
      version: 2,
    },
  ],
  flow: [
    { stage: 'IN_REVIEW', count: 7, atRisk: 2 },
    { stage: 'NEEDS_INFO', count: 1, atRisk: 1 },
    { stage: 'APPROVED', count: 12, atRisk: 0 },
  ],
  insights: [
    {
      key: 'overdue',
      tone: 'RISK',
      titleKo: '기한을 넘긴 결정이 있습니다',
      titleEn: 'A decision is overdue',
      detailKo: '위험도가 높은 항목을 먼저 검토하세요.',
      detailEn: 'Review the highest-risk item first.',
      route: '/approvals/inbox',
    },
  ],
  administrator: false,
  adminPulse: null,
};

function fulfillSuccess(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

async function mockApprovalHome(page: Page) {
  await page.route('**/api/approvals/v1/home', (route) => fulfillSuccess(route, HOME_FIXTURE));
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
  await mockApprovalHome(page);

  await page.goto('/approvals/home');

  await expect(page.getByRole('heading', { name: '전자결재', level: 1 })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '이서연님의 결정이 기다리고 있습니다' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: '우선 결재함' })).toBeVisible();
  await expect(page.getByText('고객 분석 환경 접근 연장')).toBeVisible();
  await expect(page.getByRole('link', { name: '프로세스 설계' })).toHaveCount(0);

  const geometry = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.viewportWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
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
    visible: ['프로세스 설계', '양식 관리'],
    hidden: ['운영 개요', '결재 정책', 'SLA 및 전달 운영', '전자서명 연계'],
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
    visible: ['프로세스 설계', '양식 관리', '결재 정책'],
    hidden: ['운영 개요', 'SLA 및 전달 운영', '전자서명 연계'],
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
    hidden: ['프로세스 설계', '양식 관리', '결재 정책', '전자서명 연계'],
    forbiddenPath: '/approvals/admin/workflows',
  },
] as const;

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
    await mockApprovalHome(page);

    await page.goto('/approvals/home');
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
