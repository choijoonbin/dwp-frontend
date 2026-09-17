import { expect, test, type Page } from '@playwright/test';

import {
  mockNotificationAdminGovernance,
  NOTIFICATION_GOVERNANCE_PERMISSIONS,
} from './support/notification-admin-governance-fixtures';
import {
  mockNotificationOperationsAndSuppressions,
  NOTIFICATION_OPERATIONS_PERMISSIONS,
} from './support/notification-design-completion-fixtures';
import {
  expectNoHorizontalOverflow,
  mockNotificationAttentionR2,
  mockNotificationCenter,
  mockNotificationNoiseQuality,
  mockNotificationPreferences,
  notification,
} from './support/notification-fixtures';
import { mockShellSession } from './support/shell-session';

const FIXED_NOW = new Date('2026-09-16T06:00:00.000Z');

const visualNotifications = [
  {
    ...notification,
    notificationId: 'visual-approval',
    receivedAt: '2026-09-16T04:55:00Z',
    lastActivityAt: '2026-09-16T04:55:00Z',
    dueAt: '2026-09-16T08:00:00Z',
    readAt: null,
  },
  {
    ...notification,
    notificationId: 'visual-security',
    threadKey: 'service:vpn-renewal-8',
    source: {
      appKey: 'services',
      appName: 'IT 서비스',
      iconKey: 'shield',
      accent: '#246BFD',
    },
    typeKey: 'SERVICE.SECURITY_REVIEW',
    title: '원격접속 VPN 갱신 신청에 대한 추가 사유 확인 필요',
    preview: '외부 네트워크 접근 권한 연장을 위해 신청 사유 보완이 요청되었습니다.',
    actorLabel: '인프라운영팀',
    priority: 'HIGH',
    reason: { kind: 'ROLE', label: '담당 역할' },
    receivedAt: '2026-09-16T04:20:00Z',
    lastActivityAt: '2026-09-16T04:20:00Z',
    dueAt: '2026-09-16T09:00:00Z',
    readAt: null,
    actions: [
      {
        actionKey: 'review-security',
        label: '보완 작성하기',
        href: '/services/my',
        enabled: true,
        disabledReason: null,
        primary: true,
      },
    ],
  },
  {
    ...notification,
    notificationId: 'visual-messaging',
    threadKey: 'messaging:design-systems',
    threadCount: 4,
    source: {
      appKey: 'messaging',
      appName: 'Space 메신저',
      iconKey: 'message',
      accent: '#138A72',
    },
    typeKey: 'MESSAGING.MENTION',
    title: '분기 운영 보고서 배포 일정 확인 요청',
    preview:
      '@최준빈 분기 운영 보고서 배포 일정 확인 부탁드립니다. 이번 배포 파이프라인에 디자인 승인 단계가 포함되어야 합니다.',
    actorLabel: '이서윤',
    priority: 'NORMAL',
    reason: { kind: 'MENTION', label: '나를 멘션함' },
    receivedAt: '2026-09-16T04:05:00Z',
    lastActivityAt: '2026-09-16T04:05:00Z',
    dueAt: null,
    readAt: null,
    actionable: false,
    actions: [
      {
        actionKey: 'open-space',
        label: 'Space 열기',
        href: '/messaging',
        enabled: true,
        disabledReason: null,
        primary: true,
      },
    ],
  },
  {
    ...notification,
    notificationId: 'visual-hr',
    threadKey: 'hr:security-guide-2026',
    source: {
      appKey: 'hr',
      appName: 'HR People',
      iconKey: 'people',
      accent: '#6B5CE7',
    },
    typeKey: 'HR.POLICY_UPDATE',
    title: '사내 정보 보안 가이드 2026 개정 안내',
    preview: '클라우드 데이터 처리 절차와 비밀번호 정책이 개정되었습니다.',
    actorLabel: '조직 정책',
    priority: 'LOW',
    reason: { kind: 'SUBSCRIPTION', label: '구독 중' },
    receivedAt: '2026-09-16T03:30:00Z',
    lastActivityAt: '2026-09-16T03:30:00Z',
    dueAt: null,
    readAt: '2026-09-16T03:40:00Z',
    actionable: false,
    actions: [],
  },
  {
    ...notification,
    notificationId: 'visual-calendar',
    threadKey: 'calendar:seminar-12',
    source: {
      appKey: 'calendar',
      appName: '캘린더',
      iconKey: 'calendar',
      accent: '#008A73',
    },
    typeKey: 'CALENDAR.EVENT_ACCEPTED',
    title: '외부 교육 참가 신청서 최종 승인됨',
    preview: '신청자 본인과 워크플로우 승인 완료 및 교육비 청구 프로세스가 시작됩니다.',
    actorLabel: '전자결재',
    priority: 'NORMAL',
    reason: { kind: 'DIRECT', label: '신청 결과' },
    receivedAt: '2026-09-16T02:15:00Z',
    lastActivityAt: '2026-09-16T02:15:00Z',
    dueAt: null,
    readAt: null,
    actionable: false,
    actions: [],
  },
] as const;

const byApp = [
  {
    appKey: 'messaging',
    totalUnread: 1,
    actionableUnread: 0,
    urgentUnread: 0,
    lastActivityAt: '2026-09-16T04:05:00Z',
  },
  {
    appKey: 'approvals',
    totalUnread: 1,
    actionableUnread: 1,
    urgentUnread: 1,
    lastActivityAt: '2026-09-16T04:55:00Z',
  },
  {
    appKey: 'services',
    totalUnread: 1,
    actionableUnread: 1,
    urgentUnread: 0,
    lastActivityAt: '2026-09-16T04:20:00Z',
  },
  {
    appKey: 'hr',
    totalUnread: 0,
    actionableUnread: 0,
    urgentUnread: 0,
    lastActivityAt: '2026-09-16T03:30:00Z',
  },
] as const;

async function installVisualFixture(page: Page) {
  await page.clock.setFixedTime(FIXED_NOW);
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
    locale: 'ko',
    permissions: [...NOTIFICATION_GOVERNANCE_PERMISSIONS, ...NOTIFICATION_OPERATIONS_PERMISSIONS],
  });
  await mockNotificationCenter(page, {
    actionableUnread: 2,
    totalUnread: 4,
    viewCounts: { PRIORITY: 2, ALL: 5, MENTIONS: 1, SAVED: 1, SNOOZED: 1, DONE: 2 },
    inboxItems: () => [...visualNotifications],
    byAppItems: () => [...byApp],
    detailItem: () => visualNotifications[0],
    profilePreviewMode: 'FULL',
  });
  await mockNotificationPreferences(page);
  await mockNotificationAttentionR2(page);
  await mockNotificationNoiseQuality(page);
  await mockNotificationAdminGovernance(page);
  await mockNotificationOperationsAndSuppressions(page);
}

async function readyForVisual(page: Page) {
  const frame = page.getByTestId('notification-page-frame');
  await expect(frame).toBeVisible({ timeout: 15_000 });
  // Drawers and dialogs correctly hide the page from the accessibility tree.
  // DOM locators still let the shared readiness check cover those visual states.
  await expect(frame.locator('h1').first()).toBeAttached({ timeout: 15_000 });
  await expect(frame.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(async () => document.fonts.ready);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await expectNoHorizontalOverflow(page);
}

async function expectVisual(page: Page, name: string) {
  await readyForVisual(page);
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.005,
  });
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'This suite owns its explicit viewport matrix.');
  await installVisualFixture(page);
});

test('home keeps the approved actionable desktop composition', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/notifications/home');
  await expectVisual(page, 'notification-home-1440.png');
});

test('home keeps the approved mobile reflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications/home');
  await expectVisual(page, 'notification-home-390.png');
});

test('center keeps the approved desktop list and inspector', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/notifications/center?view=all');
  await expectVisual(page, 'notification-center-1440.png');
});

test('center keeps the approved mobile triage surface', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications/center?view=all');
  await expectVisual(page, 'notification-center-390.png');
});

test('center keeps the approved desktop detail state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/notifications/center/visual-approval?view=all');
  await expectVisual(page, 'notification-detail-1440.png');
});

test('center keeps the approved mobile detail state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications/center/visual-approval?view=all');
  await expectVisual(page, 'notification-detail-390.png');
});

test('center keeps the approved mobile filter sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications/center?view=all');
  await page.getByRole('button', { name: '상세 필터', exact: true }).click();
  await expect(page.getByRole('presentation')).toBeVisible();
  await expectVisual(page, 'notification-filter-sheet-390.png');
});

test('settings keep the approved desktop channel matrix', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/notifications/settings');
  await expectVisual(page, 'notification-settings-channels-1440.png');
});

test('settings keep the approved mobile app rules', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications/settings');
  await page
    .getByRole('navigation', { name: '알림 설정 바로가기' })
    .getByRole('button', { name: '앱별 알림' })
    .click();
  await expectVisual(page, 'notification-settings-apps-390.png');
});

test('settings keep the approved attention rules workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/notifications/settings');
  await page
    .getByRole('navigation', { name: '알림 설정 바로가기' })
    .getByRole('button', { name: '수신 집중 규칙' })
    .click();
  await expectVisual(page, 'notification-settings-attention-1440.png');
});

for (const state of [
  { route: '/notifications/admin/overview', name: 'overview' },
  { route: '/notifications/admin/contracts', name: 'contracts' },
  { route: '/notifications/admin/policies', name: 'policies' },
  { route: '/notifications/admin/templates', name: 'templates' },
  { route: '/notifications/admin/operations', name: 'operations' },
  { route: '/notifications/admin/suppressions', name: 'suppressions' },
] as const) {
  test(`admin ${state.name} keeps the approved desktop workspace`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(state.route);
    await expectVisual(page, `notification-admin-${state.name}-1440.png`);
  });
}

test('admin overview keeps the approved mobile operating board', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications/admin/overview');
  await expectVisual(page, 'notification-admin-overview-390.png');
});
