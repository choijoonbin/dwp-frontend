import { describe, expect, it } from 'vitest';

import { resolveFlowGovernedPlacement } from './flow-governed-placement';

describe('Flow Home governed editorial placement', () => {
  it.each(['fifth', 'quarter', 'compact', 'medium', 'large'] as const)(
    'protects an unpaired %s widget from becoming an orphaned partial row',
    (preferredSize) => {
      expect(resolveFlowGovernedPlacement(preferredSize)).toEqual({
        preferredSize,
        renderSize: 'full',
        orphanProtected: true,
      });
    }
  );

  it('keeps an already full-width governed widget unchanged', () => {
    expect(resolveFlowGovernedPlacement('full')).toEqual({
      preferredSize: 'full',
      renderSize: 'full',
      orphanProtected: false,
    });
  });
});
