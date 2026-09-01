import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  MEETING_VISUAL_ID,
  MEETING_VISUAL_SUMMARY,
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';

import type { Page, Route } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const ARTIFACT_ID = '84000000-0000-0000-0000-000000000301';

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

function recapDetail(contentType: 'video/mp4' | 'audio/webm', retentionUntil: string) {
  return {
    ...MEETING_VISUAL_SUMMARY,
    title: 'Regional launch readiness review',
    lifecycleState: 'ENDED',
    startsAt: '2026-08-29T01:00:00Z',
    endsAt: '2026-08-29T01:50:00Z',
    startedAt: '2026-08-29T01:03:00Z',
    endedAt: '2026-08-29T01:45:00Z',
    guestAccessEnabled: false,
    provider: 'LIVEKIT',
    participants: [],
    artifacts: [
      {
        artifactId: ARTIFACT_ID,
        artifactType: 'RECORDING',
        artifactState: 'AVAILABLE',
        contentType,
        sizeBytes: 84_000_000,
        retentionUntil,
        metadata: {},
        version: 2,
      },
    ],
    decisions: [],
    followUpActions: [],
    recordingAvailable: true,
    transcriptAvailable: false,
    aiNotesAvailable: true,
    version: 9,
  };
}

async function mockArtifactDetail(
  page: Page,
  contentType: 'video/mp4' | 'audio/webm',
  retentionUntil: string
) {
  await page.route(`**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: success(recapDetail(contentType, retentionUntil)),
    })
  );
}

async function openArtifactTab(page: Page) {
  await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);
  await page.getByRole('tab', { name: 'Recording, transcript, and AI' }).click();
  await expect(page.getByText('Meeting recording')).toBeVisible();
}

async function expectNoBlockingAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    main:
      (document.querySelector<HTMLElement>('#dwp-main-content')?.scrollWidth ?? 0) -
      (document.querySelector<HTMLElement>('#dwp-main-content')?.clientWidth ?? 0),
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.main).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page);
});

test('AVAILABLE recording fails closed, retries, and opens a short-lived verified ticket without an opener', async ({
  page,
  context,
}, testInfo) => {
  const contentType = testInfo.project.name === 'mobile' ? 'audio/webm' : 'video/mp4';
  const actionName = contentType.startsWith('audio/')
    ? 'Open audio recording'
    : 'Open video recording';
  await mockArtifactDetail(page, contentType, '2026-09-28T01:50:00Z');

  let attempts = 0;
  let releaseFailure!: () => void;
  const failureGate = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  const requestBodies: unknown[] = [];
  await page.route(
    `**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/artifacts/${ARTIFACT_ID}/access-ticket`,
    async (route: Route) => {
      attempts += 1;
      requestBodies.push(route.request().postDataJSON());
      if (attempts === 1) {
        await failureGate;
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ERROR',
            message: 'provider detail must not be rendered',
            errorCode: 'EXTERNAL_SERVICE_ERROR',
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: success({
          artifactId: ARTIFACT_ID,
          artifactVersion: 2,
          accessUrl: 'https://media.dwp.example/opaque/playback-ticket',
          expiresAt: '2026-08-31T04:22:00Z',
          contentType,
        }),
      });
    }
  );
  await context.route('https://media.dwp.example/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Secure playback</title>' })
  );

  await openArtifactTab(page);
  const action = page.getByRole('button', { name: actionName });
  const bounds = await action.boundingBox();
  expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);

  const failedPopupPromise = page.waitForEvent('popup');
  await action.click();
  const failedPopup = await failedPopupPromise;
  await expect(page.getByRole('button', { name: 'Preparing secure playback' })).toHaveAttribute(
    'aria-busy',
    'true'
  );
  releaseFailure();
  await expect(
    page.getByText('Secure playback is temporarily unavailable. No storage location was exposed.')
  ).toBeVisible();
  await expect.poll(() => failedPopup.isClosed()).toBe(true);

  const popupPromise = page.waitForEvent('popup');
  await action.click();
  const popup = await popupPromise;
  await popup.waitForURL('https://media.dwp.example/opaque/playback-ticket');
  await popup.waitForLoadState('load');
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await expect(page.getByText(/Secure playback opened in a new tab/u)).toBeVisible();
  expect(requestBodies).toEqual([{ expectedArtifactVersion: 2 }, { expectedArtifactVersion: 2 }]);

  const mainText = await page.locator('#dwp-main-content').innerText();
  expect(mainText).not.toContain(ARTIFACT_ID);
  expect(mainText).not.toContain('media.dwp.example');
  expect(mainText).not.toContain('playback-ticket');
  expect(mainText).not.toContain('provider detail');
  expect(mainText).not.toContain('LIVEKIT');
  await expectNoHorizontalOverflow(page);
  await expectNoBlockingAccessibilityViolations(page);
  await popup.close();
});

test('expired AVAILABLE recording remains fail-closed with an explicit retention message', async ({
  page,
}) => {
  await mockArtifactDetail(page, 'video/mp4', '2026-08-30T01:50:00Z');
  let accessCalls = 0;
  await page.route('**/artifacts/*/access-ticket', (route) => {
    accessCalls += 1;
    return route.abort();
  });

  await openArtifactTab(page);
  await expect(page.getByText('The retention period ended.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Open .* recording/u })).toHaveCount(0);
  expect(accessCalls).toBe(0);
  await expectNoHorizontalOverflow(page);
  await expectNoBlockingAccessibilityViolations(page);
});
