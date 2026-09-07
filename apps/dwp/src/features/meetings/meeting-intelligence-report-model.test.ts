import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { VideoMeetingArtifact } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type {
  VideoMeetingIntelligenceReport,
  VideoMeetingIntelligenceRun,
} from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

import {
  MeetingIntelligenceReportView,
  type MeetingIntelligenceReportLabels,
} from './meeting-intelligence-report';
import {
  deriveMeetingIntelligenceActions,
  deriveMeetingIntelligenceSurfaceState,
  formatMeetingIntelligenceCitation,
  formatMeetingIntelligenceTimestamp,
  meetingIntelligenceTimestampDuration,
  selectFreshlyAuthorizedMeetingIntelligenceReport,
  selectMeetingIntelligenceReportForViewer,
} from './meeting-intelligence-report-model';

const transcript: VideoMeetingArtifact = {
  artifactId: 'artifact-1',
  artifactType: 'TRANSCRIPT',
  artifactState: 'AVAILABLE',
  metadata: {},
  version: 2,
};

const run: VideoMeetingIntelligenceRun = {
  runId: 'run-1',
  meetingId: 'meeting-1',
  sourceArtifactId: 'artifact-1',
  state: 'SUCCEEDED',
  analysisProfile: 'STANDARD_RECAP_V1',
  outputLanguage: 'en',
  processingRegion: 'ap-northeast-2',
  providerCode: 'governed-provider',
  providerModel: 'recap-v1',
  schemaVersion: 'meeting-intelligence-v1',
  requestedAt: '2026-08-28T00:00:00Z',
  completedAt: '2026-08-28T00:00:04Z',
  failureCode: null,
  version: 2,
  reportId: 'report-1',
};

const report: VideoMeetingIntelligenceReport = {
  reportId: 'report-1',
  meetingId: 'meeting-1',
  runId: 'run-1',
  state: 'DRAFT',
  audience: 'PRIVATE_REVIEWERS',
  schemaVersion: 'meeting-intelligence-v1',
  retentionUntil: '2026-09-27T00:00:00Z',
  legalHold: false,
  approvedAt: null,
  publishedAt: null,
  version: 3,
  canCurrentViewerReview: true,
  analysis: {
    executiveSummary: {
      text: 'Launch in two governed phases.',
      citations: [{ segmentId: 'segment-1', startMillis: 61_000, endMillis: 68_000 }],
    },
    topics: [
      {
        text: 'Launch sequence',
        citations: [{ segmentId: 'segment-2', startMillis: 75_000, endMillis: 78_000 }],
      },
    ],
    decisions: [{ text: 'Start with the internal cohort.', citations: [] }],
    actionItems: [{ text: 'Publish the rollout checklist.', citations: [] }],
    openQuestions: [{ text: 'Confirm the external launch date.', citations: [] }],
    risks: [{ text: 'Migration capacity remains unverified.', citations: [] }],
    conversationClimate: {
      label: 'MIXED',
      signals: ['CONSTRUCTIVE_DISAGREEMENT'],
      citations: [{ segmentId: 'segment-3', startMillis: 3_661_000, endMillis: 3_665_000 }],
    },
  },
  reviews: [],
};

const labels: MeetingIntelligenceReportLabels = {
  title: 'AI meeting recap',
  description: 'A governed, evidence-linked meeting summary.',
  loading: 'Loading AI recap',
  loadErrorTitle: 'Could not load AI recap',
  loadErrorDescription: 'Try again.',
  retry: 'Retry',
  refresh: 'Refresh',
  refreshing: 'Refreshing',
  states: {
    UNAVAILABLE: 'Unavailable',
    PROCESSING: 'Processing',
    FAILURE: 'Failed',
    DRAFT: 'Draft',
    APPROVED: 'Approved',
    PUBLISHED: 'Published',
    REJECTED: 'Rejected',
    DELETED: 'Deleted',
  },
  stateDescriptions: {
    UNAVAILABLE: 'No visible report exists.',
    PROCESSING: 'The governed agent is processing the transcript.',
    FAILURE: 'Generation did not complete.',
    DRAFT: 'A private draft awaits independent review.',
    APPROVED: 'The reviewed report is ready for explicit publication.',
    PUBLISHED: 'Meeting participants can view this report.',
    REJECTED: 'A reviewer rejected this draft.',
    DELETED: 'The report content is no longer available.',
  },
  generate: 'Generate recap',
  regenerate: 'Generate new recap',
  generating: 'Generating recap',
  generateBlockers: {
    NOT_HOST: 'Only a host can generate a recap.',
    PROCESSING: 'A recap run is already processing.',
    TRANSCRIPT_NOT_AVAILABLE: 'An available transcript is required.',
    CONTENT_PLAN_NOT_AVAILABLE: 'A current content plan is required.',
  },
  actionError: 'The action could not be completed. Refresh before trying again.',
  processing: 'Keep this view open or return later.',
  failureCode: (value) => `Failure code: ${value}`,
  disclaimerTitle: 'Meeting-level assistance only',
  disclaimerDescription:
    'This report is not an assessment of any participant’s emotion, intent, or performance.',
  evidenceTitle: 'Evidence and custody',
  evidenceDescription: 'Every conclusion must remain traceable to transcript timestamps.',
  retentionUntil: (value) => `Retained until ${value}`,
  legalHold: 'Legal hold',
  schemaVersion: (value) => `Schema ${value}`,
  sections: {
    executiveSummary: 'Executive summary',
    topics: 'Topics',
    decisions: 'Decisions',
    actionItems: 'Action items',
    openQuestions: 'Open questions',
    risks: 'Risks',
    conversationClimate: 'Conversation climate',
  },
  sectionEmpty: 'No evidence-backed item was identified.',
  citationLabel: (value) => `Transcript ${value}`,
  citationDetail: (segmentId, value) => `Transcript evidence ${segmentId}, ${value}`,
  citationSeek: (segmentId, value) => `Seek recording to ${segmentId}, ${value}`,
  climateDescription:
    'This meeting-level signal is not person-level emotion or performance inference.',
  climateLabels: {
    ALIGNED: 'Aligned',
    MIXED: 'Mixed',
    CONTESTED: 'Contested',
    INSUFFICIENT_EVIDENCE: 'Insufficient evidence',
  },
  climateSignals: {
    CONSTRUCTIVE_DISAGREEMENT: 'Constructive disagreement',
    UNRESOLVED_DISAGREEMENT: 'Unresolved disagreement',
    LOW_TRANSCRIPT_EVIDENCE: 'Low transcript evidence',
  },
  reviewTitle: 'Independent review',
  reviewDescription: 'Approve or reject the evidence-linked draft.',
  reviewSeparationNote: 'The requester cannot review the same report.',
  reviewReasonLabel: 'Review reason',
  reviewReasonPlaceholder: 'Select a reason',
  reviewReasons: [
    { code: 'INDEPENDENT_REVIEW', label: 'Independent review completed' },
    { code: 'EVIDENCE_INSUFFICIENT', label: 'Evidence is insufficient' },
  ],
  approve: 'Approve draft',
  approving: 'Approving draft',
  reject: 'Reject draft',
  rejecting: 'Rejecting draft',
  publishTitle: 'Publish to meeting participants',
  publishDescription: 'Publication is explicit and changes the report audience.',
  publish: 'Publish recap',
  publishing: 'Publishing recap',
};

describe('meeting intelligence report state model', () => {
  it('drops cached report data when the latest authorization revalidation fails', () => {
    expect(selectFreshlyAuthorizedMeetingIntelligenceReport(report, false)).toBe(report);
    expect(selectFreshlyAuthorizedMeetingIntelligenceReport(report, true)).toBeUndefined();
  });

  it('represents processing and domain failure ahead of a previous report state', () => {
    expect(deriveMeetingIntelligenceSurfaceState(report, { ...run, state: 'RUNNING' })).toBe(
      'PROCESSING'
    );
    expect(deriveMeetingIntelligenceSurfaceState(report, { ...run, state: 'FAILED' })).toBe(
      'FAILURE'
    );
    expect(deriveMeetingIntelligenceSurfaceState(report, run)).toBe('DRAFT');
    expect(deriveMeetingIntelligenceSurfaceState(null, null)).toBe('UNAVAILABLE');
  });

  it('exposes a draft only when the backend grants the current viewer review authority', () => {
    expect(selectMeetingIntelligenceReportForViewer(report, false)).toBe(report);
    expect(
      selectMeetingIntelligenceReportForViewer({ ...report, canCurrentViewerReview: false }, false)
    ).toBeNull();
    expect(selectMeetingIntelligenceReportForViewer(report, true)).toBe(report);
    expect(
      selectMeetingIntelligenceReportForViewer(
        { ...report, state: 'PUBLISHED', audience: 'MEETING_PARTICIPANTS' },
        false
      )
    ).toMatchObject({ reportId: 'report-1' });
    expect(
      selectMeetingIntelligenceReportForViewer({ ...report, state: 'DELETED' }, true)
    ).toBeNull();
  });

  it('requires host authority, an available transcript, and a current plan before generation', () => {
    expect(
      deriveMeetingIntelligenceActions({
        canHost: true,
        transcriptArtifact: transcript,
        contentPlanVersion: 0,
      })
    ).toMatchObject({ canGenerate: true, generateBlocker: null });
    expect(
      deriveMeetingIntelligenceActions({
        canHost: true,
        transcriptArtifact: { ...transcript, artifactState: 'PROCESSING' },
        contentPlanVersion: 2,
      }).generateBlocker
    ).toBe('TRANSCRIPT_NOT_AVAILABLE');
    expect(
      deriveMeetingIntelligenceActions({
        canHost: false,
        transcriptArtifact: transcript,
        contentPlanVersion: 2,
      }).generateBlocker
    ).toBe('NOT_HOST');
  });

  it('allows delegated draft review but keeps publication host-only', () => {
    expect(
      deriveMeetingIntelligenceActions({
        canHost: true,
        transcriptArtifact: transcript,
        contentPlanVersion: 2,
        report,
      })
    ).toMatchObject({ canApprove: true, canReject: true, canPublish: false });
    expect(
      deriveMeetingIntelligenceActions({
        canHost: false,
        transcriptArtifact: transcript,
        contentPlanVersion: 2,
        report,
      })
    ).toMatchObject({ canApprove: true, canReject: true, canPublish: false });
    expect(
      deriveMeetingIntelligenceActions({
        canHost: true,
        transcriptArtifact: transcript,
        contentPlanVersion: 2,
        report: { ...report, state: 'APPROVED' },
      })
    ).toMatchObject({ canApprove: false, canReject: false, canPublish: true });
  });

  it('keeps the requester from reviewing their own draft', () => {
    expect(
      deriveMeetingIntelligenceActions({
        canHost: true,
        transcriptArtifact: transcript,
        contentPlanVersion: 2,
        report: { ...report, canCurrentViewerReview: false },
      })
    ).toMatchObject({ canApprove: false, canReject: false, canPublish: false });
  });

  it('formats stable transcript evidence timestamps and durations', () => {
    expect(formatMeetingIntelligenceTimestamp(61_000)).toBe('01:01');
    expect(formatMeetingIntelligenceTimestamp(3_661_000)).toBe('01:01:01');
    expect(
      formatMeetingIntelligenceCitation({
        segmentId: 'segment-1',
        startMillis: 61_000,
        endMillis: 68_000,
      })
    ).toBe('01:01–01:08');
    expect(meetingIntelligenceTimestampDuration(3_661_000)).toBe('PT1H1M1S');
  });
});

describe('meeting intelligence report view', () => {
  it('renders every evidence section, citation time, and the non-evaluation boundary', () => {
    const published = {
      ...report,
      state: 'PUBLISHED' as const,
      audience: 'MEETING_PARTICIPANTS' as const,
    };
    const actions = deriveMeetingIntelligenceActions({
      canHost: false,
      transcriptArtifact: transcript,
      contentPlanVersion: 2,
      report: published,
    });
    const markup = renderToStaticMarkup(
      createElement(MeetingIntelligenceReportView, {
        state: 'PUBLISHED',
        report: published,
        run,
        canHost: false,
        actions,
        labels,
        locale: 'en',
        reviewReason: '',
        isRefreshing: false,
        isGenerating: false,
        reviewDecision: null,
        isPublishing: false,
        actionError: false,
        onReviewReasonChange: () => undefined,
        onRefresh: () => undefined,
        onGenerate: () => undefined,
        onReview: () => undefined,
        onPublish: () => undefined,
      })
    );

    expect(markup).toContain('Executive summary');
    expect(markup).toContain('Topics');
    expect(markup).toContain('Decisions');
    expect(markup).toContain('Action items');
    expect(markup).toContain('Open questions');
    expect(markup).toContain('Risks');
    expect(markup).toContain('Conversation climate');
    expect(markup).toContain('Transcript 01:01–01:08');
    expect(markup).toContain('dateTime="PT1M1S"');
    expect(markup).toContain(
      'not an assessment of any participant’s emotion, intent, or performance'
    );
    expect(markup).not.toContain('Generate recap');
    expect(markup).not.toContain('Approve draft');
    expect(markup).not.toContain('Publish recap');
  });

  it('renders review controls for a delegated reviewer without host-only actions', () => {
    const actions = deriveMeetingIntelligenceActions({
      canHost: false,
      transcriptArtifact: transcript,
      contentPlanVersion: 2,
      report,
    });
    const markup = renderToStaticMarkup(
      createElement(MeetingIntelligenceReportView, {
        state: 'DRAFT',
        report,
        run,
        canHost: false,
        actions,
        labels,
        locale: 'en',
        reviewReason: 'INDEPENDENT_REVIEW',
        isRefreshing: false,
        isGenerating: false,
        reviewDecision: null,
        isPublishing: false,
        actionError: false,
        onReviewReasonChange: () => undefined,
        onRefresh: () => undefined,
        onGenerate: () => undefined,
        onReview: () => undefined,
        onPublish: () => undefined,
      })
    );

    expect(markup).not.toContain('Generate new recap');
    expect(markup).toContain('Independent review');
    expect(markup).toContain('Approve draft');
    expect(markup).toContain('Reject draft');
    expect(markup).not.toContain('Publish recap');
  });
});
