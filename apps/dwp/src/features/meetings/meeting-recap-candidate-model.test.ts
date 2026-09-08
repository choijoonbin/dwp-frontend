import { describe, expect, it } from 'vitest';
import type { VideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';
import {
  meetingRecapCandidateHref,
  projectMeetingRecapActionCandidates,
} from './meeting-recap-candidate-model';

const meetingId = '81000000-0000-0000-0000-000000000001';
const reportId = '82000000-0000-0000-0000-000000000001';
const candidateId = '83000000-0000-0000-0000-000000000001';
const now = Date.parse('2026-09-07T00:00:00Z');
function report(
  overrides: Partial<VideoMeetingIntelligenceReport> = {}
): VideoMeetingIntelligenceReport {
  return {
    meetingId,
    reportId,
    state: 'PUBLISHED',
    audience: 'MEETING_PARTICIPANTS',
    version: 2,
    retentionUntil: '2026-10-01T00:00:00Z',
    legalHold: false,
    analysis: {
      actionItems: [
        { text: 'Confirm launch scope', citations: [] },
        { text: 'Unbound action', citations: [] },
      ],
    },
    followUpCandidates: [{ candidateId, sourceVersion: 2, actionItemIndex: 0 }],
    ...overrides,
  } as VideoMeetingIntelligenceReport;
}
describe('exact recap action candidate identity', () => {
  it('links the precise meeting/report/candidate without titles or transcript data in the URL', () => {
    const [candidate] = projectMeetingRecapActionCandidates(meetingId, report(), now);
    expect(candidate).toEqual({
      meetingId,
      reportId,
      candidateId,
      sourceVersion: 2,
      actionItemIndex: 0,
    });
    expect(meetingRecapCandidateHref(candidate)).toBe(
      `/meetings/history?meeting=${meetingId}&reportId=${reportId}&candidateId=${candidateId}`
    );
  });
  it('never manufactures a candidate for an unbound action', () => {
    expect(
      projectMeetingRecapActionCandidates(meetingId, report(), now).map(
        (candidate) => candidate.actionItemIndex
      )
    ).toEqual([0]);
    expect(
      projectMeetingRecapActionCandidates(meetingId, report({ followUpCandidates: undefined }), now)
    ).toEqual([]);
  });
  it.each([
    { meetingId: candidateId },
    { state: 'DRAFT' as const },
    { audience: 'PRIVATE_REVIEWERS' as const },
    { retentionUntil: '2026-09-06T00:00:00Z' },
    { retentionUntil: 'invalid' },
    { version: -1 },
  ])('rejects unavailable or mismatched published source %#', (overrides) => {
    expect(projectMeetingRecapActionCandidates(meetingId, report(overrides), now)).toEqual([]);
  });
  it('permits a retained legal-hold source without guessing an expiry', () => {
    expect(
      projectMeetingRecapActionCandidates(
        meetingId,
        report({ legalHold: true, retentionUntil: '2026-01-01T00:00:00Z' }),
        now
      )
    ).toHaveLength(1);
  });
  it.each([
    { candidateId, sourceVersion: 1, actionItemIndex: 0 },
    { candidateId: 'private-text', sourceVersion: 2, actionItemIndex: 0 },
    { candidateId, sourceVersion: 2, actionItemIndex: -1 },
    { candidateId, sourceVersion: 2, actionItemIndex: 2 },
  ])('rejects stale, invalid, or out-of-range candidate %#', (candidate) => {
    expect(
      projectMeetingRecapActionCandidates(
        meetingId,
        report({ followUpCandidates: [candidate] }),
        now
      )
    ).toEqual([]);
  });
  it('rejects duplicate identity or duplicate action-index bindings instead of choosing arbitrarily', () => {
    const duplicate = { candidateId, sourceVersion: 2, actionItemIndex: 0 };
    expect(
      projectMeetingRecapActionCandidates(
        meetingId,
        report({ followUpCandidates: [duplicate, duplicate] }),
        now
      )
    ).toEqual([]);
    expect(
      projectMeetingRecapActionCandidates(
        meetingId,
        report({ followUpCandidates: [duplicate, { ...duplicate, candidateId: meetingId }] }),
        now
      )
    ).toEqual([]);
  });
});
