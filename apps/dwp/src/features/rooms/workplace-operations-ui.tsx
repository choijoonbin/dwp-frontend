import { useTranslation } from 'react-i18next';
import { LoadingState } from '@dwp-frontend/design-system';
import TablePagination from '@mui/material/TablePagination';
const PAGE_SIZES = [10, 25, 50];

export function ResultSkeleton() {
  const { t } = useTranslation('rooms');
  return (
    <LoadingState
      embedded
      variant="skeleton"
      skeletonRows={5}
      skeletonHeight={64}
      label={t('workplace.experience.refreshing')}
    />
  );
}

export function OperationsPagination({
  count,
  page,
  size,
  onPage,
  onSize,
}: {
  count: number;
  page: number;
  size: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const { t } = useTranslation('rooms');
  return (
    <TablePagination
      component="div"
      count={count}
      page={page}
      rowsPerPage={size}
      rowsPerPageOptions={PAGE_SIZES}
      labelRowsPerPage={t('workplace.admin.operations.pagination.rowsPerPage')}
      labelDisplayedRows={({ from, to, count: total }) =>
        t('workplace.admin.operations.pagination.displayed', { from, to, count: total })
      }
      onPageChange={(_event, nextPage) => onPage(nextPage)}
      onRowsPerPageChange={(event) => onSize(Number(event.target.value))}
      sx={{
        overflow: 'hidden',
        '.MuiTablePagination-toolbar': { flexWrap: 'wrap' },
        '.MuiTablePagination-spacer': { display: { xs: 'none', sm: 'block' } },
        '.MuiTablePagination-selectLabel': { ml: { xs: 0, sm: 2 } },
      }}
    />
  );
}
