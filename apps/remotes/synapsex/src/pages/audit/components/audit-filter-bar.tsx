/**
 * 감사 추적 로그 필터 바 — FilterCard 활용
 * 1행: 기간 + category + eventType + outcome + actorType
 * 2행: q + [Advanced] + [Reset]
 * 옵션: useAuditFilterOptions (코드 API) → BE 미제공 시 fallback
 */

import { memo, type ReactNode } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Iconify, FilterCard } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

import { isoToDatetimeLocal } from '../utils/audit-date-utils';

import type { AuditFilters, AuditDatePreset } from '../types';
import type { AuditFilterOptions } from '../hooks/use-audit-filter-options';

// ----------------------------------------------------------------------

const DATE_PRESET_OPTIONS: { value: AuditDatePreset; labelKey: string }[] = [
  { value: 'today', labelKey: 'audit.datePresets.today' },
  { value: '1h', labelKey: 'audit.datePresets.1h' },
  { value: '6h', labelKey: 'audit.datePresets.6h' },
  { value: '24h', labelKey: 'audit.datePresets.24h' },
  { value: '7d', labelKey: 'audit.datePresets.7d' },
  { value: '30d', labelKey: 'audit.datePresets.30d' },
  { value: '90d', labelKey: 'audit.datePresets.90d' },
  { value: 'custom', labelKey: 'audit.datePresets.custom' },
];

// ----------------------------------------------------------------------

type AuditFilterBarProps = {
  filters: AuditFilters;
  options: AuditFilterOptions;
  onUpdate: <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => void;
  onReset: () => void;
  onAdvancedOpen: () => void;
  hasActiveFilters: boolean;
  /** 선택된 필터 칩 (FilterCard title 옆에 표시) */
  chips?: ReactNode;
};

export const AuditFilterBar = memo(({
  filters,
  options,
  onUpdate,
  onReset,
  onAdvancedOpen,
  hasActiveFilters,
  chips,
}: AuditFilterBarProps) => {
  const { t } = useTranslation('common');

  return (
    <FilterCard
      title={t('audit.filterTitle')}
      chips={chips}
      resetLabel={t('audit.filterReset')}
      onReset={hasActiveFilters ? onReset : undefined}
      children={
        <Stack spacing={2}>
          {/* Row 1: Date + category + outcome + actorType */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            flexWrap="wrap"
            alignItems={{ sm: 'center' }}
            sx={{ gap: 1 }}
          >
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>{t('audit.dateRange')}</InputLabel>
              <Select
                value={filters.datePreset}
                label={t('audit.dateRange')}
                onChange={(e) => onUpdate('datePreset', e.target.value as AuditDatePreset)}
              >
                {DATE_PRESET_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {(filters.datePreset === 'custom') && (
              <>
                <TextField
                  size="small"
                  type="datetime-local"
                  label={t('audit.dateFrom')}
                  value={isoToDatetimeLocal(filters.from)}
                  onChange={(e) => onUpdate('from', e.target.value ? `${e.target.value}:00` : '')}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 180 }}
                />
                <TextField
                  size="small"
                  type="datetime-local"
                  label={t('audit.dateTo')}
                  value={isoToDatetimeLocal(filters.to)}
                  onChange={(e) => onUpdate('to', e.target.value ? `${e.target.value}:00` : '')}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 180 }}
                />
              </>
            )}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>{t('audit.allCategories')}</InputLabel>
              <Select
                value={filters.eventCategory}
                label={t('audit.allCategories')}
                onChange={(e) => onUpdate('eventCategory', e.target.value as AuditFilters['eventCategory'])}
              >
                {options.categoryOptions.map((opt) => (
                  <MenuItem key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>{t('audit.eventType')}</InputLabel>
              <Select
                value={filters.eventTypeFilter}
                label={t('audit.eventType')}
                onChange={(e) => onUpdate('eventTypeFilter', e.target.value)}
              >
                {options.eventTypeOptions.map((opt) => (
                  <MenuItem key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>{t('audit.allOutcomes')}</InputLabel>
              <Select
                value={filters.outcome}
                label={t('audit.allOutcomes')}
                onChange={(e) => onUpdate('outcome', e.target.value as AuditFilters['outcome'])}
              >
                {options.outcomeOptions.map((opt) => (
                  <MenuItem key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>{t('audit.actorType')}</InputLabel>
              <Select
                value={filters.actorType}
                label={t('audit.actorType')}
                onChange={(e) => onUpdate('actorType', e.target.value as AuditFilters['actorType'])}
              >
                {options.actorTypeOptions.map((opt) => (
                  <MenuItem key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Row 2: q + [Advanced] + [Reset] */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ sm: 'center' }}
            sx={{ gap: 1 }}
          >
            <TextField
              size="small"
              placeholder={t('audit.searchPlaceholder')}
              value={filters.q}
              onChange={(e) => onUpdate('q', e.target.value)}
              sx={{ minWidth: 280, flex: 1 }}
              InputProps={{
                startAdornment: (
                  <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                ),
              }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:settings-bold-duotone" width={18} />}
              onClick={onAdvancedOpen}
              sx={{ bgcolor: 'transparent' }}
            >
              {t('audit.advanced')}
            </Button>
          </Stack>
        </Stack>
      }
    />
  );
});

AuditFilterBar.displayName = 'AuditFilterBar';
