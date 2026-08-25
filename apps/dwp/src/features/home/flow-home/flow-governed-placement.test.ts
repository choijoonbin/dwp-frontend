import { describe, expect, it } from 'vitest';

import { resolveFlowTrailingGovernedPlacement } from './flow-governed-placement';

describe('Flow Home trailing governed placement', () => {
  it.each(['fifth', 'quarter', 'compact', 'medium', 'large'] as const)(
    'protects an unpaired %s widget from becoming an orphaned partial row',
    (preferredSize) => {
      expect(resolveFlowTrailingGovernedPlacement(preferredSize)).toEqual({
        preferredSize,
        renderSize: 'full',
        orphanProtected: true,
      });
    }
  );

  it('keeps an already full-width governed widget unchanged', () => {
    expect(resolveFlowTrailingGovernedPlacement('full')).toEqual({
      preferredSize: 'full',
      renderSize: 'full',
      orphanProtected: false,
    });
  });
});
