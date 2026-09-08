import { describe, expect, it } from 'vitest';
import type { VideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';
import { selectMeetingFollowUpEvidence } from './meeting-follow-up-evidence';

const source = {
  sourceSystem: 'MEETING_FOLLOWUP',
  meetingId: 'meeting-a',
  reportId: 'report-a',
  candidateId: 'candidate-a',
} as const;
const now = Date.parse('2026-09-07T00:00:00Z');
const action = {
  text: 'Verify the release checklist',
  citations: [{ segmentId: 'seg-a', startMillis: 840000, endMillis: 858000 }],
};
const report: VideoMeetingIntelligenceReport = {
  meetingId: source.meetingId,
  reportId: source.reportId,
  runId: 'run-a',
  state: 'PUBLISHED',
  audience: 'MEETING_PARTICIPANTS',
  schemaVersion: 'meeting-intelligence-v1',
  retentionUntil: '2026-10-01T00:00:00Z',
  legalHold: false,
  version: 7,
  canCurrentViewerReview: false,
  publishedAt: '2026-09-05T00:00:00Z',
  reviews: [],
  followUpCandidates: [{ candidateId: source.candidateId, actionItemIndex: 0, sourceVersion: 7 }],
  analysis: {
    executiveSummary: action,
    actionItems: [action],
    decisions: [],
    topics: [],
    openQuestions: [],
    risks: [],
    conversationClimate: { label: 'ALIGNED', signals: [], citations: [] },
  },
};

describe('Follow-up exact published source evidence', () => {
  it('retains cited timestamps for the explicitly selected authorized action only', () => {
    expect(selectMeetingFollowUpEvidence(report, source, 7, now)).toEqual(action);
  });
  it.each([
    { meetingId: 'another-meeting' },
    { reportId: 'another-report' },
    { version: 8 },
    { state: 'DRAFT' as const },
    { audience: 'PRIVATE_REVIEWERS' as const },
    { publishedAt: null },
    { analysis: null },
    { retentionUntil: '2026-09-07T00:00:00Z' },
    { retentionUntil: 'invalid' },
    {
      followUpCandidates: [
        { candidateId: 'another-candidate', actionItemIndex: 0, sourceVersion: 7 },
      ],
    },
    {
      followUpCandidates: [
        { candidateId: source.candidateId, actionItemIndex: 0, sourceVersion: 8 },
      ],
    },
    {
      followUpCandidates: [
        { candidateId: source.candidateId, actionItemIndex: -1, sourceVersion: 7 },
      ],
    },
  ])('does not substitute inaccessible, expired or mismatched source evidence: %j', (override) => {
    expect(selectMeetingFollowUpEvidence({ ...report, ...override }, source, 7, now)).toBeNull();
  });
  it('retains an authorized report on legal hold after its ordinary retention deadline', () => {
    expect(
      selectMeetingFollowUpEvidence(
        { ...report, legalHold: true, retentionUntil: '2026-09-01T00:00:00Z' },
        source,
        7,
        now
      )
    ).toEqual(action);
  });
});
