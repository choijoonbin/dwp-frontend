import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_CENTER_VIEW_LINKS,
  NOTIFICATION_NAVIGATION,
  findNotificationNavigationItem,
  notificationContextFiltersFromSearchParams,
  notificationCenterPath,
  notificationCenterSearchParams,
  notificationIncludedTypesFromSearchParams,
} from './notification-navigation';

describe('notification navigation contract', () => {
  it('maps the six center views onto the canonical notification route', () => {
    expect(NOTIFICATION_CENTER_VIEW_LINKS.map((link) => link.view)).toEqual([
      'PRIORITY',
      'ALL',
      'MENTIONS',
      'SAVED',
      'SNOOZED',
      'DONE',
    ]);
    expect(
      NOTIFICATION_CENTER_VIEW_LINKS.every((link) => link.path.startsWith('/notifications'))
    ).toBe(true);
  });

  it('keeps user settings and governed administration inside the product shell', () => {
    const items = NOTIFICATION_NAVIGATION.flatMap((group) => group.items);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ view: 'home', path: '/notifications/home' }),
        expect.objectContaining({
          view: 'center',
          path: '/notifications/center',
          requiredResourceKey: 'APP.NOTIFICATIONS',
          requiredPermissionCode: 'VIEW',
        }),
        expect.objectContaining({ view: 'settings', path: '/notifications/settings' }),
        expect.objectContaining({
          view: 'admin-overview',
          path: '/notifications/admin/overview',
          requiredResourceKey: 'ADMIN.NOTIFICATION_OPERATIONS',
        }),
        expect.objectContaining({
          view: 'admin-policies',
          path: '/notifications/admin/policies',
          requiredResourceKey: 'ADMIN.NOTIFICATION_POLICY',
        }),
        expect.objectContaining({
          view: 'admin-templates',
          path: '/notifications/admin/templates',
          requiredResourceKey: 'ADMIN.NOTIFICATION_TEMPLATE',
        }),
        expect.objectContaining({
          view: 'admin-suppressions',
          path: '/notifications/admin/suppressions',
          requiredResourceKey: 'ADMIN.NOTIFICATION_OPERATIONS',
        }),
      ])
    );
    expect(findNotificationNavigationItem('/notifications/center/')).toEqual(
      expect.objectContaining({ view: 'center' })
    );
    expect(findNotificationNavigationItem('/account/settings/notifications')).toBeUndefined();
    expect(findNotificationNavigationItem('/admin/notifications/overview')).toBeUndefined();
  });

  it('preserves server-backed search and read scope in a shareable center URL', () => {
    expect(
      notificationCenterPath({
        view: 'ALL',
        readState: 'UNREAD',
        query: '  SLA breach  ',
      })
    ).toBe('/notifications/center?view=all&read=unread&q=SLA+breach');
    expect(notificationCenterPath({ view: 'PRIORITY', query: '   ' })).toBe(
      '/notifications/center?view=priority'
    );
    expect(
      notificationCenterSearchParams({
        view: 'ALL',
        readState: 'READ',
        query: 'policy',
        appKey: 'security',
        priority: 'URGENT',
      }).toString()
    ).toBe('view=all&read=read&q=policy&app=security&priority=urgent');
    expect(
      notificationCenterSearchParams({ view: 'ALL', attentionEffect: 'PRIORITIZE' }).toString()
    ).toBe('view=all&attentionEffect=prioritize');
  });

  it('round-trips ordered opaque context keys without putting labels in the URL', () => {
    const parameters = notificationCenterSearchParams({
      view: 'ALL',
      contextFilters: [
        { kind: 'THREAD', key: 'conversation:42', label: 'Private room name' },
        { kind: 'ACTOR', key: 'user:7', label: 'Private person name' },
        { kind: 'ACTOR', key: 'user:9', label: 'Another private name' },
      ],
    });

    expect(parameters.toString()).toBe(
      'view=all&context=actor&contextKey=user%3A7&context=actor&contextKey=user%3A9&context=thread&contextKey=conversation%3A42'
    );
    expect(parameters.toString()).not.toContain('Private');
    expect(notificationContextFiltersFromSearchParams(parameters)).toEqual([
      { kind: 'ACTOR', key: 'user:7', label: '' },
      { kind: 'ACTOR', key: 'user:9', label: '' },
      { kind: 'THREAD', key: 'conversation:42', label: '' },
    ]);
  });

  it('round-trips included types in deterministic order', () => {
    const parameters = notificationCenterSearchParams({
      view: 'ALL',
      includedTypes: ['MANDATORY_POLICY', 'DIRECT', 'ASSIGNED'],
    });

    expect(parameters.toString()).toBe('view=all&type=direct&type=assigned&type=mandatory_policy');
    expect(notificationIncludedTypesFromSearchParams(parameters)).toEqual([
      'DIRECT',
      'ASSIGNED',
      'MANDATORY_POLICY',
    ]);
  });

  it('rejects duplicate or oversized included types while preserving untrusted URL input', () => {
    expect(() =>
      notificationCenterSearchParams({ view: 'ALL', includedTypes: ['DIRECT', 'DIRECT'] })
    ).toThrow('not canonical');
    expect(
      notificationIncludedTypesFromSearchParams(new URLSearchParams('type=direct&type=unknown'))
    ).toEqual(['DIRECT', 'UNKNOWN']);
  });

  it('preserves malformed pairs as untrusted input so the API can fail closed', () => {
    const parameters = new URLSearchParams(
      'view=all&context=thread&contextKey=conversation%3A42&contextKey=orphan'
    );

    expect(notificationContextFiltersFromSearchParams(parameters)).toEqual([
      { kind: 'THREAD', key: 'conversation:42', label: '' },
      { kind: '', key: 'orphan', label: '' },
    ]);
  });
});
