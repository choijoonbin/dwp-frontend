import { describe, expect, it } from 'vitest';

import {
  notificationLiveChannelName,
  notificationStreamUrl,
  newestNotificationCursor,
  isNotificationConnectionRequest,
  parseNotificationConnectionChannelMessage,
  parseNotificationLiveChannelMessage,
  parseNotificationSyncResetChannelMessage,
} from './notification-live-bridge';

describe('notification live bridge boundary', () => {
  it('isolates browser coordination by tenant and authenticated user', () => {
    expect(notificationLiveChannelName('1', 900018)).toBe('dwp:notification-live:v2:1:900018');
    expect(notificationLiveChannelName('2', 900018)).not.toBe(
      notificationLiveChannelName('1', 900018)
    );
    expect(notificationLiveChannelName('1', 900019)).not.toBe(
      notificationLiveChannelName('1', 900018)
    );
    expect(() => notificationLiveChannelName('  ', 900018)).toThrow('Tenant and user IDs');
    expect(() => notificationLiveChannelName('1', '')).toThrow('Tenant and user IDs');
  });

  it('relays only content-free version hints', () => {
    const notificationId = '93af7315-2271-462e-a819-3d238a28830f';
    expect(
      parseNotificationLiveChannelMessage({
        kind: 'notification.changed',
        signal: {
          changeVersion: '42',
          counterVersion: '9',
          changedIds: [notificationId],
          arrivalIds: [notificationId],
        },
      })
    ).toEqual({
      changeVersion: '42',
      counterVersion: '9',
      changedIds: [notificationId],
      arrivalIds: [notificationId],
    });
    expect(
      parseNotificationLiveChannelMessage({
        kind: 'notification.changed',
        signal: { changeVersion: '42', changedIds: [], title: 'must never cross tabs' },
      })
    ).toBeNull();
    expect(parseNotificationLiveChannelMessage({ kind: 'other', signal: {} })).toBeNull();
  });

  it('relays a governed cursor reset without notification content', () => {
    expect(
      parseNotificationSyncResetChannelMessage({
        kind: 'notification.sync-reset',
        signal: { errorCode: 'NOTIFICATION_SYNC_RESET_REQUIRED' },
      })
    ).toEqual({ errorCode: 'NOTIFICATION_SYNC_RESET_REQUIRED' });
    expect(
      parseNotificationSyncResetChannelMessage({
        kind: 'notification.sync-reset',
        signal: {
          errorCode: 'NOTIFICATION_SYNC_RESET_REQUIRED',
          title: 'must never cross tabs',
        },
      })
    ).toBeNull();
  });

  it('coordinates connection state without notification content', () => {
    expect(
      parseNotificationConnectionChannelMessage({
        kind: 'notification.connection',
        signal: { state: 'live' },
      })
    ).toEqual({ state: 'live' });
    expect(
      parseNotificationConnectionChannelMessage({
        kind: 'notification.connection',
        signal: { state: 'live', title: 'must never cross tabs' },
      })
    ).toBeNull();
    expect(isNotificationConnectionRequest({ kind: 'notification.connection-request' })).toBe(true);
    expect(
      isNotificationConnectionRequest({ kind: 'notification.connection-request', cursor: '1' })
    ).toBe(false);
  });

  it('reconnects with the greatest decimal cursor without JavaScript precision loss', () => {
    expect(newestNotificationCursor(null, '9007199254740993')).toBe('9007199254740993');
    expect(newestNotificationCursor('9007199254740993', '9007199254740992')).toBe(
      '9007199254740993'
    );
    expect(newestNotificationCursor('9007199254740993', '9007199254740994')).toBe(
      '9007199254740994'
    );
    expect(notificationStreamUrl(null)).toBe('/api/notifications/v1/stream');
    expect(notificationStreamUrl('9007199254740994')).toBe(
      '/api/notifications/v1/stream?after=9007199254740994'
    );
  });
});
