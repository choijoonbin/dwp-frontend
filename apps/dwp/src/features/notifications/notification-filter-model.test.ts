import { describe, expect, it } from 'vitest';
import {
  canonicalNotificationIncludedTypes,
  canonicalNotificationContextFilters,
  EMPTY_NOTIFICATION_FILTERS,
  hasNotificationFilters,
  notificationFiltersForView,
  notificationQueryFacets,
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
          includedTypes: ['ASSIGNED'],
          readState: 'UNREAD',
          appKey: 'messaging',
        },
        'MENTIONS'
      )
    ).toEqual({
      ...EMPTY_NOTIFICATION_FILTERS,
      reason: 'ALL',
      includedTypes: [],
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
    expect(
      hasNotificationFilters({ ...EMPTY_NOTIFICATION_FILTERS, attentionEffect: 'PRIORITIZE' })
    ).toBe(true);
  });
  it('canonicalizes at most five exact contexts for deterministic cache and URL keys', () => {
    expect(
      canonicalNotificationContextFilters([
        { kind: 'THREAD', key: 'conversation:42', label: ' Room ' },
        { kind: 'ACTOR', key: 'user:84', label: 'Lee' },
        { kind: 'ACTOR', key: 'user:42', label: 'Kim' },
      ])
    ).toEqual([
      { kind: 'ACTOR', key: 'user:42', label: 'Kim' },
      { kind: 'ACTOR', key: 'user:84', label: 'Lee' },
      { kind: 'THREAD', key: 'conversation:42', label: 'Room' },
    ]);
    expect(
      canonicalNotificationContextFilters([{ kind: 'THREAD', key: ' conversation:42', label: '' }])
    ).toBeNull();
    expect(
      canonicalNotificationContextFilters([
        { kind: 'THREAD', key: 'conversation:42', label: '' },
        { kind: 'THREAD', key: 'conversation:42', label: '' },
      ])
    ).toBeNull();
  });
  it('canonicalizes bounded included types and rejects malformed sets', () => {
    expect(canonicalNotificationIncludedTypes(['MANDATORY_POLICY', 'DIRECT', 'ASSIGNED'])).toEqual([
      'DIRECT',
      'ASSIGNED',
      'MANDATORY_POLICY',
    ]);
    expect(canonicalNotificationIncludedTypes(['DIRECT', 'DIRECT'])).toBeNull();
    expect(canonicalNotificationIncludedTypes(['direct' as 'DIRECT'])).toBeNull();
  });
  it('builds label-free canonical cache and server facets', () => {
    expect(
      notificationQueryFacets(
        ['ASSIGNED', 'DIRECT'],
        [
          { kind: 'RESOURCE', key: 'project:renewal', label: 'Renewal project' },
          { kind: 'ACTOR', key: 'user:42', label: 'Kim' },
        ]
      )
    ).toEqual({
      includedTypes: ['DIRECT', 'ASSIGNED'],
      contexts: [
        { kind: 'ACTOR', key: 'user:42' },
        { kind: 'RESOURCE', key: 'project:renewal' },
      ],
    });
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
    expect(
      notificationMatchesInboxScope(item, { view: 'ALL', includedTypes: ['DIRECT', 'ASSIGNED'] })
    ).toBe(false);
    expect(
      notificationMatchesInboxScope(item, { view: 'ALL', includedTypes: ['SUBSCRIPTION'] })
    ).toBe(true);
  });
});
