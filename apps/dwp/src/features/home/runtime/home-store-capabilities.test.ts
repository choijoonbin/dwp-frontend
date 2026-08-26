import { describe, expect, it } from 'vitest';

import { activeHomeStoreUsesViews } from './home-store-capabilities';

describe('home personalization store capabilities', () => {
  it('does not expose VIEWS-only capabilities for the LEGACY store', () => {
    expect(activeHomeStoreUsesViews(false)).toBe(false);
  });

  it('keeps an active LEGACY edit session isolated from a refreshed VIEWS policy', () => {
    expect(activeHomeStoreUsesViews(true, 'LEGACY')).toBe(false);
  });

  it('keeps an active VIEWS edit session on VIEWS until that draft closes', () => {
    expect(activeHomeStoreUsesViews(false, 'VIEWS')).toBe(true);
  });
});
