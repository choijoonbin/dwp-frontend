import {
  axiosInstance,
  HttpTransportError,
  productSurfaceGovernedMutationConfig,
} from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  isPerformanceReviewIdentifier,
  parsePerformanceReviewDraftCommand,
  parsePerformanceReviewEtag,
  parsePerformanceReviewSnapshot,
  parsePerformanceReviewSubmission,
  parseSubmitPerformanceReviewCommand,
  PERFORMANCE_REVIEW_BASE_PATH,
  PERFORMANCE_REVIEW_DATA_CONTRACT,
  PERFORMANCE_REVIEW_DRAFT_CONTRACT,
  PERFORMANCE_REVIEW_SUBMIT_CONTRACT,
} from '../model/performance-review-contract';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  AssignedPerformanceReviewWire,
  PerformanceReviewDraftCommand,
  PerformanceReviewDraftCommandWire,
  PerformanceReviewSnapshot,
  PerformanceReviewSubmission,
  PerformanceReviewSubmissionWire,
  SavedPerformanceReviewWire,
  SubmitPerformanceReviewCommand,
  SubmitPerformanceReviewCommandWire,
} from '../model/performance-review-types';

export const PERFORMANCE_REVIEW_API_CONTRACTS = [
  {
    id: 'PEP-PER-012',
    apiFunction: 'readAssignedPerformanceReview',
    routeContractKey: PERFORMANCE_REVIEW_DATA_CONTRACT,
    method: 'GET',
    path: PERFORMANCE_REVIEW_BASE_PATH + '/{reviewId}',
  },
  {
    id: 'PEP-PER-013',
    apiFunction: 'saveAssignedPerformanceReviewDraft',
    routeContractKey: PERFORMANCE_REVIEW_DRAFT_CONTRACT,
    method: 'PATCH',
    mediaType: 'application/merge-patch+json',
    path: PERFORMANCE_REVIEW_BASE_PATH + '/{reviewId}',
  },
  {
    id: 'PEP-PER-014',
    apiFunction: 'submitAssignedPerformanceReview',
    routeContractKey: PERFORMANCE_REVIEW_SUBMIT_CONTRACT,
    method: 'POST',
    mediaType: 'application/json',
    path: PERFORMANCE_REVIEW_BASE_PATH + '/{reviewId}/submit',
  },
] as const;

export const HCM_PERFORMANCE_REVIEW_MUTATION_API_CONTRACTS = [
  PERFORMANCE_REVIEW_API_CONTRACTS[1],
  PERFORMANCE_REVIEW_API_CONTRACTS[2],
] as const;

export type PerformanceReviewMutationExecution = Readonly<{
  authority: ProductSurfaceGovernedMutationAuthority;
  idempotencyKey: string;
  expectedVersion: number;
  etag: string;
}>;

export type PerformanceReviewDataSource = Readonly<{
  read: (
    reviewId: string,
    contextScopeKey?: string,
    signal?: AbortSignal
  ) => Promise<PerformanceReviewSnapshot>;
  saveDraft: (
    reviewId: string,
    command: PerformanceReviewDraftCommand,
    execution: PerformanceReviewMutationExecution
  ) => Promise<PerformanceReviewSnapshot>;
  submit: (
    reviewId: string,
    command: SubmitPerformanceReviewCommand,
    execution: PerformanceReviewMutationExecution
  ) => Promise<PerformanceReviewSubmission>;
}>;

function reviewPath(reviewId: string): string {
  if (!isPerformanceReviewIdentifier(reviewId)) {
    throw new Error('Performance-review identifier is invalid.');
  }
  return PERFORMANCE_REVIEW_BASE_PATH + '/' + encodeURIComponent(reviewId.toLowerCase());
}

function mutationConfig(
  execution: PerformanceReviewMutationExecution,
  mediaType: 'application/json' | 'application/merge-patch+json'
) {
  const { authority, idempotencyKey, expectedVersion } = execution;
  if (
    authority.mode !== 'SECURE' ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 128 ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0 ||
    (authority.idempotencyKey !== undefined && authority.idempotencyKey !== idempotencyKey) ||
    (authority.objectVersion !== undefined && authority.objectVersion !== expectedVersion)
  ) {
    throw new Error('Performance-review mutation authority is invalid.');
  }
  const governed = productSurfaceGovernedMutationConfig(authority);
  return {
    ...governed,
    headers: {
      ...governed.headers,
      'Content-Type': mediaType,
      'Idempotency-Key': idempotencyKey,
      'If-Match': parsePerformanceReviewEtag(execution.etag),
    },
  };
}

export async function readAssignedPerformanceReview(
  reviewId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<PerformanceReviewSnapshot> {
  const response = await axiosInstance.get<AssignedPerformanceReviewWire>(
    reviewPath(reviewId),
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  const snapshot = parsePerformanceReviewSnapshot(response.data, response.headers?.get('ETag'));
  if (snapshot.review.reviewId !== reviewId.toLowerCase()) {
    throw new Error('Assigned performance-review identity does not match the request.');
  }
  return snapshot;
}

export async function saveAssignedPerformanceReviewDraft(
  reviewId: string,
  command: PerformanceReviewDraftCommand,
  execution: PerformanceReviewMutationExecution
): Promise<PerformanceReviewSnapshot> {
  const body = parsePerformanceReviewDraftCommand(command);
  const wireBody = { answers: [...body.answers] } satisfies PerformanceReviewDraftCommandWire;
  // The shared browser transport serializes plain objects as application/json. A typed Blob
  // preserves the only media type sealed for PEP-PER-013 without changing control-owned code.
  const mergePatchBody = new Blob([JSON.stringify(wireBody)], {
    type: 'application/merge-patch+json',
  });
  const response = await axiosInstance.patch<SavedPerformanceReviewWire, Blob>(
    reviewPath(reviewId),
    mergePatchBody,
    mutationConfig(execution, 'application/merge-patch+json')
  );
  try {
    const snapshot = parsePerformanceReviewSnapshot(response.data, response.headers?.get('ETag'));
    if (
      snapshot.review.reviewId !== reviewId.toLowerCase() ||
      snapshot.review.aggregateVersion !== execution.expectedVersion + 1
    ) {
      throw new Error('Saved performance-review identity or version is invalid.');
    }
    return snapshot;
  } catch (cause) {
    // A 2xx response proves dispatch but malformed evidence cannot prove whether the command
    // committed. Preserve the exact replay identity through the hook's RETRYABLE path.
    throw new HttpTransportError('NETWORK', cause);
  }
}

export async function submitAssignedPerformanceReview(
  reviewId: string,
  command: SubmitPerformanceReviewCommand,
  execution: PerformanceReviewMutationExecution
): Promise<PerformanceReviewSubmission> {
  const body = parseSubmitPerformanceReviewCommand(command);
  const wireBody = body satisfies SubmitPerformanceReviewCommandWire;
  const response = await axiosInstance.post<
    PerformanceReviewSubmissionWire,
    SubmitPerformanceReviewCommandWire
  >(reviewPath(reviewId) + '/submit', wireBody, mutationConfig(execution, 'application/json'));
  try {
    const submission = parsePerformanceReviewSubmission(response.data);
    if (submission.contentHash !== body.draftContentHash) {
      throw new Error('Submitted performance-review content does not match the guarded draft.');
    }
    return submission;
  } catch (cause) {
    throw new HttpTransportError('NETWORK', cause);
  }
}

export const performanceReviewDataSource: PerformanceReviewDataSource = {
  read: readAssignedPerformanceReview,
  saveDraft: saveAssignedPerformanceReviewDraft,
  submit: submitAssignedPerformanceReview,
};
