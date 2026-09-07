import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import type { VideoMeetingIntelligenceReport } from '../libs/shared-utils/src/api/video-meeting-intelligence-api';
import {
  MEETING_VISUAL_ID,
  MEETING_VISUAL_SUMMARY,
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';

const sourceId = '88000000-0000-4000-8000-000000000311';
const secondSourceId = '88000000-0000-4000-8000-000000000312';
const unrelatedMeetingId = '81000000-0000-4000-8000-000000000399';
const originalText = 'SOURCE A: the approved assignment requires a capacity review.';
const secondText = 'SOURCE B: the separate report requires a security review.';
const substitutionText = 'LATEST SUBSTITUTE MUST NEVER REPLACE THE ASSIGNMENT SOURCE.';
const unavailable = 'The source meeting report is unavailable.';
const base = `/api/meetings/v1/meetings/${MEETING_VISUAL_ID}`;
const url = (reportId = sourceId) =>
  `/meetings/history?meeting=${MEETING_VISUAL_ID}&reportId=${reportId}`;

function report(id = sourceId, text = originalText): VideoMeetingIntelligenceReport {
  return {
    reportId: id,
    meetingId: MEETING_VISUAL_ID,
    runId: '87000000-0000-4000-8000-000000000311',
    state: 'PUBLISHED',
    audience: 'MEETING_PARTICIPANTS',
    schemaVersion: 'meeting-intelligence-v1',
    retentionUntil: '2026-09-28T01:50:00Z',
    legalHold: false,
    approvedAt: '2026-08-29T02:00:00Z',
    publishedAt: '2026-08-29T02:02:00Z',
    version: id === sourceId ? 2 : 7,
    canCurrentViewerReview: false,
    reviews: [],
    analysis: {
      executiveSummary: {
        text,
        citations: [{ segmentId: 'seg-12', startMillis: 92000, endMillis: 118000 }],
      },
      topics: [],
      decisions: [],
      actionItems: [],
      openQuestions: [],
      risks: [],
      conversationClimate: {
        label: 'INSUFFICIENT_EVIDENCE',
        signals: ['LOW_TRANSCRIPT_EVIDENCE'],
        citations: [],
      },
    },
  };
}
function fulfill(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      status: status < 400 ? 'SUCCESS' : 'ERROR',
      success: status < 400,
      message: status < 400 ? 'OK' : 'Unavailable',
      data,
    }),
  });
}

/** Browser/public-route contract fixtures, not live backend/provider or retention evidence. */
async function setup(page: Page) {
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page);
  const state = {
    status: 200,
    selected: report() as VideoMeetingIntelligenceReport | null,
    mismatchedMeeting: false,
    hold: false,
    release: null as null | (() => Promise<void>),
    requests: [] as string[],
    errors: [] as string[],
  };
  page.on('pageerror', (error) => state.errors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/meetings/v1/')) state.requests.push(`${request.method()} ${path}`);
  });
  await page.route('**/api/meetings/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === base && state.mismatchedMeeting)
      return fulfill(route, {
        ...MEETING_VISUAL_SUMMARY,
        meetingId: unrelatedMeetingId,
        participants: [],
        artifacts: [],
        guestAccessEnabled: false,
      });
    if (
      [
        `${base}/intelligence/reports/latest`,
        `${base}/intelligence/reports/latest-published`,
      ].includes(path)
    )
      return fulfill(route, report(secondSourceId, substitutionText));
    if (
      path === `${base}/intelligence/reports/${sourceId}` ||
      path === `${base}/intelligence/reports/${secondSourceId}`
    ) {
      const finish = () => fulfill(route, state.selected, state.status);
      if (state.hold) {
        state.release = finish;
        return;
      }
      return finish();
    }
    return route.fallback();
  });
  return state;
}
function exactOnly(state: Awaited<ReturnType<typeof setup>>, id = sourceId) {
  const reportReads = state.requests.filter((path) => path.includes('/intelligence/'));
  expect(reportReads.length).toBeGreaterThan(0);
  expect(reportReads.every((path) => path === `GET ${base}/intelligence/reports/${id}`)).toBe(true);
  expect(state.requests.some((path) => path.includes('/history'))).toBe(false);
  expect(state.requests.every((path) => path.startsWith('GET '))).toBe(true);
  expect(state.errors).toEqual([]);
}
async function noSubstitution(page: Page) {
  await expect(page.getByText(substitutionText, { exact: true })).toHaveCount(0);
  await expect(page.getByText('The group approved a staged launch', { exact: false })).toHaveCount(
    0
  );
}
async function noBlockingA11y(page: Page) {
  const result = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    result.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
  ).toEqual([]);
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === 'mobile' ? 390 : 1280,
    height: 960,
  });
});

test('exact source identity remains selected across overview, artifacts, attendance and refresh', async ({
  page,
}, testInfo) => {
  const state = await setup(page);
  await page.goto(url());
  await expect(page.getByText(originalText, { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status').filter({ hasText: sourceId })).toBeVisible();
  for (const tab of await page.getByRole('tab').all()) {
    expect(
      await tab.evaluate((element) => element.scrollWidth - element.clientWidth),
      `Source recap tab must not clip its label: ${await tab.textContent()}`
    ).toBeLessThanOrEqual(1);
  }
  await page.getByRole('tab', { name: 'Recording, transcript, and AI', exact: true }).click();
  await noSubstitution(page);
  await page.getByRole('tab', { name: 'Attendance evidence', exact: true }).click();
  await page.getByRole('tab', { name: 'Overview and outcomes', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText(originalText, { exact: true })).toBeVisible();
  exactOnly(state);
  await noSubstitution(page);
  await noBlockingA11y(page);
  const overflow = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('#dwp-main-content')!;
    return Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      main.scrollWidth - main.clientWidth
    );
  });
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: testInfo.outputPath(`exact-source-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test('changing the report identifier selects that source rather than the latest report', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto(url());
  await expect(page.getByText(originalText, { exact: true })).toBeVisible({ timeout: 30_000 });
  state.selected = report(secondSourceId, secondText);
  state.requests.length = 0;
  await page.goto(url(secondSourceId));
  await expect(page.getByText(secondText, { exact: true })).toBeVisible();
  await expect(page.getByText(originalText, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: secondSourceId })).toBeVisible();
  exactOnly(state, secondSourceId);
  await noSubstitution(page);
});

for (const status of [403, 404, 410, 503]) {
  test(`source ${status} never reads or displays a substitute, including retry`, async ({
    page,
  }) => {
    const state = await setup(page);
    state.status = status;
    state.selected = null;
    await page.goto(url());
    await expect(page.getByRole('heading', { name: unavailable, exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(originalText, { exact: true })).toHaveCount(0);
    const reads = state.requests.length;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('heading', { name: unavailable, exact: true })).toBeVisible();
    await expect.poll(() => state.requests.length).toBeGreaterThan(reads);
    exactOnly(state);
    await noSubstitution(page);
  });
}

test('refresh immediately conceals cached source content and keeps it hidden after access revocation', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto(url());
  await expect(page.getByText(originalText, { exact: true })).toBeVisible({ timeout: 30_000 });
  state.status = 403;
  state.selected = null;
  state.hold = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect.poll(() => Boolean(state.release)).toBe(true);
  await expect(page.getByText(originalText, { exact: true })).toHaveCount(0);
  await state.release!();
  await expect(page.getByRole('heading', { name: unavailable, exact: true })).toBeVisible();
  await expect(page.getByText('Regional launch readiness review', { exact: true })).toHaveCount(0);
  exactOnly(state);
  await noSubstitution(page);
  await noBlockingA11y(page);
});

for (const mismatch of ['meetingId', 'reportId'] as const) {
  test(`response ${mismatch} mismatch fails closed before exposing report content`, async ({
    page,
  }) => {
    const state = await setup(page);
    state.selected![mismatch] = mismatch === 'meetingId' ? unrelatedMeetingId : secondSourceId;
    await page.goto(url());
    await expect(page.getByRole('heading', { name: unavailable, exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(originalText, { exact: true })).toHaveCount(0);
    exactOnly(state);
    await noSubstitution(page);
  });
}

for (const condition of ['DRAFT', 'DELETED', 'PRIVATE_REVIEWERS', 'NULL'] as const) {
  test(`source ${condition} is not treated as a published participant report`, async ({ page }) => {
    const state = await setup(page);
    if (condition === 'NULL') state.selected = null;
    else if (condition === 'PRIVATE_REVIEWERS') state.selected!.audience = condition;
    else state.selected!.state = condition;
    await page.goto(url());
    await expect(page.getByRole('heading', { name: unavailable, exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(originalText, { exact: true })).toHaveCount(0);
    exactOnly(state);
    await noSubstitution(page);
  });
}

const invalid = [
  `reportId=${sourceId}`,
  `meeting=${MEETING_VISUAL_ID}&reportId=latest`,
  `meeting=${MEETING_VISUAL_ID}&reportId=`,
  `meeting=${MEETING_VISUAL_ID}&reportId=${sourceId}&reportId=${secondSourceId}`,
  `meeting=${MEETING_VISUAL_ID}&meeting=${unrelatedMeetingId}&reportId=${sourceId}`,
  `meeting=..%2F..%2Fadmin&reportId=${sourceId}`,
];
for (const [index, search] of invalid.entries()) {
  test(`malformed or ambiguous source URL ${index + 1} performs no Meeting data reads`, async ({
    page,
  }) => {
    const state = await setup(page);
    await page.goto(`/meetings/history?${search}`);
    await expect(page.getByTestId('product-surface-local-not-found')).toBeVisible({
      timeout: 30_000,
    });
    expect(state.requests).toEqual([]);
    await expect(page.getByText(originalText, { exact: true })).toHaveCount(0);
    await noSubstitution(page);
  });
}

test('mismatched meeting metadata prevents even an exact report read', async ({ page }) => {
  const state = await setup(page);
  state.mismatchedMeeting = true;
  await page.goto(url());
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  expect(state.requests).toEqual([`GET ${base}`]);
  await expect(page.getByText(originalText, { exact: true })).toHaveCount(0);
  await noSubstitution(page);
});
