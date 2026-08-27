import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  ProductSurfaceOperationCancelledError,
  isProductSurfaceOperationCancelledError,
  sameProductSurfaceOperationIdentity,
} from './product-surface-operation-coordinator';

import type { ApprovalHighRiskAttempt } from './product-surface-high-risk-command-model';
import type {
  ProductSurfaceOperationIdentity,
  ProductSurfaceOperationTicket,
} from './product-surface-operation-coordinator';

export type ApprovalHighRiskOperationBinding = Readonly<{
  identity: ProductSurfaceOperationIdentity;
  ticket: ProductSurfaceOperationTicket;
  actionDecisionRevision: { current: string | null };
}>;

export type ApprovalHighRiskCommandFailureDisposition =
  | 'AMBIGUOUS_RETRY'
  | 'REISSUE_PROOF'
  | 'REPLAY_SUCCESS'
  | 'REPLAY_UNCERTAIN'
  | 'AUTHORITY_CONFLICT'
  | 'DETERMINISTIC_REJECT';

function errorCode(error: HttpError): string | null {
  if (!error.details || typeof error.details !== 'object' || Array.isArray(error.details)) {
    return null;
  }
  const value = (error.details as Record<string, unknown>).errorCode;
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null;
}

export function classifyApprovalHighRiskCommandFailure(
  error: unknown
): ApprovalHighRiskCommandFailureDisposition {
  if (error instanceof HttpTransportError) return 'AMBIGUOUS_RETRY';
  if (!(error instanceof HttpError)) return 'DETERMINISTIC_REJECT';
  const code = errorCode(error);
  if (
    error.status === 403 &&
    (code === 'STEP_UP_REQUIRED' ||
      code === 'STEP_UP_CHALLENGE_EXPIRED' ||
      code === 'STEP_UP_CHALLENGE_INVALID')
  ) {
    return 'REISSUE_PROOF';
  }
  if (
    error.status === 409 &&
    (code === 'IDEMPOTENCY_REPLAY_SUCCESS' || code === 'IDEMPOTENT_REPLAY_SUCCESS')
  ) {
    return 'REPLAY_SUCCESS';
  }
  // People consumes proof in the same transaction as the command. A replay after an
  // ambiguous response therefore cannot be represented as a deterministic rejection.
  if (error.status === 409 && code === 'STEP_UP_CHALLENGE_REPLAY') {
    return 'REPLAY_UNCERTAIN';
  }
  if (
    error.status === 409 &&
    (code === 'DECISION_REVISION_CONFLICT' ||
      code === 'SCOPE_CONTEXT_EXPIRED' ||
      code === 'OBJECT_VERSION_CONFLICT')
  ) {
    return 'AUTHORITY_CONFLICT';
  }
  if (error.status === 408 || error.status >= 500) return 'AMBIGUOUS_RETRY';
  return 'DETERMINISTIC_REJECT';
}

export async function runApprovalHighRiskResumeSingleFlight(
  flag: { current: boolean },
  task: () => Promise<void>
): Promise<boolean> {
  if (flag.current) return false;
  flag.current = true;
  try {
    await task();
    return true;
  } finally {
    flag.current = false;
  }
}

export function assertApprovalHighRiskOperationBindingCurrent(
  binding: ApprovalHighRiskOperationBinding,
  currentIdentity: ProductSurfaceOperationIdentity | null
): void {
  binding.ticket.assertCurrent();
  if (!sameProductSurfaceOperationIdentity(currentIdentity, binding.identity)) {
    throw new ProductSurfaceOperationCancelledError();
  }
}

export function assertApprovalHighRiskAttemptBinding(
  attempt: ApprovalHighRiskAttempt,
  binding: ApprovalHighRiskOperationBinding
): void {
  if (
    attempt.authority.contextKey !== binding.identity.contextKey ||
    attempt.authority.contextScopeKey !== binding.identity.contextScopeKey ||
    attempt.authority.expectedDecisionRevision !== binding.actionDecisionRevision.current
  ) {
    throw new ProductSurfaceOperationCancelledError();
  }
}

export class ApprovalHighRiskDispatchContextChangedError extends Error {
  readonly dispatchError: unknown;

  constructor(dispatchError: unknown) {
    super('The HIGH command result is uncertain after its authority context changed.');
    this.name = 'ApprovalHighRiskDispatchContextChangedError';
    this.dispatchError = dispatchError;
  }
}

export async function runApprovalHighRiskBoundDispatch<TResult>(
  binding: ApprovalHighRiskOperationBinding,
  dispatch: () => Promise<TResult>
): Promise<TResult> {
  binding.ticket.markDispatched();
  try {
    const result = await dispatch();
    binding.ticket.finish();
    return result;
  } catch (caught) {
    try {
      binding.ticket.markPreflight();
    } catch (bindingError) {
      if (isProductSurfaceOperationCancelledError(bindingError)) {
        throw new ApprovalHighRiskDispatchContextChangedError(caught);
      }
      throw bindingError;
    }
    throw caught;
  }
}
