import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { NOTIFICATION_PERMISSION, mockNotificationCenter } from './support/notification-fixtures';
import { mockShellSession } from './support/shell-session';

for (const badge of [
  { actionable: 0, total: 0, visible: null },
  { actionable: 1, total: 3, visible: '3' },
  { actionable: 120, total: 140, visible: '99+' },
] as const) {
  test(`헤더 알림 배지는 최초 진입부터 전체 ${badge.total}건을 명확히 표현한다`, async ({
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
    const control = page.getByTestId('shell-notification-control');
    const trigger = control.getByRole('button', {
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

    const initialTriggerHandle = await trigger.elementHandle();
    await trigger.click();
    await expect(page.getByRole('dialog', { name: '최근 알림' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    expect(
      await initialTriggerHandle?.evaluate(
        (element) => element.isConnected && element === document.activeElement
      )
    ).toBe(true);
  });
}

test('알림 조회 권한이 회수되면 이전 헤더 배지와 제어를 즉시 제거한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Authority revocation is covered once.');
  const permissions = NOTIFICATION_PERMISSION.map((permission) => ({ ...permission }));
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions,
  });
  await mockNotificationCenter(page, { actionableUnread: 1, totalUnread: 3 });

  await page.goto('/notifications/center');
  const control = page.getByTestId('shell-notification-control');
  await expect(
    control.getByRole('button', { name: '조치 필요 알림 1건, 전체 새 알림 3건' })
  ).toBeVisible();

  permissions.splice(0, permissions.length);
  const permissionRefresh = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/auth/permissions'
  );
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await permissionRefresh;

  await expect(control).toHaveCount(0);
});

test('실시간 커서 초기화는 활성 알림 캐시를 즉시 재동기화한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Cursor reset recovery is covered once.');
  const summaryQueries: string[] = [];
  const inboxQueries: string[] = [];
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, { summaryQueries, inboxQueries });

  await page.goto('/notifications/center');
  await expect(page.getByRole('heading', { name: '알림 센터', level: 1 })).toBeVisible();
  await expect.poll(() => summaryQueries.length).toBeGreaterThan(0);
  await expect.poll(() => inboxQueries.length).toBeGreaterThan(0);
  const initialSummaryQueries = summaryQueries.length;
  const initialInboxQueries = inboxQueries.length;

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('dwp:notification-sync-reset-required', {
        detail: { errorCode: 'NOTIFICATION_SYNC_RESET_REQUIRED' },
      })
    );
  });

  await expect.poll(() => summaryQueries.length).toBeGreaterThan(initialSummaryQueries);
  await expect.poll(() => inboxQueries.length).toBeGreaterThan(initialInboxQueries);
});

test('헤더 알림 런타임 로드 실패는 안정 트리거에서 알리고 복구 동작을 제공한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Lazy-load failure is covered once.');
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page);
  await page.route('**/src/features/notifications/notification-header-glance.tsx*', (route) =>
    route.abort()
  );

  await page.goto('/notifications/center');
  const control = page.getByTestId('shell-notification-control');
  const trigger = control.getByRole('button');
  const triggerHandle = await trigger.elementHandle();
  await trigger.click();

  const recovery = control.getByRole('button', {
    name: '페이지를 새로고침하여 알림 다시 불러오기',
  });
  await expect(recovery).toBeVisible();
  await expect(recovery).toBeFocused();
  await expect(control.getByRole('alert')).toContainText(
    '페이지를 새로고침하여 알림 다시 불러오기'
  );
  expect(await triggerHandle?.evaluate((element) => element.isConnected)).toBe(true);
});

test('헤더 알림 런타임 지연 중 상태와 취소 동작을 제공한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Lazy loading feedback is covered once.');
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page);

  let releaseModule: (() => void) | undefined;
  const moduleReleased = new Promise<void>((resolve) => {
    releaseModule = resolve;
  });
  await page.route(
    '**/src/features/notifications/notification-header-glance.tsx*',
    async (route) => {
      await moduleReleased;
      await route.continue();
    }
  );

  await page.goto('/notifications/center');
  const control = page.getByTestId('shell-notification-control');
  const trigger = control.getByRole('button');
  await trigger.click();

  const loadingDialog = page.getByRole('dialog', { name: '알림을 불러오는 중입니다' });
  await expect(loadingDialog).toBeVisible();
  await expect(loadingDialog.getByRole('status')).toContainText('알림을 불러오는 중입니다');
  await loadingDialog.getByRole('button', { name: '알림 닫기' }).click();
  await expect(loadingDialog).toBeHidden();
  await expect(trigger).toBeFocused();

  releaseModule?.();
});

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
  await page.getByRole('button', { name: /보호된 업무 알림/ }).click();
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
  test(`알림 센터와 홈은 ${appearance.mode}/${appearance.density}/contrast-${appearance.highContrast} 모양새에서도 접근 가능하다`, async ({
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

    for (const path of ['/notifications/center', '/notifications/home']) {
      await page.goto(path);
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
    }
  });
}
