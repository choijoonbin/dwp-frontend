// ----------------------------------------------------------------------

import { memo } from 'react';
import { Iconify , PermissionGate } from '@dwp-frontend/design-system';
import { useCodesByResourceQuery, getSelectOptionsByGroup } from '@dwp-frontend/shared-utils';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

// ----------------------------------------------------------------------

type UsersFiltersProps = {
  keyword: string;
  statusFilter: string;
  loginTypeFilter: string;
  departmentFilter: string;
  onKeywordChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onLoginTypeFilterChange: (value: string) => void;
  onDepartmentFilterChange: (value: string) => void;
  onCreateClick: () => void;
};

export const UsersFilters = memo(({
  keyword,
  statusFilter,
  loginTypeFilter,
  departmentFilter,
  onKeywordChange,
  onStatusFilterChange,
  onLoginTypeFilterChange,
  onDepartmentFilterChange,
  onCreateClick,
}: UsersFiltersProps) => {
  // Get codes by resource key
  const { data: codeMap, isLoading: codesLoading } = useCodesByResourceQuery('menu.admin.users');
  const userStatusOptions = getSelectOptionsByGroup(codeMap, 'USER_STATUS');
  // Backend returns IDP_PROVIDER_TYPE, not LOGIN_TYPE
  const loginTypeOptions = getSelectOptionsByGroup(codeMap, 'IDP_PROVIDER_TYPE');

  return (
    <Card sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="검색 (이름/이메일)"
          size="small"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          sx={{ flex: 1 }}
        />
        <TextField
          select
          label="상태"
          size="small"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          disabled={codesLoading || userStatusOptions.length === 0}
          helperText={codesLoading ? '코드 로딩 중...' : userStatusOptions.length === 0 ? '코드 매핑 필요' : undefined}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">전체</MenuItem>
          {userStatusOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="로그인 유형"
          size="small"
          value={loginTypeFilter}
          onChange={(e) => onLoginTypeFilterChange(e.target.value)}
          disabled={codesLoading || loginTypeOptions.length === 0}
          helperText={codesLoading ? '코드 로딩 중...' : loginTypeOptions.length === 0 ? '코드 매핑 필요' : undefined}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">전체</MenuItem>
          {loginTypeOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <PermissionGate resource="menu.admin.users" permission="CREATE">
          <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={onCreateClick}>
            사용자 추가
          </Button>
        </PermissionGate>
      </Stack>
    </Card>
  );
});

UsersFilters.displayName = 'UsersFilters';
