import { describe, expect, it } from 'vitest';
import {
  EMPTY_NOTIFICATION_FILTERS,
  hasNotificationFilters,
  notificationFiltersForView,
} from './notification-filter-model';
import { notificationCenterSearchParams } from './notification-navigation';
import { notificationMatchesInboxScope } from './notification-inbox-model';
import type { NotificationItem } from '@dwp-frontend/shared-utils/api/notification-api';

describe('notification recipient views', () => {
  it('removes a contradictory reason for mentions while retaining unread and source filters', () => {
    expect(
      notificationFiltersForView(
        {
          ...EMPTY_NOTIFICATION_FILTERS,
          reason: 'DIRECT',
          readState: 'UNREAD',
          appKey: 'messaging',
        },
        'MENTIONS'
      )
    ).toEqual({
      ...EMPTY_NOTIFICATION_FILTERS,
      reason: 'ALL',
      readState: 'UNREAD',
      appKey: 'messaging',
    });
  });
  it('preserves independent conditions on other view changes', () => {
    const filters = { ...EMPTY_NOTIFICATION_FILTERS, reason: 'SUBSCRIPTION' as const };
    expect(notificationFiltersForView(filters, 'SAVED')).toBe(filters);
  });
  it('serializes canonical recipient filters, never contradictory mention constraints', () => {
    expect(
      notificationCenterSearchParams({ view: 'ALL', reason: 'MANDATORY_POLICY' }).toString()
    ).toBe('view=all&reason=mandatory_policy');
    expect(
      notificationCenterSearchParams({
        view: 'MENTIONS',
        reason: 'DIRECT',
        readState: 'UNREAD',
      }).toString()
    ).toBe('view=mentions&read=unread');
  });
  it('distinguishes filtered empty states from empty views', () => {
    expect(hasNotificationFilters(EMPTY_NOTIFICATION_FILTERS)).toBe(false);
    expect(hasNotificationFilters({ ...EMPTY_NOTIFICATION_FILTERS, query: '  ' })).toBe(false);
    expect(hasNotificationFilters({ ...EMPTY_NOTIFICATION_FILTERS, reason: 'ROLE' })).toBe(true);
  });
  it('optimistic updates cannot leak an item into a different recipient scope', () => {
    const item = {
      readAt: null,
      completedAt: null,
      snoozedUntil: null,
      reason: { kind: 'SUBSCRIPTION' },
    } as NotificationItem;
    expect(notificationMatchesInboxScope(item, { view: 'ALL', reason: 'DIRECT' })).toBe(false);
    expect(notificationMatchesInboxScope(item, { view: 'ALL', reason: 'SUBSCRIPTION' })).toBe(true);
  });
});
