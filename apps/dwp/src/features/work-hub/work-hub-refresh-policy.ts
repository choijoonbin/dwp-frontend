import type { WorkHubSnapshot } from './work-hub-contracts';

/**
 * Keeps the last verified rows only for a pure transport outage. An authorization
 * failure must purge source-owned content immediately, even when every source failed.
 */
export function reconcileWorkHubRefresh(
  refreshed: WorkHubSnapshot,
  previous: WorkHubSnapshot | null
): WorkHubSnapshot {
  if (!previous || refreshed.completeness !== 'UNAVAILABLE') return refreshed;
  const requested = refreshed.sources.filter((source) => source.state !== 'NOT_REQUESTED');
  const transportOutage =
    requested.length > 0 && requested.every((source) => source.state === 'UNAVAILABLE');
  return transportOutage ? { ...refreshed, items: previous.items } : refreshed;
}
