// ----------------------------------------------------------------------

import type { IngestRunSummary } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';
import { Iconify, EmptyState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';

// ----------------------------------------------------------------------

type StatusBadgeProps = {
  status: IngestRunSummary['status'];
};

const StatusBadge = memo(({ status }: StatusBadgeProps) => {
  const { t } = useTranslation('admin');
  const config: Record<string, { color: 'info' | 'success' | 'error' | 'warning'; icon: string; labelKey: string }> = {
    RUNNING: { color: 'info', icon: 'solar:refresh-bold', labelKey: 'ingest.table.statusRunning' },
    SUCCESS: { color: 'success', icon: 'solar:check-circle-bold', labelKey: 'ingest.table.statusSuccess' },
    COMPLETED: { color: 'success', icon: 'solar:check-circle-bold', labelKey: 'ingest.table.statusSuccess' },
    FAILED: { color: 'error', icon: 'solar:close-circle-bold', labelKey: 'ingest.table.statusFailed' },
    SKIPPED: { color: 'warning', icon: 'solar:danger-triangle-bold', labelKey: 'ingest.table.statusSkipped' },
  };
  const c = config[status] ?? config.SUCCESS;
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {status === 'RUNNING' && <CircularProgress size={14} />}
      <Iconify icon={c.icon} width={16} sx={{ color: `${c.color}.main` }} />
      <Typography variant="caption" sx={{ color: `${c.color}.main`, fontWeight: 600 }}>
        {t(c.labelKey)}
      </Typography>
    </Stack>
  );
});

type IngestRunsTableProps = {
  items: IngestRunSummary[];
  isLoading: boolean;
  error: Error | null;
  page: number;
  rowsPerPage: number;
  totalCount: number;
  onPageChange: (newPage: number) => void;
  onRowsPerPageChange: (newRowsPerPage: number) => void;
  onRowClick: (run: IngestRunSummary) => void;
};

export const IngestRunsTable = memo(({
  items,
  isLoading,
  error,
  page,
  rowsPerPage,
  totalCount,
  onPageChange,
  onRowsPerPageChange,
  onRowClick,
}: IngestRunsTableProps) => {
  const { t } = useTranslation('admin');
  if (error) {
    return (
      <Card sx={{ p: 2 }}>
        <ApiErrorAlert error={error} />
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('ingest.table.started')}</TableCell>
              <TableCell>{t('ingest.table.status')}</TableCell>
              <TableCell>{t('ingest.table.window')}</TableCell>
              <TableCell align="right">{t('ingest.table.duration')}</TableCell>
              <TableCell align="right">{t('ingest.table.ingested')}</TableCell>
              <TableCell align="right">{t('ingest.table.failed')}</TableCell>
              <TableCell>{t('ingest.table.runId')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading &&
              Array.from({ length: Math.min(rowsPerPage, 5) }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  <TableCell colSpan={7}>
                    <Skeleton variant="text" width="100%" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} sx={{ py: 6 }}>
                  <EmptyState
                    icon="solar:history-bold-duotone"
                    title={t('ingest.table.emptyTitle')}
                    description={t('ingest.table.emptyDesc')}
                  />
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              items.map((run) => (
                <TableRow
                  key={String(run.runId)}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => onRowClick(run)}
                >
                  <TableCell>
                    <Typography variant="body2">
                      {run.startedAt
                        ? new Date(run.startedAt).toLocaleString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                          })
                        : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {(run.status === 'SKIPPED' && run.message) || run.status === 'FAILED' ? (
                      <Tooltip title={run.message ?? t('ingest.table.statusFailed')} arrow placement="top">
                        <Box component="span" sx={{ display: 'inline-flex' }}>
                          <StatusBadge status={run.status} />
                        </Box>
                      </Tooltip>
                    ) : (
                      <StatusBadge status={run.status} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {run.windowFrom && run.windowTo
                        ? `${new Date(run.windowFrom).toLocaleDateString()} ~ ${new Date(run.windowTo).toLocaleDateString()}`
                        : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {run.durationMs != null ? `${run.durationMs}ms` : '-'}
                  </TableCell>
                  <TableCell align="right">{run.ingestedCount ?? '-'}</TableCell>
                  <TableCell align="right">{run.failedCount ?? '-'}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {String(run.runId)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      {totalCount > 0 && (
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_, p) => onPageChange(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => onRowsPerPageChange(Number(e.target.value))}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage={t('ingest.table.rowsPerPage')}
        />
      )}
    </Card>
  );
});
