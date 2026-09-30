import type {
  ProviderSupportAccessRequest,
  ProviderSupportSession,
} from '@dwp-frontend/shared-utils';

import {
  providerBoundedListCoverage,
  providerBoundedMetric,
} from './provider-bounded-list-coverage';

const REQUEST_LIMIT = 300;
const SESSION_LIMIT = 200;

export function providerSupportListMetrics(
  requests: readonly ProviderSupportAccessRequest[] | undefined,
  sessions: readonly ProviderSupportSession[] | undefined
) {
  return {
    requestsComplete:
      requests != null &&
      providerBoundedListCoverage(requests.length, REQUEST_LIMIT) === 'COMPLETE',
    sessionsComplete:
      sessions != null &&
      providerBoundedListCoverage(sessions.length, SESSION_LIMIT) === 'COMPLETE',
    pendingApproval: providerBoundedMetric(
      requests,
      REQUEST_LIMIT,
      (request) => request.lifecycleState === 'PENDING_APPROVAL'
    ),
    pendingReview: providerBoundedMetric(
      requests,
      REQUEST_LIMIT,
      (request) => request.postReviewState === 'PENDING'
    ),
    active: providerBoundedMetric(
      sessions,
      SESSION_LIMIT,
      (session) => session.lifecycleState === 'ACTIVE'
    ),
    breakGlass: providerBoundedMetric(
      sessions,
      SESSION_LIMIT,
      (session) => session.lifecycleState === 'ACTIVE' && session.accessMode === 'BREAK_GLASS'
    ),
  };
}
