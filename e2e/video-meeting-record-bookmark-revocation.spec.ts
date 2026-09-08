import { expect, test, type Route } from '@playwright/test';
import {
  MEETING_VISUAL_ID,
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import { expectNoBlockingA11y } from './support/video-meeting-visual-accessibility';

const title = '분기 제품 출시 의사결정';
const history = {
  items: [
    {
      meetingId: MEETING_VISUAL_ID,
      title,
      organizerName: 'Authorized organizer',
      organizerUserId: 42,
      participantRole: 'ATTENDEE',
      canHost: false,
      endedAt: '2026-09-07T01:00:00Z',
      actualDurationMinutes: 30,
      participantPeak: 4,
      averageQualityScore: null,
      recordingAvailable: false,
      transcriptAvailable: false,
    },
  ],
  total: 1,
  page: 0,
  pageSize: 10,
};
const bookmarks = {
  items: [{ meetingId: MEETING_VISUAL_ID, favorite: false, version: 0, updatedAt: null }],
};
function reply(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      status: status === 200 ? 'SUCCESS' : 'ERROR',
      success: status === 200,
      data,
    }),
  });
}

for (const deniedSource of ['mutation', 'read'] as const) {
  for (const historyStatus of [200, 503]) {
    test(`${deniedSource} denial remains hidden through retry until both current reads authorize (history ${historyStatus})`, async ({
      page,
      isMobile,
    }, testInfo) => {
      await page.setViewportSize({ width: isMobile ? 390 : 1440, height: isMobile ? 844 : 960 });
      await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
      await mockMeetingVisualPublishedRecap(page, true);
      let retrying = false;
      let pendingHistory: Route | undefined;
      let pendingBookmarks: Route | undefined;
      await page.route('**/api/meetings/v1/history?*', (route) => {
        if (retrying) {
          pendingHistory = route;
          return;
        }
        return reply(route, history);
      });
      await page.route('**/api/meetings/v1/history/bookmarks?*', (route) => {
        if (retrying) {
          pendingBookmarks = route;
          return;
        }
        return deniedSource === 'read'
          ? reply(route, { code: 'ACCESS_DENIED' }, 403)
          : reply(route, bookmarks);
      });
      await page.route('**/api/meetings/v1/meetings/*/bookmark', (route) =>
        reply(route, { code: 'ACCESS_DENIED' }, 403)
      );
      await page.goto('/meetings/history');
      const workspace = page.getByTestId('meeting-library-workspace');
      const recordTitle = page.getByRole('heading', { name: title, exact: true });
      const filters = page.getByRole('region', { name: 'Meeting library filters', exact: true });
      const organizer = page.getByText('Authorized organizer', { exact: true });
      if (deniedSource === 'mutation') {
        const add = page.getByRole('button', { name: `Add ${title} to favorites`, exact: true });
        await expect(add).toBeEnabled();
        await add.click();
      }
      const retry = page.getByRole('button', { name: 'Try again', exact: true });
      await expect(retry).toBeVisible();
      await expect(workspace).toHaveCount(0);
      await expect(recordTitle).toHaveCount(0);
      await expect(filters).toHaveCount(0);
      await expect(organizer).toHaveCount(0);

      retrying = true;
      await retry.click();
      await expect.poll(() => Boolean(pendingBookmarks && pendingHistory)).toBe(true);
      await expect(workspace).toHaveCount(0);
      await expect(recordTitle).toHaveCount(0);
      await expect(filters).toHaveCount(0);
      await expect(organizer).toHaveCount(0);
      const bookmarkResponse = page.waitForResponse(
        (response) => response.url().includes('/history/bookmarks?') && response.status() === 200
      );
      await reply(pendingBookmarks!, bookmarks);
      await bookmarkResponse;
      await expectNoBlockingA11y(page, 'U07 denied while history is still unverified');
      await expect(workspace).toHaveCount(0);
      await expect(recordTitle).toHaveCount(0);
      await expect(filters).toHaveCount(0);
      await expect(organizer).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath('denied-during-fresh-history-read.png') });
      const historyResponse = page.waitForResponse(
        (response) => response.url().includes('/v1/history?') && response.status() === historyStatus
      );
      await reply(
        pendingHistory!,
        historyStatus === 200 ? history : { code: 'SERVICE_UNAVAILABLE' },
        historyStatus
      );
      await historyResponse;
      if (historyStatus === 200) {
        await expect(workspace).toBeVisible();
        await expect(
          page
            .getByTestId('meeting-library-list')
            .getByRole('heading', { name: title, exact: true })
        ).toBeVisible();
        await expect(filters).toBeVisible();
      } else {
        await expect(retry).toBeVisible();
        await expectNoBlockingA11y(page, 'U07 denial survives failed history revalidation');
        await expect(workspace).toHaveCount(0);
        await expect(recordTitle).toHaveCount(0);
        await expect(filters).toHaveCount(0);
        await expect(organizer).toHaveCount(0);
      }
    });
  }
}
