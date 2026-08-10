import { useAppearance } from '../../appearance';

import Box from '@mui/material/Box';
import { DataGrid } from '@mui/x-data-grid';
import { enUS, koKR } from '@mui/x-data-grid/locales';

import type { DataGridProps, GridLocaleText, GridValidRowModel } from '@mui/x-data-grid';

type GridDensity = NonNullable<DataGridProps['density']>;

const GRID_ROW_HEIGHT: Record<GridDensity, number> = {
  compact: 44,
  standard: 52,
  comfortable: 60,
};

const GRID_FOOTER_HEIGHT = 52;
const GRID_CHROME_HEIGHT = 2;

const GRID_LOCALES: Record<string, Partial<GridLocaleText>> = {
  en: enUS.components.MuiDataGrid.defaultProps.localeText,
  ko: koKR.components.MuiDataGrid.defaultProps.localeText,
};

export function resolveDataGridLocaleText(language: string): Partial<GridLocaleText> {
  return GRID_LOCALES[language.toLowerCase().split('-')[0]] ?? GRID_LOCALES.en;
}

type AdaptiveGridHeightInput = {
  rowCount: number;
  rowHeight: number;
  columnHeaderHeight: number;
  hideFooter: boolean;
  loading: boolean;
  minVisibleRows: number;
  maxVisibleRows: number;
};

export function calculateAdaptiveGridHeight({
  rowCount,
  rowHeight,
  columnHeaderHeight,
  hideFooter,
  loading,
  minVisibleRows,
  maxVisibleRows,
}: AdaptiveGridHeightInput): number {
  const minimum = Math.max(1, minVisibleRows);
  const maximum = Math.max(minimum, maxVisibleRows);
  const requestedRows = loading ? 3 : rowCount === 0 ? 2 : rowCount;
  const visibleRows = Math.min(maximum, Math.max(minimum, requestedRows));

  return (
    columnHeaderHeight +
    visibleRows * rowHeight +
    (hideFooter ? 0 : GRID_FOOTER_HEIGHT) +
    GRID_CHROME_HEIGHT
  );
}

export type EnterpriseDataGridProps<R extends GridValidRowModel = GridValidRowModel> = Omit<
  DataGridProps<R>,
  'aria-label' | 'density'
> & {
  ariaLabel: string;
  density?: DataGridProps<R>['density'];
  height?: number | string;
  minVisibleRows?: number;
  maxVisibleRows?: number;
};

export function EnterpriseDataGrid<R extends GridValidRowModel = GridValidRowModel>({
  ariaLabel,
  density,
  height,
  minVisibleRows = 1,
  maxVisibleRows = 8,
  pageSizeOptions = [25, 50, 100],
  disableRowSelectionOnClick = true,
  rows = [],
  rowHeight,
  columnHeaderHeight,
  hideFooter = false,
  loading = false,
  localeText,
  ...props
}: EnterpriseDataGridProps<R>) {
  const appearance = useAppearance();
  const resolvedDensity = density ?? appearance.preference.density;
  const resolvedRowHeight = rowHeight ?? GRID_ROW_HEIGHT[resolvedDensity];
  const resolvedColumnHeaderHeight = columnHeaderHeight ?? resolvedRowHeight;
  const resolvedHeight =
    height ??
    calculateAdaptiveGridHeight({
      rowCount: rows.length,
      rowHeight: resolvedRowHeight,
      columnHeaderHeight: resolvedColumnHeaderHeight,
      hideFooter,
      loading,
      minVisibleRows,
      maxVisibleRows,
    });
  const resolvedLanguage =
    typeof document === 'undefined' ? 'en' : document.documentElement.lang || 'en';
  const resolvedLocaleText = localeText ?? resolveDataGridLocaleText(resolvedLanguage);

  return (
    <Box sx={{ width: 1, minWidth: 0, height: resolvedHeight }}>
      <DataGrid
        {...props}
        aria-label={ariaLabel}
        rows={rows}
        rowHeight={resolvedRowHeight}
        columnHeaderHeight={resolvedColumnHeaderHeight}
        hideFooter={hideFooter}
        loading={loading}
        localeText={resolvedLocaleText}
        density="standard"
        pageSizeOptions={pageSizeOptions}
        disableRowSelectionOnClick={disableRowSelectionOnClick}
      />
    </Box>
  );
}
