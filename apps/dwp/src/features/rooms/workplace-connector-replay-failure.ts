import { HttpError } from '@dwp-frontend/shared-utils';

const DEFINITIVE_REJECTION_STATUSES = new Set([400, 401, 403, 404, 409, 410, 412, 422]);

/**
 * A replay command is safe to discard only when the server returned an authoritative
 * client rejection. Transport failures, gateway/server failures and response parsing
 * failures can all happen after the provider command was accepted.
 */
export function isDefinitiveWorkplaceConnectorReplayFailure(error: unknown): boolean {
  return error instanceof HttpError && DEFINITIVE_REJECTION_STATUSES.has(error.status);
}

export function isAmbiguousWorkplaceConnectorReplayFailure(error: unknown): boolean {
  return !isDefinitiveWorkplaceConnectorReplayFailure(error);
}
