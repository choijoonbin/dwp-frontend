import { describe, expect, it } from 'vitest';

import { providerSupportListMetrics } from './provider-support-list-coverage';

describe('provider support owner coverage', () => {
  it('withholds aggregates when an owner response reaches its hard limit', () => {
    const requests = Array.from({ length: 300 }, () => ({ lifecycleState: 'CLOSED' }));
    const sessions = Array.from({ length: 200 }, () => ({ lifecycleState: 'EXPIRED' }));
    const metrics = providerSupportListMetrics(requests as never[], sessions as never[]);

    expect(metrics.requestsComplete).toBe(false);
    expect(metrics.sessionsComplete).toBe(false);
    expect(metrics.pendingApproval).toBeNull();
    expect(metrics.active).toBeNull();
  });

  it('counts complete responses below each owner limit', () => {
    const metrics = providerSupportListMetrics(
      [{ lifecycleState: 'PENDING_APPROVAL', postReviewState: 'PENDING' }] as never[],
      [{ lifecycleState: 'ACTIVE', accessMode: 'BREAK_GLASS' }] as never[]
    );

    expect(metrics).toMatchObject({
      requestsComplete: true,
      sessionsComplete: true,
      pendingApproval: 1,
      pendingReview: 1,
      active: 1,
      breakGlass: 1,
    });
  });
});
