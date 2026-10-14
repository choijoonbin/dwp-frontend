// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PERFORMANCE_REVIEW_API_CONTRACTS } from '../../api/performance-review-api';
import { PerformanceReviewWorkspaceView } from '../../components/performance-review-workspace';
import {
  PERFORMANCE_REVIEW_DEFAULT_ENABLED,
  parseAssignedPerformanceReview,
} from '../../model/performance-review-contract';
import { validatePerformanceReviewAnswers } from '../../model/performance-review-draft';
import {
  assignedPerformanceReviewFixture,
  assignedPerformanceReviewWireFixture,
  PERFORMANCE_REVIEW_TEST_HASH,
  PERFORMANCE_REVIEW_TEST_ID,
} from '../../model/performance-review-test-fixtures';

const review = assignedPerformanceReviewFixture();
const validation = validatePerformanceReviewAnswers(review.form, review.answers, true);
const noop = async () => true;
const props = {
  answers: review.answers,
  validation,
  validationVisible: false,
  submission: null,
  dirty: false,
  pendingKind: null,
  commandBusy: false,
  commandConnected: true,
  feedback: null,
  loadFailure: null,
  commandFailure: null,
  denied: false,
  loading: false,
  fetching: false,
  empty: false,
  partial: false,
  onAnswerChange: vi.fn(),
  onSaveDraft: noop,
  onSubmit: noop,
  onRetryPending: noop,
  onReload: noop,
  onDiscardAndReload: noop,
} as const;

type OpenApiOperation = {
  operationId?: string;
  'x-dwp-runtime-default'?: string;
  requestBody?: { content?: Record<string, unknown> };
};

describe('BASE-TFR-PER-013 assigned-review slice', () => {
  it('seals transport separation and every required accessible workspace state', () => {
    const openapi = JSON.parse(
      readFileSync(resolve(process.cwd(), 'libs/api-contracts/openapi/gateway-public.json'), 'utf8')
    ) as {
      paths: Record<string, Record<string, OpenApiOperation>>;
      components: { schemas: Record<string, { additionalProperties?: boolean }> };
    };
    const reviewPath = openapi.paths['/api/people/v1/hris/performance/reviews/{reviewId}']!;
    const submitPath = openapi.paths['/api/people/v1/hris/performance/reviews/{reviewId}/submit']!;
    const iaq022 =
      openapi.paths['/api/people/v1/hris/performance/workbench/multirater-surveys']!.get!;

    expect(PERFORMANCE_REVIEW_API_CONTRACTS.map(({ id, method }) => [id, method])).toEqual([
      ['PEP-PER-012', 'GET'],
      ['PEP-PER-013', 'PATCH'],
      ['PEP-PER-014', 'POST'],
    ]);
    expect(reviewPath.get?.operationId).toBe('people_getAssignedReview');
    expect(reviewPath.patch?.operationId).toBe('people_saveReviewDraft');
    expect(Object.keys(reviewPath.patch?.requestBody?.content ?? {})).toEqual([
      'application/merge-patch+json',
    ]);
    expect(submitPath.post?.operationId).toBe('people_submitReview');
    expect(reviewPath.get?.['x-dwp-runtime-default']).toBe('OFF');
    expect(reviewPath.patch?.['x-dwp-runtime-default']).toBe('OFF');
    expect(submitPath.post?.['x-dwp-runtime-default']).toBe('OFF');
    expect(PERFORMANCE_REVIEW_DEFAULT_ENABLED).toBe(false);
    expect(openapi.components.schemas.people_AssignedReviewV1?.additionalProperties).toBe(false);
    expect(iaq022.operationId).toBe('people_getPerformanceMultiraterSurveyWorkbench');
    expect(JSON.stringify(iaq022)).not.toContain('saveReviewDraft');
    expect(JSON.stringify(iaq022)).not.toContain('submitReview');

    expect(parseAssignedPerformanceReview(assignedPerformanceReviewWireFixture())).toEqual(review);
    expect(validation.valid).toBe(true);
    const loading = renderToStaticMarkup(
      <PerformanceReviewWorkspaceView {...props} loading review={undefined} />
    );
    const empty = renderToStaticMarkup(
      <PerformanceReviewWorkspaceView {...props} empty review={undefined} />
    );
    const denied = renderToStaticMarkup(
      <PerformanceReviewWorkspaceView
        {...props}
        denied
        review={undefined}
        loadFailure={{ kind: 'DENIED', message: 'Unavailable.' }}
      />
    );
    const failed = renderToStaticMarkup(
      <PerformanceReviewWorkspaceView
        {...props}
        review={undefined}
        loadFailure={{ kind: 'FAILED', message: 'The review could not be loaded.' }}
      />
    );
    const partial = renderToStaticMarkup(
      <PerformanceReviewWorkspaceView
        {...props}
        review={review}
        partial
        dirty
        pendingKind="SAVE_DRAFT"
        commandFailure={{
          kind: 'RETRYABLE',
          message: 'The result is not confirmed. Retry the same request.',
        }}
      />
    );
    const submitted = renderToStaticMarkup(
      <PerformanceReviewWorkspaceView
        {...props}
        review={{ ...review, state: 'SUBMITTED', writable: false }}
        submission={{
          submissionId: PERFORMANCE_REVIEW_TEST_ID.submission,
          submissionNo: 1,
          state: 'SUBMITTED',
          contentHash: PERFORMANCE_REVIEW_TEST_HASH,
          submittedAt: '2027-03-01T00:00:00Z',
        }}
        feedback="SUBMITTED"
      />
    );

    expect(loading).toContain('role="status"');
    expect(empty).toContain('Select an assigned review');
    expect(denied).toContain('outside your current assignment');
    expect(denied).not.toContain(PERFORMANCE_REVIEW_TEST_ID.participant);
    expect(failed).toContain('Try again');
    expect(partial).toContain('Some review data may be stale');
    expect(partial).toContain('Retry same request');
    expect(partial).toContain('aria-label="Review form sections"');
    expect(partial).toContain('aria-live="polite"');
    expect(submitted).toContain('Review submitted');
    expect(submitted).toContain('disabled=""');
  });
});
