import { expect, test } from '@playwright/test';

import {
  NOTIFICATION_ADMIN_PERMISSIONS,
  NOTIFICATION_PERMISSION,
  mockNotificationAdminOverview,
  mockNotificationCenter,
  mockNotificationPreferences,
  notification,
} from './support/notification-fixtures';
import {
  NOTIFICATION_GOVERNANCE_PERMISSIONS,
  mockNotificationAdminGovernance,
} from './support/notification-admin-governance-fixtures';
import { mockShellSession } from './support/shell-session';

const budgets = {
  30: { readyMs: 5_000, interactionMs: 750 },
  300: { readyMs: 8_000, interactionMs: 1_000 },
  1000: { readyMs: 12_000, interactionMs: 1_500 },
} as const;

function performanceNotifications(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const sequence = index + 1;
    const sourceIndex = (index % 4) + 1;
    return {
      ...notification,
      notificationId: `20000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
      threadKey: `performance:${sequence}`,
      source: {
        ...notification.source,
        appKey: `performance-${sourceIndex}`,
        appName: `Performance app ${sourceIndex}`,
      },
      title: `Performance notification ${sequence}`,
      preview: `Deterministic performance fixture ${sequence}`,
      receivedAt: new Date(Date.parse(notification.receivedAt) - index * 1_000).toISOString(),
      lastActivityAt: new Date(
        Date.parse(notification.lastActivityAt) - index * 1_000
      ).toISOString(),
      readAt: null,
      actions: [],
    };
  });
}

for (const size of [30, 300, 1000] as const) {
  test(`@production-preview ${size}건 알림 목록은 초기 준비와 키보드 상호작용 예산을 지킨다`, async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockShellSession(page, ['WORKSPACE_MEMBER'], {
      locale: 'ko',
      permissions: NOTIFICATION_PERMISSION,
    });
    const items = performanceNotifications(size);
    await mockNotificationCenter(page, {
      actionableUnread: size,
      totalUnread: size,
      profilePreviewMode: 'FULL',
      inboxItems: () => items,
      inboxPage: () => ({
        items,
        nextCursor: null,
        hasMore: false,
        approximateTotal: size,
      }),
    });

    const readyStartedAt = Date.now();
    await page.goto('/notifications/center');
    await expect(page.getByRole('heading', { name: '알림 센터', level: 1 })).toBeVisible();
    const rows = page.locator('[data-notification-focus-id]');
    const rowContainers = page.locator('[data-notification-row-container]');
    await expect(rows).toHaveCount(size);
    await expect(rowContainers).toHaveCount(size);
    await expect(rows.first()).toHaveAttribute('aria-current', 'true');
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        })
    );
    expect(Date.now() - readyStartedAt).toBeLessThanOrEqual(budgets[size].readyMs);

    const visibilityContracts = await rowContainers.evaluateAll((elements) =>
      [elements[0], elements.at(-1)].map((element) => {
        const style = window.getComputedStyle(element!);
        return {
          contentVisibility: style.contentVisibility,
          containIntrinsicSize: style.containIntrinsicSize,
        };
      })
    );
    expect(visibilityContracts).toEqual([
      expect.objectContaining({ contentVisibility: 'auto' }),
      expect.objectContaining({ contentVisibility: 'auto' }),
    ]);
    expect(
      visibilityContracts.every(({ containIntrinsicSize }) => containIntrinsicSize !== 'none')
    ).toBe(true);

    await rows.first().focus();
    await expect(rows.first()).toBeFocused();
    const interactionStartedAt = Date.now();
    await page.keyboard.press('j');
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('k');
    await expect(rows.first()).toBeFocused();
    expect(Date.now() - interactionStartedAt).toBeLessThanOrEqual(budgets[size].interactionMs);

    if (size === 1000) {
      await page.getByRole('button', { name: '알림 묶기: 묶지 않음' }).click();
      await page.getByRole('menuitemradio', { name: '업무 앱별' }).click();
      for (const sourceIndex of [1, 2, 3, 4]) {
        await expect(
          page.getByRole('heading', { name: `Performance app ${sourceIndex}` })
        ).toBeAttached();
      }

      const lastRow = page.getByRole('button', { name: /Performance notification 1000/ });
      await lastRow.scrollIntoViewIfNeeded();
      await expect(lastRow).toBeVisible();
      await lastRow.focus();
      await expect(lastRow).toBeFocused();
    }
  });
}

test('@production-preview settings와 admin lazy route 전환은 heading ready 예산을 지킨다', async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
    locale: 'ko',
    permissions: [...NOTIFICATION_ADMIN_PERMISSIONS, ...NOTIFICATION_GOVERNANCE_PERMISSIONS],
  });
  await mockNotificationCenter(page);
  await mockNotificationPreferences(page);
  await mockNotificationAdminOverview(page);
  await mockNotificationAdminGovernance(page);

  await page.goto('/notifications/center');
  await expect(page.getByRole('heading', { name: '알림 센터', level: 1 })).toBeVisible();

  const transitions = [
    { path: '/notifications/settings', heading: '알림 설정', readyMs: 3_000 },
    { path: '/notifications/admin/overview', heading: '운영 개요', readyMs: 2_500 },
    { path: '/notifications/admin/contracts', heading: '알림 계약', readyMs: 2_500 },
    { path: '/notifications/admin/policies', heading: '알림 정책 스튜디오', readyMs: 3_000 },
    { path: '/notifications/admin/templates', heading: '알림 템플릿 스튜디오', readyMs: 3_000 },
    { path: '/notifications/admin/operations', heading: '전달 운영', readyMs: 2_500 },
    { path: '/notifications/admin/suppressions', heading: '전달 통제', readyMs: 2_500 },
  ] as const;

  for (const transition of transitions) {
    const startedAt = await page.evaluate(() => performance.now());
    await page.evaluate((path) => {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, transition.path);
    await expect(page.getByRole('heading', { name: transition.heading, level: 1 })).toBeVisible();
    const readyTime = await page.evaluate((start) => performance.now() - start, startedAt);
    expect(readyTime, `${transition.path} heading ready time`).toBeLessThanOrEqual(
      transition.readyMs
    );
  }
});
