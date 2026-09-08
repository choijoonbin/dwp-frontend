import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import en from '../libs/shared-i18n/src/locales/en/meetings.json' with { type: 'json' };
import {
  MEETING_VISUAL_RECENT_ID,
  mockMeetingVisualHome,
  mockMeetingVisualHomeReports,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';

const assignmentId = '99000000-0000-4000-8000-000000000901';
const reportId = '99000000-0000-4000-8000-000000000902';
const candidateId = '99000000-0000-4000-8000-000000000903';
const fulfill = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', success: true, data }),
  });
async function setup(page: Page, mobile: boolean) {
  await page.setViewportSize({ width: mobile ? 390 : 1440, height: mobile ? 844 : 960 });
  await mockMeetingVisualSession(page, { locale: 'en' });
  await mockMeetingVisualHome(page, 'SAMPLE');
  await mockMeetingVisualHomeReports(page);
}

test('home personal-room copies the freshly verified current invitation and blocks rotated links', async ({
  page,
  isMobile,
}) => {
  await setup(page, isMobile);
  await page.addInitScript(() => {
    (window as unknown as { copiedMeetingLinks: string[] }).copiedMeetingLinks = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as unknown as { copiedMeetingLinks: string[] }).copiedMeetingLinks.push(value);
        },
      },
    });
  });
  let reads = 0;
  let revision = 3;
  const alias = 'abcdefabcdefabcdefabcdefabcdefab';
  await page.route('**/api/meetings/v1/personal-room', (route) => {
    reads += 1;
    return fulfill(route, {
      roomId: assignmentId,
      name: 'Mina’s private meeting room',
      opaqueAlias: alias,
      invitationRevision: revision,
      version: revision,
      currentMeetingId: null,
      updatedAt: '2026-09-07T01:00:00Z',
    });
  });
  await page.goto('/meetings/home');
  const room = page.getByTestId('meeting-home-personal-room');
  await expect(room).toContainText('Mina’s private meeting room');
  const copy = room.getByRole('button', { name: en.home.homePolish.copySecureLink, exact: true });
  revision = 4;
  await copy.click();
  await expect(room.getByRole('status')).toHaveText(en.home.homePolish.changed);
  expect(
    await page.evaluate(
      () => (window as unknown as { copiedMeetingLinks: string[] }).copiedMeetingLinks
    )
  ).toEqual([]);
  await copy.click();
  await expect(room.getByRole('status')).toHaveText(en.home.homePolish.copied);
  expect(reads).toBeGreaterThanOrEqual(3);
  expect(
    await page.evaluate(
      () => (window as unknown as { copiedMeetingLinks: string[] }).copiedMeetingLinks
    )
  ).toEqual([new URL('/meetings/join?room=' + alias + '&revision=4', page.url()).toString()]);
});

test('home work card opens that authorized assignment and never dispatches a mutation', async ({
  page,
  isMobile,
}) => {
  await setup(page, isMobile);
  const task = {
    assignmentId,
    createdByUserId: 42,
    assignedByUserId: 42,
    assigneeUserId: 42,
    title: 'Confirm the launch checklist',
    description: 'Human-confirmed independent assignment',
    priority: 'HIGH',
    dueAt: '2026-09-05T08:00:00Z',
    assignmentState: 'ACCEPTED',
    workState: 'IN_PROGRESS',
    assignmentRevision: 1,
    version: 3,
    source: {
      availability: 'AVAILABLE',
      reference: {
        sourceSystem: 'MEETING_FOLLOWUP',
        meetingId: MEETING_VISUAL_RECENT_ID,
        reportId,
        candidateId,
      },
      sourceVersion: 7,
      sourceRoute: '/meetings/follow-ups',
    },
    capabilities: {
      canAccept: false,
      canDecline: false,
      canStart: false,
      canWait: true,
      canComplete: true,
      canReassign: false,
      canCancel: true,
    },
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T01:00:00Z',
    acceptedAt: '2026-09-04T01:00:00Z',
    completedAt: null,
  };
  const details: string[] = [];
  const mutations: string[] = [];
  await page.route('**/api/platform/v1/workspace/work-hub/assignments**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET') {
      mutations.push(request.method());
      return fulfill(route, null);
    }
    if (url.pathname.endsWith('/' + assignmentId)) {
      details.push(assignmentId);
      return fulfill(route, task);
    }
    return fulfill(route, {
      items: [task],
      page: 0,
      size: Number(url.searchParams.get('size') || 20),
      totalElements: 1,
      hasMore: false,
    });
  });
  await page.goto('/meetings/home');
  const queue = page.getByTestId('meeting-home-work-items');
  await expect(queue).toContainText(task.title);
  await queue.getByRole('button').click();
  await expect(page).toHaveURL(
    new RegExp('/meetings/follow-ups\\?assignment=' + assignmentId + '$')
  );
  await expect(page.getByTestId('meeting-follow-up-detail')).toContainText(task.description);
  // StrictMode may revalidate the same read; no unrelated detail may fan out.
  expect(details.length).toBeGreaterThan(0);
  expect([...new Set(details)]).toEqual([assignmentId]);
  expect(mutations).toEqual([]);
});

test('home published candidate connects to review without pretending automatic task creation', async ({
  page,
  isMobile,
}, testInfo) => {
  await setup(page, isMobile);
  await page.route(
    `**/api/meetings/v1/meetings/${MEETING_VISUAL_RECENT_ID}/intelligence/reports/latest-published`,
    (route) =>
      fulfill(route, {
        meetingId: MEETING_VISUAL_RECENT_ID,
        reportId,
        runId: candidateId,
        state: 'PUBLISHED',
        audience: 'MEETING_PARTICIPANTS',
        schemaVersion: 'meeting-intelligence-v1',
        retentionUntil: '2030-10-01T00:00:00Z',
        legalHold: false,
        version: 8,
        canCurrentViewerReview: false,
        reviews: [],
        analysis: {
          executiveSummary: { text: 'Published launch recap', citations: [] },
          topics: [],
          decisions: [],
          openQuestions: [],
          risks: [],
          actionItems: [{ text: 'Review the security handoff', citations: [] }],
          conversationClimate: { label: 'ALIGNED', signals: [], citations: [] },
        },
        followUpCandidates: [{ candidateId, sourceVersion: 8, actionItemIndex: 0 }],
      })
  );
  await page.goto('/meetings/home');
  const card = page.getByTestId('meeting-home-candidate');
  await expect(card).toContainText('Review the security handoff');
  await card.screenshot({ path: testInfo.outputPath('home-published-candidate.png') });
  expect(
    (
      await new AxeBuilder({ page })
        .include('#dwp-main-content')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations
  ).toEqual([]);
  await card.getByRole('button', { name: en.followUps.candidates.reviewCandidate }).click();
  await expect(page.getByRole('tab', { name: en.followUps.tabs.CANDIDATES })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(
    page.getByRole('button', { name: en.followUps.candidates.reviewCandidate }).first()
  ).toBeVisible();
});
