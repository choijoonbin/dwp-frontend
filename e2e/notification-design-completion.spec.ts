import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  NOTIFICATION_OPERATIONS_PERMISSIONS,
  mockNotificationOperationsAndSuppressions,
} from './support/notification-design-completion-fixtures';
import {
  NOTIFICATION_GOVERNANCE_PERMISSIONS,
  mockNotificationAdminGovernance,
} from './support/notification-admin-governance-fixtures';
import {
  NOTIFICATION_PERMISSION,
  expectNoHorizontalOverflow,
  fulfillSuccess,
  mockNotificationCenter,
  mockNotificationPreferences,
  mockNotificationProfile,
  notification,
} from './support/notification-fixtures';
import { mockShellSession } from './support/shell-session';

test.beforeEach(async ({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Explicit desktop and mobile completion matrix.');
});

test('사용자와 관리자 전 메뉴는 동일한 workspace 기준선을 사용한다', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
    locale: 'ko',
    displayName: '최준빈',
    permissions: [...NOTIFICATION_GOVERNANCE_PERMISSIONS, ...NOTIFICATION_OPERATIONS_PERMISSIONS],
  });
  await mockNotificationCenter(page);
  await mockNotificationPreferences(page);
  await mockNotificationAdminGovernance(page);
  await mockNotificationOperationsAndSuppressions(page);
  await page.setViewportSize({ width: 1920, height: 1080 });

  const routes = [
    ['/notifications/home', 'notification-home-header'],
    ['/notifications/center', 'notification-workbench-header'],
    ['/notifications/settings', 'notification-page-heading'],
    ['/notifications/admin/overview', 'notification-page-heading'],
    ['/notifications/admin/contracts', 'notification-page-heading'],
    ['/notifications/admin/policies', 'notification-page-heading'],
    ['/notifications/admin/templates', 'notification-page-heading'],
    ['/notifications/admin/operations', 'notification-page-heading'],
    ['/notifications/admin/suppressions', 'notification-page-heading'],
  ] as const;

  for (const [path, headingTestId] of routes) {
    await page.goto(path);
    const main = page.locator('main#dwp-main-content');
    const frame = page.getByTestId('notification-page-frame');
    const heading = page.getByTestId(headingTestId);
    await expect(frame).toBeVisible();
    await expect(heading).toBeVisible();
    const [mainBox, frameBox, headingBox] = await Promise.all([
      main.boundingBox(),
      frame.boundingBox(),
      heading.boundingBox(),
    ]);
    expect(mainBox, `${path} main`).not.toBeNull();
    expect(frameBox, `${path} frame`).not.toBeNull();
    expect(headingBox, `${path} heading`).not.toBeNull();
    const leftInset = frameBox!.x - mainBox!.x;
    const rightInset = mainBox!.x + mainBox!.width - frameBox!.x - frameBox!.width;
    expect(leftInset, `${path} left inset`).toBeCloseTo(32, 0);
    expect(rightInset, `${path} right inset`).toBeCloseTo(32, 0);
    expect(headingBox!.x, `${path} heading x`).toBeCloseTo(frameBox!.x, 0);
    expect(headingBox!.width, `${path} heading width`).toBeCloseTo(frameBox!.width, 0);
    await expectNoHorizontalOverflow(page);
  }
});

test('알림 홈은 우선 및 멘션 보조 조회 실패를 정상 상태로 숨기지 않는다', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '최준빈',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, { inboxFailureViews: ['PRIORITY'] });
  await page.goto('/notifications/home');

  await expect(page.getByRole('heading', { name: '먼저 확인할 알림' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '일부 소스 1곳' })).toContainText(
    '일부 소스 1곳의 정보를 가져오지 못했습니다.'
  );
});

test('개인정보 설정이 확정되기 전 센터와 모바일 상세는 컨텍스트를 닫는다', async ({ page }) => {
  let releaseProfile!: () => void;
  const profileResponseBarrier = new Promise<void>((resolve) => {
    releaseProfile = resolve;
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '최준빈',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, {
    profilePreviewMode: 'FULL',
    profileResponseBarrier,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications/center/notification-e2e-1?view=all');

  const mobileDetail = page.getByRole('complementary', { name: '선택한 알림 상세' });
  await expect(mobileDetail.getByRole('button', { name: '뒤로' })).toBeVisible();
  await expect(mobileDetail.getByText('알림 상세를 불러오는 중')).toBeVisible();
  await expect(page.getByText(notification.title, { exact: true })).toHaveCount(0);
  await expect(page.getByText(notification.actorLabel, { exact: true })).toHaveCount(0);

  releaseProfile();
  await expect(
    mobileDetail.getByRole('heading', { name: notification.title, exact: true })
  ).toBeVisible();
  await expect(
    mobileDetail.getByText(notification.actorLabel, { exact: true }).first()
  ).toBeVisible();
});

test('모바일 직접 상세의 오류 상태는 알림 목록 복귀 수단을 유지한다', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '최준빈',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications/center/missing-notification?view=all');

  const mobileDetail = page.getByRole('complementary', { name: '선택한 알림 상세' });
  await expect(
    mobileDetail.getByRole('heading', { name: '상세 정보를 불러오지 못했습니다' })
  ).toBeVisible();
  await mobileDetail.getByRole('button', { name: '뒤로' }).click();
  await expect(page).toHaveURL(/\/notifications\/center\?view=all$/u);
});

test('운영 개요의 이상 항목은 전달 조사 워크벤치와 정본 URL로 이어진다', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
    locale: 'ko',
    displayName: '최준빈',
    permissions: NOTIFICATION_OPERATIONS_PERMISSIONS,
  });
  const fixture = await mockNotificationOperationsAndSuppressions(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/notifications/admin/overview');

  await page.getByRole('button', { name: /재시도 한도를 초과한 전달이 있습니다/ }).click();
  await expect(page).toHaveURL(/\/notifications\/admin\/operations\?finding=dead-letter-queue/);
  const investigation = page.getByTestId('notification-operation-investigation');
  await expect(
    investigation.getByRole('heading', { name: '재시도 한도를 초과한 전달이 있습니다' })
  ).toBeVisible();
  await expect(investigation.getByText('dead-letter-queue', { exact: true })).toBeVisible();
  await expect(investigation.getByText('알림 운영', { exact: true })).toBeVisible();

  const beforeRefresh = fixture.operationsRequests;
  await investigation.getByRole('button', { name: '상태 다시 확인' }).click();
  await expect.poll(() => fixture.operationsRequests).toBeGreaterThan(beforeRefresh);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('notification-operations-investigation-1440.png'),
    animations: 'disabled',
    fullPage: true,
  });
});

test('전달 조사와 억제 이력은 390px에서 목록·상세·해제 작업을 온전히 제공한다', async ({
  page,
}, testInfo) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
    locale: 'ko',
    displayName: '최준빈',
    permissions: NOTIFICATION_OPERATIONS_PERMISSIONS,
  });
  const fixture = await mockNotificationOperationsAndSuppressions(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications/admin/operations');

  const list = page.getByRole('region', { name: '전달 장애 및 운영 이상 목록' });
  const detail = page.getByRole('region', { name: '선택한 전달 장애 조사 상세' });
  await expect(list).toBeVisible();
  await expect(detail).toBeHidden();
  await list.getByRole('button', { name: /재시도 한도를 초과한 전달이 있습니다/ }).click();
  await expect(list).toBeHidden();
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: '장애 목록으로 돌아가기' }).click();
  await expect(list).toBeVisible();
  await expect(page.getByRole('table', { name: 'QoS 전달 대기열 상태' })).toBeHidden();
  await expect(page.getByRole('table', { name: '채널 Provider 상태' })).toBeHidden();
  await expect(page.getByTestId('notification-lane-mobile-CRITICAL')).toContainText('420초');
  await expect(page.getByTestId('notification-provider-mobile-email')).toContainText(
    'Email provider'
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('notification-operations-investigation-390.png'),
    animations: 'disabled',
    fullPage: true,
  });

  await page.goto('/notifications/admin/suppressions');
  const mobileSuppression = page.getByTestId('notification-suppression-mobile-suppression-space-1');
  await expect(mobileSuppression).toBeVisible();
  await expect(page.getByRole('table', { name: '알림 전달 억제 이력' })).toBeHidden();
  await mobileSuppression.getByRole('button', { name: '즉시 해제' }).click();
  const dialog = page.getByRole('dialog', { name: '전달 억제 해제' });
  await dialog.getByLabel('해제 사유').fill('중복 이벤트 원인이 해소되어 정상 전달을 재개합니다.');
  await dialog.getByRole('button', { name: '즉시 해제' }).click();
  await expect.poll(() => fixture.revokeRequests.length).toBe(1);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('notification-suppressions-390.png'),
    animations: 'disabled',
    fullPage: true,
  });
});

test('개인 설정은 실제 런타임 계약과 채널 상태를 재검사한다', async ({ page }, testInfo) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '최준빈',
    permissions: NOTIFICATION_PERMISSION,
  });
  let capabilityRequests = 0;
  await mockNotificationProfile(page);
  const fixture = await mockNotificationPreferences(page);
  await page.route('**/api/notifications/v1/capabilities', async (route) => {
    capabilityRequests += 1;
    await route.fallback();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications/settings');

  await page.getByRole('tab', { name: '내 수신 상태', exact: true }).click();
  await expect(page.getByRole('heading', { name: '내 수신 상태' })).toBeVisible();
  const diagnosticsToggle = page.getByRole('button', { name: '연결 및 기기 진단 접기' });
  await expect(diagnosticsToggle).toBeVisible();
  const diagnostics = page.getByTestId('notification-delivery-diagnostics');
  const endpoint = page.getByTestId(
    'notification-delivery-endpoint-24000000-0000-0000-0000-000000000001'
  );
  await expect(diagnostics).toBeVisible();
  await expect(endpoint).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('notification-delivery-summary-390.png'),
    animations: 'disabled',
    fullPage: true,
  });
  await diagnosticsToggle.click();
  await expect(diagnostics).toBeHidden();
  await expect(endpoint).toBeHidden();
  await page.getByRole('button', { name: '연결 및 기기 진단 보기' }).click();
  await expect(diagnostics.getByText('PostgreSQL', { exact: true })).toBeVisible();
  await expect(diagnostics.getByText('SSE + 영속 동기화', { exact: true })).toBeVisible();
  await expect(diagnostics.getByText('앱 내 알림 사용 가능', { exact: true })).toBeVisible();
  await expect(endpoint).toContainText('업무용 Chrome · MacBook Pro');
  await endpoint.getByRole('button', { name: '연결 해제' }).click();
  const revokeDialog = page.getByRole('dialog', { name: '기기 알림 연결 해제' });
  await revokeDialog.getByRole('button', { name: '연결 해제' }).click();
  await expect.poll(() => fixture.endpointRevokeRequests.length).toBe(1);
  await expect(endpoint).toContainText('해제됨');
  const beforeRefresh = capabilityRequests;
  await page.getByRole('button', { name: '수신 상태 다시 확인' }).click();
  await expect.poll(() => capabilityRequests).toBeGreaterThan(beforeRefresh);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('notification-delivery-diagnostics-390.png'),
    animations: 'disabled',
    fullPage: true,
  });

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('알림 센터는 데스크톱 분할 상세와 inbox 호환 경로를 보존한다', async ({ page }, testInfo) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '최준빈',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/notifications/inbox?view=all');
  await expect(page).toHaveURL(/\/notifications\/center\?view=all/);

  const item = page.getByRole('button', { name: /보호된 업무 알림/ }).first();
  await item.click();
  await expect(page).toHaveURL(/\/notifications\/center\/notification-e2e-1\?view=all/);
  await expect(page.getByRole('heading', { name: '알림 상세', level: 2 })).toBeVisible();
  await expect(page.locator('.MuiDrawer-root')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('notification-center-detail-1440.png'),
    animations: 'disabled',
    fullPage: true,
  });
  await page.getByRole('button', { name: '뒤로' }).click();
  await expect(page).toHaveURL(/\/notifications\/center\?view=all/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications/center/notification-e2e-1?view=all');
  await expect(page).toHaveURL(/\/notifications\/center\/notification-e2e-1\?view=all/);
  const mobileDetail = page.getByRole('complementary', { name: '선택한 알림 상세' });
  await expect(mobileDetail).toBeVisible();
  await expect(page.locator('.MuiDrawer-root')).toBeVisible();
  await expect(mobileDetail.getByText('업무 앱', { exact: true })).toBeVisible();
  await expect(mobileDetail.getByText('수신 기준', { exact: true })).toBeVisible();
  await expect(mobileDetail.getByText('보낸 사람', { exact: true })).toBeVisible();
  await expect(mobileDetail.getByText('처리 기한', { exact: true })).toBeVisible();
  const drawer = page.locator('.MuiDrawer-paper');
  const primaryAction = mobileDetail.getByTestId('notification-detail-primary-action');
  await expect(primaryAction).toBeVisible();
  const [drawerBox, primaryActionBox] = await Promise.all([
    drawer.boundingBox(),
    primaryAction.boundingBox(),
  ]);
  expect(drawerBox).not.toBeNull();
  expect(primaryActionBox).not.toBeNull();
  expect(primaryActionBox!.y + primaryActionBox!.height).toBeGreaterThan(
    drawerBox!.y + drawerBox!.height - 90
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('notification-center-detail-390.png'),
    animations: 'disabled',
    fullPage: true,
  });
  await page.getByRole('button', { name: '뒤로' }).click();
  await expect(page).toHaveURL(/\/notifications\/center\?view=all/);
  await expectNoHorizontalOverflow(page);
});

test('메신저 상세 패널의 답장은 원천 API 성공 후 알림을 완료 처리한다', async ({ page }) => {
  const triageActions: string[] = [];
  const sentMessages: Array<{ body: string; idempotencyKey: string }> = [];
  const messagingNotification = {
    ...notification,
    notificationId: 'notification-detail-reply-1',
    threadKey: 'messaging:conversation-42',
    source: {
      appKey: 'messaging',
      appName: '메신저',
      iconKey: 'message',
      accent: '#0F8A72',
    },
    typeKey: 'MESSAGING.DIRECT_MESSAGE',
    title: '김민서님이 후속 확인을 요청했습니다',
    preview: '배포 점검 결과를 답장으로 알려주세요.',
    priority: 'NORMAL',
    reason: { kind: 'DIRECT', label: '나에게 보낸 메시지' },
    readAt: null,
    dueAt: null,
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
    displayName: '최준빈',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, {
    triageActions,
    inboxItems: () => [messagingNotification],
  });
  await mockNotificationProfile(page);
  await page.route('**/api/messaging/v1/conversations/conversation-42/messages', async (route) => {
    const body = route.request().postDataJSON() as {
      body: string;
      idempotencyKey: string;
    };
    sentMessages.push(body);
    await fulfillSuccess(route, {
      messageId: 'reply-message-8',
      conversationId: 'conversation-42',
      senderUserId: 900018,
      senderName: '최준빈',
      body: body.body,
      contentType: 'TEXT',
      messageKind: 'USER',
      replyToMessageId: 'message-7',
      createdAt: '2026-08-19T07:03:00Z',
      version: 1,
      reactions: [],
      attachments: [],
    });
  });

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/notifications/center');
  await expect(
    page.getByTestId('notification-detail-scroll').getByText(messagingNotification.preview, {
      exact: true,
    })
  ).toHaveCSS(
    'white-space',
    'pre-wrap'
  );
  await page.getByRole('button', { name: messagingNotification.title }).click();
  const detail = page.getByRole('complementary', { name: '선택한 알림 상세' });
  await detail.getByRole('textbox', { name: '답장 내용' }).fill('점검 완료했습니다.');
  await detail.getByRole('button', { name: '보내기' }).click();

  await expect.poll(() => sentMessages).toHaveLength(1);
  expect(sentMessages[0]).toMatchObject({ body: '점검 완료했습니다.' });
  expect(sentMessages[0]?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/u);
  await expect.poll(() => triageActions).toContain('COMPLETE');
});
