import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  axiosInstance as ActualAxiosInstance,
  ProductSurfaceGovernedMutationAuthority,
  resetCsrfToken as ActualResetCsrfToken,
} from '@dwp-frontend/shared-utils';

type ActualSharedUtils = {
  axiosInstance: typeof ActualAxiosInstance;
  resetCsrfToken: typeof ActualResetCsrfToken;
};

const transport = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: transport,
}));

import {
  readAssignedPerformanceReview,
  saveAssignedPerformanceReviewDraft,
  submitAssignedPerformanceReview,
} from './performance-review-api';
import {
  assignedPerformanceReviewFixture,
  assignedPerformanceReviewWireFixture,
  PERFORMANCE_REVIEW_TEST_ETAG,
  PERFORMANCE_REVIEW_TEST_HASH,
  PERFORMANCE_REVIEW_TEST_ID,
} from '../model/performance-review-test-fixtures';

const authority = {
  mode: 'SECURE',
  rolloutState: '111',
  expectedDecisionRevision: 'decision-42',
  contextKey: 'hcm.operations',
  contextScopeKey: 'scope:assigned-review',
  objectVersion: 7,
  idempotencyKey: 'review-command-00000001',
} as const satisfies ProductSurfaceGovernedMutationAuthority;

const execution = {
  authority,
  idempotencyKey: 'review-command-00000001',
  expectedVersion: 7,
  etag: PERFORMANCE_REVIEW_TEST_ETAG,
};

function directResponse(data: unknown, etag?: string) {
  return Promise.resolve({
    data,
    ...(etag ? { headers: new Headers({ ETag: etag }) } : {}),
  });
}

describe('assigned performance-review API', () => {
  beforeEach(() => {
    transport.get.mockReset();
    transport.patch.mockReset();
    transport.post.mockReset();
  });

  it('loads the exact assigned review and binds the returned ETag', async () => {
    const signal = new AbortController().signal;
    transport.get.mockImplementation(() =>
      directResponse(assignedPerformanceReviewWireFixture(), PERFORMANCE_REVIEW_TEST_ETAG)
    );
    await expect(
      readAssignedPerformanceReview(
        PERFORMANCE_REVIEW_TEST_ID.review,
        authority.contextScopeKey,
        signal
      )
    ).resolves.toMatchObject({
      etag: PERFORMANCE_REVIEW_TEST_ETAG,
      review: { reviewId: PERFORMANCE_REVIEW_TEST_ID.review, aggregateVersion: 7 },
    });
    expect(transport.get).toHaveBeenCalledWith(
      '/api/people/v1/hris/performance/reviews/' + PERFORMANCE_REVIEW_TEST_ID.review,
      { contextScopeKey: authority.contextScopeKey, signal }
    );
  });

  it('saves merge-patch with stable idempotency, decision revision, and opaque CAS', async () => {
    const saved = assignedPerformanceReviewWireFixture() as Record<string, unknown>;
    saved.aggregateVersion = 8;
    const nextEtag = '"review:8:' + 'd'.repeat(64) + '"';
    transport.patch.mockImplementation(() => directResponse(saved, nextEtag));
    const body = { answers: assignedPerformanceReviewFixture().answers };

    await expect(
      saveAssignedPerformanceReviewDraft(PERFORMANCE_REVIEW_TEST_ID.review, body, execution)
    ).resolves.toMatchObject({ etag: nextEtag, review: { aggregateVersion: 8 } });
    const mergePatchBody = transport.patch.mock.calls[0]![1] as Blob;
    expect(mergePatchBody).toBeInstanceOf(Blob);
    expect(mergePatchBody.type).toBe('application/merge-patch+json');
    await expect(mergePatchBody.text().then((text) => JSON.parse(text))).resolves.toEqual(body);
    expect(transport.patch).toHaveBeenCalledWith(
      '/api/people/v1/hris/performance/reviews/' + PERFORMANCE_REVIEW_TEST_ID.review,
      mergePatchBody,
      {
        contextScopeKey: authority.contextScopeKey,
        headers: {
          'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision,
          'Idempotency-Key': execution.idempotencyKey,
          'If-Match': PERFORMANCE_REVIEW_TEST_ETAG,
          'Content-Type': 'application/merge-patch+json',
        },
      }
    );
  });

  it('preserves merge-patch media and bytes through the real shared browser transport', async () => {
    const actual = await vi.importActual<ActualSharedUtils>('@dwp-frontend/shared-utils');
    actual.resetCsrfToken();
    const wireBody = { answers: assignedPerformanceReviewFixture().answers };
    const mergePatchBody = new Blob([JSON.stringify(wireBody)], {
      type: 'application/merge-patch+json',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(assignedPerformanceReviewWireFixture()), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ETag: PERFORMANCE_REVIEW_TEST_ETAG },
        })
      );
    vi.stubGlobal('fetch', fetchMock);
    try {
      await actual.axiosInstance.patch(
        '/api/people/v1/hris/performance/reviews/' + PERFORMANCE_REVIEW_TEST_ID.review,
        mergePatchBody,
        { headers: { 'Content-Type': 'application/merge-patch+json' } }
      );
      const request = fetchMock.mock.calls[1]![1] as RequestInit;
      const headers = new Headers(request.headers);
      expect(headers.get('Content-Type')).toBe('application/merge-patch+json');
      expect(request.body).toBe(mergePatchBody);
      await expect((request.body as Blob).text().then((text) => JSON.parse(text))).resolves.toEqual(
        wireBody
      );
    } finally {
      actual.resetCsrfToken();
      vi.unstubAllGlobals();
    }
  });

  it('submits only the saved digest with the same CAS envelope', async () => {
    const body = { draftContentHash: PERFORMANCE_REVIEW_TEST_HASH, acknowledgement: true as const };
    const submittedAt = '2027-03-01T00:00:00Z';
    transport.post.mockImplementation(() =>
      directResponse({
        submissionId: PERFORMANCE_REVIEW_TEST_ID.submission,
        submissionNo: 1,
        state: 'SUBMITTED',
        contentHash: PERFORMANCE_REVIEW_TEST_HASH,
        submittedAt,
      })
    );

    await expect(
      submitAssignedPerformanceReview(PERFORMANCE_REVIEW_TEST_ID.review, body, execution)
    ).resolves.toMatchObject({ contentHash: PERFORMANCE_REVIEW_TEST_HASH, submittedAt });
    expect(transport.post).toHaveBeenCalledWith(
      '/api/people/v1/hris/performance/reviews/' + PERFORMANCE_REVIEW_TEST_ID.review + '/submit',
      body,
      expect.objectContaining({
        contextScopeKey: authority.contextScopeKey,
        headers: expect.objectContaining({
          'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision,
          'Idempotency-Key': execution.idempotencyKey,
          'If-Match': PERFORMANCE_REVIEW_TEST_ETAG,
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('classifies a mismatched 2xx submission hash as post-dispatch ambiguity', async () => {
    transport.post.mockImplementation(() =>
      directResponse({
        submissionId: PERFORMANCE_REVIEW_TEST_ID.submission,
        submissionNo: 1,
        state: 'SUBMITTED',
        contentHash: 'b'.repeat(64),
        submittedAt: '2027-03-01T00:00:00Z',
      })
    );
    await expect(
      submitAssignedPerformanceReview(
        PERFORMANCE_REVIEW_TEST_ID.review,
        { draftContentHash: PERFORMANCE_REVIEW_TEST_HASH, acknowledgement: true },
        execution
      )
    ).rejects.toMatchObject({ name: 'HttpTransportError', reason: 'NETWORK' });
  });

  it('rejects a save response that advances beyond the single sealed CAS transition', async () => {
    const overAdvanced = assignedPerformanceReviewWireFixture();
    overAdvanced.aggregateVersion = 9;
    transport.patch.mockImplementation(() =>
      directResponse(overAdvanced, '"review:9:' + 'd'.repeat(64) + '"')
    );
    await expect(
      saveAssignedPerformanceReviewDraft(
        PERFORMANCE_REVIEW_TEST_ID.review,
        { answers: [...assignedPerformanceReviewFixture().answers] },
        execution
      )
    ).rejects.toMatchObject({ name: 'HttpTransportError', reason: 'NETWORK' });
  });

  it('uses the generated length-only idempotency contract without a local ASCII shadow rule', async () => {
    const generatedKey = 'review-command-é-0001';
    const saved = assignedPerformanceReviewWireFixture();
    saved.aggregateVersion = 8;
    transport.patch.mockImplementation(() =>
      directResponse(saved, '"review:8:' + 'd'.repeat(64) + '"')
    );
    await expect(
      saveAssignedPerformanceReviewDraft(
        PERFORMANCE_REVIEW_TEST_ID.review,
        { answers: [...assignedPerformanceReviewFixture().answers] },
        {
          ...execution,
          idempotencyKey: generatedKey,
          authority: { ...authority, idempotencyKey: generatedKey },
        }
      )
    ).resolves.toMatchObject({ review: { aggregateVersion: 8 } });
    expect(transport.patch).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Blob),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': generatedKey }),
      })
    );
  });

  it('canonicalizes an uppercase UUID locator before path binding and identity comparison', async () => {
    const uppercase = PERFORMANCE_REVIEW_TEST_ID.review.toUpperCase();
    transport.get.mockImplementation(() =>
      directResponse(assignedPerformanceReviewWireFixture(), PERFORMANCE_REVIEW_TEST_ETAG)
    );
    await expect(readAssignedPerformanceReview(uppercase)).resolves.toMatchObject({
      review: { reviewId: PERFORMANCE_REVIEW_TEST_ID.review },
    });
    expect(transport.get).toHaveBeenCalledWith(
      '/api/people/v1/hris/performance/reviews/' + PERFORMANCE_REVIEW_TEST_ID.review,
      undefined
    );
  });

  it('rejects an invented response envelope instead of unsealing its nested payload', async () => {
    transport.get.mockResolvedValue({
      data: {
        status: 'SUCCESS',
        message: '',
        data: assignedPerformanceReviewWireFixture(),
      },
      headers: new Headers({ ETag: PERFORMANCE_REVIEW_TEST_ETAG }),
    });
    await expect(readAssignedPerformanceReview(PERFORMANCE_REVIEW_TEST_ID.review)).rejects.toThrow(
      'Assigned performance-review payload is invalid'
    );
  });

  it('fails closed before mutation when authority or response ETag is missing', async () => {
    transport.get.mockImplementation(() => directResponse(assignedPerformanceReviewWireFixture()));
    await expect(readAssignedPerformanceReview(PERFORMANCE_REVIEW_TEST_ID.review)).rejects.toThrow(
      'Assigned performance-review payload is invalid'
    );
    await expect(
      saveAssignedPerformanceReviewDraft(
        PERFORMANCE_REVIEW_TEST_ID.review,
        { answers: assignedPerformanceReviewFixture().answers },
        {
          ...execution,
          authority: { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' },
        }
      )
    ).rejects.toThrow('Performance-review mutation authority is invalid');
    expect(transport.patch).not.toHaveBeenCalled();

    const saved = assignedPerformanceReviewWireFixture();
    saved.aggregateVersion = 8;
    transport.patch.mockImplementation(() => directResponse(saved));
    await expect(
      saveAssignedPerformanceReviewDraft(
        PERFORMANCE_REVIEW_TEST_ID.review,
        { answers: [...assignedPerformanceReviewFixture().answers] },
        execution
      )
    ).rejects.toMatchObject({ name: 'HttpTransportError', reason: 'NETWORK' });
  });
});
