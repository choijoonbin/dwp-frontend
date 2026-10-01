import { describe, expect, it } from 'vitest';

import {
  providerBoundedListCoverage,
  providerBoundedMetric,
  providerOwnerCountLabel,
  providerOwnerListCanClaimEmpty,
} from './provider-bounded-list-coverage';

describe('provider bounded owner lists', () => {
  it('allows aggregate claims only when the owner response proves it is below the hard limit', () => {
    expect(providerBoundedListCoverage(199, 200)).toBe('COMPLETE');
    expect(providerBoundedMetric([{ pending: true }], 200, (item) => item.pending)).toBe(1);
  });

  it('fails aggregate metrics closed when a response may have been truncated', () => {
    const items = Array.from({ length: 200 }, (_, index) => ({ pending: index === 0 }));
    expect(providerBoundedListCoverage(items.length, 200)).toBe('POSSIBLY_TRUNCATED');
    expect(providerBoundedMetric(items, 200, (item) => item.pending)).toBeNull();
    expect(providerBoundedMetric(undefined, 200, () => true)).toBeNull();
  });

  it('labels owner continuation and withholds a false empty claim', () => {
    expect(providerOwnerCountLabel(12, true)).toBe('12+');
    expect(providerOwnerCountLabel(11, false)).toBe('11');
    expect(providerOwnerListCanClaimEmpty(0, true)).toBe(false);
    expect(providerOwnerListCanClaimEmpty(0, false)).toBe(true);
  });
});
