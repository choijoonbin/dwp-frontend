import { describe, expect, it } from 'vitest';

import { mapGovernedRouteEvaluation } from './governed-route-access-guard';

const request = {
  subject: { type: 'GOVERNED_CONTEXT' as const },
  navigationContextId: 'work.work',
  routeContractKey: 'route.context.work__work.review-detail.data',
  target: { opaqueTargetRef: 'opaque-work-ref' },
};

function allowed() {
  return {
    decision: 'ALLOWED' as const,
    decisionRevision: 'governed-revision-1',
    context: {
      contextKey: 'governed-context-1',
      navigationContextId: 'work.work',
      accessSource: 'RELATIONSHIP' as const,
      accessMode: 'NORMAL' as const,
      routeGrantRef: 'named-reviewer-assignment',
      effectiveReadOnly: false,
      decisionRevision: 'governed-revision-1',
      revalidateAt: '2030-01-01T00:00:00Z',
    },
  };
}

describe('governed route access guard', () => {
  it('accepts only the server relationship decision closed over context, revision, and access mode', () => {
    expect(
      mapGovernedRouteEvaluation(allowed(), request, 'NORMAL', Date.parse('2029-01-01T00:00:00Z'))
    ).toEqual({
      state: 'allowed',
      decisionRevision: 'governed-revision-1',
      effectiveReadOnly: false,
    });
    expect(
      mapGovernedRouteEvaluation(
        { ...allowed(), decisionRevision: 'stale' },
        request,
        'NORMAL',
        Date.parse('2029-01-01T00:00:00Z')
      )
    ).toEqual({ state: 'authority-unavailable' });
    expect(
      mapGovernedRouteEvaluation(
        allowed(),
        request,
        'PROVIDER_SUPPORT',
        Date.parse('2029-01-01T00:00:00Z')
      )
    ).toEqual({ state: 'authority-unavailable' });
  });

  it('keeps foreign, revoked, expired, and unknown decisions fail closed', () => {
    expect(mapGovernedRouteEvaluation({ decision: 'ROUTE_DENIED' }, request, 'NORMAL')).toEqual({
      state: 'route-denied',
    });
    expect(mapGovernedRouteEvaluation({ decision: 'EXPIRED' }, request, 'NORMAL')).toEqual({
      state: 'expired',
    });
    expect(
      mapGovernedRouteEvaluation({ decision: 'AUTHORITY_UNAVAILABLE' }, request, 'NORMAL')
    ).toEqual({ state: 'authority-unavailable' });
    expect(mapGovernedRouteEvaluation(allowed(), request, 'NORMAL')).toEqual({
      state: 'authority-unavailable',
    });
  });
});
