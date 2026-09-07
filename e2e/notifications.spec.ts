import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  NOTIFICATION_ADMIN_PERMISSIONS,
  NOTIFICATION_PERMISSION,
  expectNoHorizontalOverflow,
  fulfillSuccess,
  mockNotificationAdminOverview,
  mockNotificationCenter,
  mockNotificationPreferences,
  mockNotificationProfile,
  notification,
  openHeaderNotificationGlance,
} from './support/notification-fixtures';
import { mockShellSession } from './support/shell-session';

test('알림 센터는 사용자 작업과 관리 경계를 분리하고 반응형 상세 흐름을 제공한다', async ({
  page,
}) => {
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

  await expect(page.getByRole('heading', { name: '알림 상세', level: 2 })).toHaveCount(0);
  await protectedNotification.click();
  await expect(page.getByRole('heading', { name: '알림 상세', level: 2 })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '클라우드 운영 예산 승인이 필요합니다', level: 3 })
  ).toBeVisible();
  await page.getByRole('button', { name: '뒤로' }).click();
  await expect(page.getByRole('heading', { name: '알림 상세', level: 2 })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '알림 검색' })).toBeVisible();

  await expectNoHorizontalOverflow(page);

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

  for (const width of [1440, 1280, 1024, 900, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/notifications/center');
    await expect(page.getByRole('heading', { name: '알림 센터', level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const headerBounds = await page
      .locator(
        'button[aria-label="DWP 검색"]:visible, ' +
          '[data-testid="shell-notification-control"] button:visible, ' +
          'button[aria-label^="계정:"]:visible'
      )
      .evaluateAll((controls) =>
        controls.map((control) => {
          const bounds = control.getBoundingClientRect();
          return {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          };
        })
      );
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
    const { glance } = await openHeaderNotificationGlance(page);
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

test('알림 홈은 실제 집계와 우선 업무를 반응형 실행 허브로 제공한다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Responsive home coverage runs once on Chromium.'
  );
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '최준빈',
    jobTitle: '서비스 운영 담당자',
    email: 'joonbin@sk.com',
    permissions: NOTIFICATION_PERMISSION,
  });
  const triageActions: string[] = [];
  const conversationNotification = {
    ...notification,
    notificationId: 'notification-home-conversation-1',
    source: { appKey: 'messaging', appName: '메신저', accent: '#0F8A72' },
    typeKey: 'MESSAGING.MENTION',
    title: '운영 채널에서 회원님을 언급했습니다',
    preview: '배포 점검 결과를 함께 확인해 주세요.',
    reason: { kind: 'MENTION', label: '나를 직접 언급함' },
    actionable: false,
    priority: 'NORMAL',
    actions: [],
  } as const;
  const updateNotification = {
    ...notification,
    notificationId: 'notification-home-update-1',
    source: { appKey: 'hcm', appName: 'HR', accent: '#7A4EAB' },
    typeKey: 'HCM.LEAVE_APPROVED',
    title: '휴가 신청이 승인되었습니다',
    preview: '일정과 팀 공유 상태를 확인해 주세요.',
    reason: { kind: 'SUBSCRIPTION', label: '내 업무 상태 변경' },
    actionable: false,
    priority: 'LOW',
    actions: [],
  } as const;
  await mockNotificationCenter(page, {
    actionableUnread: 1,
    totalUnread: 3,
    triageActions,
    inboxItems: () => [notification, conversationNotification, updateNotification],
  });
  await mockNotificationProfile(page);

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/notifications/home');
    await expect(page.getByRole('heading', { name: '알림 홈', level: 1 })).toBeVisible();
    await expect(page.getByRole('group', { name: '알림 요약' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'DWP 업무 브리핑' })).toBeVisible();
    await expect(page.getByRole('region', { name: '먼저 확인할 알림' })).toBeVisible();
    await expect(page.getByRole('region', { name: '앱별 알림' })).toBeVisible();
    await expect(page.getByRole('region', { name: '알림 수신 방식' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '조치 필요' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '멘션 및 대화' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '업무 업데이트' })).toBeVisible();
    await expect(page.getByText('전자결재', { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/notifications/home');
  const search = page.getByRole('searchbox', { name: '알림 검색' });
  await search.fill('SLA breach');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page).toHaveURL(/\/notifications\/center\?view=all&q=SLA(?:\+|%20)breach$/u);
  await expect(page.getByPlaceholder('제목, 소스 또는 안전한 미리보기 검색')).toHaveValue(
    'SLA breach'
  );

  await page.goto('/notifications/home');
  await page.getByRole('button', { name: /1 조치 필요/ }).click();
  await expect(page).toHaveURL(/\/notifications\/home$/u);
  await expect(page.getByRole('button', { name: /1 조치 필요/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await page.goto('/notifications/home');
  await page.getByRole('button', { name: '알림 정리' }).first().click();
  await expect.poll(() => triageActions).toContain('COMPLETE');
});

test('알림 설정은 긴 정책 화면을 섹션 바로가기로 탐색하고 모바일에서도 넘치지 않는다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Settings navigation is covered once.');
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page);
  await mockNotificationPreferences(page);
  await mockNotificationProfile(page);

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/notifications/settings');
    const navigation = page.getByRole('navigation', { name: '알림 설정 바로가기' });
    await expect(navigation).toBeVisible();
    await navigation.getByRole('button', { name: '앱별 알림' }).click();
    await expect
      .poll(() =>
        navigation.getByRole('button', { name: '앱별 알림' }).getAttribute('aria-current')
      )
      .toBe('location');
    await expect(page.getByRole('button', { name: '전자결재', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('알림 운영 개요는 실시간 상태와 추이를 먼저 보여주고 정확한 수치를 보존한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Operations overview is covered once.');
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
    locale: 'ko',
    permissions: NOTIFICATION_ADMIN_PERMISSIONS,
  });
  await mockNotificationCenter(page);
  await mockNotificationAdminOverview(page);

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/notifications/admin/overview');
    await expect(page.getByRole('heading', { name: '운영 개요', level: 1 })).toBeVisible();
    await expect(
      page.getByRole('img', { name: '최근 알림 발생과 사용자 영향 차트' })
    ).toBeVisible();
    await expect(
      page.getByRole('group', {
        name: /8월 29일: 생성 7, 조치 필요 2, 실패 1, 음소거 1/,
      })
    ).toBeVisible();
    await expect(page.getByText('실시간 연결됨', { exact: true })).toBeVisible();
    await page.getByText('정확한 수치 보기', { exact: true }).click();
    await expect(page.getByRole('table', { name: '알림 발생과 사용자 영향 추이' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
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
  await expect(page.getByRole('button', { name: /보호된 업무 알림/ })).toBeVisible();
  const search = page.getByRole('textbox', {
    name: '알림 검색',
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
  await page.keyboard.press('Enter');
  const approvalsOption = page.getByRole('option', { name: '전자결재' });
  await expect(approvalsOption).toBeVisible();
  await approvalsOption.press('Enter');
  await expect(app).toHaveText(/전자결재/);

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
          query.get('appKey') === 'approvals' &&
          query.get('readState') === 'READ'
        );
      })
    )
    .toBe(true);
  await expect(page).toHaveURL(
    /\/notifications\/center\?view=priority&read=read&q=%EC%98%88%EC%82%B0&app=approvals&priority=urgent$/u
  );

  const toolbar = page.getByRole('toolbar', { name: '선택한 알림 작업' });
  for (const [label, action] of [
    ['읽음으로 표시', 'READ'],
    ['저장', 'SAVE'],
    ['나중에 알림', 'SNOOZE'],
    ['알림 정리', 'COMPLETE'],
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

test('알림 센터는 보기 필터와 j/k/e/s 단축키로 즉시 분류할 수 있다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Action-first triage is covered once on Chromium.'
  );
  const triageActions: string[] = [];
  const inboxQueries: string[] = [];
  const secondNotification = {
    ...notification,
    readAt: null,
    notificationId: 'notification-e2e-2',
    threadKey: 'approval:budget-43',
    title: '두 번째 운영 검토가 도착했습니다',
    receivedAt: '2026-08-19T06:56:00Z',
    lastActivityAt: '2026-08-19T06:56:00Z',
  };
  const processedIds = new Set<string>();
  const inboxItems = () =>
    [{ ...notification, readAt: null }, secondNotification].filter(
      (item) => !processedIds.has(item.notificationId)
    );
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, {
    triageActions,
    inboxQueries,
    inboxItems,
    onTriageResult: (item) => {
      processedIds.add((item as { notificationId: string }).notificationId);
    },
  });
  await mockNotificationProfile(page);

  await page.goto('/notifications/center');
  await expect(page.getByRole('heading', { name: '알림 센터', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '조치 필요', level: 2 })).toBeVisible();

  await page
    .getByRole('navigation', { name: '알림 센터 보기' })
    .getByRole('button', { name: /^받은 알림/ })
    .click();
  await page.getByRole('combobox', { name: '읽음 상태 필터' }).click();
  await page.getByRole('option', { name: '안 읽음', exact: true }).click();
  await expect
    .poll(() =>
      inboxQueries.some((rawUrl) => {
        const query = new URL(rawUrl).searchParams;
        return query.get('view') === 'ALL' && query.get('readState') === 'UNREAD';
      })
    )
    .toBe(true);

  await page
    .getByRole('navigation', { name: '알림 센터 보기' })
    .getByRole('button', { name: /^조치 필요/ })
    .click();
  await expect(page).toHaveURL(/view=priority/);
  await expect
    .poll(() =>
      inboxQueries.some((rawUrl) => {
        const query = new URL(rawUrl).searchParams;
        return query.get('view') === 'PRIORITY' && query.get('readState') === 'UNREAD';
      })
    )
    .toBe(true);
  const rows = page.locator('[data-notification-focus-id]');
  await expect(rows).toHaveCount(2);
  await rows.first().focus();
  await page.keyboard.press('j');
  await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press('k');
  await expect(rows.first()).toBeFocused();

  await page.keyboard.press('s');
  await expect.poll(() => triageActions.includes('SNOOZE')).toBe(true);
  await expect(rows).toHaveCount(1);
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: /상태를 변경했습니다/ })
      .first()
  ).toBeAttached();
  await rows.last().focus();
  await page.keyboard.press('e');
  await expect.poll(() => triageActions.includes('COMPLETE')).toBe(true);
  await expect(rows).toHaveCount(0);
});

test('읽지 않음 보기에서 상세를 열어 읽음 처리돼도 상세 맥락을 유지한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Detail retention is covered once on Chromium.');
  const triageActions: string[] = [];
  let currentItem = { ...notification, readAt: null };
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, {
    actionableUnread: 1,
    totalUnread: 1,
    triageActions,
    inboxItems: () => [currentItem],
    inboxPage: (requestUrl) => {
      const unreadOnly = new URL(requestUrl).searchParams.get('readState') === 'UNREAD';
      const items = unreadOnly && currentItem.readAt ? [] : [currentItem];
      return { items, nextCursor: null, hasMore: false, approximateTotal: items.length };
    },
    detailItem: () => currentItem,
    onTriageResult: (item) => {
      currentItem = item as typeof currentItem;
    },
  });
  await mockNotificationProfile(page);

  await page.goto('/notifications/center');
  await page.getByRole('combobox', { name: '읽음 상태 필터' }).click();
  await page.getByRole('option', { name: '안 읽음', exact: true }).click();
  await page.getByRole('button', { name: notification.title, exact: true }).click();

  await expect.poll(() => triageActions).toContain('READ');
  await expect(page.getByRole('heading', { name: '알림 상세', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: notification.title, level: 3 })).toBeVisible();
  await expect(page.getByRole('button', { name: notification.title, exact: true })).toBeHidden();
});

test('메신저 알림은 실패한 답장 초안을 보존하고 재시도 성공 후 완료 처리한다', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Cross-product reply is covered once on Chromium.'
  );
  const triageActions: string[] = [];
  const sentMessages: Array<{
    body: string;
    replyToMessageId?: string | null;
    idempotencyKey: string;
    attachmentIds: string[];
    mentionedUserIds: number[];
  }> = [];
  let sendAttempts = 0;
  const messagingNotification = {
    ...notification,
    notificationId: 'notification-messaging-e2e-1',
    threadKey: 'messaging:conversation-42',
    source: {
      appKey: 'messaging',
      appName: '메신저',
      iconKey: 'message',
      accent: '#0F8A72',
    },
    typeKey: 'MESSAGING.DIRECT_MESSAGE',
    title: '김민서님이 새 메시지를 보냈습니다',
    preview: '점검 결과를 확인해 주세요.',
    actorLabel: '김민서',
    priority: 'NORMAL',
    reason: { kind: 'DIRECT', label: '나에게 보낸 메시지' },
    receivedAt: '2026-08-19T07:02:00Z',
    lastActivityAt: '2026-08-19T07:02:00Z',
    dueAt: null,
    readAt: null,
    actionable: true,
    actions: [
      {
        actionKey: 'open-conversation',
        label: '대화 열기',
        href: '/messages/direct?conversation=conversation-42&message=message-7',
        enabled: true,
        disabledReason: null,
        primary: true,
      },
    ],
  } as const;

  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, {
    triageActions,
    inboxItems: () => [messagingNotification],
  });
  await mockNotificationProfile(page);
  await page.route('**/api/messaging/v1/conversations/conversation-42/messages', async (route) => {
    sendAttempts += 1;
    const body = route.request().postDataJSON() as (typeof sentMessages)[number];
    sentMessages.push(body);
    if (sendAttempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Temporarily unavailable' }),
      });
      return;
    }
    await fulfillSuccess(route, {
      messageId: 'reply-message-8',
      conversationId: 'conversation-42',
      senderUserId: 900018,
      senderName: '최준빈',
      body: body.body,
      contentType: 'TEXT',
      messageKind: 'USER',
      replyToMessageId: body.replyToMessageId ?? null,
      createdAt: '2026-08-19T07:03:00Z',
      version: 1,
      reactions: [],
      attachments: [],
    });
  });

  await page.goto('/notifications/home');
  await expect(page.getByRole('heading', { name: '알림 홈', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: '바로 답장' }).click();
  const reply = page.getByRole('textbox', { name: '답장 내용' });
  await reply.fill('점검 결과 확인했습니다. 후속 조치하겠습니다.');
  await page.getByRole('button', { name: '보내기' }).click();

  await expect(
    page.getByText('메시지를 보내지 못했습니다. 내용을 유지한 채 다시 시도해 주세요.')
  ).toBeVisible();
  await expect(reply).toHaveValue('점검 결과 확인했습니다. 후속 조치하겠습니다.');
  expect(triageActions).not.toContain('COMPLETE');

  await page.getByRole('button', { name: '보내기' }).click();
  await expect.poll(() => sentMessages).toHaveLength(2);
  expect(sentMessages[1]).toMatchObject({
    body: '점검 결과 확인했습니다. 후속 조치하겠습니다.',
    replyToMessageId: 'message-7',
    attachmentIds: [],
    mentionedUserIds: [],
  });
  expect(sentMessages[1]?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/u);
  expect(sentMessages[1]?.idempotencyKey).toBe(sentMessages[0]?.idempotencyKey);
  await expect.poll(() => triageActions).toContain('COMPLETE');
  await expect(page.getByText('답장을 보냈습니다.')).toBeVisible();
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
  const { glance } = await openHeaderNotificationGlance(page);
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
  const { glance } = await openHeaderNotificationGlance(page);
  await glance.getByRole('tab', { name: /^받은 알림/ }).click();
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
  await expect(glance.getByRole('button', { name: '새 알림 20개 보기' })).toBeVisible();
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
  await mockNotificationProfile(page);

  await page.goto('/notifications/center');
  const row = page.getByRole('button', { name: new RegExp(longTitle) });
  await expect(row).toBeVisible();
  const rowTitle = page.getByText(longTitle, { exact: true }).first();
  await expect(rowTitle).toHaveCSS('overflow-wrap', 'anywhere');
  await expectNoHorizontalOverflow(page);

  await row.click();
  const detailTitle = page.getByRole('heading', { name: longTitle, level: 3 });
  await expect(detailTitle).toBeVisible();
  await expect
    .poll(async () => {
      const detailBounds = await detailTitle.boundingBox();
      return (detailBounds?.x ?? 0) + (detailBounds?.width ?? 0);
    })
    .toBeLessThanOrEqual(320);
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
  await mockNotificationProfile(page);

  await page.goto('/notifications/center');
  await expect(page.getByRole('heading', { name: 'Notification center', level: 1 })).toBeVisible();
  await expect(page.getByText(englishItem.title, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/days ago$/).first()).toBeVisible();
  await page.getByRole('button', { name: englishItem.title }).click();
  await expect(page.getByRole('heading', { name: englishItem.title, level: 3 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review request' })).toBeVisible();
  await expect(page.getByText(/August 19, 2026/)).toBeVisible();
});
