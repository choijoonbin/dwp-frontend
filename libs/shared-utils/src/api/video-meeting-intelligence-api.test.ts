import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';

import {
  createVideoMeetingIntelligenceRun,
  deleteVideoMeetingIntelligenceReport,
  getLatestPublishedVideoMeetingIntelligenceReport,
  getLatestVisibleVideoMeetingIntelligenceReport,
  getVideoMeetingIntelligenceReport,
  getVideoMeetingIntelligenceReviewerAssignments,
  getVideoMeetingIntelligenceRun,
  grantVideoMeetingIntelligenceAccess,
  publishVideoMeetingIntelligenceReport,
  reviewVideoMeetingIntelligenceReport,
  revokeVideoMeetingIntelligenceAccess,
  type VideoMeetingIntelligenceReport,
  type VideoMeetingIntelligenceRun,
} from './video-meeting-intelligence-api';

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify(status >= 400 ? data : { data }),
  } as Response;
}

function requestAt(fetchMock: ReturnType<typeof vi.fn>, index: number): RequestInit {
  return fetchMock.mock.calls[index]?.[1] as RequestInit;
}

const run: VideoMeetingIntelligenceRun = {
  runId: 'run-1',
  meetingId: 'meeting-1',
  sourceArtifactId: 'artifact-1',
  state: 'FAILED',
  analysisProfile: 'STANDARD_RECAP_V1',
  outputLanguage: 'ko',
  processingRegion: 'ap-northeast-2',
  providerCode: 'governed-provider',
  providerModel: 'recap-v1',
  schemaVersion: 'meeting-intelligence-v1',
  requestedAt: '2026-08-28T00:00:00Z',
  completedAt: '2026-08-28T00:00:03Z',
  failureCode: 'PROVIDER_UNAVAILABLE',
  version: 2,
  reportId: null,
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
      text: 'The team agreed on a phased launch.',
      citations: [{ segmentId: 'segment-1', startMillis: 61_000, endMillis: 68_000 }],
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
  reviews: [],
};

describe('video meeting intelligence API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads run, report, and latest-visible projections through the meeting gateway', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(run))
      .mockResolvedValueOnce(jsonResponse(report))
      .mockResolvedValueOnce(jsonResponse(report));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getVideoMeetingIntelligenceRun('meeting/1', 'run/1')).resolves.toEqual(run);
    await expect(getVideoMeetingIntelligenceReport('meeting/1', 'report/1')).resolves.toEqual(
      report
    );
    await expect(getLatestVisibleVideoMeetingIntelligenceReport('meeting/1')).resolves.toEqual(
      report
    );

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/meetings/v1/meetings/meeting%2F1/intelligence/runs/run%2F1',
      '/api/meetings/v1/meetings/meeting%2F1/intelligence/reports/report%2F1',
      '/api/meetings/v1/meetings/meeting%2F1/intelligence/reports/latest',
    ]);
  });

  it('maps an authoritative latest-visible 404 to unavailable without exposing report existence', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: 'Not found' }, 404));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getLatestVisibleVideoMeetingIntelligenceReport('meeting-1')).resolves.toBeNull();
  });

  it('loads the latest published recap through its dedicated projection route', async () => {
    const published = {
      ...report,
      state: 'PUBLISHED' as const,
      audience: 'MEETING_PARTICIPANTS' as const,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(published));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getLatestPublishedVideoMeetingIntelligenceReport('meeting/1')).resolves.toEqual(
      published
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/meetings/v1/meetings/meeting%2F1/intelligence/reports/latest-published'
    );
  });

  it('loads report-scoped reviewer eligibility without deriving authority in the client', async () => {
    const assignments = {
      reportId: 'report-1',
      reportVersion: 3,
      eligibleParticipants: [
        {
          userId: 41,
          participantId: 'participant-41',
          displayName: 'Independent reviewer',
          participantRole: 'ATTENDEE' as const,
          attendanceState: 'LEFT' as const,
          assignmentEligible: true,
          ineligibleReason: null,
        },
      ],
      activeGrants: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(assignments));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getVideoMeetingIntelligenceReviewerAssignments('meeting/1', 'report/1')
    ).resolves.toEqual(assignments);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/meetings/v1/meetings/meeting%2F1/intelligence/reports/report%2F1/reviewer-assignments'
    );
  });

  it('maps a published recap 404 to unavailable without reusing another report', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: 'Not found' }, 404));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getLatestPublishedVideoMeetingIntelligenceReport('meeting-1')).resolves.toBeNull();
  });

  it('creates a governed run with an idempotency key and preserves a domain-level failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(run, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createVideoMeetingIntelligenceRun('meeting-1', {
        sourceArtifactId: 'artifact-1',
        outputLanguage: 'ko',
        expectedContentPlanVersion: 7,
        idempotencyKey: 'recap-run-0001',
        correlationId: 'correlation-1',
      })
    ).resolves.toMatchObject({ state: 'FAILED', failureCode: 'PROVIDER_UNAVAILABLE' });

    const request = requestAt(fetchMock, 1);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/meetings/v1/meetings/meeting-1/intelligence/runs'
    );
    expect(request.method).toBe('POST');
    expect(request.headers).toMatchObject({
      'Idempotency-Key': 'recap-run-0001',
      'X-Correlation-ID': 'correlation-1',
      'X-XSRF-TOKEN': 'csrf',
    });
    expect(JSON.parse(String(request.body))).toEqual({
      sourceArtifactId: 'artifact-1',
      outputLanguage: 'ko',
      expectedContentPlanVersion: 7,
    });
  });

  it('sends review, publish, delete-version, and ACL commands without widening authority', async () => {
    const approved = { ...report, state: 'APPROVED' as const, version: 4 };
    const published = {
      ...approved,
      state: 'PUBLISHED' as const,
      audience: 'MEETING_PARTICIPANTS' as const,
      version: 5,
    };
    const deleted = { ...published, state: 'DELETED' as const, version: 6 };
    const grant = {
      aclId: 'acl-1',
      reportId: 'report-1',
      principalUserId: 41,
      permission: 'REVIEW' as const,
      grantedAt: '2026-08-28T01:00:00Z',
      grantedBy: 9,
      expiresAt: '2026-08-28T02:00:00Z',
      reasonCode: 'INDEPENDENT_REVIEW',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(approved))
      .mockResolvedValueOnce(jsonResponse(published))
      .mockResolvedValueOnce(jsonResponse(deleted))
      .mockResolvedValueOnce(jsonResponse(grant))
      .mockResolvedValueOnce(jsonResponse(null));
    vi.stubGlobal('fetch', fetchMock);

    await reviewVideoMeetingIntelligenceReport('meeting-1', 'report-1', {
      expectedVersion: 3,
      decision: 'APPROVE',
      reasonCode: 'INDEPENDENT_REVIEW',
    });
    await publishVideoMeetingIntelligenceReport('meeting-1', 'report-1', 4);
    await deleteVideoMeetingIntelligenceReport('meeting-1', 'report-1', 5);
    await grantVideoMeetingIntelligenceAccess('meeting-1', 'report-1', 41, {
      expectedReportVersion: 3,
      permission: 'REVIEW',
      expiresAt: '2026-08-28T02:00:00Z',
      reasonCode: 'INDEPENDENT_REVIEW',
    });
    await revokeVideoMeetingIntelligenceAccess('meeting-1', 'report-1', 41, 'REVIEW', 3);

    expect(JSON.parse(String(requestAt(fetchMock, 1).body))).toEqual({
      expectedVersion: 3,
      decision: 'APPROVE',
      reasonCode: 'INDEPENDENT_REVIEW',
    });
    expect(JSON.parse(String(requestAt(fetchMock, 2).body))).toEqual({ expectedVersion: 4 });
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      '/api/meetings/v1/meetings/meeting-1/intelligence/reports/report-1?expectedVersion=5'
    );
    expect(requestAt(fetchMock, 3).method).toBe('DELETE');
    expect(requestAt(fetchMock, 3).body).toBeUndefined();
    expect(fetchMock.mock.calls[4]?.[0]).toContain('/reports/report-1/acl/41');
    expect(requestAt(fetchMock, 4).method).toBe('PUT');
    expect(JSON.parse(String(requestAt(fetchMock, 4).body))).toEqual({
      expectedReportVersion: 3,
      permission: 'REVIEW',
      expiresAt: '2026-08-28T02:00:00Z',
      reasonCode: 'INDEPENDENT_REVIEW',
    });
    expect(fetchMock.mock.calls[5]?.[0]).toContain(
      '/reports/report-1/acl/41/REVIEW?expectedReportVersion=3'
    );
    expect(requestAt(fetchMock, 5).method).toBe('DELETE');
  });

  it('rejects an unsafe idempotency key before requesting CSRF or report generation', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createVideoMeetingIntelligenceRun('meeting-1', {
        sourceArtifactId: 'artifact-1',
        outputLanguage: 'en',
        expectedContentPlanVersion: 1,
        idempotencyKey: 'bad key',
      })
    ).rejects.toThrow('valid idempotency key');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
