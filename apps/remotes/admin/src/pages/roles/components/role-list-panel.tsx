// ----------------------------------------------------------------------

import { memo, useMemo, useState } from 'react';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

import type { RoleRowModel } from '../types';

// ----------------------------------------------------------------------

type RoleListPanelProps = {
  roles: RoleRowModel[];
  selectedRoleId: string | null;
  onRoleSelect: (roleId: string) => void;
  onCreateClick: () => void;
  isLoading: boolean;
  error: Error | null;
};

type RoleFilter = {
  search: string;
  status: 'ALL' | 'ACTIVE' | 'INACTIVE';
  sortBy: 'updatedAt' | 'name' | 'code';
  sortOrder: 'asc' | 'desc';
};

export const RoleListPanel = memo(({ roles, selectedRoleId, onRoleSelect, onCreateClick, isLoading, error }: RoleListPanelProps) => {
  const [filter, setFilter] = useState<RoleFilter>({
    search: '',
    status: 'ALL',
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  const filteredRoles = useMemo(() => roles
      .filter((role) => {
        const searchLower = filter.search.toLowerCase();
        const matchesSearch =
          filter.search === '' ||
          role.roleName.toLowerCase().includes(searchLower) ||
          role.roleCode.toLowerCase().includes(searchLower);

        const matchesStatus = filter.status === 'ALL' || role.status === filter.status;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (filter.sortBy) {
          case 'name':
            comparison = a.roleName.localeCompare(b.roleName, 'ko');
            break;
          case 'code':
            comparison = a.roleCode.localeCompare(b.roleCode);
            break;
          case 'updatedAt':
          default:
            // Note: updatedAt not available in RoleRowModel, using name as fallback
            comparison = a.roleName.localeCompare(b.roleName, 'ko');
            break;
        }
        return filter.sortOrder === 'asc' ? comparison : -comparison;
      }), [roles, filter]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '날짜 없음';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <ApiErrorAlert error={error} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">역할 목록</Typography>
          <PermissionGate resource="menu.admin.roles" permission="CREATE">
            <Button size="small" startIcon={<Iconify icon="mingcute:add-line" />} onClick={onCreateClick}>
              새 역할
            </Button>
          </PermissionGate>
        </Stack>

        {/* Search */}
        <TextField
          size="small"
          fullWidth
          placeholder="역할명 또는 코드 검색..."
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          InputProps={{
            startAdornment: <Iconify icon="solar:magnifer-bold" width={20} sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ mb: 1.5 }}
        />

        {/* Filters */}
        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>상태</InputLabel>
            <Select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value as typeof filter.status })}
              label="상태"
            >
              <MenuItem value="ALL">전체 상태</MenuItem>
              <MenuItem value="ACTIVE">활성</MenuItem>
              <MenuItem value="INACTIVE">비활성</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>정렬</InputLabel>
            <Select
              value={filter.sortBy}
              onChange={(e) => setFilter({ ...filter, sortBy: e.target.value as typeof filter.sortBy })}
              label="정렬"
            >
              <MenuItem value="updatedAt">최근 수정</MenuItem>
              <MenuItem value="name">이름</MenuItem>
              <MenuItem value="code">코드</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Box>

      {/* Role List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <Box sx={{ p: 2 }}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} variant="rectangular" height={96} sx={{ mb: 1, borderRadius: 1 }} />
            ))}
          </Box>
        ) : filteredRoles.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Iconify icon="solar:magnifer-bold" width={48} sx={{ color: 'text.secondary', mb: 2 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              검색 결과가 없습니다
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              다른 검색어나 필터를 시도해보세요
            </Typography>
          </Box>
        ) : (
          <Box sx={{ p: 1 }}>
            {filteredRoles.map((role, idx) => (
              <RoleCard
                key={role.id || `${role.roleCode}-${idx}`}
                role={role}
                selected={selectedRoleId === role.id}
                onSelect={onRoleSelect}
                formatDate={formatDate}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Footer */}
      {!isLoading && filteredRoles.length > 0 && (
        <Box sx={{ borderTop: 1, borderColor: 'divider', px: 2, py: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            총 {filteredRoles.length}개 역할
          </Typography>
        </Box>
      )}
    </Box>
  );
});

RoleListPanel.displayName = 'RoleListPanel';

// Role Card Component
const RoleCard = memo<{
  role: RoleRowModel;
  selected: boolean;
  onSelect: (roleId: string) => void;
  formatDate: (date?: string) => string;
}>(({ role, selected, onSelect, formatDate }) => {
  const handleClick = () => {
    if (role.id) {
      onSelect(role.id);
    }
  };

  return (
    <Card
      component="button"
      type="button"
      onClick={handleClick}
      sx={{
        width: '100%',
        textAlign: 'left',
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 2,
        p: 1.5,
        mb: 1,
        bgcolor: selected ? 'primary.lighter' : 'background.paper',
        transition: 'all 0.2s',
        cursor: 'pointer',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: selected ? 'primary.lighter' : 'action.hover',
        },
        '&:focus': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {role.roleName}
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
          {role.roleCode}
        </Typography>
      </Box>
      <Chip
        label={role.statusLabel}
        color={role.statusColor}
        size="small"
        sx={{ height: 20, fontSize: '0.7rem' }}
      />
    </Stack>

      <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Iconify icon="solar:users-group-rounded-bold" width={14} sx={{ color: 'text.secondary' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {role.memberCount ?? 0}명
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Iconify icon="solar:buildings-bold" width={14} sx={{ color: 'text.secondary' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {role.departmentCount ?? 0}팀
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Iconify icon="solar:clock-circle-bold" width={14} sx={{ color: 'text.secondary' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {formatDate(role.updatedAt)}
          </Typography>
        </Stack>
      </Stack>
    </Card>
  );
});

RoleCard.displayName = 'RoleCard';
