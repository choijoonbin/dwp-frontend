// ----------------------------------------------------------------------

import type { DetectRunSummary } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
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
  status: DetectRunSummary['status'];
};

const StatusBadge = memo(({ status }: StatusBadgeProps) => {
  const config: Record<string, { color: 'info' | 'success' | 'error' | 'warning'; icon: string; label: string }> = {
    RUNNING: { color: 'info', icon: 'solar:refresh-bold', label: '실행 중' },
    SUCCESS: { color: 'success', icon: 'solar:check-circle-bold', label: '성공' },
    COMPLETED: { color: 'success', icon: 'solar:check-circle-bold', label: '성공' },
    FAILED: { color: 'error', icon: 'solar:close-circle-bold', label: '실패' },
    SKIPPED: { color: 'warning', icon: 'solar:danger-triangle-bold', label: '건너뜀' },
  };
  const c = config[status] ?? config.SUCCESS;
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {status === 'RUNNING' && <CircularProgress size={14} />}
      <Iconify icon={c.icon} width={16} sx={{ color: `${c.color}.main` }} />
      <Typography variant="caption" sx={{ color: `${c.color}.main`, fontWeight: 600 }}>
        {c.label}
      </Typography>
    </Stack>
  );
});

type BatchRunsTableProps = {
  items: DetectRunSummary[];
  isLoading: boolean;
  error: Error | null;
  page: number;
  rowsPerPage: number;
  totalCount: number;
  onPageChange: (newPage: number) => void;
  onRowsPerPageChange: (newRowsPerPage: number) => void;
  onRowClick: (run: DetectRunSummary) => void;
};

export const BatchRunsTable = memo(({
  items,
  isLoading,
  error,
  page,
  rowsPerPage,
  totalCount,
  onPageChange,
  onRowsPerPageChange,
  onRowClick,
}: BatchRunsTableProps) => {
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
              <TableCell>Started</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Window</TableCell>
              <TableCell align="right">Duration</TableCell>
              <TableCell align="right">Created</TableCell>
              <TableCell align="right">Updated</TableCell>
              <TableCell align="right">Suppressed</TableCell>
              <TableCell>Run ID</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading &&
              Array.from({ length: Math.min(rowsPerPage, 5) }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  <TableCell colSpan={8}>
                    <Skeleton variant="text" width="100%" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} sx={{ py: 6 }}>
                  <EmptyState
                    icon="solar:history-bold-duotone"
                    title="실행 이력이 없습니다"
                    description="수동 실행 또는 배치 스케줄 실행 후 이력이 표시됩니다."
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
                      <Tooltip
                        title={
                          run.status === 'SKIPPED'
                            ? run.message ?? '다른 인스턴스가 실행 중(락 미획득)'
                            : run.status === 'FAILED'
                              ? `${run.message ?? '실패'} — Run 상세에서 View Audit로 원인 확인`
                              : ''
                        }
                        arrow
                        placement="top"
                      >
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
                  <TableCell align="right">{run.createdCount ?? '-'}</TableCell>
                  <TableCell align="right">{run.updatedCount ?? '-'}</TableCell>
                  <TableCell align="right">{run.suppressedCount ?? '-'}</TableCell>
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
          labelRowsPerPage="페이지당:"
        />
      )}
    </Card>
  );
});
