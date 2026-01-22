// ----------------------------------------------------------------------

import { memo, useState, useEffect, useCallback } from 'react';
import { useAdminRoleDetailQuery, useUpdateAdminRoleMutation } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type RoleOverviewTabProps = {
  roleId: string;
  onSuccess: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveRequest?: (handler: () => Promise<void>) => void;
};

export const RoleOverviewTab = memo(({ roleId, onSuccess, onDirtyChange, onSaveRequest }: RoleOverviewTabProps) => {
  const { data: roleDetail, isLoading, error } = useAdminRoleDetailQuery(roleId);
  const updateMutation = useUpdateAdminRoleMutation();

  const [formData, setFormData] = useState({
    roleName: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const [originalData, setOriginalData] = useState({
    roleName: '',
    description: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  // Initialize form from role detail
  useEffect(() => {
    if (roleDetail) {
      const initialData = {
        roleName: roleDetail.roleName || '',
        description: roleDetail.description || '',
        status: roleDetail.status || 'ACTIVE',
      };
      setFormData(initialData);
      setOriginalData(initialData);
      onDirtyChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleDetail?.id]); // Only re-initialize when role changes

  // Check if form has changes compared to original
  useEffect(() => {
    const hasChanges =
      formData.roleName !== originalData.roleName ||
      formData.description !== originalData.description ||
      formData.status !== originalData.status;
    onDirtyChange?.(hasChanges);
  }, [formData, originalData, onDirtyChange]);

  const handleFieldChange = (field: keyof typeof formData, value: string | 'ACTIVE' | 'INACTIVE') => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!roleDetail) return;

    try {
      await updateMutation.mutateAsync({
        roleId: roleDetail.id,
        payload: {
          roleName: formData.roleName,
          description: formData.description || undefined,
          status: formData.status,
        },
      });
      onDirtyChange?.(false);
      onSuccess();
    } catch {
      // Error handled by mutation
    }
  }, [roleDetail, formData, updateMutation, onDirtyChange, onSuccess]);

  // Register save handler
  useEffect(() => {
    onSaveRequest?.(handleSave);
  }, [handleSave, onSaveRequest]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '날짜 없음';
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return <Skeleton variant="rectangular" height={200} />;
  }

  if (error) {
    return <Alert severity="error">권한 정보를 불러올 수 없습니다.</Alert>;
  }

  if (!roleDetail) {
    return <Alert severity="warning">권한 정보가 없습니다.</Alert>;
  }

  // Note: hasChanges is tracked via onDirtyChange callback

  return (
    <Stack spacing={3}>
      {/* Basic Information Card */}
      <Card sx={{ border: 1, borderColor: 'divider' }}>
        <Box sx={{ p: 3 }}>
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              기본 정보
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              권한의 기본 정보를 수정합니다
            </Typography>
          </Stack>

          <Stack spacing={3}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="권한명"
                fullWidth
                value={formData.roleName}
                onChange={(e) => handleFieldChange('roleName', e.target.value)}
                size="small"
                placeholder="권한 이름을 입력하세요"
              />

              <TextField
                label="권한 코드"
                fullWidth
                value={roleDetail.roleCode}
                disabled
                size="small"
                sx={{ fontFamily: 'monospace' }}
                helperText="권한 코드는 생성 후 변경할 수 없습니다"
              />
            </Stack>

            <TextField
              label="설명 (선택)"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              size="small"
              placeholder="권한에 대한 설명을 입력하세요"
            />

            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack spacing={0.5}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    활성 상태
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    비활성화 시 이 권한을 가진 사용자의 권한이 적용되지 않습니다
                  </Typography>
                </Stack>
                <Switch
                  checked={formData.status === 'ACTIVE'}
                  onChange={(e) => handleFieldChange('status', e.target.checked ? 'ACTIVE' : 'INACTIVE')}
                />
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Card>

      {/* History Information Card */}
      <Card sx={{ border: 1, borderColor: 'divider' }}>
        <Box sx={{ p: 3 }}>
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              이력 정보
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              권한의 생성 및 수정 이력입니다
            </Typography>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
            <Stack sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, fontWeight: 500 }}>
                생성일
              </Typography>
              <Typography variant="body2">{formatDate(roleDetail.createdAt)}</Typography>
            </Stack>

            {roleDetail.updatedAt && (
              <Stack sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, fontWeight: 500 }}>
                  최근 수정일
                </Typography>
                <Typography variant="body2">{formatDate(roleDetail.updatedAt)}</Typography>
              </Stack>
            )}
          </Stack>
        </Box>
      </Card>

      {/* Statistics Card */}
      <Card sx={{ border: 1, borderColor: 'divider' }}>
        <Box sx={{ p: 3 }}>
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              통계
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              이 역할에 할당된 멤버 현황입니다
            </Typography>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box sx={{ flex: 1, p: 2, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {roleDetail.userCount ?? 0}
                <Typography component="span" variant="body2" sx={{ fontWeight: 'normal', ml: 0.5, color: 'text.secondary' }}>
                  명
                </Typography>
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                할당된 사용자
              </Typography>
            </Box>
            <Box sx={{ flex: 1, p: 2, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {roleDetail.departmentCount ?? 0}
                <Typography component="span" variant="body2" sx={{ fontWeight: 'normal', ml: 0.5, color: 'text.secondary' }}>
                  개
                </Typography>
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                할당된 부서
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Card>
    </Stack>
  );
});

RoleOverviewTab.displayName = 'RoleOverviewTab';
