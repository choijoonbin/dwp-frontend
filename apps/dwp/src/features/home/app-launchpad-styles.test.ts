import { describe, expect, it } from 'vitest';

import { launchpadInteractionFrameSx, launchpadTileSx } from './app-launchpad-styles';

type StyleRecord = Record<string, unknown>;

function asStyleRecord(value: unknown): StyleRecord {
  return value as StyleRecord;
}

describe('launchpad hover treatment', () => {
  it('keeps the interaction frame free of an oversized pseudo-element surface', () => {
    const frame = asStyleRecord(launchpadInteractionFrameSx(false));

    expect(frame).not.toHaveProperty('&::after');
    expect(frame).toMatchObject({ width: 52, height: 52 });
  });

  it('lifts only the glyph and leaves the tile surface transparent', () => {
    const tile = asStyleRecord(launchpadTileSx(false, 0));
    const hover = asStyleRecord(tile['&:hover']);
    const glyphHover = asStyleRecord(tile['&:hover [data-launchpad-glyph]']);

    expect(hover).toMatchObject({ bgcolor: 'transparent', boxShadow: 'none' });
    expect(glyphHover).toMatchObject({
      transform: 'translateY(-2px) scale(1.02)',
      filter: 'saturate(1.06)',
    });
    expect(glyphHover.boxShadow).toEqual(expect.any(Function));
    expect(tile).not.toHaveProperty('&:hover [data-launchpad-edit-frame]::after');
  });

  it('does not animate disabled tools and preserves the editing frame treatment', () => {
    const disabledTile = asStyleRecord(launchpadTileSx(false, 0, true));
    const editingTile = asStyleRecord(launchpadTileSx(true, 0));

    expect(disabledTile['&:hover [data-launchpad-glyph]']).toBeUndefined();
    expect(editingTile['&:hover [data-launchpad-glyph]']).toBeUndefined();
    expect(editingTile['&:hover [data-launchpad-edit-frame]']).toBeDefined();
  });
});
