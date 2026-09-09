import { expect, test } from '@playwright/test';
import { mockScheduleWorkspace, scheduleResponse } from './support/meeting-schedule-fixtures';
import { mockPreparationDesignMetadata } from './support/meeting-preparation-design-fixtures';
import {
  MEETING_VISUAL_ID,
  MEETING_VISUAL_SUMMARY,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';
import { withMeetingDocumentCapture } from './support/meeting-document-capture';

const actorId = '11000000-0000-4000-8000-000000000001';
const colleagueId = '11000000-0000-4000-8000-000000000002';

test('U03 checks canonical Calendar evidence explicitly and clears failed or expired observations', async ({
  page,
  isMobile,
}, info) => {
  await page.clock.install({ time: new Date('2026-09-10T00:00:00Z') });
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 900 });
  await mockScheduleWorkspace(page, { personPublicId: actorId, dark: isMobile });
  await page.route('**/api/meetings/v1/people?**', (route) =>
    scheduleResponse(route, [
      {
        userId: 17,
        personPublicId: colleagueId,
        displayName: 'Alex Lee',
        emailAddress: 'alex.lee@sk.com',
        organizationName: 'Platform Engineering',
      },
    ])
  );
  const requests: Record<string, unknown>[] = [];
  let failure = false;
  await page.route('**/api/platform/v1/calendar/scheduling/evaluations', async (route) => {
    requests.push(route.request().postDataJSON());
    if (failure) return scheduleResponse(route, null, 403);
    const generatedAt = await page.evaluate(() => new Date().toISOString());
    return scheduleResponse(route, {
      evaluationId: '11000000-0000-4000-8000-000000000003',
      criteriaHash: 'a'.repeat(64),
      completeness: 'COMPLETE',
      sources: [{ sourceType: 'DWP_NATIVE', status: 'HEALTHY', lastSuccessfulSyncAt: generatedAt }],
      generatedAt,
      validUntil: new Date(Date.parse(generatedAt) + 30_000).toISOString(),
      availability: {
        generatedAt,
        participants: [
          { personPublicId: actorId, busyMinutes: 0, availableSlotCount: 0 },
          { personPublicId: colleagueId, busyMinutes: 30, availableSlotCount: 0 },
        ],
        suggestions: [],
      },
      rooms: [],
    });
  });
  await page.goto('/meetings/mine?view=schedule');
  await page
    .getByRole('textbox', { name: 'Meeting title', exact: true })
    .fill('Review calendar conflicts');
  if (isMobile) await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await page.getByRole('combobox', { name: 'Invite people' }).fill('Alex');
  await page
    .getByRole('option', { name: 'Alex Lee · alex.lee@sk.com · Platform Engineering' })
    .click();
  if (isMobile)
    for (let index = 0; index < 2; index += 1)
      await page.getByRole('button', { name: 'Next step', exact: true }).click();
  const availability = page.getByTestId('meeting-calendar-availability');
  await expect(
    availability.getByRole('button', { name: 'Check Calendar schedules' })
  ).toBeEnabled();
  expect(requests).toHaveLength(0);
  await availability.getByRole('button').click();
  await expect(availability).toContainText('1 participant schedules overlap');
  expect(requests[0].personIds).toEqual([actorId, colleagueId]);
  expect(requests[0].from).toEqual(requests[0].roomStartsAt);
  expect(requests[0].to).toEqual(requests[0].roomEndsAt);
  await expectNoBlockingA11y(page, 'U03 Calendar conflict');
  await expectNoHorizontalOverflow(page, 'U03 Calendar conflict');
  await withMeetingDocumentCapture(page, async () => {
    await page.screenshot({ path: info.outputPath('u03-calendar-conflict.png'), fullPage: true });
  });
  if (!isMobile) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await expectNoHorizontalOverflow(page, 'U03 Calendar conflict 1280px');
  }
  failure = true;
  await availability.getByRole('button').click();
  await expect(availability).toContainText('Schedules could not be verified for every participant');
  await expect(availability.getByRole('listitem')).toHaveCount(0);
  failure = false;
  await availability.getByRole('button').click();
  await expect(availability.getByRole('listitem')).toHaveCount(1);
  await page.clock.fastForward(30_001);
  await expect(availability).toContainText('The schedule observation expired');
  await expect(availability.getByRole('listitem')).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expectNoHorizontalOverflow(page, 'U03 Calendar check 320px 200%');
});

test('U04 binds preparation sources and delivery receipts without claiming AI generation or RSVP', async ({
  page,
  isMobile,
}, info) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 900 });
  await mockMeetingVisualSession(page, { locale: 'en', colorScheme: isMobile ? 'dark' : 'light' });
  await mockPreparationDesignMetadata(page);
  let revision = 1;
  let delivery = 'PENDING';
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/schedule`, (route) =>
    scheduleResponse(route, {
      meetingId: MEETING_VISUAL_ID,
      lifecycleState: 'LIVE',
      startsAt: MEETING_VISUAL_SUMMARY.startsAt,
      endsAt: MEETING_VISUAL_SUMMARY.endsAt,
      timeZone: 'Asia/Seoul',
      meetingVersion: 8,
      seriesId: null,
      occurrenceIndex: null,
      occurrenceCount: null,
      frequency: null,
      recurrenceInterval: null,
      seriesVersion: null,
      exceptionState: 'NONE',
      invitationRevision: revision,
      deliveryState: delivery,
    })
  );
  await page.goto(`/meetings/mine?view=preparation&meetingId=${MEETING_VISUAL_ID}`);
  const briefing = page.getByTestId('meeting-preparation-briefing');
  await expect(briefing).toContainText('Preparation briefing from source records');
  await expect(briefing).toContainText('It is not an AI-generated summary');
  await expect(briefing.getByRole('listitem')).toHaveCount(3);
  await briefing.getByRole('button', { name: 'Review agenda and my preparation' }).click();
  await expect(page.locator('#preparation-agenda')).toBeFocused();
  const status = page.getByTestId('meeting-invitation-delivery');
  await expect(status).toContainText('Delivery request pending');
  delivery = 'DELIVERED';
  revision = 2;
  await status.getByRole('button').click();
  await expect(status).toContainText(
    'Delivery could not be verified for the current invitation revision'
  );
  await expect(status).not.toContainText('Delivery processing completed');
  revision = 1;
  await status.getByRole('button').click();
  await expect(status).toContainText('Delivery processing completed');
  await expect(status).toContainText('does not confirm that a participant read or accepted');
  await expectNoBlockingA11y(page, 'U04 source briefing');
  await expectNoHorizontalOverflow(page, 'U04 source briefing');
  await withMeetingDocumentCapture(page, async () => {
    await page.screenshot({ path: info.outputPath('u04-source-briefing.png'), fullPage: true });
  });
  if (!isMobile) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await expectNoHorizontalOverflow(page, 'U04 source briefing 1280px');
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expectNoHorizontalOverflow(page, 'U04 source briefing 320px 200%');
});
