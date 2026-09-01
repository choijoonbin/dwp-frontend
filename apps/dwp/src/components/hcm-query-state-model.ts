import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

export type HcmQueryFailureKind =
  'permission' | 'not-found' | 'context-changed' | 'unavailable' | 'unknown';

export type HcmQueryFailure = Readonly<{
  kind: HcmQueryFailureKind;
  reference?: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function failureReference(details: unknown): string | undefined {
  if (!isRecord(details)) return undefined;
  const direct =
    nonBlank(details.correlationId) ?? nonBlank(details.requestId) ?? nonBlank(details.traceId);
  if (direct) return direct;
  return isRecord(details.detail) ? failureReference(details.detail) : undefined;
}

export function resolveHcmQueryFailure(error: unknown): HcmQueryFailure | null {
  if (!error) return null;

  if (error instanceof HttpError) {
    const reference = failureReference(error.details);
    if (error.status === 401 || error.status === 403) {
      return { kind: 'permission', ...(reference ? { reference } : {}) };
    }
    if (error.status === 404) {
      return { kind: 'not-found', ...(reference ? { reference } : {}) };
    }
    if (error.status === 409) {
      return { kind: 'context-changed', ...(reference ? { reference } : {}) };
    }
    if (error.status === 429 || error.status >= 500) {
      return { kind: 'unavailable', ...(reference ? { reference } : {}) };
    }
    return { kind: 'unknown', ...(reference ? { reference } : {}) };
  }

  if (error instanceof HttpTransportError) return { kind: 'unavailable' };
  return { kind: 'unknown' };
}
