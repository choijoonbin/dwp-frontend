import { describe, expect, it } from 'vitest';

import {
  homeLaunchpadEqualColumnTemplate,
  homeLaunchpadFixedItemColumnTemplate,
  resolveHomeLaunchpadGroupColumnCount,
} from './home-launchpad-layout-contract';

describe('home launchpad equal-width layout contract', () => {
  it.each([
    [3, [1, 2, 3, 3]],
    [4, [1, 2, 4, 4]],
    [5, [1, 2, 3, 5]],
    [6, [1, 2, 3, 6]],
  ] as const)('balances %i group panels without using app counts', (groupCount, expected) => {
    const tiers = ['mobile', 'tablet', 'desktop', 'wide'] as const;
    expect(tiers.map((tier) => resolveHomeLaunchpadGroupColumnCount(groupCount, tier))).toEqual(
      expected
    );
  });

  it('emits equal fractional tracks for every panel', () => {
    expect(homeLaunchpadEqualColumnTemplate(4, 'wide')).toBe('repeat(4, minmax(0, 1fr))');
    expect(homeLaunchpadEqualColumnTemplate(6, 'desktop')).toBe('repeat(3, minmax(0, 1fr))');
  });

  it('keeps fixed left-filling slots regardless of app count', () => {
    expect(homeLaunchpadFixedItemColumnTemplate(2)).toBe('repeat(2, minmax(0, 1fr))');
    expect(homeLaunchpadFixedItemColumnTemplate(3)).toBe('repeat(3, minmax(0, 1fr))');
    expect(homeLaunchpadFixedItemColumnTemplate(4)).toBe('repeat(4, minmax(0, 1fr))');
    expect(homeLaunchpadFixedItemColumnTemplate(5)).toBe('repeat(5, minmax(0, 1fr))');
  });
});
