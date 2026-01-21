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

type ResourcesFiltersProps = {
  keyword: string;
  resourceTypeFilter: string;
  onKeywordChange: (value: string) => void;
  onResourceTypeFilterChange: (value: string) => void;
  onCreateClick: () => void;
};

export const ResourcesFilters = memo(({
  keyword,
  resourceTypeFilter,
  onKeywordChange,
  onResourceTypeFilterChange,
  onCreateClick,
}: ResourcesFiltersProps) => {
  // Get codes by resource key
  const { data: codeMap, isLoading: codesLoading } = useCodesByResourceQuery('menu.admin.resources');
  const resourceTypes = getSelectOptionsByGroup(codeMap, 'RESOURCE_TYPE');

  return (
    <Card sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="검색"
          size="small"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          sx={{ flex: 1 }}
        />
        <TextField
          select
          label="타입"
          size="small"
          value={resourceTypeFilter}
          onChange={(e) => onResourceTypeFilterChange(e.target.value)}
          disabled={codesLoading || resourceTypes.length === 0}
          helperText={codesLoading ? '코드 로딩 중...' : resourceTypes.length === 0 ? '코드 매핑 필요' : undefined}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">전체</MenuItem>
          {resourceTypes.map((type) => (
            <MenuItem key={type.value} value={type.value}>
              {type.label}
            </MenuItem>
          ))}
        </TextField>
        <PermissionGate resource="menu.admin.resources" permission="CREATE">
          <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={onCreateClick}>
            리소스 추가
          </Button>
        </PermissionGate>
      </Stack>
    </Card>
  );
});

ResourcesFilters.displayName = 'ResourcesFilters';
