import { describe, expect, it } from 'vitest';

import { calculateAdaptiveGridHeight, resolveDataGridLocaleText } from './enterprise-data-grid';

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

describe('resolveDataGridLocaleText', () => {
  it('uses the active product language and falls back to English for future locales', () => {
    expect(resolveDataGridLocaleText('ko-KR').paginationRowsPerPage).toBe('페이지 당 행:');
    expect(resolveDataGridLocaleText('en-US').paginationRowsPerPage).toBe('Rows per page:');
    expect(resolveDataGridLocaleText('fr-FR').paginationRowsPerPage).toBe('Rows per page:');
  });
});
