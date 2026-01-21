// ----------------------------------------------------------------------

import { memo } from 'react';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
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
  onUserSelect: (userId: string | null) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, user: UserRowModel) => void;
  onMenuClose: () => void;
  onEdit: (user: UserRowModel) => void;
  onDelete: (user: UserRowModel) => void;
  onRoles: (user: UserRowModel) => void;
  onResetPassword: (user: UserRowModel) => void;
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
  onUserSelect,
  onMenuOpen,
  onMenuClose,
  onEdit,
  onDelete,
  onRoles,
  onResetPassword,
  onRetry,
}: UsersTableProps) => {
  const selectedUser = users.find((u) => u.id === selectedUserId);

  if (error) {
    return (
      <Card sx={{ p: 2 }}>
        <ApiErrorAlert error={error} onRetry={onRetry} />
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>사용자명</TableCell>
            <TableCell>이메일</TableCell>
            <TableCell>부서</TableCell>
            <TableCell>상태</TableCell>
            <TableCell>로그인 유형</TableCell>
            <TableCell>최근 로그인</TableCell>
            <TableCell>생성일</TableCell>
            <TableCell align="right">작업</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading &&
            Array.from({ length: rowsPerPage }).map((_, idx) => (
              <TableRow key={`loading-${idx}`}>
                {Array.from({ length: 8 }).map((_unused, cellIdx) => (
                  <TableCell key={cellIdx}>
                    <Skeleton variant="text" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          {!isLoading && users.length === 0 && (
            <TableRow key="empty">
              <TableCell colSpan={8} align="center">
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 3 }}>
                  데이터가 없습니다.
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            users.length > 0 &&
            users.map((user, index) => (
              <TableRow key={`${user.id}-${index}`} hover>
                <TableCell>{user.userName}</TableCell>
                <TableCell>{user.email || '-'}</TableCell>
                <TableCell>{user.departmentName || '-'}</TableCell>
                <TableCell>
                  <Chip label={user.statusLabel} color={user.statusColor} size="small" />
                </TableCell>
                <TableCell>{user.loginType || '-'}</TableCell>
                <TableCell>
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ko-KR') : '-'}
                </TableCell>
                <TableCell>{new Date(user.createdAt).toLocaleDateString('ko-KR')}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={(e) => onMenuOpen(e, user)}>
                    <Iconify icon="solar:menu-dots-bold" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

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
