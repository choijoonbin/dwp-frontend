import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

import { resetCsrfToken } from '../axios-instance';

import {
  createVideoMeetingIntelligenceRun,
  deleteVideoMeetingIntelligenceReport,
  downloadVideoMeetingIntelligenceReport,
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
    vi.restoreAllMocks();
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

  it.each([
    ['latest visible', getLatestVisibleVideoMeetingIntelligenceReport],
    ['latest published', getLatestPublishedVideoMeetingIntelligenceReport],
  ])('cancels the %s transport when the viewer scope is discarded', async (_, read) => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_: unknown, init: RequestInit) => {
      receivedSignal = init.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        receivedSignal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        );
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const pending = read('meeting-1', controller.signal);
    await vi.waitFor(() => expect(receivedSignal).toBeDefined());
    controller.abort();

    await expect(pending).rejects.toBeDefined();
    expect(receivedSignal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it('downloads an exact version-bound report only through the audited owner endpoint', async () => {
    const exportBlob = new Blob(['published recap'], { type: 'text/markdown' });
    const exportDigest = createHash('sha256').update('published recap').digest('hex');
    const digestSpy = vi.spyOn(globalThis.crypto.subtle, 'digest');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Type': 'text/markdown',
          'X-DWP-Report-Version': '7',
          'X-DWP-Content-SHA256': exportDigest,
        }),
        blob: async () => exportBlob,
      } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      downloadVideoMeetingIntelligenceReport(
        'meeting/1',
        'report/1',
        7,
        'MARKDOWN',
        {
          mode: 'SECURE',
          rolloutState: '111',
          expectedDecisionRevision: 'decision-revision-7',
          contextKey: 'meeting-context',
          contextScopeKey: 'meeting-scope',
        },
        'recap-export-001'
      )
    ).resolves.toBe(exportBlob);

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/meetings/v1/meetings/meeting%2F1/intelligence/reports/report%2F1/exports?contextScopeKey=meeting-scope'
    );
    const request = requestAt(fetchMock, 1);
    expect(request.method).toBe('POST');
    expect(request.headers).toMatchObject({
      Accept: 'text/markdown',
      'Content-Type': 'application/json',
      'X-Correlation-ID': 'recap-export-001',
      'X-DWP-Expected-Decision-Revision': 'decision-revision-7',
      'X-XSRF-TOKEN': 'csrf',
    });
    expect(JSON.parse(String(request.body))).toEqual({
      expectedReportVersion: 7,
      format: 'MARKDOWN',
    });
    expect(digestSpy.mock.calls[0]?.[1]).toBeInstanceOf(Uint8Array);
  });

  it('rejects a response whose version evidence does not match the observed report', async () => {
    const content = 'published recap';
    const exportBlob = new Blob([content], { type: 'application/json' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-DWP-Report-Version': '6',
          'X-DWP-Content-SHA256': createHash('sha256').update(content).digest('hex'),
        }),
        blob: async () => exportBlob,
      } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      downloadVideoMeetingIntelligenceReport('meeting-1', 'report-1', 7, 'JSON', {
        mode: 'LEGACY_COMPATIBILITY',
        rolloutState: '100',
      })
    ).rejects.toThrow('export evidence is invalid');
  });

  it('rejects a response whose content digest evidence does not match', async () => {
    const exportBlob = new Blob(['substituted recap'], { type: 'application/json' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-DWP-Report-Version': '7',
          'X-DWP-Content-SHA256': '0'.repeat(64),
        }),
        blob: async () => exportBlob,
      } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      downloadVideoMeetingIntelligenceReport('meeting-1', 'report-1', 7, 'JSON', {
        mode: 'LEGACY_COMPATIBILITY',
        rolloutState: '100',
      })
    ).rejects.toThrow('integrity check failed');
  });

  it('rejects an invalid export version before requesting CSRF or report content', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      downloadVideoMeetingIntelligenceReport('meeting-1', 'report-1', 0, 'JSON', {
        mode: 'LEGACY_COMPATIBILITY',
        rolloutState: '100',
      })
    ).rejects.toThrow('valid report version');
    expect(fetchMock).not.toHaveBeenCalled();
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
