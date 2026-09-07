import { describe, expect, it } from 'vitest';

import { reconcileWorkHubRefresh } from './work-hub-refresh-policy';
import { hubItem, snapshot as hubSnapshot } from './work-hub.test-support';

describe('reconcileWorkHubRefresh', () => {
  const previous = hubSnapshot([hubItem()]);

  it('retains verified rows during a pure transport outage', () => {
    const refreshed = hubSnapshot([]);
    refreshed.completeness = 'UNAVAILABLE';
    refreshed.sources = refreshed.sources.map((source) => ({
      ...source,
      state: source.state === 'NOT_REQUESTED' ? 'NOT_REQUESTED' : 'UNAVAILABLE',
      items: [],
    }));

    const result = reconcileWorkHubRefresh(refreshed, previous);

    expect(result.items).toEqual(previous.items);
    expect(result.sources).toBe(refreshed.sources);
  });

  it('purges previous rows when authorization was revoked', () => {
    const refreshed = hubSnapshot([]);
    refreshed.completeness = 'UNAVAILABLE';
    refreshed.sources = refreshed.sources.map((source, index) => ({
      ...source,
      state:
        source.state === 'NOT_REQUESTED'
          ? 'NOT_REQUESTED'
          : index === 0
            ? 'FORBIDDEN'
            : 'UNAVAILABLE',
      items: [],
    }));

    expect(reconcileWorkHubRefresh(refreshed, previous)).toBe(refreshed);
    expect(reconcileWorkHubRefresh(refreshed, previous).items).toEqual([]);
  });
});
