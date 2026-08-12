import { forwardRef, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useAppearance } from '../../appearance';

import { Columns3, Download, Filter, RefreshCw } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DataGrid } from '@mui/x-data-grid';
import { enUS, koKR } from '@mui/x-data-grid/locales';
import {
  ColumnsPanelTrigger,
  ExportCsv,
  FilterPanelTrigger,
  QuickFilter,
  QuickFilterControl,
  Toolbar,
  ToolbarButton,
} from '@mui/x-data-grid';

import type {
  DataGridProps,
  GridLocaleText,
  GridRowSelectionModel,
  GridValidRowModel,
} from '@mui/x-data-grid';

type AccessibleCheckboxInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  ownerState?: unknown;
  'data-indeterminate'?: boolean | string;
};

const AccessibleCheckboxInput = forwardRef<HTMLInputElement, AccessibleCheckboxInputProps>(
  function AccessibleCheckboxInput(
    {
      'aria-checked': _ariaChecked,
      'data-indeterminate': dataIndeterminate,
      ownerState: _ownerState,
      style,
      ...props
    },
    forwardedRef
  ) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const setInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef]
    );
    const indeterminate = dataIndeterminate === true || dataIndeterminate === 'true';

    useLayoutEffect(() => {
      if (inputRef.current) inputRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    return (
      <input
        {...props}
        data-indeterminate={indeterminate || undefined}
        ref={setInputRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
          cursor: 'inherit',
          opacity: 0,
          ...style,
        }}
      />
    );
  }
);

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

export type EnterpriseGridMode = 'client' | 'server';
export type EnterpriseGridExportStrategy = 'none' | 'client' | 'server';

export type EnterpriseDataGridToolbarConfig = {
  ariaLabel: string;
  showColumns?: boolean;
  columnsLabel?: string;
  showFilters?: boolean;
  filtersLabel?: string;
  showQuickFilter?: boolean;
  quickFilterLabel?: string;
  quickFilterPlaceholder?: string;
  quickFilterDebounceMs?: number;
  enableCsvExport?: boolean;
  exportLabel?: string;
  csvFileName?: string;
  onExport?: () => void | Promise<void>;
  exporting?: boolean;
  onRefresh?: () => void;
  refreshLabel?: string;
  refreshing?: boolean;
  selectedCountLabel?: (count: number) => string;
  bulkActions?: React.ReactNode;
  columnPresets?: EnterpriseGridColumnPreset[];
  columnPresetsLabel?: string;
  selectedColumnPresetId?: string;
  onColumnPresetChange?: (presetId: string) => void;
};

export type EnterpriseGridColumnPreset = {
  id: string;
  label: string;
};

export type EnterpriseGridStickyColumns = {
  left?: string[];
  right?: string[];
};

export function resolveGridExportStrategy(
  mode: EnterpriseGridMode,
  config: EnterpriseDataGridToolbarConfig | undefined
): EnterpriseGridExportStrategy {
  if (config?.onExport) return 'server';
  return config?.enableCsvExport && mode === 'client' ? 'client' : 'none';
}

type GridProcessingModes = Pick<DataGridProps, 'filterMode' | 'paginationMode' | 'sortingMode'>;

export function resolveGridProcessingModes(
  mode: EnterpriseGridMode,
  current: GridProcessingModes = {}
): Required<GridProcessingModes> {
  if (mode === 'server') {
    return { filterMode: 'server', paginationMode: 'server', sortingMode: 'server' };
  }
  return {
    filterMode: current.filterMode ?? 'client',
    paginationMode: current.paginationMode ?? 'client',
    sortingMode: current.sortingMode ?? 'client',
  };
}

export function countSelectedRows(
  selection: GridRowSelectionModel | undefined,
  totalRowCount: number
): number {
  if (!selection) return 0;
  return selection.type === 'include'
    ? selection.ids.size
    : Math.max(0, totalRowCount - selection.ids.size);
}

type EnterpriseGridToolbarProps = {
  config?: EnterpriseDataGridToolbarConfig;
  mode?: EnterpriseGridMode;
  selectedCount?: number;
};

declare module '@mui/x-data-grid' {
  interface ToolbarPropsOverrides {
    config?: EnterpriseDataGridToolbarConfig;
    mode?: EnterpriseGridMode;
    selectedCount?: number;
  }
}

function EnterpriseGridToolbar({
  config,
  mode = 'client',
  selectedCount = 0,
}: EnterpriseGridToolbarProps) {
  if (!config) return null;
  const showColumns = config.showColumns ?? true;
  const showFilters = config.showFilters ?? true;
  const showQuickFilter = config.showQuickFilter ?? true;
  const selectionLabel = config.selectedCountLabel?.(selectedCount) ?? `${selectedCount}`;
  const exportStrategy = resolveGridExportStrategy(mode, config);

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar aria-label={config.ariaLabel}>
        {config.columnPresets && config.columnPresets.length > 0 && (
          <Select
            size="small"
            variant="standard"
            disableUnderline
            value={config.selectedColumnPresetId ?? config.columnPresets[0].id}
            onChange={(event) => config.onColumnPresetChange?.(String(event.target.value))}
            inputProps={{ 'aria-label': config.columnPresetsLabel ?? 'Column preset' }}
            sx={{ minWidth: 132, mr: 0.5 }}
          >
            {config.columnPresets.map((preset) => (
              <MenuItem key={preset.id} value={preset.id}>
                {preset.label}
              </MenuItem>
            ))}
          </Select>
        )}
        {showColumns && (
          <Tooltip title={config.columnsLabel ?? 'Columns'}>
            <ColumnsPanelTrigger render={<ToolbarButton />}>
              <Columns3 size={17} aria-hidden="true" />
            </ColumnsPanelTrigger>
          </Tooltip>
        )}
        {showFilters && (
          <Tooltip title={config.filtersLabel ?? 'Filters'}>
            <FilterPanelTrigger render={<ToolbarButton />}>
              <Filter size={17} aria-hidden="true" />
            </FilterPanelTrigger>
          </Tooltip>
        )}
        {exportStrategy === 'server' ? (
          <Tooltip title={config.exportLabel ?? 'Export CSV'}>
            <ToolbarButton
              aria-label={config.exportLabel ?? 'Export CSV'}
              disabled={config.exporting}
              onClick={() => void config.onExport?.()}
            >
              <Download size={17} aria-hidden="true" />
            </ToolbarButton>
          </Tooltip>
        ) : (
          exportStrategy === 'client' && (
            <Tooltip title={config.exportLabel ?? 'Export CSV'}>
              <ExportCsv
                render={<ToolbarButton />}
                options={{ fileName: config.csvFileName, utf8WithBom: true }}
              >
                <Download size={17} aria-hidden="true" />
              </ExportCsv>
            </Tooltip>
          )
        )}
        {config.onRefresh && (
          <Tooltip title={config.refreshLabel ?? 'Refresh'}>
            <ToolbarButton
              aria-label={config.refreshLabel ?? 'Refresh'}
              disabled={config.refreshing}
              onClick={config.onRefresh}
            >
              <RefreshCw size={17} aria-hidden="true" />
            </ToolbarButton>
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        {showQuickFilter && (
          <Box sx={{ width: { xs: 160, sm: 240 } }}>
            <QuickFilter expanded debounceMs={config.quickFilterDebounceMs ?? 300}>
              <QuickFilterControl
                aria-label={config.quickFilterLabel ?? 'Search rows'}
                placeholder={config.quickFilterPlaceholder ?? config.quickFilterLabel ?? 'Search'}
                size="small"
                style={{ width: '100%' }}
              />
            </QuickFilter>
          </Box>
        )}
      </Toolbar>
      {selectedCount > 0 && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          gap={1}
          role="status"
          aria-live="polite"
          sx={{ minHeight: 44, px: 1.5, py: 0.75, bgcolor: 'action.selected' }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <Chip size="small" color="primary" label={selectedCount} />
            <Typography variant="body2">{selectionLabel}</Typography>
          </Stack>
          {config.bulkActions && (
            <Stack direction="row" justifyContent="flex-end" gap={0.5}>
              {config.bulkActions}
            </Stack>
          )}
        </Stack>
      )}
    </Box>
  );
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
  mode?: EnterpriseGridMode;
  toolbar?: EnterpriseDataGridToolbarConfig | false;
  density?: DataGridProps<R>['density'];
  height?: number | string;
  minVisibleRows?: number;
  maxVisibleRows?: number;
  stickyColumns?: EnterpriseGridStickyColumns;
};

function escapeCssAttribute(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function resolveStickyColumnStyles<R extends GridValidRowModel>(
  columns: DataGridProps<R>['columns'],
  stickyColumns: EnterpriseGridStickyColumns | undefined
): Record<string, Record<string, string | number>> {
  if (!stickyColumns) return {};
  const byField = new Map(columns.map((column) => [column.field, column]));
  const styles: Record<string, Record<string, string | number>> = {};

  const apply = (field: string, edge: 'left' | 'right', offset: number, last: boolean) => {
    const escaped = escapeCssAttribute(field);
    styles[`& .MuiDataGrid-columnHeader[data-field="${escaped}"]`] = {
      position: 'sticky',
      [edge]: offset,
      zIndex: 4,
      backgroundColor: 'var(--DataGrid-containerBackground)',
      ...(last
        ? {
            boxShadow:
              edge === 'left'
                ? '2px 0 0 var(--DataGrid-rowBorderColor)'
                : '-2px 0 0 var(--DataGrid-rowBorderColor)',
          }
        : {}),
    };
    styles[`& .MuiDataGrid-cell[data-field="${escaped}"]`] = {
      position: 'sticky',
      [edge]: offset,
      zIndex: 3,
      backgroundColor: 'inherit',
      ...(last
        ? {
            boxShadow:
              edge === 'left'
                ? '2px 0 0 var(--DataGrid-rowBorderColor)'
                : '-2px 0 0 var(--DataGrid-rowBorderColor)',
          }
        : {}),
    };
  };

  let leftOffset = 0;
  (stickyColumns.left ?? []).forEach((field, index, fields) => {
    const column = byField.get(field);
    if (!column) return;
    apply(field, 'left', leftOffset, index === fields.length - 1);
    leftOffset += column.width ?? column.minWidth ?? 100;
  });

  let rightOffset = 0;
  [...(stickyColumns.right ?? [])].reverse().forEach((field, reverseIndex, fields) => {
    const column = byField.get(field);
    if (!column) return;
    apply(field, 'right', rightOffset, reverseIndex === fields.length - 1);
    rightOffset += column.width ?? column.minWidth ?? 100;
  });

  return styles;
}

export function EnterpriseDataGrid<R extends GridValidRowModel = GridValidRowModel>({
  ariaLabel,
  density,
  height,
  minVisibleRows = 1,
  maxVisibleRows = 8,
  stickyColumns,
  pageSizeOptions = [25, 50, 100],
  disableRowSelectionOnClick = true,
  rows = [],
  rowHeight,
  columnHeaderHeight,
  hideFooter = false,
  loading = false,
  localeText,
  mode = 'client',
  toolbar = false,
  pagination,
  paginationMode,
  sortingMode,
  filterMode,
  keepNonExistentRowsSelected,
  rowCount,
  rowSelectionModel,
  showToolbar,
  slots,
  slotProps,
  columns,
  sx,
  disableVirtualization,
  ...props
}: EnterpriseDataGridProps<R>) {
  const appearance = useAppearance();
  const gridRootRef = useRef<HTMLDivElement>(null);
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
  const processingModes = resolveGridProcessingModes(mode, {
    paginationMode,
    sortingMode,
    filterMode,
  });
  const totalRowCount = rowCount ?? rows.length;
  const selectedCount = countSelectedRows(rowSelectionModel, totalRowCount);
  const stickyColumnStyles = useMemo(
    () => resolveStickyColumnStyles(columns, stickyColumns),
    [columns, stickyColumns]
  );
  const hasStickyColumns = Boolean(stickyColumns?.left?.length || stickyColumns?.right?.length);
  const toolbarEnabled = toolbar !== false;
  const resolvedSlotProps = {
    ...slotProps,
    baseCheckbox: {
      ...slotProps?.baseCheckbox,
      material: {
        ...slotProps?.baseCheckbox?.material,
        slots: {
          ...slotProps?.baseCheckbox?.material?.slots,
          input: AccessibleCheckboxInput,
        },
      },
    },
    ...(toolbarEnabled
      ? {
          toolbar: {
            ...slotProps?.toolbar,
            config: toolbar,
            mode,
            selectedCount,
          },
        }
      : {}),
  };

  useLayoutEffect(() => {
    const scroller = gridRootRef.current?.querySelector<HTMLElement>(
      '.MuiDataGrid-virtualScroller'
    );
    if (!scroller) return;
    scroller.removeAttribute('tabindex');
    if (!scroller.querySelector('[tabindex="0"]')) {
      const firstCell = scroller.querySelector<HTMLElement>('[role="gridcell"]');
      if (firstCell) firstCell.tabIndex = 0;
    }
  });

  return (
    <Box ref={gridRootRef} sx={{ width: 1, minWidth: 0, height: resolvedHeight }}>
      <DataGrid
        {...props}
        columns={columns}
        aria-label={ariaLabel}
        rows={rows}
        rowHeight={resolvedRowHeight}
        columnHeaderHeight={resolvedColumnHeaderHeight}
        hideFooter={hideFooter}
        loading={loading}
        localeText={resolvedLocaleText}
        density="standard"
        pagination={mode === 'server' ? true : pagination}
        paginationMode={processingModes.paginationMode}
        sortingMode={processingModes.sortingMode}
        filterMode={processingModes.filterMode}
        keepNonExistentRowsSelected={mode === 'server' ? true : keepNonExistentRowsSelected}
        rowCount={rowCount}
        rowSelectionModel={rowSelectionModel}
        showToolbar={toolbarEnabled || showToolbar}
        slots={toolbarEnabled ? { ...slots, toolbar: EnterpriseGridToolbar } : slots}
        slotProps={resolvedSlotProps}
        pageSizeOptions={pageSizeOptions}
        disableRowSelectionOnClick={disableRowSelectionOnClick}
        disableVirtualization={hasStickyColumns || disableVirtualization}
        sx={[stickyColumnStyles, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      />
    </Box>
  );
}
