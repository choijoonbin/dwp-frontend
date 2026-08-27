import { describe, expect, it } from 'vitest';

import type { ProviderSupportPostReviewEvidence } from '@dwp-frontend/shared-utils';

import { isProviderPostReviewEvidenceReady } from './provider-support-post-review-evidence-model';

const request = {
  supportAccessRequestId: 'request-1',
  supportSessionId: 'session-1',
  tenantId: 'tenant-1',
};

function evidence(
  overrides: Partial<ProviderSupportPostReviewEvidence> = {}
): ProviderSupportPostReviewEvidence {
  return {
    supportAccessRequestId: 'request-1',
    supportSessionId: 'session-1',
    tenantId: 'tenant-1',
    sessionLifecycleState: 'REVOKED',
    evidenceFrom: '2026-08-27T01:00:00Z',
    evidenceThrough: '2026-08-27T01:05:00Z',
    grantedScopes: ['TENANT_EXPERIENCE_PREVIEW'],
    observedScopes: ['TENANT_EXPERIENCE_PREVIEW'],
    totalEventCount: 1,
    actualUseCount: 1,
    deniedAttemptCount: 0,
    evidenceComplete: true,
    displayTruncated: false,
    noUseConfirmed: false,
    readiness: 'READY_WITH_USE',
    anomalies: [],
    events: [],
    ...overrides,
  };
}

describe('provider post-review evidence readiness', () => {
  it('accepts complete actual-use evidence', () => {
    expect(isProviderPostReviewEvidenceReady(request, evidence())).toBe(true);
  });

  it('accepts only an explicit complete no-use decision', () => {
    expect(
      isProviderPostReviewEvidenceReady(
        request,
        evidence({
          totalEventCount: 0,
          actualUseCount: 0,
          observedScopes: [],
          noUseConfirmed: true,
          readiness: 'READY_NO_USE',
        })
      )
    ).toBe(true);
    expect(
      isProviderPostReviewEvidenceReady(
        request,
        evidence({ actualUseCount: 0, readiness: 'READY_NO_USE', noUseConfirmed: false })
      )
    ).toBe(false);
  });

  it('fails closed for partial retrieval even when a display event exists', () => {
    expect(
      isProviderPostReviewEvidenceReady(
        request,
        evidence({ evidenceComplete: false, readiness: 'INCOMPLETE' })
      )
    ).toBe(false);
  });

  it('uses aggregate completeness rather than a truncated six-event slice', () => {
    expect(
      isProviderPostReviewEvidenceReady(
        request,
        evidence({ totalEventCount: 10_000, actualUseCount: 9_990, displayTruncated: true })
      )
    ).toBe(true);
  });

  it('rejects request, session, and tenant binding mismatches', () => {
    expect(
      isProviderPostReviewEvidenceReady(request, evidence({ supportAccessRequestId: 'request-2' }))
    ).toBe(false);
    expect(
      isProviderPostReviewEvidenceReady(request, evidence({ supportSessionId: 'session-2' }))
    ).toBe(false);
    expect(isProviderPostReviewEvidenceReady(request, evidence({ tenantId: 'tenant-2' }))).toBe(
      false
    );
  });
});
