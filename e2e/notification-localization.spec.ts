import { expect, test } from '@playwright/test';

import {
  NOTIFICATION_PERMISSION,
  expectNoHorizontalOverflow,
  mockNotificationCenter,
  mockNotificationProfile,
  notification,
} from './support/notification-fixtures';
import { mockShellSession } from './support/shell-session';

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
  await expect(
    page
      .getByRole('complementary', { name: 'Selected notification details' })
      .getByRole('heading', { name: englishItem.title, level: 3 })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review request' })).toBeVisible();
  await expect(page.getByText(/August 19, 2026/)).toBeVisible();
});
