// ----------------------------------------------------------------------

import { memo } from 'react';
import { useAdminUserRolesQuery, useAdminUserDetailQuery } from '@dwp-frontend/shared-utils';

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


// ----------------------------------------------------------------------

type UserDetailDrawerProps = {
  open: boolean;
  userId: string | null;
  onClose: () => void;
};

export const UserDetailDrawer = memo(({ open, userId, onClose }: UserDetailDrawerProps) => {
  const { data: userDetail, isLoading, error } = useAdminUserDetailQuery(userId || '');
  const { data: userRoles } = useAdminUserRolesQuery(userId || '');

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 400 } } }}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 3 }}>
          사용자 상세
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            데이터를 불러오는 중 오류가 발생했습니다: {error instanceof Error ? error.message : 'Unknown error'}
          </Alert>
        )}

        {isLoading ? (
          <Stack spacing={2}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} variant="rectangular" height={60} />
            ))}
          </Stack>
        ) : userDetail ? (
          <Stack spacing={3}>
            {/* 기본 정보 */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                기본 정보
              </Typography>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    사용자명
                  </Typography>
                  <Typography variant="body1">{userDetail.userName}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    이메일
                  </Typography>
                  <Typography variant="body1">{userDetail.email || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    부서
                  </Typography>
                  <Typography variant="body1">{userDetail.departmentName || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    상태
                  </Typography>
                  <Chip
                    label={userDetail.status === 'ACTIVE' ? '활성' : '비활성'}
                    color={userDetail.status === 'ACTIVE' ? 'success' : 'default'}
                    size="small"
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              </Stack>
            </Box>

            <Divider />

            {/* 계정 정보 */}
            {userDetail.accounts && userDetail.accounts.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                  계정 정보
                </Typography>
                <List dense>
                  {userDetail.accounts.map((account) => (
                    <ListItem key={account.id}>
                      <ListItemText
                        primary={account.accountType}
                        secondary={
                          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                            {account.principal && (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Principal: {account.principal}
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

            {/* 역할 목록 */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                할당된 역할
              </Typography>
              {userRoles && userRoles.length > 0 ? (
                <List dense>
                  {userRoles.map((role) => (
                    <ListItem key={role.id}>
                      <ListItemText primary={role.roleName} secondary={role.roleCode} />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  할당된 역할이 없습니다.
                </Typography>
              )}
            </Box>

            <Divider />

            {/* 생성일 */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                생성일
              </Typography>
              <Typography variant="body2">{new Date(userDetail.createdAt).toLocaleString('ko-KR')}</Typography>
            </Box>
          </Stack>
        ) : null}
      </Box>
    </Drawer>
  );
});

UserDetailDrawer.displayName = 'UserDetailDrawer';
