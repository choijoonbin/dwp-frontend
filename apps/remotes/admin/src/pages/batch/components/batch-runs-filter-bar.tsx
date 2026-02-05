// ----------------------------------------------------------------------

import type { DetectRunStatus } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

import type { BatchFilters } from '../hooks/use-batch-table-state';

// ----------------------------------------------------------------------

type BatchRunsFilterBarProps = {
  filters: BatchFilters;
  onUpdateFilter: <K extends keyof BatchFilters>(key: K, value: BatchFilters[K]) => void;
  onReset: () => void;
};

const STATUS_OPTIONS: { value: DetectRunStatus | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'RUNNING', label: '실행 중' },
  { value: 'SUCCESS', label: '성공' },
  { value: 'FAILED', label: '실패' },
  { value: 'SKIPPED', label: '건너뜀' },
];

export const BatchRunsFilterBar = memo(({
  filters,
  onUpdateFilter,
  onReset,
}: BatchRunsFilterBarProps) => (
  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
    <TextField
      size="small"
      label="From"
      type="datetime-local"
      value={filters.from}
      onChange={(e) => onUpdateFilter('from', e.target.value)}
      InputLabelProps={{ shrink: true }}
      sx={{ minWidth: 200 }}
    />
    <TextField
      size="small"
      label="To"
      type="datetime-local"
      value={filters.to}
      onChange={(e) => onUpdateFilter('to', e.target.value)}
      InputLabelProps={{ shrink: true }}
      sx={{ minWidth: 200 }}
    />
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <InputLabel>Status</InputLabel>
      <Select
        value={filters.status}
        label="Status"
        onChange={(e) => onUpdateFilter('status', e.target.value as BatchFilters['status'])}
      >
        {STATUS_OPTIONS.map((opt) => (
          <MenuItem key={opt.value || 'all'} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
    <Box
      component="button"
      type="button"
      onClick={onReset}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.5,
        py: 0.75,
        border: 0,
        borderRadius: 1,
        bgcolor: 'action.hover',
        cursor: 'pointer',
        fontSize: '0.875rem',
        color: 'text.secondary',
        '&:hover': { bgcolor: 'action.selected' },
      }}
    >
      <Iconify icon="solar:refresh-bold" width={16} />
      초기화
    </Box>
  </Stack>
));
