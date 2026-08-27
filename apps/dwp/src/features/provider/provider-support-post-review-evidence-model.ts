import type {
  ProviderSupportAccessRequest,
  ProviderSupportPostReviewEvidence,
} from '@dwp-frontend/shared-utils';

export function isProviderPostReviewEvidenceReady(
  request: Pick<
    ProviderSupportAccessRequest,
    'supportAccessRequestId' | 'supportSessionId' | 'tenantId'
  >,
  evidence?: ProviderSupportPostReviewEvidence
) {
  if (!evidence || !evidence.evidenceComplete) return false;
  if (
    evidence.supportAccessRequestId !== request.supportAccessRequestId ||
    evidence.supportSessionId !== request.supportSessionId ||
    evidence.tenantId !== request.tenantId
  ) {
    return false;
  }
  if (evidence.readiness === 'READY_WITH_USE') {
    return evidence.actualUseCount > 0;
  }
  return (
    evidence.readiness === 'READY_NO_USE' &&
    evidence.actualUseCount === 0 &&
    evidence.noUseConfirmed
  );
}
