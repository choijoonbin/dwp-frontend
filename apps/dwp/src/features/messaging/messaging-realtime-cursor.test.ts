import { describe, expect, it } from 'vitest';

import {
  clearMessagingRealtimeCursor,
  MESSAGING_REALTIME_SHARED_CURSOR_TTL_MS,
  messagingRealtimeCursorStorageKey,
  newestMessagingRealtimeCursor,
  normalizeMessagingRealtimeCursor,
  readMessagingRealtimeCursor,
  readMessagingRealtimeSharedCursor,
  storeMessagingRealtimeCursor,
  storeMessagingRealtimeSharedCursor,
} from './messaging-realtime-cursor';

describe('messaging realtime cursor custody', () => {
  it('isolates session cursors by tenant and user', () => {
    expect(messagingRealtimeCursorStorageKey({ tenantId: 7, userId: 42 })).toBe(
      'dwp:messaging:realtime:v1:7:42:cursor'
    );
    expect(messagingRealtimeCursorStorageKey({ tenantId: 8, userId: 42 })).not.toBe(
      messagingRealtimeCursorStorageKey({ tenantId: 7, userId: 42 })
    );
    expect(messagingRealtimeCursorStorageKey({ tenantId: 7, userId: 43 })).not.toBe(
      messagingRealtimeCursorStorageKey({ tenantId: 7, userId: 42 })
    );
  });

  it('accepts only nonnegative signed 64-bit sequence cursors and never moves backwards', () => {
    expect(normalizeMessagingRealtimeCursor('0')).toBe('0');
    expect(normalizeMessagingRealtimeCursor('9223372036854775807')).toBe('9223372036854775807');
    expect(normalizeMessagingRealtimeCursor('9223372036854775808')).toBeNull();
    expect(normalizeMessagingRealtimeCursor('-1')).toBeNull();
    expect(normalizeMessagingRealtimeCursor('01')).toBeNull();
    expect(newestMessagingRealtimeCursor('41', '42')).toBe('42');
    expect(newestMessagingRealtimeCursor('42', '41')).toBe('42');
  });

  it('persists, clears, and tolerates blocked session storage', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    storeMessagingRealtimeCursor(storage, 'cursor', '42');
    expect(readMessagingRealtimeCursor(storage, 'cursor')).toBe('42');
    clearMessagingRealtimeCursor(storage, 'cursor');
    expect(readMessagingRealtimeCursor(storage, 'cursor')).toBeNull();
    expect(
      readMessagingRealtimeCursor(
        {
          getItem: () => {
            throw new Error('blocked');
          },
        },
        'cursor'
      )
    ).toBeNull();
  });

  it('retains content-free crash evidence beyond the lease and expires it after 24 hours', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    storeMessagingRealtimeSharedCursor(storage, 'cursor', '42', 1_000);
    expect(readMessagingRealtimeSharedCursor(storage, 'cursor', 31_000)).toBe('42');
    expect(
      readMessagingRealtimeSharedCursor(
        storage,
        'cursor',
        1_000 + MESSAGING_REALTIME_SHARED_CURSOR_TTL_MS + 1
      )
    ).toBeNull();
  });
});
