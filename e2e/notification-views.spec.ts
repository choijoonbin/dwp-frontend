import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockShellSession } from './support/shell-session';
import {
  expectNoHorizontalOverflow,
  mockNotificationCenter,
  mockNotificationProfile,
  notification,
  NOTIFICATION_PERMISSION,
} from './support/notification-fixtures';

const reasons = [
  'DIRECT',
  'MENTION',
  'ROLE',
  'ORGANIZATION',
  'SUBSCRIPTION',
  'MANDATORY_POLICY',
] as const;
const reasonLabels = [
  '직접 수신',
  '나를 멘션함',
  '담당 역할에 포함됨',
  '소속 조직에 전달됨',
  '구독 중인 소식',
  '필수 정책 알림',
];
const items = reasons.map((kind, index) => ({
  ...notification,
  notificationId: `reason-${kind}`,
  title: `수신 이유 ${kind}`,
  readAt: null,
  actionable: index === 0,
  reason: { kind, label: reasonLabels[index] },
}));

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Explicit desktop and mobile viewport matrix.');
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, {
    totalUnread: 6,
    viewCounts: { PRIORITY: 1, ALL: 6, MENTIONS: 1, SAVED: 0, SNOOZED: 0, DONE: 0 },
    inboxPage: (url) => {
      const p = new URL(url).searchParams;
      const filtered = items.filter(
        (item) =>
          (p.get('view') !== 'MENTIONS' || item.reason.kind === 'MENTION') &&
          (p.get('view') !== 'PRIORITY' || item.actionable) &&
          (!p.get('reason') || item.reason.kind === p.get('reason')) &&
          (!p.get('query') || item.title.includes(p.get('query')!))
      );
      return {
        items: filtered,
        nextCursor: null,
        hasMore: false,
        approximateTotal: filtered.length,
      };
    },
  });
  await mockNotificationProfile(page);
});

test('홈 요약 선택은 해당 알림을 서버 조회하고 홈 안에서 바로 전환한다', async ({
  page,
}, testInfo) => {
  await page.goto('/notifications/home');
  const mentions = page
    .getByRole('group', { name: '알림 요약' })
    .getByRole('button', { name: /나를 멘션/ });
  await mentions.click();
  await expect(mentions).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\/notifications\/home$/);
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '수신 이유 MENTION', exact: true })).toBeVisible();
  await mentions.click();
  await expect(page.getByRole('article')).toHaveCount(6);
  await page.mouse.move(0, 0);
  await expect(page.locator('.MuiTouchRipple-rippleVisible')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('notification-home-action-first.png'),
    animations: 'disabled',
    fullPage: true,
  });
});

test('수신 이유 6종은 서버 query와 표시를 일치시키고 필터 초기화로 복원한다', async ({ page }) => {
  await page.goto('/notifications/center?view=all');
  for (const [index, reason] of reasons.entries()) {
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname.endsWith('/inbox') &&
        new URL(r.url()).searchParams.get('reason') === reason
    );
    await page.getByRole('combobox', { name: '수신 이유', exact: true }).click();
    await page.getByRole('option', { name: reasonLabels[index], exact: true }).click();
    await response;
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(
      page.getByRole('heading', { name: `수신 이유 ${reason}`, exact: true })
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`reason=${reason.toLowerCase()}`));
  }
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await expect(page.getByRole('article')).toHaveCount(6);
});

test('수신 이유 전환은 이전 범위의 일괄 선택을 해제하고 숨겨진 알림을 처리하지 않는다', async ({
  page,
}) => {
  const bulkRequests: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/inbox/bulk-actions')) {
      bulkRequests.push(request.postData() ?? '');
    }
  });
  await page.goto('/notifications/center?view=all&reason=direct');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('toolbar')).toBeVisible();
  await page.getByRole('combobox', { name: '수신 이유', exact: true }).click();
  await page.getByRole('option', { name: reasonLabels[2], exact: true }).click();
  await expect(page.getByRole('heading', { name: '수신 이유 ROLE', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByRole('toolbar')).toHaveCount(0);
  expect(bulkRequests).toEqual([]);
});

test('멘션 보기는 일반 대화를 제외하고 읽음 조건과 URL 범위를 보존하며 뒤로 이동한다', async ({
  page,
}) => {
  await page.goto('/notifications/center?view=all&read=unread&contextProbe=keep');
  const views = page.getByRole('navigation', { name: '알림 센터 보기' });
  await views.getByRole('button', { name: /^나를 멘션/ }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '수신 이유 MENTION', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/contextProbe=keep/);
  await expect(page).toHaveURL(/view=mentions&read=unread/);
  await expect(page.getByRole('combobox', { name: '수신 이유', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true'
  );
  await views.getByRole('button', { name: /^저장됨/ }).click();
  await expect(page).toHaveURL(/view=saved/);
  await page.goBack();
  await expect(page).toHaveURL(/view=mentions&read=unread/);
  await expect(views.getByRole('button', { name: /^나를 멘션/ })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page).toHaveURL(/contextProbe=keep/);
});

test('필터 결과 없음은 받은 알림이 없는 상태와 구분한다', async ({ page }) => {
  await page.goto('/notifications/center?view=all&q=unmatched');
  await expect(page.getByRole('heading', { name: '조건에 맞는 알림이 없습니다' })).toBeVisible();
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await expect(page.getByRole('article')).toHaveCount(6);
});

test('알림 정리에 실패하면 낙관적으로 숨긴 항목을 복원한다', async ({ page }) => {
  await mockNotificationCenter(page, { triageFailureActions: ['COMPLETE'] });
  await mockNotificationProfile(page);
  await page.goto('/notifications/center');
  await page.getByRole('button', { name: '알림 정리', exact: true }).click();
  await expect(page.getByRole('heading', { name: notification.title, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '알림 정리', exact: true })).toBeEnabled();
  await expect(
    page.getByText('알림 상태를 변경하지 못했습니다. 최신 상태를 확인한 뒤 다시 시도해 주세요.', {
      exact: true,
    })
  ).toBeVisible();
});

for (const width of [390, 320]) {
  test(`모바일 ${width}px에서 모든 보기와 수신 이유 필터에 접근한다`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/notifications/center?view=all');
    await page.getByRole('combobox', { name: '알림 센터 보기' }).click();
    await page.getByRole('option', { name: '나를 멘션', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByRole('button', { name: '상세 필터', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '상세 필터' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox', { name: '읽음 상태 필터' }).click();
    await page.getByRole('option', { name: '안 읽음', exact: true }).click();
    await dialog.getByRole('button', { name: '필터 닫기' }).click();
    await expect(page.getByRole('button', { name: '상세 필터', exact: true })).toBeFocused();
    await expect(page).toHaveURL(/view=mentions&read=unread/);
    await expectNoHorizontalOverflow(page);
    const violations = (
      await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()
    ).violations;
    expect(violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`notification-views-${width}.png`),
      fullPage: true,
    });
  });
}

test('홈과 알림 센터는 200% 배율의 유효 화면 폭에서도 탐색할 수 있다', async ({
  page,
}, testInfo) => {
  // Browser zoom halves the CSS viewport; CSS zoom alone does not update media queries.
  await page.setViewportSize({ width: 640, height: 450 });
  for (const route of ['/notifications/home', '/notifications/center?view=all']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (route.includes('center')) {
      await expect(page.getByRole('combobox', { name: '알림 센터 보기' })).toBeVisible();
      await page.getByRole('button', { name: '상세 필터', exact: true }).click();
      await expect(page.getByRole('dialog', { name: '상세 필터' })).toBeVisible();
      await page.getByRole('button', { name: '필터 닫기' }).click();
    }
    await page.screenshot({
      path: testInfo.outputPath(`${route.includes('home') ? 'home' : 'center'}-zoom200.png`),
      fullPage: true,
    });
  }
});
