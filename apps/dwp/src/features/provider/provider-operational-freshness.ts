import type { LiveStatusState } from '@dwp-frontend/design-system';

export const PROVIDER_OPERATIONAL_MAX_AGE_MS = 90_000;

export function providerOperationalSnapshotState({
  fetching,
  partial,
  sourceObservedAt,
  now = Date.now(),
}: {
  fetching: boolean;
  partial: boolean;
  sourceObservedAt: number;
  now?: number;
}): LiveStatusState {
  if (fetching) return 'syncing';
  if (
    sourceObservedAt <= 0 ||
    !Number.isFinite(sourceObservedAt) ||
    now - sourceObservedAt > PROVIDER_OPERATIONAL_MAX_AGE_MS
  )
    return 'stale';
  if (partial) return 'degraded';
  return 'live';
}
