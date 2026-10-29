import { describe, expect, it } from 'vitest';

import {
  notificationGlanceBulkFeedback,
  notificationGlanceSummaryState,
} from './notification-header-glance-model';

import type {
  NotificationBulkResult,
  NotificationSummary,
} from '@dwp-frontend/shared-utils/api/notification-api';

const summary = {
  partial: false,
  unavailableSources: [],
  message: null,
  actionableUnread: 5,
  totalUnread: 8,
  viewCounts: { PRIORITY: 5, ALL: 8, MENTIONS: 1, SAVED: 0, SNOOZED: 0, DONE: 0 },
  changeVersion: '10',
  counterVersion: '10',
  generatedAt: '2026-10-28T00:00:00Z',
} satisfies NotificationSummary;

describe('notification header glance model', () => {
  it('represents an initial summary 5xx as unknown without invented zero counts', () => {
    const state = notificationGlanceSummaryState({
      summary: undefined,
      pending: true,
      error: true,
    });

    expect(state).toEqual({ kind: 'UNKNOWN' });
    expect(state).not.toHaveProperty('summary');
  });

  it('keeps the last successful counts stale when a refetch fails', () => {
    const state = notificationGlanceSummaryState({ summary, pending: false, error: true });

    expect(state).toEqual({ kind: 'STALE', summary });
    if (state.kind !== 'STALE') throw new Error('Expected stale summary state.');
    expect(state.summary.actionableUnread).toBe(5);
    expect(state.summary.totalUnread).toBe(8);
  });

  it('reports only failed mark-visible results in partial feedback', () => {
    const result = {
      results: [
        { notificationId: 'applied', outcome: 'APPLIED' },
        { notificationId: 'already-read', outcome: 'ALREADY_APPLIED' },
        { notificationId: 'conflict', outcome: 'CONFLICT' },
      ],
      changeVersion: '11',
      summary,
      undoToken: null,
      undoExpiresAt: null,
    } satisfies NotificationBulkResult;

    expect(
      notificationGlanceBulkFeedback(result, ['applied', 'already-read', 'conflict', 'omitted'])
    ).toEqual({
      kind: 'PARTIAL',
      count: 2,
      failedIds: ['conflict', 'omitted'],
    });
  });
});
