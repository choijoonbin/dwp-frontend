// ----------------------------------------------------------------------

import { memo, useState, useEffect } from 'react';
import { getAdminUserRoles, getAdminUserDetail } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';

import type { UserRowModel } from '../types';

// ----------------------------------------------------------------------

type UserDetailDrawerProps = {
  open: boolean;
  userId: string | null;
  /** 목록에서 클릭한 행 데이터. API 로딩 중/실패 시 표시 */
  selectedUserRow?: UserRowModel | null;
  onClose: () => void;
};

/**
 * Drawer 열릴 때 useEffect로 GET /api/admin/users/:userId, GET /api/admin/users/:userId/roles 직접 호출.
 * - useQuery/useAuth 미의존, PermissionGate 없음 → 권한으로 API 호출이 막히지 않음.
 * - 401/403 시 axiosInstance 전역 핸들러가 리다이렉트(/sign-in 또는 /403) 처리.
 */
export const UserDetailDrawer = memo(({ open, userId, selectedUserRow, onClose }: UserDetailDrawerProps) => {
  const [userDetail, setUserDetail] = useState<Awaited<ReturnType<typeof getAdminUserDetail>>['data'] | null>(null);
  const [userRoles, setUserRoles] = useState<Awaited<ReturnType<typeof getAdminUserRoles>>['data'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!open || !userId) {
      setUserDetail(null);
      setUserRoles(null);
      setError(null);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setError(null);
    setUserDetail(null);
    setUserRoles(null);
    setIsLoading(true);
    const detailPromise = getAdminUserDetail(userId);
    const rolesPromise = getAdminUserRoles(userId);
    Promise.all([detailPromise, rolesPromise])
      .then(([detailRes, rolesRes]) => {
        if (cancelled) return;
        // ApiResponse<T>: { data, message, status, ... }. 백엔드가 data 직접 반환하는 경우도 처리
        const detailData =
          detailRes && typeof detailRes === 'object' && 'data' in detailRes
            ? (detailRes as { data?: unknown }).data
            : detailRes;
        if (detailData && typeof detailData === 'object') {
          setUserDetail(detailData as Awaited<ReturnType<typeof getAdminUserDetail>>['data']);
        } else {
          const msg =
            detailRes && typeof detailRes === 'object' && 'message' in detailRes
              ? String((detailRes as { message?: string }).message)
              : 'Failed to fetch user detail';
          setError(new Error(msg));
        }
        const rolesData =
          rolesRes && typeof rolesRes === 'object' && 'data' in rolesRes
            ? (rolesRes as { data?: unknown }).data
            : Array.isArray(rolesRes)
              ? rolesRes
              : null;
        if (Array.isArray(rolesData)) setUserRoles(rolesData as Awaited<ReturnType<typeof getAdminUserRoles>>['data']);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const fallback = selectedUserRow && userId && selectedUserRow.id === userId ? selectedUserRow : null;

  return (
    <Drawer
      key={userId ?? 'closed'}
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 400 },
          bgcolor: 'background.paper',
        },
      }}
    >
      <Box sx={{ p: 3, color: 'text.primary' }}>
        <Typography variant="h6" sx={{ mb: 3 }} color="inherit">
          사용자 상세
        </Typography>

        {/* 열릴 때마다 목록 데이터가 있으면 맨 위에 표시 (API 로딩/실패와 무관하게 내용 보임) */}
        {open && userId && fallback && (
          <Box sx={{ mb: 2, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }} color="text.secondary">
              기본 정보 (목록)
            </Typography>
            <Typography variant="body1" color="inherit" fontWeight={600}>{fallback.userName}</Typography>
            <Typography variant="body2" color="text.secondary">{fallback.email || '-'}</Typography>
            <Typography variant="body2" color="text.secondary">{fallback.departmentName || '-'}</Typography>
            <Box sx={{ mt: 1 }}>
              <Chip label={fallback.statusLabel} size="small" color={fallback.statusColor as 'success' | 'default'} />
            </Box>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            데이터를 불러오는 중 오류가 발생했습니다: {error instanceof Error ? error.message : 'Unknown error'}
          </Alert>
        )}

        {isLoading && (
          <Stack spacing={2}>
            <Typography variant="caption" color="text.secondary">상세 불러오는 중...</Typography>
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} variant="rectangular" height={48} />
            ))}
          </Stack>
        )}

        {!isLoading && userDetail && (
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }} color="text.secondary">
                기본 정보
              </Typography>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>사용자명</Typography>
                  <Typography variant="body1" color="inherit">{userDetail.userName}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>이메일</Typography>
                  <Typography variant="body1" color="inherit">{userDetail.email || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>부서</Typography>
                  <Typography variant="body1" color="inherit">{userDetail.departmentName || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>상태</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={userDetail.status === 'ACTIVE' ? '활성' : '비활성'}
                      color={userDetail.status === 'ACTIVE' ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                </Box>
              </Stack>
            </Box>

            <Divider />

            {userDetail.accounts && userDetail.accounts.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }} color="text.secondary">
                  계정 정보
                </Typography>
                <List dense>
                  {userDetail.accounts.map((account) => (
                    <ListItem key={account.id}>
                      <ListItemText
                        primary={account.accountType}
                        primaryTypographyProps={{ color: 'inherit' }}
                        secondary={
                          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                            {account.principal && (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                아이디: {account.principal}
                              </Typography>
                            )}
                            {account.lastLoginAt && (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                최근 로그인: {new Date(account.lastLoginAt).toLocaleString('ko-KR')}
                              </Typography>
                            )}
                          </Stack>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }} color="text.secondary">
                할당된 역할
              </Typography>
              {userRoles && userRoles.length > 0 ? (
                <List dense>
                  {userRoles.map((role) => (
                    <ListItem key={role.id}>
                      <ListItemText
                        primary={role.roleName}
                        secondary={role.roleCode}
                        primaryTypographyProps={{ color: 'inherit' }}
                        secondaryTypographyProps={{ color: 'text.secondary' }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  할당된 역할이 없습니다.
                </Typography>
              )}
            </Box>

            <Divider />

            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>생성일</Typography>
              <Typography variant="body2" color="inherit">{new Date(userDetail.createdAt).toLocaleString('ko-KR')}</Typography>
            </Box>
          </Stack>
        )}

        {!isLoading && !userDetail && fallback && (
          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary">목록 데이터</Typography>
            <Typography variant="body1" color="inherit">{fallback.userName}</Typography>
            <Typography variant="body2" color="text.secondary">{fallback.email || '-'}</Typography>
            <Typography variant="body2" color="text.secondary">{fallback.departmentName || '-'}</Typography>
            <Box>
              <Chip label={fallback.statusLabel} size="small" color={fallback.statusColor as 'success' | 'default'} />
            </Box>
          </Stack>
        )}

        {!isLoading && !userDetail && !fallback && open && userId && (
          <Typography variant="body2" color="text.secondary">사용자 정보를 불러올 수 없습니다.</Typography>
        )}
      </Box>
    </Drawer>
  );
});

UserDetailDrawer.displayName = 'UserDetailDrawer';
