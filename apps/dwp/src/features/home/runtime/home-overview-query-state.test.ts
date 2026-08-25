import { describe, expect, it } from 'vitest';

import { resolveHomeOverviewQueryFailureState } from './home-overview-query-state';

describe('Home overview query failure state', () => {
  it('keeps cached overview data visible after a background refresh failure', () => {
    expect(
      resolveHomeOverviewQueryFailureState({
        hasData: true,
        isError: true,
        isRefetchError: true,
      })
    ).toEqual({ hardFailed: false, refreshPartial: true });
  });

  it('uses the hard error state when no overview has ever loaded', () => {
    expect(
      resolveHomeOverviewQueryFailureState({
        hasData: false,
        isError: true,
        isRefetchError: false,
      })
    ).toEqual({ hardFailed: true, refreshPartial: false });
  });
});
