import { describe, expect, it, vi } from 'vitest';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type { VideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

const api = vi.hoisted(() => ({ latest: vi.fn(), published: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-intelligence-api', () => ({
  getLatestVisibleVideoMeetingIntelligenceReport: api.latest,
  getLatestPublishedVideoMeetingIntelligenceReport: api.published,
}));

import {
  boundMeetingHomeResults,
  createMeetingHomeResultsLoader,
  meetingHomeResultReviewPath,
  meetingHomeResultUnexpired,
} from './meeting-home-results-model';
import { MeetingIntelligenceAuthorizationSupersededError } from './meeting-intelligence-authorization-fence';

const now = Date.parse('2026-09-04T04:00:00Z');
const report: VideoMeetingIntelligenceReport = {
  reportId: 'report-1',
  meetingId: 'meeting-1',
  runId: 'run-1',
  state: 'DRAFT',
  audience: 'PRIVATE_REVIEWERS',
  schemaVersion: 'meeting-intelligence-v1',
  retentionUntil: '2026-09-20T00:00:00Z',
  legalHold: false,
  version: 1,
  canCurrentViewerReview: true,
  reviews: [],
  analysis: {
    executiveSummary: {
      text: 'Private draft that must never appear in the home queue.',
      citations: [],
    },
    topics: [],
    decisions: [],
    actionItems: [],
    openQuestions: [],
    risks: [],
    conversationClimate: { label: 'INSUFFICIENT_EVIDENCE', signals: [], citations: [] },
  },
};

const published: VideoMeetingIntelligenceReport = {
  ...report,
  reportId: 'published-1',
  state: 'PUBLISHED',
  audience: 'MEETING_PARTICIPANTS',
  canCurrentViewerReview: false,
  publishedAt: '2026-09-04T03:00:00Z',
  analysis: {
    ...report.analysis!,
    executiveSummary: { text: 'Published evidence-linked summary.', citations: [] },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('meeting home result contracts', () => {
  it('binds a review queue action to the exact meeting and draft report', () => {
    expect(
      meetingHomeResultReviewPath({
        meetingId: '81000000-0000-4000-8000-000000000001',
        reportId: '82000000-0000-4000-8000-000000000001',
      })
    ).toBe(
      '/meetings/history?meeting=81000000-0000-4000-8000-000000000001&reportId=82000000-0000-4000-8000-000000000001&intent=review'
    );
  });

  it('limits requests to the first four distinct recent meetings without reordering', () => {
    const recent = ['1', '2', '1', '3', '4', '5'].map(
      (meetingId) => ({ meetingId }) as VideoMeetingSummary
    );
    expect(boundMeetingHomeResults(recent).map((meeting) => meeting.meetingId)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
  });

  it('queues only reviewable drafts and never stores draft text in the home projection', async () => {
    const loader = createMeetingHomeResultsLoader(
      'scope',
      'queue',
      async () => report,
      () => now
    );
    const result = await loader.load(['meeting-1']);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].summary).toBeNull();
    expect(JSON.stringify(result)).not.toContain('Private draft');
    expect(JSON.stringify(result)).not.toContain('actionItems');
  });

  it.each([
    { state: 'APPROVED' as const },
    { state: 'PUBLISHED' as const },
    { canCurrentViewerReview: false },
    { analysis: null },
  ])('does not invent a review task for %j', async (override) => {
    const loader = createMeetingHomeResultsLoader(
      'scope',
      'queue',
      async () => ({ ...report, ...override }),
      () => now
    );
    expect((await loader.load(['meeting-1'])).entries).toEqual([]);
  });

  it('loads an older published report separately from a newer private draft', async () => {
    api.latest.mockResolvedValueOnce(report);
    api.published.mockResolvedValueOnce(published);
    const queue = await createMeetingHomeResultsLoader('queue', 'queue', undefined, () => now).load(
      ['meeting-1']
    );
    const recent = await createMeetingHomeResultsLoader(
      'recent',
      'recent',
      undefined,
      () => now
    ).load(['meeting-1']);
    expect(queue.entries[0].reportId).toBe('report-1');
    expect(queue.entries[0].summary).toBeNull();
    expect(recent.entries[0].reportId).toBe('published-1');
    expect(recent.entries[0].summary).toBe('Published evidence-linked summary.');
    expect(api.latest).toHaveBeenCalledWith('meeting-1');
    expect(api.published).toHaveBeenCalledWith('meeting-1');
  });

  it.each([
    { state: 'DRAFT' as const },
    { state: 'APPROVED' as const },
    { audience: 'PRIVATE_REVIEWERS' as const },
    { meetingId: 'other-meeting' },
    { retentionUntil: 'invalid' },
    { retentionUntil: new Date(now).toISOString() },
  ])('rejects a non-public, mismatched or expired recent projection: %j', async (override) => {
    const loader = createMeetingHomeResultsLoader(
      'scope',
      'recent',
      async () => ({ ...published, ...override }),
      () => now
    );
    expect((await loader.load(['meeting-1'])).entries).toEqual([]);
  });

  it('honors a server-authorized legal hold while bounding ordinary retention', () => {
    expect(meetingHomeResultUnexpired({ retentionUntil: '2026-09-01', legalHold: true }, now)).toBe(
      true
    );
    expect(
      meetingHomeResultUnexpired({ retentionUntil: '2026-09-01', legalHold: false }, now)
    ).toBe(false);
  });

  it('treats a missing report as empty but preserves partial failure without an error payload', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(published)
      .mockRejectedValueOnce(new Error('sensitive transport detail'))
      .mockResolvedValueOnce(null);
    const result = await createMeetingHomeResultsLoader('scope', 'recent', read, () => now).load([
      'meeting-1',
      'meeting-2',
      'meeting-3',
    ]);
    expect(result.entries).toHaveLength(1);
    expect(result.failedMeetingIds).toEqual(['meeting-2']);
    expect(JSON.stringify(result)).not.toContain('sensitive transport detail');
  });

  it('does not reuse prior protected content after a failed authorization refresh', async () => {
    const read = vi.fn().mockResolvedValueOnce(published).mockRejectedValueOnce({ status: 403 });
    const loader = createMeetingHomeResultsLoader('scope', 'recent', read, () => now);
    expect((await loader.load(['meeting-1'])).entries).toHaveLength(1);
    expect(await loader.load(['meeting-1'])).toEqual({
      entries: [],
      failedMeetingIds: ['meeting-1'],
    });
  });

  it('suppresses a revoked report immediately while another meeting request remains pending', async () => {
    const slowRequest = deferred<VideoMeetingIntelligenceReport | null>();
    const read = vi
      .fn()
      .mockRejectedValueOnce({ status: 403 })
      .mockReturnValueOnce(slowRequest.promise);
    const suppressed = vi.fn();
    const loader = createMeetingHomeResultsLoader('scope', 'recent', read, () => now);
    const result = loader.load(['meeting-1', 'meeting-2'], undefined, suppressed);
    await vi.waitFor(() => expect(suppressed).toHaveBeenCalledWith('meeting-1'));
    slowRequest.resolve(null);
    expect((await result).entries).toEqual([]);
  });

  it('rejects a late old success after a newer revoked response', async () => {
    const oldRequest = deferred<VideoMeetingIntelligenceReport | null>();
    const read = vi
      .fn()
      .mockReturnValueOnce(oldRequest.promise)
      .mockRejectedValueOnce({ status: 403 });
    const loader = createMeetingHomeResultsLoader('scope', 'recent', read, () => now);
    const oldLoad = loader.load(['meeting-1']);
    const rejected = expect(oldLoad).rejects.toBeInstanceOf(
      MeetingIntelligenceAuthorizationSupersededError
    );
    expect((await loader.load(['meeting-1'])).entries).toEqual([]);
    oldRequest.resolve(published);
    await rejected;
  });

  it('rejects pending results when their identity scope unmounts', async () => {
    const request = deferred<VideoMeetingIntelligenceReport | null>();
    const loader = createMeetingHomeResultsLoader(
      'scope',
      'recent',
      () => request.promise,
      () => now
    );
    const pending = loader.load(['meeting-1']);
    const rejected = expect(pending).rejects.toBeInstanceOf(
      MeetingIntelligenceAuthorizationSupersededError
    );
    loader.revoke();
    request.resolve(published);
    await rejected;
  });

  it('does not commit an aborted fetch even when the underlying adapter resolves later', async () => {
    const controller = new AbortController();
    const loader = createMeetingHomeResultsLoader(
      'scope',
      'recent',
      async () => published,
      () => now
    );
    controller.abort();
    await expect(loader.load(['meeting-1'], controller.signal)).rejects.toBeInstanceOf(
      MeetingIntelligenceAuthorizationSupersededError
    );
  });
});
