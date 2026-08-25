import AxeBuilder from '@axe-core/playwright';
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

async function mockNotificationCenter(
  page: Page,
  options: {
    actionableUnread?: number;
    totalUnread?: number;
    partial?: boolean;
    unavailableSources?: string[];
    bulkActions?: string[];
    inboxQueries?: string[];
    inboxItems?: () => unknown[];
    inboxPage?: (requestUrl: string) => {
      items: unknown[];
      nextCursor: string | null;
      hasMore: boolean;
      approximateTotal: number;
    };
    detailItem?: () => unknown;
    targetState?: 'AVAILABLE' | 'DELETED' | 'EXPIRED' | 'FORBIDDEN';
  } = {}
) {
  await page.route('**/api/notifications/v1/stream**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: ': connected\n\n',
    })
  );
  await page.route('**/api/notifications/v1/summary**', (route) =>
    fulfillSuccess(route, {
      partial: options.partial ?? false,
      unavailableSources: options.unavailableSources ?? [],
      message: options.partial ? '일부 알림 소스가 지연되고 있습니다.' : null,
      actionableUnread: options.actionableUnread ?? 0,
      totalUnread: options.totalUnread ?? 0,
      viewCounts: { PRIORITY: 1, ALL: 1, MENTIONS: 0, SAVED: 0, SNOOZED: 0, DONE: 0 },
      changeVersion: '1',
      counterVersion: '1',
      generatedAt: '2026-08-19T07:00:00Z',
    })
  );
  await page.route('**/api/notifications/v1/inbox**', (route) => {
    const requestUrl = route.request().url();
    const path = new URL(requestUrl).pathname;
    if (route.request().method() === 'POST' && path.endsWith('/bulk-actions')) {
      const body = route.request().postDataJSON() as {
        notificationIds: string[];
        action: string;
      };
      options.bulkActions?.push(body.action);
      return fulfillSuccess(route, {
        results: body.notificationIds.map((notificationId) => ({
          notificationId,
          outcome: 'APPLIED',
          item: notification,
          message: null,
        })),
        changeVersion: '2',
        summary: {
          partial: false,
          unavailableSources: [],
          message: null,
          actionableUnread: 0,
          totalUnread: 0,
          viewCounts: { PRIORITY: 1, ALL: 1, MENTIONS: 0, SAVED: 0, SNOOZED: 0, DONE: 0 },
          changeVersion: '2',
          counterVersion: '2',
          generatedAt: '2026-08-19T07:01:00Z',
        },
        undoToken: null,
        undoExpiresAt: null,
      });
    }
    if (path.endsWith(`/${notification.notificationId}`)) {
      const targetState = options.targetState ?? 'AVAILABLE';
      return fulfillSuccess(route, {
        item: options.detailItem?.() ?? notification,
        reasonExplanation: '원천 앱이 회원님의 계정을 직접 수신 대상으로 지정했습니다.',
        absoluteOccurredAt: notification.receivedAt,
        targetState,
        targetStateReason: targetState === 'DELETED' ? 'SOURCE_DELETED' : null,
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
    if (route.request().method() === 'GET') options.inboxQueries?.push(requestUrl);
    const pageData = options.inboxPage?.(requestUrl);
    return fulfillSuccess(route, {
      partial: options.partial ?? false,
      unavailableSources: options.unavailableSources ?? [],
      message: options.partial ? '일부 알림 소스가 지연되고 있습니다.' : null,
      items: pageData?.items ?? options.inboxItems?.() ?? [notification],
      nextCursor: pageData?.nextCursor ?? null,
      hasMore: pageData?.hasMore ?? false,
      approximateTotal: pageData?.approximateTotal ?? 1,
      changeVersion: '1',
    });
  });
}

async function mockFullNotificationProfile(page: Page) {
  await page.route('**/api/notifications/v1/me/delivery-profile', (route) =>
    fulfillSuccess(route, {
      channels: { IN_APP: true },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '07:00',
        timeZone: 'Asia/Seoul',
        days: [1, 2, 3, 4, 5, 6, 7],
        allowUrgentBypass: true,
      },
      digest: { mode: 'OFF', deliveryTime: '09:00', dayOfWeek: null },
      presentation: { bannerMode: 'SMART', previewMode: 'FULL' },
      version: '1',
      updatedAt: '2026-08-19T07:00:00Z',
    })
  );
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

  await page.goto('/notifications/center');

  await expect(page.getByRole('heading', { name: '알림 센터', level: 1 })).toBeVisible();
  const protectedNotification = page.getByRole('button', { name: /보호된 업무 알림/ });
  await expect(protectedNotification).toBeVisible();
  await expect(page.getByText('운영 개요', { exact: true })).toHaveCount(0);
  await expect(page.getByText('알림 계약', { exact: true })).toHaveCount(0);
  await expect(page.getByText('전달 운영', { exact: true })).toHaveCount(0);

  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('heading', { name: '알림 상세', level: 2 })).toHaveCount(0);
    await protectedNotification.click();
    await expect(page.getByRole('heading', { name: '알림 상세', level: 2 })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: '클라우드 운영 예산 승인이 필요합니다', level: 3 })
    ).toBeVisible();
    await page.getByRole('button', { name: '뒤로' }).click();
    await expect(
      page.getByRole('textbox', { name: '제목, 소스 또는 안전한 미리보기 검색' })
    ).toBeVisible();
  } else {
    await expect(page.getByRole('heading', { name: '알림 상세', level: 2 })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: '클라우드 운영 예산 승인이 필요합니다', level: 3 })
    ).toBeVisible();
  }

  const geometry = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.viewportWidth);

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  expect(
    await page.evaluate(
      () =>
        document.documentElement
          .getAnimations({ subtree: true })
          .filter(
            (animation) => animation.playState === 'running' || animation.playState === 'pending'
          ).length
    )
  ).toBe(0);

  for (const width of [1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/notifications/center');
    await expect(page.getByRole('heading', { name: '알림 센터', level: 1 })).toBeVisible();
    const resizedGeometry = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      contentWidth: document.documentElement.scrollWidth,
    }));
    expect(resizedGeometry.contentWidth).toBeLessThanOrEqual(resizedGeometry.viewportWidth);

    const glanceTrigger = page.getByRole('button', { name: /조치 필요 알림/ });
    const headerControls = [
      page.locator('button[aria-label="DWP 검색"]:visible'),
      glanceTrigger,
      page.locator('button[aria-label^="계정:"]:visible'),
    ];
    const headerBounds = (
      await Promise.all(headerControls.map((control) => control.boundingBox()))
    ).filter((bounds) => bounds !== null);
    for (let left = 0; left < headerBounds.length; left += 1) {
      for (let right = left + 1; right < headerBounds.length; right += 1) {
        const first = headerBounds[left];
        const second = headerBounds[right];
        if (!first || !second) continue;
        const overlap =
          first.x < second.x + second.width &&
          first.x + first.width > second.x &&
          first.y < second.y + second.height &&
          first.y + first.height > second.y;
        expect(overlap).toBe(false);
      }
    }
    await glanceTrigger.click();
    const glance = page.getByRole('dialog', { name: '최근 알림' });
    await expect(glance).toBeVisible();
    const glanceGeometry = await glance.boundingBox();
    expect(glanceGeometry).not.toBeNull();
    expect(glanceGeometry?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((glanceGeometry?.x ?? 0) + (glanceGeometry?.width ?? 0)).toBeLessThanOrEqual(width + 1);
    await page.keyboard.press('Escape');

    const selection = page.getByRole('checkbox').first();
    await selection.check();
    const bulkToolbar = page.getByRole('toolbar', { name: '선택한 알림 작업' });
    await expect(bulkToolbar).toBeVisible();
    const bulkBounds = await bulkToolbar.boundingBox();
    expect(bulkBounds).not.toBeNull();
    expect(bulkBounds?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((bulkBounds?.x ?? 0) + (bulkBounds?.width ?? 0)).toBeLessThanOrEqual(width + 1);
    await selection.uncheck();
  }
});

test('알림 센터의 필터와 일괄 정리는 키보드만으로 수행할 수 있다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Keyboard workflow is covered once on Chromium.');
  const bulkActions: string[] = [];
  const inboxQueries: string[] = [];
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '최준빈',
    jobTitle: '서비스 운영 담당자',
    email: 'joonbin@sk.com',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, { bulkActions, inboxQueries });

  await page.goto('/notifications/center');
  const search = page.getByRole('textbox', {
    name: '제목, 소스 또는 안전한 미리보기 검색',
  });
  await search.focus();
  await page.keyboard.type('예산');
  await expect(search).toHaveValue('예산');

  const priority = page.getByRole('combobox', { name: '우선순위 필터' });
  await priority.focus();
  await page.keyboard.press('ArrowDown');
  await page.getByRole('option', { name: '긴급' }).press('Enter');
  await expect(priority).toHaveText(/긴급/);

  const app = page.getByRole('combobox', { name: '앱 필터' });
  await app.focus();
  await page.keyboard.press('ArrowDown');
  await page.getByRole('option', { name: 'Approvals' }).press('Enter');
  await expect(app).toHaveText(/Approvals/);

  const readState = page.getByRole('combobox', { name: '읽음 상태 필터' });
  await readState.focus();
  await page.keyboard.press('ArrowDown');
  await page.getByRole('option', { name: '읽음', exact: true }).press('Enter');
  await expect(readState).toHaveText(/읽음/);
  await expect
    .poll(() =>
      inboxQueries.some((rawUrl) => {
        const query = new URL(rawUrl).searchParams;
        return (
          query.get('query') === '예산' &&
          query.get('priority') === 'URGENT' &&
          query.get('appKey') === 'APPROVALS' &&
          query.get('readState') === 'READ'
        );
      })
    )
    .toBe(true);

  const toolbar = page.getByRole('toolbar', { name: '선택한 알림 작업' });
  for (const [label, action] of [
    ['읽음으로 표시', 'READ'],
    ['저장', 'SAVE'],
    ['나중에 알림', 'SNOOZE'],
    ['완료로 이동', 'COMPLETE'],
  ] as const) {
    const checkbox = page.getByRole('checkbox').first();
    await expect(checkbox).not.toBeChecked();
    await checkbox.press('Space');
    await expect(checkbox).toBeChecked();
    await expect(toolbar).toBeVisible();
    const actionButton = toolbar.getByRole('button', { name: label });
    await actionButton.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => bulkActions.at(-1)).toBe(action);
    await expect(toolbar).toBeHidden();
  }
});

test('키셋 점진 렌더링은 기존 순서와 항목별 작업을 유지한다', async ({ page }) => {
  const secondNotification = {
    ...notification,
    notificationId: 'notification-e2e-2',
    threadKey: 'approval:budget-43',
    title: '두 번째 운영 검토가 도착했습니다',
    receivedAt: '2026-08-19T06:56:00Z',
    lastActivityAt: '2026-08-19T06:56:00Z',
  };
  const thirdNotification = {
    ...notification,
    notificationId: 'notification-e2e-3',
    threadKey: 'approval:budget-44',
    title: '세 번째 정책 확인이 필요합니다',
    receivedAt: '2026-08-19T06:55:00Z',
    lastActivityAt: '2026-08-19T06:55:00Z',
  };
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '최준빈',
    jobTitle: '서비스 운영 담당자',
    email: 'joonbin@sk.com',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, {
    inboxPage: (requestUrl) => {
      const cursor = new URL(requestUrl).searchParams.get('cursor');
      return cursor === 'page-2'
        ? {
            items: [secondNotification, thirdNotification],
            nextCursor: null,
            hasMore: false,
            approximateTotal: 3,
          }
        : {
            items: [notification],
            nextCursor: 'page-2',
            hasMore: true,
            approximateTotal: 3,
          };
    },
  });

  await page.goto('/notifications/center');
  const rows = page.locator('[data-notification-focus-id]');
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: '더 불러오기' }).click();
  await expect(rows).toHaveCount(3);
  await expect
    .poll(() =>
      rows.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-notification-focus-id'))
      )
    )
    .toEqual([
      notification.notificationId,
      secondNotification.notificationId,
      thirdNotification.notificationId,
    ]);
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  await expect(page.getByRole('button', { name: '더 불러오기' })).toHaveCount(0);
});

test('열린 알림 패널은 새 이벤트를 버퍼링하고 현재 포커스를 유지한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Glance focus behavior is covered once.');
  const newerNotification = {
    ...notification,
    notificationId: '10000000-0000-4000-8000-000000000002',
    threadKey: 'approval:budget-43',
    title: '신규 운영 예산 검토가 도착했습니다',
    receivedAt: '2026-08-19T07:02:00Z',
    lastActivityAt: '2026-08-19T07:02:00Z',
    readAt: null,
  };
  let inboxItems: unknown[] = [notification];
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, { inboxItems: () => inboxItems });

  await page.goto('/notifications/center');
  await page.getByRole('button', { name: /조치 필요 알림/ }).click();
  const glance = page.getByRole('dialog', { name: '최근 알림' });
  const originalRow = glance.getByRole('button', { name: /보호된 업무 알림/ }).first();
  await originalRow.focus();
  await expect(originalRow).toBeFocused();
  const focusedId = await originalRow.getAttribute('data-notification-focus-id');

  inboxItems = [newerNotification, notification];
  const mixedViewArrivalIds = [
    newerNotification.notificationId,
    ...Array.from(
      { length: 19 },
      (_, index) => `20000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`
    ),
  ];
  await page.evaluate((arrivalIds) => {
    window.dispatchEvent(
      new CustomEvent('dwp:notification-changed', {
        detail: {
          changeVersion: '2',
          counterVersion: '2',
          changedIds: arrivalIds,
          arrivalIds,
        },
      })
    );
  }, mixedViewArrivalIds);

  await expect(glance.getByRole('button', { name: '새 알림 1개 보기' })).toBeVisible();
  await expect(originalRow).toBeFocused();
  await expect(originalRow).toHaveAttribute('data-notification-focus-id', focusedId ?? '');
  await expect(glance.getByRole('button', { name: /보호된 업무 알림/ })).toHaveCount(1);
});

test('20건 알림 burst는 한 번의 집계 안내로 버퍼링하고 열린 목록을 밀지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Burst behavior is covered once.');
  let inboxItems: unknown[] = [notification];
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, { inboxItems: () => inboxItems });

  await page.goto('/notifications/center');
  await page.getByRole('button', { name: /조치 필요 알림/ }).click();
  const glance = page.getByRole('dialog', { name: '최근 알림' });
  await glance.getByRole('tab', { name: /^전체/ }).click();
  const originalRow = glance.getByRole('button', { name: /보호된 업무 알림/ }).first();
  await originalRow.focus();
  await expect(originalRow).toBeFocused();

  const arrivalIds = Array.from(
    { length: 20 },
    (_, index) => `10000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`
  );
  inboxItems = [
    ...arrivalIds.map((notificationId, index) => ({
      ...notification,
      notificationId,
      threadKey: `approval:burst-${index}`,
      title: `신규 운영 알림 ${index + 1}`,
      receivedAt: `2026-08-19T07:${String(20 + index).padStart(2, '0')}:00Z`,
      lastActivityAt: `2026-08-19T07:${String(20 + index).padStart(2, '0')}:00Z`,
      readAt: null,
    })),
    notification,
  ];
  await page.evaluate((ids) => {
    window.dispatchEvent(
      new CustomEvent('dwp:notification-changed', {
        detail: {
          changeVersion: '20',
          counterVersion: '20',
          changedIds: ids,
          arrivalIds: ids,
        },
      })
    );
  }, arrivalIds);

  const aggregateStatus = glance.getByRole('status').filter({ hasText: '새 알림 20개 보기' });
  await expect(aggregateStatus).toHaveText('새 알림 20개 보기');
  await expect(aggregateStatus.getByRole('button', { name: '새 알림 20개 보기' })).toBeVisible();
  await expect(originalRow).toBeFocused();
  await expect(glance.getByRole('button', { name: /보호된 업무 알림/ })).toHaveCount(1);
});

test('한국어와 영어 장문 제목은 320px 목록과 상세 화면을 벗어나지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Long-title reflow is covered once.');
  const longTitle =
    '조직 전체 보안 정책 변경 승인이 필요합니다 EnterpriseNotificationGovernancePolicyAcknowledgementRequiredImmediately';
  const longItem = { ...notification, title: longTitle };
  await page.setViewportSize({ width: 320, height: 844 });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, {
    inboxItems: () => [longItem],
    detailItem: () => longItem,
  });
  await mockFullNotificationProfile(page);

  await page.goto('/notifications/center');
  const row = page.getByRole('button', { name: new RegExp(longTitle) });
  await expect(row).toBeVisible();
  const rowTitle = page.getByText(longTitle, { exact: true }).first();
  await expect(rowTitle).toHaveCSS('overflow', 'hidden');
  await expect(rowTitle).toHaveCSS('text-overflow', 'ellipsis');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(0);

  await row.click();
  const detailTitle = page.getByRole('heading', { name: longTitle, level: 3 });
  await expect(detailTitle).toBeVisible();
  const detailBounds = await detailTitle.boundingBox();
  expect(detailBounds).not.toBeNull();
  expect((detailBounds?.x ?? 0) + (detailBounds?.width ?? 0)).toBeLessThanOrEqual(320);
});

test('영어 세션은 제목과 CTA 및 상대·절대 시각을 지역화해 표시한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'English locale rendering is covered once.');
  const englishItem = {
    ...notification,
    title: 'Review the cloud operations budget request',
    preview: 'Minseo Kim requested your review before the end of the day.',
    reason: { kind: 'DIRECT' as const, label: 'Assigned directly to you' },
    actions: [
      {
        ...notification.actions[0],
        label: 'Review request',
      },
    ],
  };
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, {
    inboxItems: () => [englishItem],
    detailItem: () => englishItem,
  });
  await mockFullNotificationProfile(page);

  await page.goto('/notifications/center');
  await expect(page.getByRole('heading', { name: 'Notification center', level: 1 })).toBeVisible();
  await expect(page.getByText(englishItem.title, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/days ago$/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: englishItem.title, level: 3 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review request' })).toBeVisible();
  await expect(page.getByText(/August 19, 2026/)).toBeVisible();
});

for (const badge of [
  { actionable: 0, total: 0, visible: null },
  { actionable: 1, total: 3, visible: '1' },
  { actionable: 120, total: 140, visible: '99+' },
] as const) {
  test(`헤더 알림 배지는 ${badge.actionable}건 상태를 명확히 표현한다`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Badge state matrix is covered once.');
    await mockShellSession(page, ['WORKSPACE_MEMBER'], {
      locale: 'ko',
      permissions: NOTIFICATION_PERMISSION,
    });
    await mockNotificationCenter(page, {
      actionableUnread: badge.actionable,
      totalUnread: badge.total,
    });

    await page.goto('/notifications/center');
    const trigger = page.getByRole('button', {
      name: `조치 필요 알림 ${badge.actionable}건, 전체 새 알림 ${badge.total}건`,
    });
    await expect(trigger).toBeVisible();
    const badgeElement = trigger.locator('.MuiBadge-badge');
    if (badge.visible === null) {
      await expect(badgeElement).toHaveClass(/MuiBadge-invisible/);
    } else {
      await expect(badgeElement).toHaveText(badge.visible);
      await expect(badgeElement).not.toHaveClass(/MuiBadge-invisible/);
    }
  });
}

test('부분 장애와 오프라인 및 삭제된 업무는 안전한 상태로 설명된다', async ({
  context,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Failure state matrix is covered once.');
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, {
    partial: true,
    unavailableSources: ['messaging'],
    targetState: 'DELETED',
  });

  await page.goto('/notifications/center');
  await expect(page.getByText('일부 소스 1곳의 정보를 가져오지 못했습니다.').first()).toBeVisible();
  await expect(page.getByText('원본 앱에서 연결된 업무가 삭제되었습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '검토하기' })).toHaveCount(0);

  await context.setOffline(true);
  await expect(
    page.getByText('오프라인입니다. 마지막으로 동기화된 알림을 표시합니다.').first()
  ).toBeVisible();
  await context.setOffline(false);
});

for (const appearance of [
  { mode: 'light', density: 'compact', highContrast: false },
  { mode: 'dark', density: 'standard', highContrast: false },
  { mode: 'light', density: 'comfortable', highContrast: true },
] as const) {
  test(`알림 센터는 ${appearance.mode}/${appearance.density}/contrast-${appearance.highContrast} 모양새에서도 접근 가능하다`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'Appearance matrix is covered once on Chromium.'
    );
    await mockShellSession(page, ['WORKSPACE_MEMBER'], {
      locale: 'ko',
      appearance: { ...appearance, reduceMotion: true },
      permissions: NOTIFICATION_PERMISSION,
    });
    await mockNotificationCenter(page);

    await page.goto('/notifications/center');
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-color-scheme', appearance.mode);
    await expect(root).toHaveAttribute('data-density', appearance.density);
    await expect(root).toHaveAttribute(
      'data-contrast',
      appearance.highContrast ? 'high' : 'standard'
    );
    const geometry = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      contentWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    const accessibility = await new AxeBuilder({ page }).include('main').analyze();
    expect(
      accessibility.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
      )
    ).toEqual([]);
  });
}
