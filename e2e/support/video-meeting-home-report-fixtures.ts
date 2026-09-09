import type { Page, Route } from '@playwright/test';

export const MEETING_VISUAL_RECENT_ID = '81000000-0000-0000-0000-000000000304';

function fulfill(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data }),
  });
}

export async function mockMeetingVisualHomeReports(page: Page) {
  let revoked = false;
  const citation = { segmentId: 'seg-18', startMillis: 221_000, endMillis: 238_000 };
  await page.route(
    `**/api/meetings/v1/meetings/${MEETING_VISUAL_RECENT_ID}/intelligence/reports/latest*`,
    (route) => {
      if (revoked) {
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Report access revoked' }),
        });
      }
      const published = new URL(route.request().url()).pathname.endsWith('/latest-published');
      return fulfill(route, {
        reportId: published
          ? '88000000-0000-0000-0000-000000000304'
          : '88000000-0000-0000-0000-000000000305',
        meetingId: MEETING_VISUAL_RECENT_ID,
        runId: '87000000-0000-0000-0000-000000000304',
        state: published ? 'PUBLISHED' : 'DRAFT',
        audience: published ? 'MEETING_PARTICIPANTS' : 'REVIEWERS',
        schemaVersion: 'meeting-intelligence-v1',
        retentionUntil: '2026-09-28T01:50:00Z',
        legalHold: false,
        approvedAt: published ? '2026-08-29T02:00:00Z' : null,
        publishedAt: published ? '2026-08-29T02:02:00Z' : null,
        canCurrentViewerReview: !published,
        version: 2,
        analysis: {
          executiveSummary: {
            text: published
              ? 'The group approved a staged launch with an explicit regional checkpoint.'
              : 'Private unreviewed draft text must never appear on the home screen.',
            citations: [citation],
          },
          topics: [],
          decisions: [],
          actionItems: [
            {
              text: 'Confirm the accountable owner for the regional checkpoint.',
              citations: [citation],
            },
          ],
          openQuestions: [],
          risks: [],
          conversationClimate: { label: 'ALIGNED', signals: [], citations: [citation] },
        },
        reviews: [],
        followUpCandidates: published
          ? [
              {
                candidateId: '89000000-0000-4000-8000-000000000309',
                sourceVersion: 2,
                actionItemIndex: 0,
              },
            ]
          : [],
      });
    }
  );
  return { revoke: () => (revoked = true) };
}
