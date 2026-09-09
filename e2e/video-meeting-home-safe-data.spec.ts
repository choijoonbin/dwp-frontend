import { expect, test, type Page } from '@playwright/test';

import {
  mockMeetingVisualHome,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

async function setupSafeSeededHome(page: Page) {
  await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });
  await mockMeetingVisualHome(page, 'SAFE_SEEDED');
  await page.route('**/api/meetings/v1/personal-room', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        status: 'SUCCESS',
        data: {
          roomId: '88000000-0000-4000-8000-000000000011',
          name: '김민아 개인 회의실',
          opaqueAlias: 'a'.repeat(32),
          invitationRevision: 3,
          version: 2,
          updatedAt: '2026-09-08T00:00:00Z',
          currentMeetingId: null,
        },
      }),
    })
  );
}

test('safe local seed restores honest wide-screen home density without fabricated AI', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Dedicated desktop project');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await setupSafeSeededHome(page);
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/meetings/home');
  await expect(page.getByTestId('meeting-home-manual-follow-ups')).toBeVisible();
  await expect(page.getByTestId('meeting-home-recent-factual')).toBeVisible();
  await expect(page.getByText('수동 기록 · AI 분석 결과 아님', { exact: true })).toBeVisible();
  await expect(page.getByText(/실제 Work 업무로 할당되지 않음/u)).toBeVisible();
  await expect(page.getByLabel('처리 항목 1건')).toBeVisible();
  await expect(page.getByText('게시된 회의록', { exact: true })).toHaveCount(0);
  await expect(page.getByText('AI 회의록 검토', { exact: true })).toHaveCount(0);

  const geometry = await page.getByTestId('meeting-day-lists').evaluate((element) => {
    const timeline = element.querySelector<HTMLElement>('[data-testid="meeting-home-timeline"]');
    const queue = element.querySelector<HTMLElement>('[data-testid="meeting-home-queue"]');
    if (!timeline || !queue) return null;
    const timelineBox = timeline.getBoundingClientRect();
    const queueBox = queue.getBoundingClientRect();
    return {
      ratio: timelineBox.width / queueBox.width,
      timelineWidth: timelineBox.width,
      topDelta: Math.abs(timelineBox.top - queueBox.top),
    };
  });
  expect(geometry).not.toBeNull();
  expect(geometry!.ratio).toBeGreaterThan(1.3);
  expect(geometry!.ratio).toBeLessThan(1.5);
  expect(geometry!.timelineWidth).toBeLessThan(1000);
  expect(geometry!.topDelta).toBeLessThanOrEqual(2);
  await expectNoHorizontalOverflow(page, 'safe seeded home 1920');
  await expectNoBlockingA11y(page, 'safe seeded home 1920');
  expect(runtimeErrors).toEqual([]);
});

test('safe local seed keeps the approved mobile reading order and touch layout', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Dedicated mobile project');
  await page.setViewportSize({ width: 390, height: 844 });
  await setupSafeSeededHome(page);

  await page.goto('/meetings/home');
  await expect(page.getByTestId('meeting-home-manual-follow-ups')).toBeVisible();
  await expect(page.getByTestId('meeting-home-recent-factual')).toBeVisible();
  const order = await page
    .locator(
      '[data-testid="meeting-command-primary"], [data-testid="meeting-home-timeline"], [data-testid="meeting-home-queue"], [data-testid="meeting-home-recent"], [data-testid="meeting-home-resources"]'
    )
    .evaluateAll((elements) =>
      elements.map((element) => ({
        testId: element.getAttribute('data-testid'),
        top: element.getBoundingClientRect().top,
      }))
    );
  expect(order.map((entry) => entry.testId)).toEqual([
    'meeting-command-primary',
    'meeting-home-timeline',
    'meeting-home-queue',
    'meeting-home-recent',
    'meeting-home-resources',
  ]);
  expect(order.every((entry, index) => index === 0 || entry.top > order[index - 1].top)).toBe(true);
  const actions = page.getByTestId('meeting-home-manual-follow-ups').getByRole('button');
  await expect(actions).toHaveCount(1);
  expect(
    await actions.first().evaluate((element) => element.getBoundingClientRect().height)
  ).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page, 'safe seeded home 390');
  await expectNoBlockingA11y(page, 'safe seeded home 390');
});
