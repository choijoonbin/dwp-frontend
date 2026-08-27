import { describe, expect, it } from 'vitest';

import {
  WORKSPACE_WIDGET_GRID_COLUMNS,
  WORKSPACE_WIDGET_HEIGHT_POLICY,
  WORKSPACE_WIDGET_SIZE_POLICY,
  WORKSPACE_WIDGET_SPACING_POLICY,
  workspaceWidgetBlockSize,
  workspaceWidgetFootprint,
  workspaceWidgetGridColumn,
  workspaceWidgetContentRows,
  workspaceWidgetSpacing,
  workspaceWidgetSizeFraction,
} from './workspace-widget-layout-policy';

describe('workspace widget layout policy', () => {
  it('uses the least common grid that exactly represents 2, 3, 4, and 5 items per row', () => {
    expect(WORKSPACE_WIDGET_GRID_COLUMNS).toBe(60);
    expect(WORKSPACE_WIDGET_SIZE_POLICY).toEqual({
      fifth: { xs: 60, sm: 60, lg: 12 },
      quarter: { xs: 60, sm: 60, lg: 15 },
      compact: { xs: 60, sm: 60, lg: 20 },
      medium: { xs: 60, sm: 60, lg: 30 },
      large: { xs: 60, sm: 60, lg: 40 },
      full: { xs: 60, sm: 60, lg: 60 },
    });
  });

  it('uses semantic height constraints on an 8px baseline and releases them on phones', () => {
    expect(WORKSPACE_WIDGET_HEIGHT_POLICY).toEqual({
      short: { blockSize: 168, contentRows: 3 },
      standard: { blockSize: 232, contentRows: 3 },
      tall: { blockSize: 304, contentRows: 4 },
      expanded: { blockSize: 384, contentRows: 6 },
    });
    expect(workspaceWidgetBlockSize('tall')).toEqual({ xs: 'auto', sm: 304 });
    expect(workspaceWidgetContentRows('expanded')).toBe(6);
    expect(
      Object.values(WORKSPACE_WIDGET_HEIGHT_POLICY).every(({ blockSize }) => blockSize % 8 === 0)
    ).toBe(true);
  });

  it('turns governed footprints into responsive grid placement', () => {
    expect(workspaceWidgetGridColumn('fifth')).toEqual({
      xs: '1 / -1',
      sm: '1 / -1',
      lg: 'span 12',
    });
    expect(workspaceWidgetGridColumn('compact')).toEqual({
      xs: '1 / -1',
      sm: '1 / -1',
      lg: 'span 20',
    });
    expect(workspaceWidgetGridColumn('full')).toEqual({
      xs: '1 / -1',
      sm: '1 / -1',
      lg: '1 / -1',
    });
    expect(workspaceWidgetSizeFraction('large')).toBe('2/3');
    expect(workspaceWidgetFootprint('quarter')).toEqual({ numerator: 1, denominator: 4 });
  });

  it('governs responsive visual spacing without adding 60 full-size column gaps', () => {
    expect(workspaceWidgetSpacing('focused')).toEqual({
      inlineInset: { xs: 0, sm: 7, lg: 7 },
      virtualColumnGapPx: { xs: 0, sm: 2 },
      rowGap: { xs: 1.5, sm: 2, lg: 2 },
    });
    expect(workspaceWidgetSpacing('balanced')).toEqual({
      inlineInset: { xs: 0, sm: 9, lg: 11 },
      virtualColumnGapPx: { xs: 0, sm: 2 },
      rowGap: { xs: 2, sm: 2.5, lg: 3 },
    });
    expect(workspaceWidgetSpacing('expressive')).toEqual({
      inlineInset: { xs: 0, sm: 11, lg: 15 },
      virtualColumnGapPx: { xs: 0, sm: 2 },
      rowGap: { xs: 2.5, sm: 3, lg: 4 },
    });
    expect(WORKSPACE_WIDGET_SPACING_POLICY.balanced).toBe(workspaceWidgetSpacing('balanced'));
  });
});
