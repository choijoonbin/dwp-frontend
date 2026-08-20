import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_CENTER_VIEW_LINKS,
  NOTIFICATION_NAVIGATION,
  findNotificationNavigationItem,
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
      ])
    );
    expect(findNotificationNavigationItem('/notifications/center/')).toEqual(
      expect.objectContaining({ view: 'center' })
    );
    expect(findNotificationNavigationItem('/account/settings/notifications')).toBeUndefined();
    expect(findNotificationNavigationItem('/admin/notifications/overview')).toBeUndefined();
  });
});
