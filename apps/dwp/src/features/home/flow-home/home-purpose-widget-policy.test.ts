import { describe, expect, it } from 'vitest';

import {
  homeContributionDomAttributes,
  homePurposeContentPolicy,
  homePurposeVisibleLimit,
} from './home-purpose-widget';

describe('Home purpose widget footprint policy', () => {
  it.each([
    ['short', 3],
    ['standard', 3],
    ['tall', 3],
  ] as const)('keeps the configured item contract at %s height', (height, rows) => {
    expect(homePurposeVisibleLimit(3, height)).toBe(rows);
  });

  it('allows the bounded adaptive-wide item budget without changing general callers', () => {
    expect(homePurposeVisibleLimit(1, 'tall')).toBe(1);
    expect(homePurposeVisibleLimit(3, 'short')).toBe(3);
    expect(homePurposeVisibleLimit(4, 'standard')).toBe(4);
    expect(homePurposeVisibleLimit(8, 'tall')).toBe(4);
    expect(homePurposeVisibleLimit(Number.NaN, 'standard')).toBe(1);
  });

  it('keeps saved records while removing duplicate explanatory copy in a support stack', () => {
    expect(homePurposeVisibleLimit(4, 'standard', true)).toBe(4);
    expect(homePurposeContentPolicy('tall', true)).toEqual({
      density: 'tall',
      showSectionDescription: false,
      showItemDescription: false,
      showOwner: true,
      showScope: false,
    });
    expect(homePurposeContentPolicy('standard', true)).toEqual({
      density: 'standard',
      showSectionDescription: false,
      showItemDescription: false,
      showOwner: true,
      showScope: false,
    });
  });

  it('changes information density instead of deleting records', () => {
    expect(homePurposeContentPolicy('short')).toEqual({
      density: 'short',
      showSectionDescription: false,
      showItemDescription: false,
      showOwner: false,
      showScope: false,
    });
    expect(homePurposeContentPolicy('standard')).toEqual({
      density: 'standard',
      showSectionDescription: true,
      showItemDescription: false,
      showOwner: true,
      showScope: false,
    });
    expect(homePurposeContentPolicy('tall')).toEqual({
      density: 'tall',
      showSectionDescription: true,
      showItemDescription: true,
      showOwner: true,
      showScope: true,
    });
    expect(homePurposeContentPolicy('expanded')).toEqual(homePurposeContentPolicy('tall'));
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
