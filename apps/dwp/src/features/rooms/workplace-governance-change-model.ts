import { HttpError } from '@dwp-frontend/shared-utils';

export type GovernanceChangeOutcome =
  'conflict' | 'denied' | 'unknown' | 'reviewUnavailable' | 'invalid';
export const GOVERNANCE_REVIEW_MAX_AGE_MS = 30_000;

export function governanceReviewFingerprint(contextKey: string, proposed: unknown) {
  return JSON.stringify([contextKey, proposed]);
}

export function governanceReviewIsCurrent(
  review: { fingerprint: string; reviewedAt: number } | null,
  fingerprint: string,
  now: number
) {
  return Boolean(
    review &&
    review.fingerprint === fingerprint &&
    now >= review.reviewedAt &&
    now - review.reviewedAt < GOVERNANCE_REVIEW_MAX_AGE_MS
  );
}

export function governanceChangeOutcome(
  error: unknown,
  submittedWrite: boolean
): GovernanceChangeOutcome {
  if (error instanceof HttpError) {
    if ([401, 403, 404].includes(error.status)) return 'denied';
    if (error.status === 409) return 'conflict';
    if ([400, 422].includes(error.status)) return 'invalid';
  }
  return submittedWrite ? 'unknown' : 'reviewUnavailable';
}
