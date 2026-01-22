// ----------------------------------------------------------------------

import type { PageResponse , AuditLogSummary } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';
import { Iconify, EmptyState } from '@dwp-frontend/design-system';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import { useMediaQuery } from '@mui/material';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';

// ----------------------------------------------------------------------

type AuditLogsTableProps = {
  data: PageResponse<AuditLogSummary> | undefined;
  isLoading: boolean;
  error: Error | null;
  page: number;
  rowsPerPage: number;
  onPageChange: (newPage: number) => void;
  onRowsPerPageChange: (newRowsPerPage: number) => void;
  onRowClick: (log: AuditLogSummary) => void;
};

export const AuditLogsTable = memo(({
  data,
  isLoading,
  error,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  onRowClick,
}: AuditLogsTableProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  if (error) {
    return (
      <Card sx={{ p: 2 }}>
        <ApiErrorAlert error={error} />
      </Card>
    );
  }

  if (isMobile) {
    return (
      <Stack spacing={1.5}>
        {isLoading &&
          Array.from({ length: Math.min(rowsPerPage, 6) }).map((_, idx) => (
            <Card key={`mobile-loading-${idx}`} sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Skeleton variant="text" width="50%" />
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="rectangular" height={32} />
              </Stack>
            </Card>
          ))}
        {!isLoading && (!data || data.items.length === 0) && (
          <Card sx={{ p: 3 }}>
            <EmptyState
              icon="solar:document-text-outline"
              title="감사 로그가 없습니다"
              description="검색 조건을 변경하거나 기간을 확대해보세요."
            />
          </Card>
        )}
        {!isLoading &&
          data?.items.map((log) => (
            <Card
              key={log.id}
              sx={{ p: 2, border: 1, borderColor: 'divider', cursor: 'pointer' }}
              onClick={() => onRowClick(log)}
            >
              <Stack spacing={1}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {new Date(log.occurredAt).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
                <Typography variant="subtitle2" noWrap>
                  {log.action} · {log.resourceType}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                  {log.actor}
                </Typography>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                    {log.resourceId || '-'}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRowClick(log);
                    }}
                  >
                    <Iconify icon="solar:eye-bold" />
                  </IconButton>
                </Stack>
              </Stack>
            </Card>
          ))}

        {data && (
          <TablePagination
            component="div"
            count={data.total}
            page={page}
            onPageChange={(_e, newPage) => onPageChange(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
            rowsPerPageOptions={[10, 20, 50, 100]}
            labelRowsPerPage="페이지당 행 수:"
          />
        )}
      </Stack>
    );
  }

  return (
    <Card>
      <TableContainer sx={{ maxHeight: { md: 640 }, overflowX: 'auto' }}>
        <Table stickyHeader sx={{ minWidth: 860, tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ height: 56 }}>
              <TableCell sx={{ minWidth: 180 }}>발생일시</TableCell>
              <TableCell sx={{ minWidth: 180 }}>실행자</TableCell>
              <TableCell sx={{ width: 140 }}>액션</TableCell>
              <TableCell sx={{ width: 140 }}>리소스 타입</TableCell>
              <TableCell sx={{ minWidth: 200 }}>리소스 ID</TableCell>
              <TableCell align="right" sx={{ width: 72 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: rowsPerPage }).map((_, idx) => (
                <TableRow key={idx} sx={{ height: 48 }}>
                  {Array.from({ length: 6 }).map((_unused, cellIdx) => (
                    <TableCell key={cellIdx}>
                      <Skeleton variant="text" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !data || data.items.length === 0 ? (
              <TableRow sx={{ height: 200 }}>
                <TableCell colSpan={6} align="center">
                  <EmptyState
                    icon="solar:document-text-outline"
                    title="감사 로그가 없습니다"
                    description="검색 조건을 변경하거나 기간을 확대해보세요."
                  />
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((log) => (
                <TableRow key={log.id} hover sx={{ height: 48, cursor: 'pointer' }} onClick={() => onRowClick(log)}>
                  <TableCell>
                    {new Date(log.occurredAt).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={log.actor} placement="top-start">
                      <Typography variant="body2" noWrap>
                        {log.actor}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.resourceType}</TableCell>
                  <TableCell>
                    <Tooltip title={log.resourceId || '-'} placement="top-start">
                      <Typography variant="body2" noWrap>
                        {log.resourceId || '-'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRowClick(log);
                      }}
                    >
                      <Iconify icon="solar:eye-bold" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {data && (
        <TablePagination
          component="div"
          count={data.total}
          page={page}
          onPageChange={(_e, newPage) => onPageChange(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="페이지당 행 수:"
        />
      )}
    </Card>
  );
});

AuditLogsTable.displayName = 'AuditLogsTable';
