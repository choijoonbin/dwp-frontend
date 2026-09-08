import { expect, test, type Page } from '@playwright/test';
import { withMeetingDocumentCapture } from './support/meeting-document-capture';
import {
  MEETING_VISUAL_ID,
  MEETING_VISUAL_SUMMARY,
  mockMeetingVisualHome,
  mockMeetingVisualHomeReports,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

async function setup(page: Page, dark = false) {
  await mockMeetingVisualSession(page, { locale: 'ko', colorScheme: dark ? 'dark' : 'light' });
  await mockMeetingVisualHome(page, 'SAMPLE');
  await mockMeetingVisualHomeReports(page);
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
          updatedAt: '2026-09-04T00:00:00Z',
          currentMeetingId: null,
        },
      }),
    })
  );
  await page.route('**/api/meetings/v1/meetings/*/preparation', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        success: true,
        data: {
          meetingId: MEETING_VISUAL_ID,
          meetingVersion: 7,
          agendaVersion: 1,
          materialsVersion: 0,
          invitationRevision: 1,
          agendaItems: [
            '출시 범위 및 스펙 확인',
            '남은 보안·성능 위험 검토',
            '배포 승인권자 일정 확정',
          ].map((title, position) => ({
            itemId: '88000000-0000-4000-8000-00000000000' + (position + 1),
            title,
            position,
            objective: null,
            ownerUserId: 42 + position,
            ownerDisplayName: ['김민아', '최준빈', '경영기획'][position],
            plannedMinutes: 15,
          })),
          materials: [],
          myResponse: null,
          invitationResponses: MEETING_VISUAL_SUMMARY.participants.map((person) => ({
            participantId: person.participantId,
            displayName: person.displayName,
            response: 'NEEDS_RESPONSE',
            invitationRevision: 1,
            respondedAt: null,
            version: 0,
            mine: false,
          })),
          invitationCounts: { accepted: 0, tentative: 0, declined: 0, pending: 3 },
          myPreparation: {
            agendaVersion: 1,
            version: 0,
            preparedAgendaItemIds: [],
            updatedAt: null,
          },
          canEditAgenda: true,
          canManageMaterials: true,
          canRespond: false,
          canPrepare: true,
          observedAt: '2026-08-31T04:20:00Z',
        },
      }),
    })
  );
}

for (const width of [1440, 1280, 390, 320]) {
  test(`U01 approved composition and actual preparation at ${width}`, async ({
    page,
    isMobile,
  }, info) => {
    test.skip(isMobile !== width < 600, 'Dedicated viewport project');
    await page.setViewportSize({ width, height: width < 600 ? 844 : 960 });
    await setup(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/meetings/home');
    const focus = page.getByTestId('meeting-command-primary');
    await expect(focus.getByText('출시 범위 및 스펙 확인', { exact: true })).toBeVisible();
    await expect(focus.getByText('배포 승인권자 일정 확정', { exact: true })).toBeVisible();
    await expect(focus.getByRole('button', { name: '사전 자료 0건' })).toBeVisible();
    await expect(focus.getByRole('button', { name: '입장 및 장치 점검' })).toBeVisible();
    await expect(
      page.getByTestId('meeting-home-queue').getByRole('heading', { level: 2 })
    ).toHaveCount(1);
    await expect(page.getByTestId('meeting-home-timeline-row')).toHaveCount(3);
    await expect(page.getByTestId('meeting-home-resources').getByRole('listitem')).toHaveCount(3);
    const agenda = await focus.locator('ol > li').evaluateAll((items) =>
      items.map((item) => ({
        x: item.getBoundingClientRect().x,
        y: item.getBoundingClientRect().y,
      }))
    );
    if (width >= 1280) {
      await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', '24px');
      await expect(focus.getByRole('heading', { level: 2 })).toHaveCSS('font-size', '24px');
      expect(
        Math.max(...agenda.map((item) => item.y)) - Math.min(...agenda.map((item) => item.y))
      ).toBeLessThan(2);
      const queue = await page.getByTestId('meeting-home-queue').boundingBox();
      const timeline = await page.getByTestId('meeting-home-timeline').boundingBox();
      expect(queue!.x).toBeGreaterThan(timeline!.x + timeline!.width);
    } else {
      expect(agenda[1].y).toBeGreaterThan(agenda[0].y);
      const actions = await page
        .getByTestId('meeting-home-actions')
        .locator(':scope > button:visible')
        .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().y));
      expect(Math.max(...actions) - Math.min(...actions)).toBeLessThan(2);
    }
    await expectNoHorizontalOverflow(page);
    await expectNoBlockingA11y(page);
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath(`U01-${width}-viewport.png`) });
    await withMeetingDocumentCapture(page, async () => {
      await page.screenshot({ path: info.outputPath(`U01-${width}-document.png`), fullPage: true });
    });
  });
}

test('U01 dark preparation keeps contrast and does not request media automatically', async ({
  page,
  isMobile,
}, info) => {
  test.skip(!isMobile, 'Mobile dark edge case');
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, true);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => {
          throw new Error('Unexpected media capture on home');
        },
      },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', ({ message }) => errors.push(message));
  await page.goto('/meetings/home');
  await expect(page.getByText('출시 범위 및 스펙 확인', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoBlockingA11y(page);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('U01-390-dark-document.png'), fullPage: true });
});
