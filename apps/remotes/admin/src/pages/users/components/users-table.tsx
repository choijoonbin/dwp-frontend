// ----------------------------------------------------------------------

import { memo } from 'react';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import { useMediaQuery } from '@mui/material';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';

import type { UserRowModel } from '../types';

// ----------------------------------------------------------------------

type UsersTableProps = {
  users: UserRowModel[];
  page: number;
  rowsPerPage: number;
  total: number;
  isLoading: boolean;
  error: Error | null;
  selectedUserId: string | null;
  anchorEl: HTMLElement | null;
  onPageChange: (event: unknown, newPage: number) => void;
  onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, user: UserRowModel) => void;
  onMenuClose: () => void;
  onEdit: (user: UserRowModel) => void;
  onDelete: (user: UserRowModel) => void;
  onRoles: (user: UserRowModel) => void;
  onResetPassword: (user: UserRowModel) => void;
  onRowClick: (user: UserRowModel) => void;
  onRetry?: () => void;
};

export const UsersTable = memo(({
  users,
  page,
  rowsPerPage,
  total,
  isLoading,
  error,
  selectedUserId,
  anchorEl,
  onPageChange,
  onRowsPerPageChange,
  onMenuOpen,
  onMenuClose,
  onEdit,
  onDelete,
  onRoles,
  onResetPassword,
  onRowClick,
  onRetry,
}: UsersTableProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const selectedUser = users.find((u) => u.id === selectedUserId);

  if (error) {
    return (
      <Card sx={{ p: 2 }}>
        <ApiErrorAlert error={error} onRetry={onRetry} />
      </Card>
    );
  }

  if (isMobile) {
    return (
      <Stack spacing={1.5}>
        {isLoading &&
          Array.from({ length: Math.min(rowsPerPage, 6) }).map((_unused, idx) => (
            <Card key={`mobile-loading-${idx}`} sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="text" width="70%" />
                <Skeleton variant="rectangular" height={32} />
              </Stack>
            </Card>
          ))}
        {!isLoading && users.length === 0 && (
          <Card sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              데이터가 없습니다.
            </Typography>
          </Card>
        )}
        {!isLoading &&
          users.map((user) => (
            <Card
              key={user.id}
              sx={{
                p: 2,
                border: 1,
                borderColor: 'divider',
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main' },
              }}
              onClick={() => onRowClick(user)}
            >
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="subtitle2" noWrap>
                      {user.userName}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                      {user.email || '-'}
                    </Typography>
                  </Box>
                  <Chip label={user.statusLabel} color={user.statusColor} size="small" />
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={user.departmentName || '부서 없음'} size="small" variant="outlined" />
                  <Chip label={user.loginType || '-'} size="small" variant="outlined" />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    최근 로그인: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ko-KR') : '-'}
                  </Typography>
                  <IconButton size="small" onClick={(e) => onMenuOpen(e, user)}>
                    <Iconify icon="solar:menu-dots-bold" />
                  </IconButton>
                </Stack>
              </Stack>
            </Card>
          ))}

        {total > 0 && (
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={onPageChange}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={onRowsPerPageChange}
            rowsPerPageOptions={[10, 30, 50]}
            labelRowsPerPage="페이지당 행 수:"
          />
        )}

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={onMenuClose}
          container={() => document.getElementById('root') as HTMLElement}
        >
          <PermissionGate resource="menu.admin.users" permission="UPDATE">
            <MenuItem onClick={() => selectedUser && onEdit(selectedUser)}>
              <Iconify icon="solar:pen-bold" width={16} sx={{ mr: 1 }} />
              편집
            </MenuItem>
          </PermissionGate>
          <PermissionGate resource="menu.admin.users" permission="MANAGE">
            <MenuItem onClick={() => selectedUser && onRoles(selectedUser)}>
              <Iconify icon="solar:users-group-rounded-bold" width={16} sx={{ mr: 1 }} />
              역할 관리
            </MenuItem>
            <MenuItem onClick={() => selectedUser && onResetPassword(selectedUser)}>
              <Iconify icon="solar:lock-password-bold" width={16} sx={{ mr: 1 }} />
              비밀번호 초기화
            </MenuItem>
          </PermissionGate>
          <PermissionGate resource="menu.admin.users" permission="DELETE">
            <MenuItem onClick={() => selectedUser && onDelete(selectedUser)} sx={{ color: 'error.main' }}>
              <Iconify icon="solar:trash-bin-trash-bold" width={16} sx={{ mr: 1 }} />
              삭제
            </MenuItem>
          </PermissionGate>
        </Menu>
      </Stack>
    );
  }

  return (
    <Card>
      <TableContainer sx={{ maxHeight: { md: 640 }, overflowX: 'auto' }}>
        <Table stickyHeader sx={{ minWidth: 980, tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ height: 56 }}>
              <TableCell sx={{ minWidth: 160 }}>사용자명</TableCell>
              <TableCell sx={{ minWidth: 220 }}>이메일</TableCell>
              <TableCell sx={{ minWidth: 160 }}>부서</TableCell>
              <TableCell sx={{ width: 120 }}>상태</TableCell>
              <TableCell sx={{ width: 140 }}>로그인 유형</TableCell>
              <TableCell sx={{ width: 140 }}>최근 로그인</TableCell>
              <TableCell sx={{ width: 140 }}>생성일</TableCell>
              <TableCell align="right" sx={{ width: 72 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading &&
              Array.from({ length: rowsPerPage }).map((_, idx) => (
                <TableRow key={`loading-${idx}`} sx={{ height: 48 }}>
                  {Array.from({ length: 8 }).map((_unused, cellIdx) => (
                    <TableCell key={cellIdx}>
                      <Skeleton variant="text" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading && users.length === 0 && (
              <TableRow key="empty" sx={{ height: 120 }}>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    데이터가 없습니다.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              users.length > 0 &&
              users.map((user, index) => (
                <TableRow
                  key={`${user.id}-${index}`}
                  hover
                  sx={{ height: 48, cursor: 'pointer' }}
                  onClick={() => onRowClick(user)}
                >
                  <TableCell>
                    <Tooltip title={user.userName} placement="top-start">
                      <Typography variant="body2" noWrap>
                        {user.userName}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={user.email || '-'} placement="top-start">
                      <Typography variant="body2" noWrap>
                        {user.email || '-'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={user.departmentName || '-'} placement="top-start">
                      <Typography variant="body2" noWrap>
                        {user.departmentName || '-'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip label={user.statusLabel} color={user.statusColor} size="small" />
                  </TableCell>
                  <TableCell>{user.loginType || '-'}</TableCell>
                  <TableCell>
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ko-KR') : '-'}
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString('ko-KR')}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMenuOpen(e, user);
                      }}
                    >
                      <Iconify icon="solar:menu-dots-bold" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      {total > 0 && (
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={onPageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={onRowsPerPageChange}
          rowsPerPageOptions={[10, 30, 50]}
          labelRowsPerPage="페이지당 행 수:"
        />
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={onMenuClose}
        container={() => document.getElementById('root') as HTMLElement}
      >
        <PermissionGate resource="menu.admin.users" permission="UPDATE">
          <MenuItem onClick={() => selectedUser && onEdit(selectedUser)}>
            <Iconify icon="solar:pen-bold" width={16} sx={{ mr: 1 }} />
            편집
          </MenuItem>
        </PermissionGate>
        <PermissionGate resource="menu.admin.users" permission="MANAGE">
          <MenuItem onClick={() => selectedUser && onRoles(selectedUser)}>
            <Iconify icon="solar:users-group-rounded-bold" width={16} sx={{ mr: 1 }} />
            역할 관리
          </MenuItem>
          <MenuItem onClick={() => selectedUser && onResetPassword(selectedUser)}>
            <Iconify icon="solar:lock-password-bold" width={16} sx={{ mr: 1 }} />
            비밀번호 초기화
          </MenuItem>
        </PermissionGate>
        <PermissionGate resource="menu.admin.users" permission="DELETE">
          <MenuItem onClick={() => selectedUser && onDelete(selectedUser)} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:trash-bin-trash-bold" width={16} sx={{ mr: 1 }} />
            삭제
          </MenuItem>
        </PermissionGate>
      </Menu>
    </Card>
  );
});

UsersTable.displayName = 'UsersTable';
