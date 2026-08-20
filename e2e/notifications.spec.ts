import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

const NOTIFICATION_PERMISSION = [
  {
    resourceType: 'APP',
    resourceKey: 'APP.NOTIFICATIONS',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
];

const notification = {
  notificationId: 'notification-e2e-1',
  threadKey: 'approval:budget-42',
  threadCount: 1,
  source: {
    appKey: 'APPROVALS',
    appName: 'Approvals',
    iconKey: 'approval',
    accent: '#2457D6',
  },
  typeKey: 'APPROVAL.ACTION_REQUIRED',
  title: '클라우드 운영 예산 승인이 필요합니다',
  preview: '김민서님이 오늘 안으로 검토를 요청했습니다.',
  actorLabel: '김민서',
  priority: 'URGENT',
  reason: { kind: 'DIRECT', label: '나에게 직접 지정됨' },
  receivedAt: '2026-08-19T06:57:00Z',
  lastActivityAt: '2026-08-19T06:57:00Z',
  dueAt: '2026-08-19T14:59:00Z',
  readAt: '2026-08-19T07:00:00Z',
  savedAt: null,
  completedAt: null,
  snoozedUntil: null,
  actionable: true,
  sensitive: false,
  actions: [
    {
      actionKey: 'review',
      label: '검토하기',
      href: '/approvals/inbox',
      enabled: true,
      disabledReason: null,
      primary: true,
    },
  ],
  version: '1',
} as const;

function fulfillSuccess(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

async function mockNotificationCenter(page: Page) {
  await page.route('**/api/notifications/v1/stream**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: ': connected\n\n',
    })
  );
  await page.route('**/api/notifications/v1/summary**', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      message: null,
      actionableUnread: 0,
      totalUnread: 0,
      viewCounts: { PRIORITY: 1, ALL: 1, MENTIONS: 0, SAVED: 0, SNOOZED: 0, DONE: 0 },
      changeVersion: '1',
      counterVersion: '1',
      generatedAt: '2026-08-19T07:00:00Z',
    })
  );
  await page.route('**/api/notifications/v1/inbox**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(`/${notification.notificationId}`)) {
      return fulfillSuccess(route, {
        item: notification,
        reasonExplanation: '원천 앱이 회원님의 계정을 직접 수신 대상으로 지정했습니다.',
        absoluteOccurredAt: notification.receivedAt,
        targetState: 'AVAILABLE',
        targetStateReason: null,
        timeline: [
          {
            entryId: 'timeline-e2e-1',
            title: 'Notification received',
            detail: '클라우드 운영 예산 요청의 검토 차례가 도착했습니다.',
            occurredAt: notification.receivedAt,
            actorLabel: null,
          },
        ],
      });
    }
    return fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      message: null,
      items: [notification],
      nextCursor: null,
      hasMore: false,
      approximateTotal: 1,
      changeVersion: '1',
    });
  });
}

test('알림 센터는 사용자 작업과 관리 경계를 분리하고 반응형 상세 흐름을 제공한다', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '최준빈',
    jobTitle: '서비스 운영 담당자',
    email: 'joonbin@sk.com',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page);

  await page.goto('/notifications');

  await expect(page.getByRole('heading', { name: '알림 센터', level: 1 })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /클라우드 운영 예산 승인이 필요합니다/ })
  ).toBeVisible();
  await expect(page.getByText('운영 개요', { exact: true })).toHaveCount(0);
  await expect(page.getByText('알림 계약', { exact: true })).toHaveCount(0);
  await expect(page.getByText('전달 운영', { exact: true })).toHaveCount(0);

  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('heading', { name: '알림 상세', level: 2 })).toHaveCount(0);
    await page.getByRole('button', { name: /클라우드 운영 예산 승인이 필요합니다/ }).click();
    await expect(page.getByRole('heading', { name: '알림 상세', level: 2 })).toBeVisible();
    await page.getByRole('button', { name: '뒤로' }).click();
    await expect(
      page.getByRole('textbox', { name: '제목, 소스 또는 안전한 미리보기 검색' })
    ).toBeVisible();
  } else {
    await expect(page.getByRole('heading', { name: '알림 상세', level: 2 })).toBeVisible();
  }

  const geometry = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
});
