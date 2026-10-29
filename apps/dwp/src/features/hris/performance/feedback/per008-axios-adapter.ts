import {
  axiosInstance,
  HttpError,
  productSurfaceGovernedMutationConfig,
} from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import { createPer008Client, unwrapPer008ApiResponse } from './per008-client';
import type { Per008EnvelopeTransport, Per008Transport } from './per008-client';
import { PER008_ROUTES } from './per008-model';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type {
  Per008CommandContext,
  Per008CreateFeedbackRequestCommand,
  Per008FeedbackRequestReceipt,
  Per008FeedbackResponseCommand,
  Per008FeedbackSubmissionReceipt,
} from './per008-model';

export const HCM_PERFORMANCE_FEEDBACK_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'createPerformanceFeedbackRequest',
    routeContractKey: 'route.hcm.performance.feedback-request-create.action',
    method: 'POST',
    path: PER008_ROUTES.createRequest,
  },
  {
    apiFunction: 'submitPerformanceFeedbackResponse',
    routeContractKey: 'route.hcm.personal.feedback-response-submit.action',
    method: 'POST',
    path: '/api/people/v1/hris/performance/feedback-assignments/{feedbackAssignmentId}/responses',
  },
] as const;

export type Per008AxiosContext = Readonly<{
  contextScopeKey: string;
  signal: AbortSignal;
  timeoutMs?: number;
  mutationAuthority: (path: string) => ProductSurfaceGovernedMutationAuthority;
}>;

export type Per008MutationExecution = Readonly<{
  authority: ProductSurfaceGovernedMutationAuthority;
  signal: AbortSignal;
  timeoutMs?: number;
}>;

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0;
}

function errorPayload(value: unknown, status: number): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { code: 'PER008_OWNER_ERROR', correlationId: null, retryable: status >= 500 };
  }
  if (!Object.hasOwn(value, 'status') || !Object.hasOwn(value, 'data')) return value;
  const envelope = value as ApiResponse<unknown>;
  if (
    typeof envelope.data === 'object' &&
    envelope.data !== null &&
    !Array.isArray(envelope.data) &&
    Object.hasOwn(envelope.data, 'code')
  )
    return envelope.data;
  return {
    code: nonBlank(envelope.errorCode) ? envelope.errorCode : 'PER008_OWNER_ERROR',
    correlationId: nonBlank(envelope.correlationId) ? envelope.correlationId : null,
    retryable: status >= 500,
  };
}

function assertMutationAuthority(
  authority: ProductSurfaceGovernedMutationAuthority,
  headers: Readonly<Record<string, string>>,
  contextScopeKey: string
): void {
  if (
    authority.mode !== 'SECURE' ||
    authority.contextScopeKey !== contextScopeKey ||
    authority.expectedDecisionRevision !== headers['X-DWP-Expected-Decision-Revision'] ||
    authority.idempotencyKey !== headers['Idempotency-Key'] ||
    (authority.stepUp?.challenge ?? undefined) !== headers['X-DWP-Step-Up-Challenge']
  ) {
    throw new Error('PER008_GOVERNED_MUTATION_AUTHORITY_MISMATCH');
  }
}

/**
 * Real DWP adapter: uses read scope for GET and governed mutation authority for POST,
 * then unwraps ApiResponse exactly once before the closed PER-008 parsers see it.
 */
export function createPer008AxiosTransport(context: Per008AxiosContext): Per008Transport {
  if (
    !nonBlank(context.contextScopeKey) ||
    (context.timeoutMs !== undefined &&
      (!Number.isSafeInteger(context.timeoutMs) || context.timeoutMs < 1))
  ) {
    throw new Error('PER008_AXIOS_CONTEXT_INVALID');
  }
  const timeout = context.timeoutMs ?? 15_000;
  const envelopeTransport: Per008EnvelopeTransport = async (path, init) => {
    try {
      if (init.method === 'GET') {
        const scoped = productSurfaceReadScopeConfig(context.contextScopeKey, context.signal);
        const response = await axiosInstance.get<ApiResponse<unknown>>(path, {
          ...scoped,
          timeoutMs: timeout,
          headers: init.headers,
        });
        return { status: 200, data: response.data };
      }
      const authority = context.mutationAuthority(path);
      assertMutationAuthority(authority, init.headers, context.contextScopeKey);
      const governed = productSurfaceGovernedMutationConfig(authority);
      const response = await axiosInstance.post<ApiResponse<unknown>>(
        path,
        init.body === undefined ? undefined : JSON.parse(init.body),
        {
          ...governed,
          signal: context.signal,
          timeoutMs: timeout,
          headers: {
            ...init.headers,
            ...governed.headers,
          },
        }
      );
      return { status: 200, data: response.data };
    } catch (error) {
      if (error instanceof HttpError) return { status: error.status, data: error.details };
      throw error;
    }
  };
  return async (path, init) => {
    const response = await envelopeTransport(path, init);
    return {
      status: response.status,
      data:
        response.status >= 400
          ? errorPayload(response.data, response.status)
          : unwrapPer008ApiResponse(response.data),
    };
  };
}

function per008CommandContext(execution: Per008MutationExecution): Per008CommandContext {
  const authority = execution.authority;
  if (
    authority.mode !== 'SECURE' ||
    !authority.contextScopeKey ||
    !authority.expectedDecisionRevision ||
    !authority.idempotencyKey
  ) {
    throw new Error('PER008_GOVERNED_MUTATION_AUTHORITY_MISMATCH');
  }
  return {
    idempotencyKey: authority.idempotencyKey,
    expectedDecisionRevision: authority.expectedDecisionRevision,
    ...(authority.stepUp?.challenge ? { stepUpChallenge: authority.stepUp.challenge } : {}),
  };
}

function per008GovernedMutationTransport(execution: Per008MutationExecution): Per008Transport {
  const authority = execution.authority;
  const context = per008CommandContext(execution);
  if (authority.mode !== 'SECURE' || !authority.contextScopeKey) {
    throw new Error('PER008_GOVERNED_MUTATION_AUTHORITY_MISMATCH');
  }
  const contextScopeKey = authority.contextScopeKey;
  const timeout = execution.timeoutMs ?? 15_000;
  if (!Number.isSafeInteger(timeout) || timeout < 1) {
    throw new Error('PER008_AXIOS_CONTEXT_INVALID');
  }
  const governed = productSurfaceGovernedMutationConfig(authority);
  return async (path, init) => {
    if (init.method !== 'POST') throw new Error('PER008_MUTATION_TRANSPORT_METHOD_INVALID');
    assertMutationAuthority(authority, init.headers, contextScopeKey);
    if (
      init.headers['Idempotency-Key'] !== context.idempotencyKey ||
      init.headers['X-DWP-Expected-Decision-Revision'] !== context.expectedDecisionRevision
    ) {
      throw new Error('PER008_GOVERNED_MUTATION_AUTHORITY_MISMATCH');
    }
    try {
      const response = await axiosInstance.post<ApiResponse<unknown>>(
        path,
        init.body === undefined ? undefined : JSON.parse(init.body),
        {
          ...governed,
          signal: execution.signal,
          timeoutMs: timeout,
          headers: { ...init.headers, ...governed.headers },
          csrfReplay: 'NEVER',
        }
      );
      return { status: 200, data: unwrapPer008ApiResponse(response.data) };
    } catch (error) {
      if (error instanceof HttpError) {
        return { status: error.status, data: errorPayload(error.details, error.status) };
      }
      throw error;
    }
  };
}

export function createPerformanceFeedbackRequest(
  command: Per008CreateFeedbackRequestCommand,
  execution: Per008MutationExecution
): Promise<Per008FeedbackRequestReceipt> {
  return createPer008Client(per008GovernedMutationTransport(execution)).createFeedbackRequest(
    command,
    per008CommandContext(execution)
  );
}

export function submitPerformanceFeedbackResponse(
  feedbackAssignmentId: string,
  command: Per008FeedbackResponseCommand,
  execution: Per008MutationExecution
): Promise<Per008FeedbackSubmissionReceipt> {
  return createPer008Client(per008GovernedMutationTransport(execution)).submitResponse(
    feedbackAssignmentId,
    command,
    per008CommandContext(execution)
  );
}
