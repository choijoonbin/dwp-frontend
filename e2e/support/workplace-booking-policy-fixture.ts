import { fulfillSuccess } from './shell-session';

import type { Route } from '@playwright/test';
import type { WorkplacePolicy } from '@dwp-frontend/shared-utils';

export function createWorkplaceBookingPolicyFixture(initial: WorkplacePolicy) {
  let current = initial;
  return (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/booking-policy/review')) {
      return fulfillSuccess(route, {
        targetType: 'WP_BOOKING_POLICY',
        targetId: null,
        current,
        proposed: request.postDataJSON().proposed,
        currentActorAccess: null,
        knownImpact: ['Existing booking snapshots remain unchanged.'],
        warnings: [],
        evaluatedAt: '2026-08-19T00:00:00Z',
      });
    }
    if (path.endsWith('/booking-policy/changes')) {
      current = { ...request.postDataJSON().proposed, version: current.version + 1 };
    } else if (request.method() === 'PUT') {
      current = { ...request.postDataJSON(), version: current.version + 1 };
    }
    return fulfillSuccess(route, current);
  };
}
