import { describe, expect, it } from 'vitest';

import { homeContributionDomAttributes, homePurposeVisibleLimit } from './home-purpose-widget';

describe('Home purpose widget footprint policy', () => {
  it.each([
    ['short', 1],
    ['standard', 2],
    ['tall', 3],
  ] as const)('uses the same %s row budget for loading and loaded content', (height, rows) => {
    expect(homePurposeVisibleLimit(3, height)).toBe(rows);
  });

  it('never exceeds the configured or governed row budget', () => {
    expect(homePurposeVisibleLimit(1, 'tall')).toBe(1);
    expect(homePurposeVisibleLimit(8, 'tall')).toBe(3);
  });

  it('keeps confidential contribution identity out of DOM metadata', () => {
    const confidentialSemanticKey = 'salary review|executive approval|2026-08-31';
    const attributes = JSON.stringify(homeContributionDomAttributes());

    expect(attributes).toContain('data-home-contribution');
    expect(attributes).not.toContain(confidentialSemanticKey);
    expect(attributes).not.toContain('sourceReference');
    expect(attributes).not.toContain('dedupeKey');
  });
});
