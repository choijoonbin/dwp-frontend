import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import {
  MEETING_VISUAL_ID,
  MEETING_VISUAL_SUMMARY,
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';

const RECORDING_ID = '84000000-0000-4000-8000-000000000411';
const TRANSCRIPT_ID = '84000000-0000-4000-8000-000000000412';
const RETENTION = '2099-09-04T00:00:00Z';

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

function transcriptDetail() {
  return {
    ...MEETING_VISUAL_SUMMARY,
    title: 'Synchronized transcript review',
    lifecycleState: 'ENDED',
    guestAccessEnabled: false,
    provider: 'LIVEKIT',
    participants: [],
    artifacts: [
      {
        artifactId: RECORDING_ID,
        artifactType: 'RECORDING',
        artifactState: 'AVAILABLE',
        contentType: 'audio/webm',
        sizeBytes: 48_000,
        retentionUntil: RETENTION,
        metadata: {},
        version: 2,
      },
      {
        artifactId: TRANSCRIPT_ID,
        artifactType: 'TRANSCRIPT',
        artifactState: 'AVAILABLE',
        contentType: 'application/json',
        sizeBytes: 4_800,
        retentionUntil: RETENTION,
        metadata: {},
        version: 7,
      },
    ],
    decisions: [],
    followUpActions: [],
    recordingAvailable: true,
    transcriptAvailable: true,
    aiNotesAvailable: true,
    version: 9,
  };
}

async function mockTranscriptRecap(page: Page, transcriptBodies: unknown[]) {
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page);
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: success(transcriptDetail()),
    })
  );
  await page.route(`**/artifacts/${TRANSCRIPT_ID}/transcript/query`, (route: Route) => {
    const body = route.request().postDataJSON() as { query?: string | null };
    transcriptBodies.push(body);
    const searched = body.query === 'decision';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' },
      body: success({
        artifactId: TRANSCRIPT_ID,
        artifactVersion: 7,
        segments: searched
          ? [
              {
                segmentId: 'segment-2',
                startMillis: 12_000,
                endMillis: 16_000,
                text: 'Final decision approved.',
              },
            ]
          : [
              {
                segmentId: 'segment-1',
                startMillis: 5_000,
                endMillis: 9_000,
                text: 'Opening context.',
              },
              {
                segmentId: 'segment-2',
                startMillis: 12_000,
                endMillis: 16_000,
                text: 'Final decision approved.',
              },
            ],
        nextCursor: null,
        hasMore: false,
        queryApplied: searched,
        retentionUntil: RETENTION,
      }),
    });
  });
  await page.route(`**/artifacts/${RECORDING_ID}/access-ticket`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: success({
        artifactId: RECORDING_ID,
        artifactVersion: 2,
        accessUrl: 'https://media.dwp.example/opaque/transcript-sync-ticket',
        expiresAt: '2099-09-03T23:59:00Z',
        contentType: 'audio/webm',
      }),
    })
  );
}

test('authorized transcript stays explicit, searches in the body, and seeks governed playback', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const transcriptBodies: unknown[] = [];
  await mockTranscriptRecap(page, transcriptBodies);

  await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);
  await expect(page.getByText('Opening context.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Check access and open transcript' }).click();
  await expect(page.getByText('Opening context.')).toBeVisible();

  await page.getByRole('button', { name: 'Play recording from 0:05' }).click();
  await expect(page.getByLabel('Authorized meeting audio recording')).toHaveAttribute(
    'src',
    'https://media.dwp.example/opaque/transcript-sync-ticket'
  );

  await page.getByLabel('Search this transcript').fill('decision');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('Final decision approved.')).toBeVisible();
  await expect(page.getByText('Opening context.')).toHaveCount(0);
  expect(transcriptBodies).toEqual([
    { expectedArtifactVersion: 7, cursor: 0, pageSize: 25, query: null },
    { expectedArtifactVersion: 7, cursor: 0, pageSize: 25, query: 'decision' },
  ]);

  const rendered = await page.locator('#dwp-main-content').innerText();
  expect(rendered).not.toContain(TRANSCRIPT_ID);
  expect(rendered).not.toContain('transcript-sync-ticket');
  const axe = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    axe.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});
