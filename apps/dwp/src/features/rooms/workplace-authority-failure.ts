import { HttpError } from '@dwp-frontend/shared-utils';

function reasonCode(details: unknown) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const record = details as Record<string, unknown>;
  const value = record.errorCode ?? record.reasonCode ?? record.code;
  return typeof value === 'string' ? value.toUpperCase() : null;
}

export function isAuthoritativeWorkplaceReadFailure(error: unknown) {
  if (!(error instanceof HttpError)) return false;
  if ([401, 403, 404].includes(error.status)) return true;
  const reason = reasonCode(error.details);
  return (
    (error.status === 409 && reason === 'SCOPE_CONTEXT_EXPIRED') ||
    (error.status === 503 && reason === 'AUTHORITY_RESOLUTION_UNAVAILABLE')
  );
}
