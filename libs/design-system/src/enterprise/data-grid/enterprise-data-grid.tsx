import { useAppearance } from '../../appearance';

import Box from '@mui/material/Box';
import { DataGrid } from '@mui/x-data-grid';

import type { DataGridProps, GridValidRowModel } from '@mui/x-data-grid';

export type EnterpriseDataGridProps<R extends GridValidRowModel = GridValidRowModel> = Omit<
  DataGridProps<R>,
  'aria-label' | 'density'
> & {
  ariaLabel: string;
  density?: DataGridProps<R>['density'];
  height?: number | string;
};

export function EnterpriseDataGrid<R extends GridValidRowModel = GridValidRowModel>({
  ariaLabel,
  density,
  height = 420,
  pageSizeOptions = [25, 50, 100],
  disableRowSelectionOnClick = true,
  ...props
}: EnterpriseDataGridProps<R>) {
  const appearance = useAppearance();

  return (
    <Box sx={{ width: 1, minWidth: 0, height }}>
      <DataGrid
        {...props}
        aria-label={ariaLabel}
        density={density ?? appearance.preference.density}
        pageSizeOptions={pageSizeOptions}
        disableRowSelectionOnClick={disableRowSelectionOnClick}
      />
    </Box>
  );
}
