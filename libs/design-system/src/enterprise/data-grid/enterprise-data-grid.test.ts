import { describe, expect, it } from 'vitest';

import { calculateAdaptiveGridHeight } from './enterprise-data-grid';

const standardGrid = {
  rowHeight: 52,
  columnHeaderHeight: 52,
  minVisibleRows: 1,
  maxVisibleRows: 8,
};

describe('calculateAdaptiveGridHeight', () => {
  it('fits a single row without leaving an empty viewport', () => {
    expect(
      calculateAdaptiveGridHeight({
        ...standardGrid,
        rowCount: 1,
        hideFooter: true,
        loading: false,
      })
    ).toBe(106);
  });

  it('reserves two rows for an intentional empty state', () => {
    expect(
      calculateAdaptiveGridHeight({
        ...standardGrid,
        rowCount: 0,
        hideFooter: true,
        loading: false,
      })
    ).toBe(158);
  });

  it('caps large datasets and preserves room for pagination', () => {
    expect(
      calculateAdaptiveGridHeight({
        ...standardGrid,
        rowCount: 50,
        hideFooter: false,
        loading: false,
      })
    ).toBe(522);
  });
});
