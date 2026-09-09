import { describe, expect, it } from 'vitest';

import {
  notificationSavedViewConfiguration,
  parseNotificationSavedViewConfiguration,
  selectedNotificationBuiltInViewId,
} from './notification-saved-view-model';

describe('notification saved views', () => {
  it('round-trips a canonical center scope without transient selection state', () => {
    const scope = {
      view: 'ALL' as const,
      query: '  renewal  ',
      appKey: 'approvals',
      priority: 'HIGH' as const,
      readState: 'UNREAD' as const,
      reason: 'DIRECT' as const,
    };

    expect(
      parseNotificationSavedViewConfiguration(notificationSavedViewConfiguration(scope))
    ).toEqual({
      ...scope,
      query: 'renewal',
    });
  });

  it('drops a contradictory reason when a saved view targets mentions', () => {
    expect(
      parseNotificationSavedViewConfiguration({
        contract: 'dwp.notifications.center.saved-view',
        version: 1,
        scope: {
          view: 'MENTIONS',
          query: '',
          appKey: '',
          priority: 'ALL',
          readState: 'UNREAD',
          reason: 'ROLE',
        },
      })
    ).toEqual({
      view: 'MENTIONS',
      query: '',
      appKey: '',
      priority: 'ALL',
      readState: 'UNREAD',
      reason: 'ALL',
    });
  });

  it('fails closed for foreign, oversized, or malformed configurations', () => {
    expect(
      parseNotificationSavedViewConfiguration({ contract: 'mail.saved-view', version: 1 })
    ).toBeNull();
    expect(
      parseNotificationSavedViewConfiguration({
        contract: 'dwp.notifications.center.saved-view',
        version: 1,
        scope: {
          view: 'ALL',
          query: 'x'.repeat(201),
          appKey: '',
          priority: 'ALL',
          readState: 'ALL',
          reason: 'ALL',
        },
      })
    ).toBeNull();
  });

  it('recognizes only the canonical built-in scopes', () => {
    expect(
      selectedNotificationBuiltInViewId({
        view: 'PRIORITY',
        query: '',
        appKey: '',
        priority: 'ALL',
        readState: 'ALL',
        reason: 'ALL',
      })
    ).toBe('notification-priority');
    expect(
      selectedNotificationBuiltInViewId({
        view: 'ALL',
        query: '',
        appKey: '',
        priority: 'ALL',
        readState: 'UNREAD',
        reason: 'ALL',
      })
    ).toBe('notification-unread');
  });
});
