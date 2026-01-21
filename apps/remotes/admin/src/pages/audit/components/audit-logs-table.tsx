// ----------------------------------------------------------------------

import type { PageResponse , AuditLogSummary } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
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
  if (error) {
    return (
      <Card sx={{ p: 2 }}>
        <ApiErrorAlert error={error} />
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>발생일시</TableCell>
            <TableCell>실행자</TableCell>
            <TableCell>액션</TableCell>
            <TableCell>리소스 타입</TableCell>
            <TableCell>리소스 ID</TableCell>
            <TableCell align="right">작업</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            Array.from({ length: rowsPerPage }).map((_, idx) => (
              <TableRow key={idx}>
                {Array.from({ length: 6 }).map((_unused, cellIdx) => (
                  <TableCell key={cellIdx}>
                    <Skeleton variant="text" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : !data || data.items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center">
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 3 }}>
                  데이터가 없습니다.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            data.items.map((log) => (
              <TableRow key={log.id} hover sx={{ cursor: 'pointer' }} onClick={() => onRowClick(log)}>
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
                <TableCell>{log.actor}</TableCell>
                <TableCell>{log.action}</TableCell>
                <TableCell>{log.resourceType}</TableCell>
                <TableCell>{log.resourceId || '-'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={(e) => {
                    e.stopPropagation();
                    onRowClick(log);
                  }}>
                    <Iconify icon="solar:eye-bold" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

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
