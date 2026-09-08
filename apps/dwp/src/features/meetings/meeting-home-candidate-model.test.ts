import { describe, expect, it, vi } from 'vitest';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type { VideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';
import { createMeetingHomeCandidateLoader } from './meeting-home-candidate-model';

const meetingId = '99000000-0000-4000-8000-000000000001';
const reportId = '99000000-0000-4000-8000-000000000002';
const candidateId = '99000000-0000-4000-8000-000000000003';
const meeting = { meetingId, title: 'Planning' } as VideoMeetingSummary;
const report: VideoMeetingIntelligenceReport = {
  meetingId,
  reportId,
  runId: candidateId,
  state: 'PUBLISHED',
  audience: 'MEETING_PARTICIPANTS',
  schemaVersion: 'meeting-intelligence-v1',
  retentionUntil: '2026-10-01T00:00:00Z',
  legalHold: false,
  version: 8,
  canCurrentViewerReview: false,
  reviews: [],
  analysis: {
    executiveSummary: { text: 'Do not copy the whole recap', citations: [] },
    topics: [],
    decisions: [],
    openQuestions: [],
    risks: [],
    actionItems: [{ text: 'Publish rollout checklist', citations: [] }],
    conversationClimate: { label: 'ALIGNED', signals: [], citations: [] },
  },
  followUpCandidates: [{ candidateId, sourceVersion: 8, actionItemIndex: 0 }],
};
const now = () => Date.parse('2026-09-07T01:00:00Z');
describe('home candidate queue exact publication boundary', () => {
  it('projects the current candidate, never private full analysis, through an abortable read', async () => {
    const read = vi.fn().mockResolvedValue(report);
    const controller = new AbortController();
    const result = await createMeetingHomeCandidateLoader('tenant1', read, now).load(
      [meeting, meeting],
      controller.signal
    );
    expect(read).toHaveBeenCalledExactlyOnceWith(meetingId, controller.signal);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].sourceVersion).toBe(8);
    expect(result.entries[0].source).toEqual({
      sourceSystem: 'MEETING_FOLLOWUP',
      meetingId,
      reportId,
      candidateId,
    });
    expect(JSON.stringify(result)).not.toContain('Do not copy');
    expect(JSON.stringify(result)).not.toContain('citations');
  });
  it.each([
    { state: 'DRAFT' },
    { audience: 'PRIVATE_REVIEWERS' },
    { meetingId: candidateId },
    { followUpCandidates: [{ candidateId, sourceVersion: 7, actionItemIndex: 0 }] },
    { retentionUntil: 'not-a-date' },
    { retentionUntil: '2026-09-01T00:00:00Z' },
  ])('conceals private, stale, expired or unbound candidate input: %j', async (override) => {
    const result = await createMeetingHomeCandidateLoader(
      'tenant1',
      vi.fn().mockResolvedValue({ ...report, ...override }),
      now
    ).load([meeting]);
    expect(result.entries).toEqual([]);
  });
  it('treats access failure as unavailable, never an authorized empty response', async () => {
    const result = await createMeetingHomeCandidateLoader(
      'tenant1',
      vi.fn().mockRejectedValue(new Error('403')),
      now
    ).load([meeting]);
    expect(result).toEqual({ entries: [], unavailable: true });
  });
  it.each(['revoke', 'abort'] as const)('rejects late success after %s', async (action) => {
    let finish!: (value: VideoMeetingIntelligenceReport) => void;
    const read = vi.fn().mockReturnValue(
      new Promise((done) => {
        finish = done;
      })
    );
    const controller = new AbortController();
    const loader = createMeetingHomeCandidateLoader('tenant1', read, now);
    const pending = loader.load([meeting], controller.signal);
    const rejected = expect(pending).rejects.toThrow();
    if (action === 'abort') controller.abort();
    else loader.revoke();
    finish(report);
    await rejected;
  });
});
