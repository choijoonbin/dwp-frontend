// ----------------------------------------------------------------------

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

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
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField
        label="시작일시"
        type="datetime-local"
        size="small"
        value={filters.from}
        onChange={(e) => onFilterChange('from', e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 200 }}
      />
      <TextField
        label="종료일시"
        type="datetime-local"
        size="small"
        value={filters.to}
        onChange={(e) => onFilterChange('to', e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: 200 }}
      />
      <TextField
        label="실행자 (Actor)"
        size="small"
        value={filters.actor}
        onChange={(e) => onFilterChange('actor', e.target.value)}
        placeholder="사용자 ID 또는 이름"
        sx={{ flex: 1 }}
      />
      <TextField
        label="액션"
        size="small"
        value={filters.action}
        onChange={(e) => onFilterChange('action', e.target.value)}
        placeholder="CREATE, UPDATE, DELETE 등"
        sx={{ minWidth: 150 }}
      />
      <TextField
        label="검색"
        size="small"
        value={filters.keyword}
        onChange={(e) => onFilterChange('keyword', e.target.value)}
        placeholder="키워드 검색"
        sx={{ flex: 1 }}
      />
      <Button variant="outlined" onClick={onReset} startIcon={<Iconify icon="solar:refresh-bold" />}>
        초기화
      </Button>
      <Button
        variant="contained"
        onClick={onExport}
        disabled={isExporting}
        startIcon={<Iconify icon={isExporting ? 'svg-spinners:ring-resize' : 'solar:download-bold'} />}
      >
        {isExporting ? '다운로드 중...' : 'Excel 다운로드'}
      </Button>
    </Stack>
  </Card>
));

AuditLogsFilterBar.displayName = 'AuditLogsFilterBar';
