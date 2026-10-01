import { HttpError } from '@dwp-frontend/shared-utils';

export type AIRuntimeControlLoadFailure = 'rollout-unavailable' | 'load-error';

const ROLLOUT_UNAVAILABLE_CODE = 'AI_CONTROL_ROLLOUT_UNAVAILABLE';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function errorCode(details: unknown): string | null {
  if (!isRecord(details)) return null;
  const direct = details.errorCode ?? details.code;
  if (typeof direct === 'string') return direct;
  const nested = details.detail;
  if (!isRecord(nested)) return null;
  const nestedCode = nested.errorCode ?? nested.code;
  return typeof nestedCode === 'string' ? nestedCode : null;
}

export function resolveAIRuntimeControlLoadFailure(error: unknown): AIRuntimeControlLoadFailure {
  if (
    error instanceof HttpError &&
    error.status === 503 &&
    errorCode(error.details) === ROLLOUT_UNAVAILABLE_CODE
  ) {
    return 'rollout-unavailable';
  }
  return 'load-error';
}

export function shouldRetryAIRuntimeControlLoad(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && resolveAIRuntimeControlLoadFailure(error) !== 'rollout-unavailable';
}
