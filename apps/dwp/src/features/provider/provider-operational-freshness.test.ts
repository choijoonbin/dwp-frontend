import { describe, expect, it } from 'vitest';

import {
  PROVIDER_OPERATIONAL_MAX_AGE_MS,
  providerOperationalSnapshotState,
} from './provider-operational-freshness';

describe('providerOperationalSnapshotState', () => {
  const now = 1_000_000;

  it('distinguishes current, synchronizing, partial, and stale snapshots', () => {
    expect(
      providerOperationalSnapshotState({
        fetching: false,
        partial: false,
        sourceObservedAt: now,
        now,
      })
    ).toBe('live');
    expect(
      providerOperationalSnapshotState({
        fetching: true,
        partial: false,
        sourceObservedAt: now,
        now,
      })
    ).toBe('syncing');
    expect(
      providerOperationalSnapshotState({
        fetching: false,
        partial: true,
        sourceObservedAt: now,
        now,
      })
    ).toBe('degraded');
    expect(
      providerOperationalSnapshotState({
        fetching: false,
        partial: false,
        sourceObservedAt: now - PROVIDER_OPERATIONAL_MAX_AGE_MS - 1,
        now,
      })
    ).toBe('stale');
    expect(
      providerOperationalSnapshotState({
        fetching: false,
        partial: false,
        sourceObservedAt: 0,
        now,
      })
    ).toBe('stale');
  });

  it('does not turn an old source snapshot live merely because HTTP refreshed now', () => {
    const freshlyReceivedAt = now;
    const oldGeneratedAt = freshlyReceivedAt - PROVIDER_OPERATIONAL_MAX_AGE_MS - 10_000;

    expect(
      providerOperationalSnapshotState({
        fetching: false,
        partial: false,
        sourceObservedAt: oldGeneratedAt,
        now: freshlyReceivedAt,
      })
    ).toBe('stale');
  });

  it('keeps source staleness visible when another fragment is also unavailable', () => {
    expect(
      providerOperationalSnapshotState({
        fetching: false,
        partial: true,
        sourceObservedAt: now - PROVIDER_OPERATIONAL_MAX_AGE_MS - 1,
        now,
      })
    ).toBe('stale');
  });
});
