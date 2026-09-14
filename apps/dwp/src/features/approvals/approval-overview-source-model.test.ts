import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  APPROVAL_OVERVIEW_FRESHNESS_MS,
  approvalOverviewExceptions,
  approvalOverviewSourceState,
} from './approval-management-model';

import type { ApprovalAdminPulse } from '@dwp-frontend/shared-utils';
import type { ApprovalOverviewSource } from './approval-management-model';

const NOW = Date.parse('2029-01-01T00:00:00Z');
const pulse: ApprovalAdminPulse = {
  publishedWorkflows: 7,
  draftWorkflows: 2,
  activeRequests: 97,
  overdueTasks: 3,
  failedIntegrations: 1,
  assurance: [
    { key: 'identity', state: 'ENFORCED', exceptions: 0 },
    { key: 'segregation', state: 'ATTENTION', exceptions: 2 },
    { key: 'evidence', state: 'ENFORCED', exceptions: 0 },
    { key: 'delivery', state: 'ATTENTION', exceptions: 1 },
  ],
};
function source(overrides: Partial<ApprovalOverviewSource> = {}): ApprovalOverviewSource {
  return {
    data: pulse,
    dataUpdatedAt: NOW,
    error: null,
    failureReason: null,
    failureCount: 0,
    status: 'success',
    fetchStatus: 'idle',
    ...overrides,
  };
}

describe('Overview source freshness and typed exception destinations', () => {
  it('expires at the exact client last-received boundary', () => {
    expect(approvalOverviewSourceState(source(), NOW + APPROVAL_OVERVIEW_FRESHNESS_MS - 1)).toBe(
      'READY'
    );
    expect(approvalOverviewSourceState(source(), NOW + APPROVAL_OVERVIEW_FRESHNESS_MS)).toBe(
      'EXPIRED'
    );
  });
  it.each([0, Number.NaN, Number.POSITIVE_INFINITY, NOW + 1])(
    'rejects invalid/future receipt time %s',
    (dataUpdatedAt) => {
      expect(approvalOverviewSourceState(source({ dataUpdatedAt }), NOW)).toBe('EXPIRED');
    }
  );
  it.each(['fetching', 'paused'] as const)(
    'cannot treat %s cached success as currently enforced',
    (fetchStatus) => {
      expect(approvalOverviewSourceState(source({ fetchStatus }), NOW)).toBe('CHECKING');
    }
  );
  it.each([401, 403, 404])(
    'masks first native %s even while cached success is fetching',
    (status) => {
      expect(
        approvalOverviewSourceState(
          source({ failureReason: new HttpError('Denied', status), fetchStatus: 'fetching' }),
          NOW
        )
      ).toBe('DENIED');
    }
  );
  it('does not hide denial behind another generic failure', () => {
    expect(
      approvalOverviewSourceState(
        source({
          error: new HttpError('Denied', 403),
          failureReason: new HttpError('Unavailable', 503),
        }),
        NOW
      )
    ).toBe('DENIED');
    expect(approvalOverviewSourceState(source(), NOW, true)).toBe('DENIED');
  });
  it.each([
    [409, 'SCOPE_CONTEXT_EXPIRED'],
    [503, 'AUTHORITY_RESOLUTION_UNAVAILABLE'],
  ])('masks explicit authority failure %s/%s', (status, errorCode) => {
    expect(
      approvalOverviewSourceState(
        source({ error: new HttpError('Denied', Number(status), { errorCode }) }),
        NOW
      )
    ).toBe('DENIED');
  });
  it('retains generic failed reads as labelled history, never READY', () => {
    const error = new HttpError('Unavailable', 503);
    expect(approvalOverviewSourceState(source({ error, status: 'error' }), NOW)).toBe('STALE');
    expect(
      approvalOverviewSourceState(source({ data: undefined, error, status: 'error' }), NOW)
    ).toBe('UNAVAILABLE');
    expect(approvalOverviewSourceState(source({ failureCount: 1 }), NOW)).toBe('STALE');
    expect(approvalOverviewSourceState(undefined, NOW)).toBe('UNAVAILABLE');
    expect(approvalOverviewSourceState(source({ data: undefined, status: 'pending' }), NOW)).toBe(
      'LOADING'
    );
  });
  it('binds real exceptions to the correct queue or PAGE, without invented policy IDs', () => {
    expect(approvalOverviewExceptions(pulse)).toEqual([
      {
        key: 'overdue',
        count: 3,
        severity: 'warning',
        target: 'operations',
        route: '/approvals/admin/operations?queue=sla',
      },
      {
        key: 'failedIntegrations',
        count: 1,
        severity: 'error',
        target: 'operations',
        route: '/approvals/admin/operations?queue=delivery',
      },
      {
        key: 'segregation',
        count: 2,
        severity: 'warning',
        target: 'policies',
        route: '/approvals/admin/policies',
      },
      {
        key: 'delivery',
        count: 1,
        severity: 'error',
        target: 'operations',
        route: '/approvals/admin/operations?queue=delivery',
      },
    ]);
    expect(
      approvalOverviewExceptions({
        ...pulse,
        overdueTasks: 0,
        failedIntegrations: 0,
        assurance: [{ key: 'evidence', state: 'ATTENTION', exceptions: 1 }],
      })
    ).toEqual([
      {
        key: 'evidence',
        count: 1,
        severity: 'warning',
        target: 'operations',
        route: '/approvals/admin/operations',
      },
    ]);
  });
});
