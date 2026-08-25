import { beforeEach, describe, expect, it } from 'vitest';

import {
  purgeForeignProductSurfaceLastRoutes,
  purgeProductSurfaceLastRoutes,
  readProductSurfaceLastRoute,
  storeProductSurfaceLastRoute,
} from './product-surface-last-route';

const identity = {
  tenantId: 'tenant-1',
  actorId: 'actor-1',
  productId: 'approvals',
  surfaceId: 'approvals.work',
};

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const storage = new MemoryStorage();

describe('product surface last-route convenience state', () => {
  beforeEach(() => storage.clear());

  it('stores only an opaque route id and restores it for the same revision before expiry', () => {
    expect(
      storeProductSurfaceLastRoute(
        identity,
        {
          routeId: 'approvals.work.inbox',
          decisionRevision: 'revision-1',
          expiresAt: '2030-01-01T00:00:00Z',
        },
        storage,
        Date.parse('2029-01-01T00:00:00Z')
      )
    ).toBe(true);
    expect(
      readProductSurfaceLastRoute(
        identity,
        'revision-1',
        storage,
        Date.parse('2029-01-01T00:00:00Z')
      )
    ).toBe('approvals.work.inbox');
    expect(storage.getItem(storage.key(0)!)).not.toContain('/approvals');
  });

  it('purges stale revisions, expired values, malformed route ids, and all logout state', () => {
    const base = {
      routeId: 'approvals.work.inbox',
      decisionRevision: 'revision-1',
      expiresAt: '2030-01-01T00:00:00Z',
    };
    expect(storeProductSurfaceLastRoute(identity, base, storage, 0)).toBe(true);
    expect(readProductSurfaceLastRoute(identity, 'revision-2', storage, 0)).toBeUndefined();
    expect(storage).toHaveLength(0);

    expect(storeProductSurfaceLastRoute(identity, base, storage, 0)).toBe(true);
    expect(
      readProductSurfaceLastRoute(
        identity,
        'revision-1',
        storage,
        Date.parse('2031-01-01T00:00:00Z')
      )
    ).toBeUndefined();
    expect(storage).toHaveLength(0);

    expect(
      storeProductSurfaceLastRoute(
        identity,
        { ...base, routeId: '/approvals/inbox?task=secret' },
        storage,
        0
      )
    ).toBe(false);
    expect(storeProductSurfaceLastRoute(identity, base, storage, 0)).toBe(true);
    purgeProductSurfaceLastRoutes(storage);
    expect(storage).toHaveLength(0);
  });

  it('purges another tenant or actor without removing the current identity on session recovery', () => {
    const value = {
      routeId: 'approvals.work.inbox',
      decisionRevision: 'revision-1',
      expiresAt: '2030-01-01T00:00:00Z',
    };
    expect(storeProductSurfaceLastRoute(identity, value, storage, 0)).toBe(true);
    expect(
      storeProductSurfaceLastRoute(
        { ...identity, tenantId: 'tenant-2', actorId: 'actor-2' },
        value,
        storage,
        0
      )
    ).toBe(true);

    purgeForeignProductSurfaceLastRoutes(identity, storage);

    expect(storage).toHaveLength(1);
    expect(readProductSurfaceLastRoute(identity, 'revision-1', storage, 0)).toBe(
      'approvals.work.inbox'
    );
  });
});
