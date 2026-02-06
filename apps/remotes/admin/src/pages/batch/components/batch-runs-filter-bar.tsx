// ----------------------------------------------------------------------

import type { DetectRunStatus } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

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

const STATUS_OPTIONS: { value: DetectRunStatus | ''; labelKey: string }[] = [
  { value: '', labelKey: 'batch.filter.all' },
  { value: 'RUNNING', labelKey: 'batch.table.statusRunning' },
  { value: 'SUCCESS', labelKey: 'batch.table.statusSuccess' },
  { value: 'FAILED', labelKey: 'batch.table.statusFailed' },
  { value: 'SKIPPED', labelKey: 'batch.table.statusSkipped' },
];

export const BatchRunsFilterBar = memo(({
  filters,
  onUpdateFilter,
  onReset,
}: BatchRunsFilterBarProps) => {
  const { t } = useTranslation('admin');
  return (
  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
    <TextField
      size="small"
      label={t('batch.filter.from')}
      type="datetime-local"
      value={filters.from}
      onChange={(e) => onUpdateFilter('from', e.target.value)}
      InputLabelProps={{ shrink: true }}
      sx={{ minWidth: 200 }}
    />
    <TextField
      size="small"
      label={t('batch.filter.to')}
      type="datetime-local"
      value={filters.to}
      onChange={(e) => onUpdateFilter('to', e.target.value)}
      InputLabelProps={{ shrink: true }}
      sx={{ minWidth: 200 }}
    />
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <InputLabel>{t('batch.filter.status')}</InputLabel>
      <Select
        value={filters.status}
        label={t('batch.filter.status')}
        onChange={(e) => onUpdateFilter('status', e.target.value as BatchFilters['status'])}
      >
        {STATUS_OPTIONS.map((opt) => (
          <MenuItem key={opt.value || 'all'} value={opt.value}>
            {t(opt.labelKey)}
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
      {t('batch.filter.reset')}
    </Box>
  </Stack>
  );
});
