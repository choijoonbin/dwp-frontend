import { describe, expect, it } from 'vitest';

import type { VideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

import { derivePublishedMeetingRecap } from './meeting-recap-intelligence-model';

const publishedReport: VideoMeetingIntelligenceReport = {
  reportId: 'report-published',
  meetingId: 'meeting-1',
  runId: 'run-1',
  state: 'PUBLISHED',
  audience: 'MEETING_PARTICIPANTS',
  schemaVersion: 'meeting-intelligence-v1',
  retentionUntil: '2026-09-29T00:00:00Z',
  legalHold: false,
  approvedAt: '2026-08-29T00:03:00Z',
  publishedAt: '2026-08-29T00:04:00Z',
  version: 4,
  canCurrentViewerReview: false,
  analysis: {
    executiveSummary: { text: 'Published summary', citations: [] },
    topics: [{ text: 'Launch readiness', citations: [] }],
    decisions: [{ text: 'Published decision', citations: [] }],
    actionItems: [{ text: 'Published action', citations: [] }],
    openQuestions: [{ text: 'Who owns rollback?', citations: [] }],
    risks: [{ text: 'Regional capacity remains unverified', citations: [] }],
    conversationClimate: {
      label: 'INSUFFICIENT_EVIDENCE',
      signals: ['LOW_TRANSCRIPT_EVIDENCE'],
      citations: [],
    },
  },
  reviews: [],
};

describe('published meeting recap projection', () => {
  it('projects summary, decisions, and actions from one published report', () => {
    expect(derivePublishedMeetingRecap(publishedReport, false)).toEqual({
      state: 'READY',
      reportId: 'report-published',
      publishedAt: '2026-08-29T00:04:00Z',
      summary: 'Published summary',
      topics: ['Launch readiness'],
      decisions: ['Published decision'],
      actionItems: ['Published action'],
      openQuestions: ['Who owns rollback?'],
      risks: ['Regional capacity remains unverified'],
      conversationClimate: {
        label: 'INSUFFICIENT_EVIDENCE',
        signals: ['LOW_TRANSCRIPT_EVIDENCE'],
        citations: [],
      },
    });
  });

  it('rejects a draft even when its analysis is present', () => {
    expect(
      derivePublishedMeetingRecap(
        { ...publishedReport, state: 'DRAFT', audience: 'PRIVATE_REVIEWERS' },
        false
      )
    ).toMatchObject({ state: 'FAILED', decisions: [], actionItems: [] });
  });

  it('drops a cached published report after authorization or refresh failure', () => {
    expect(derivePublishedMeetingRecap(publishedReport, true)).toEqual({
      state: 'FAILED',
      summary: null,
      topics: [],
      decisions: [],
      actionItems: [],
      openQuestions: [],
      risks: [],
      conversationClimate: null,
    });
  });
});
