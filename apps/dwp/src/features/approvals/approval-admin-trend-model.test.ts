import { describe, expect, it } from 'vitest';

import { approvalAdminTrendView } from './approval-admin-trend-model';

function trend() {
  const start = Date.parse('2026-09-11T00:00:00Z');
  return {
    generatedAt: '2026-09-13T23:30:00Z',
    windowHours: 72,
    bucketHours: 6,
    buckets: Array.from({ length: 12 }, (_, index) => ({
      startsAt: new Date(start + index * 6 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(start + (index + 1) * 6 * 60 * 60 * 1000).toISOString(),
      submittedRequests: index,
      completedRequests: index % 3,
      slaBreaches: index === 4 ? 2 : 0,
      unresolvedDeliveryUpdates: index === 11 ? 1 : 0,
      inFlightRequests: 20 + index,
      slaEligibleTasks: index === 4 ? 5 : 0,
    })),
  };
}

describe('approval admin 72-hour trend', () => {
  it('accepts only the exact contiguous server window and derives honest totals', () => {
    expect(approvalAdminTrendView(trend())).toMatchObject({
      maximumInFlight: 31,
      slaCompliancePercent: 60,
      totals: {
        submittedRequests: 66,
        completedRequests: 12,
        slaBreaches: 2,
        unresolvedDeliveryUpdates: 1,
        inFlightRequests: 306,
        slaEligibleTasks: 5,
      },
    });
  });

  it.each([
    ['missing bucket', () => trend().buckets.slice(1)],
    [
      'non-contiguous bucket',
      () =>
        trend().buckets.map((bucket, index) =>
          index === 3 ? { ...bucket, startsAt: bucket.endsAt } : bucket
        ),
    ],
    [
      'negative count',
      () =>
        trend().buckets.map((bucket, index) =>
          index === 2 ? { ...bucket, slaBreaches: -1 } : bucket
        ),
    ],
    [
      'impossible SLA ratio',
      () =>
        trend().buckets.map((bucket, index) =>
          index === 4 ? { ...bucket, slaEligibleTasks: 1 } : bucket
        ),
    ],
  ])('rejects %s instead of drawing a fabricated trend', (_, mutate) => {
    expect(approvalAdminTrendView({ ...trend(), buckets: mutate() })).toBeUndefined();
  });
});
