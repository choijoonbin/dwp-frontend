import { describe, expect, it } from 'vitest';

import {
  calculateAdaptiveGridHeight,
  countSelectedRows,
  resolveDataGridLocaleText,
  resolveGridExportStrategy,
  resolveGridProcessingModes,
  resolveStickyColumnStyles,
} from './enterprise-data-grid';

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

describe('resolveGridProcessingModes', () => {
  it('owns all remote processing contracts in server mode', () => {
    expect(resolveGridProcessingModes('server')).toEqual({
      filterMode: 'server',
      paginationMode: 'server',
      sortingMode: 'server',
    });
  });

  it('preserves explicit modes for backwards-compatible client grids', () => {
    expect(resolveGridProcessingModes('client', { paginationMode: 'server' })).toEqual({
      filterMode: 'client',
      paginationMode: 'server',
      sortingMode: 'client',
    });
  });
});

describe('countSelectedRows', () => {
  it('counts included rows and excluded rows across server pages', () => {
    expect(countSelectedRows({ type: 'include', ids: new Set([1, 2]) }, 50)).toBe(2);
    expect(countSelectedRows({ type: 'exclude', ids: new Set([3, 4]) }, 50)).toBe(48);
  });

  it('never returns a negative count for stale exclusion models', () => {
    expect(countSelectedRows({ type: 'exclude', ids: new Set([1, 2, 3]) }, 2)).toBe(0);
  });
});

describe('resolveGridExportStrategy', () => {
  it('prevents a partial built-in export from looking complete in server mode', () => {
    expect(
      resolveGridExportStrategy('server', {
        ariaLabel: 'Grid tools',
        enableCsvExport: true,
      })
    ).toBe('none');
  });

  it('uses built-in export for client data and an explicit handler for server data', () => {
    expect(
      resolveGridExportStrategy('client', {
        ariaLabel: 'Grid tools',
        enableCsvExport: true,
      })
    ).toBe('client');
    expect(
      resolveGridExportStrategy('server', {
        ariaLabel: 'Grid tools',
        onExport: () => undefined,
      })
    ).toBe('server');
  });
});

describe('resolveStickyColumnStyles', () => {
  it('calculates stable offsets for leading and trailing operational columns', () => {
    const styles = resolveStickyColumnStyles(
      [
        { field: 'id', width: 100 },
        { field: 'title', minWidth: 220 },
        { field: 'status', width: 120 },
      ],
      { left: ['id', 'title'], right: ['status'] }
    );

    expect(styles['& .MuiDataGrid-cell[data-field="id"]']).toMatchObject({ left: 0 });
    expect(styles['& .MuiDataGrid-cell[data-field="title"]']).toMatchObject({ left: 100 });
    expect(styles['& .MuiDataGrid-cell[data-field="status"]']).toMatchObject({ right: 0 });
  });
});
