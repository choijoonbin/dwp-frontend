import { describe, expect, it } from 'vitest';

import {
  MESSAGING_CROSS_TAB_LEASE_TTL_MS,
  MessagingCrossTabLease,
} from './messaging-cross-tab-coordination';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('messaging cross-tab lease', () => {
  it('elects one owner, renews it, and transfers after release', () => {
    const storage = new MemoryStorage();
    const first = new MessagingCrossTabLease({ name: 'presence', owner: 'first', storage });
    const second = new MessagingCrossTabLease({ name: 'presence', owner: 'second', storage });

    expect(first.claim(1_000)).toBe(true);
    expect(second.claim(1_001)).toBe(false);
    expect(first.renew(2_000)).toBe(true);
    first.release();
    expect(second.claim(2_001)).toBe(true);
  });

  it('allows takeover only after the previous lease expires', () => {
    const storage = new MemoryStorage();
    const first = new MessagingCrossTabLease({ name: 'stream', owner: 'first', storage });
    const second = new MessagingCrossTabLease({ name: 'stream', owner: 'second', storage });

    expect(first.claim(10_000)).toBe(true);
    expect(second.claim(10_000 + MESSAGING_CROSS_TAB_LEASE_TTL_MS - 1)).toBe(false);
    expect(second.claim(10_000 + MESSAGING_CROSS_TAB_LEASE_TTL_MS)).toBe(true);
    expect(first.renew(30_000)).toBe(false);
  });

  it('does not let a corrupt far-future lease block Messenger indefinitely', () => {
    const storage = new MemoryStorage();
    const lease = new MessagingCrossTabLease({ name: 'stream', owner: 'safe-tab', storage });
    storage.setItem(
      lease.key,
      JSON.stringify({ version: 1, owner: 'stale-tab', expiresAt: Number.MAX_SAFE_INTEGER })
    );

    expect(lease.claim(10_000)).toBe(true);
  });

  it('keeps the feature functional when browser storage is unavailable', () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const lease = new MessagingCrossTabLease({
      name: 'presence',
      owner: 'fallback',
      storage: brokenStorage,
    });

    expect(lease.claim()).toBe(true);
    expect(lease.renew()).toBe(true);
    expect(() => lease.release()).not.toThrow();
  });

  it('carries a recent durable cursor through a crashed-owner takeover', () => {
    const storage = new MemoryStorage();
    const first = new MessagingCrossTabLease({ name: 'stream', owner: 'first', storage });
    const second = new MessagingCrossTabLease({ name: 'stream', owner: 'second', storage });

    expect(first.claim(1_000)).toBe(true);
    expect(first.renew(2_000, '41')).toBe(true);
    expect(second.cursor(2_000)).toBe('41');
    expect(second.claim(14_001)).toBe(true);
    expect(second.cursor(14_001)).toBe('41');
  });

  it('drops lease cursors after the bounded crash-handoff window', () => {
    const storage = new MemoryStorage();
    const first = new MessagingCrossTabLease({ name: 'stream', owner: 'first', storage });
    const second = new MessagingCrossTabLease({ name: 'stream', owner: 'second', storage });

    expect(first.claim(1_000, '41')).toBe(true);
    expect(second.claim(37_001)).toBe(true);
    expect(second.cursor(37_001)).toBeNull();
  });
});
