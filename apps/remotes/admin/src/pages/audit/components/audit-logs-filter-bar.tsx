// ----------------------------------------------------------------------

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';

import type { AuditLogTableState } from '../types';

// ----------------------------------------------------------------------

type AuditLogsFilterBarProps = {
  filters: AuditLogTableState;
  onFilterChange: <K extends keyof AuditLogTableState>(key: K, value: AuditLogTableState[K]) => void;
  onReset: () => void;
  onExport: () => void;
  isExporting: boolean;
};

export const AuditLogsFilterBar = memo(({
  filters,
  onFilterChange,
  onReset,
  onExport,
  isExporting,
}: AuditLogsFilterBarProps) => (
  <Card sx={{ p: 2 }}>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
      <TextField
        id="audit-filter-from"
        label="시작일시"
        type="datetime-local"
        size="small"
        value={filters.from}
        onChange={(e) => onFilterChange('from', e.target.value)}
        InputLabelProps={{ shrink: true }}
        inputProps={{ name: 'audit-from' }}
        sx={{ minWidth: { xs: 1, md: 200 } }}
      />
      <TextField
        id="audit-filter-to"
        label="종료일시"
        type="datetime-local"
        size="small"
        value={filters.to}
        onChange={(e) => onFilterChange('to', e.target.value)}
        InputLabelProps={{ shrink: true }}
        inputProps={{ name: 'audit-to' }}
        sx={{ minWidth: { xs: 1, md: 200 } }}
      />
      <TextField
        id="audit-filter-actor"
        label="실행자"
        size="small"
        value={filters.actor}
        onChange={(e) => onFilterChange('actor', e.target.value)}
        placeholder="사용자 ID 또는 이름"
        inputProps={{ name: 'audit-actor' }}
        sx={{ minWidth: { xs: 1, md: 200 }, flex: 1 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="solar:user-bold" width={16} />
            </InputAdornment>
          ),
        }}
      />
      <TextField
        id="audit-filter-action"
        name="audit-action"
        select
        label="액션"
        size="small"
        value={filters.action}
        onChange={(e) => onFilterChange('action', e.target.value)}
        sx={{ minWidth: { xs: 1, md: 150 } }}
      >
        <MenuItem value="">전체</MenuItem>
        <MenuItem value="CREATE">CREATE</MenuItem>
        <MenuItem value="UPDATE">UPDATE</MenuItem>
        <MenuItem value="DELETE">DELETE</MenuItem>
        <MenuItem value="REORDER">REORDER</MenuItem>
      </TextField>
      <TextField
        id="audit-filter-keyword"
        label="키워드"
        size="small"
        value={filters.keyword}
        onChange={(e) => onFilterChange('keyword', e.target.value)}
        placeholder="키워드 검색"
        inputProps={{ name: 'audit-keyword' }}
        sx={{ minWidth: { xs: 1, md: 240 }, flex: 1 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="solar:magnifer-bold" width={16} />
            </InputAdornment>
          ),
        }}
      />
      <Box sx={{ ml: { md: 'auto' }, display: 'flex', gap: 1, width: { xs: 1, md: 'auto' } }}>
        <Button
          variant="outlined"
          onClick={onReset}
          startIcon={<Iconify icon="solar:refresh-bold" />}
          sx={{ flex: { xs: 1, md: 'none' }, minHeight: 40 }}
        >
          초기화
        </Button>
        <Button
          variant="contained"
          onClick={onExport}
          disabled={isExporting}
          startIcon={<Iconify icon={isExporting ? 'svg-spinners:ring-resize' : 'solar:download-bold'} />}
          sx={{ flex: { xs: 1, md: 'none' }, minHeight: 40 }}
        >
          {isExporting ? '다운로드 중...' : 'Excel 다운로드'}
        </Button>
      </Box>
    </Stack>
  </Card>
));

AuditLogsFilterBar.displayName = 'AuditLogsFilterBar';
