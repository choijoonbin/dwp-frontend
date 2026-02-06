/**
 * 거래처 허브 검색 필터
 * - type: useCodes('ENTITY_TYPE') — VENDOR, CUSTOMER
 * - country: useCodes('COUNTRY') — KOR, USA, JPN, CHN 등
 * - q: 텍스트 검색 (이름/코드)
 */

import type { SelectChangeEvent } from '@mui/material/Select';

import { useMemo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useCodes } from '@dwp-frontend/shared-utils';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';

import type { EntityFilters } from '../types';

/** useCodes 결과로 Select 옵션 생성 (전체 + BE codes) */
function buildOptionsFromCodes(
  codeMap: Map<string, string>,
  allLabel: string
): { value: string; label: string }[] {
  const items = Array.from(codeMap.entries())
    .filter(([k]) => k.trim())
    .map(([value, label]) => ({ value, label }));
  return [{ value: '', label: allLabel }, ...items];
}

type EntitiesFilterBarProps = {
  filters: EntityFilters;
  onFiltersChange: (f: EntityFilters) => void;
  onReset: () => void;
};

export const EntitiesFilterBar = ({
  filters,
  onFiltersChange,
  onReset,
}: EntitiesFilterBarProps) => {
  const { t } = useTranslation('common');
  const { codeMap: entityTypeMap } = useCodes('ENTITY_TYPE');
  const { codeMap: countryMap } = useCodes('COUNTRY');

  const typeOptions = useMemo(
    () => buildOptionsFromCodes(entityTypeMap, t('commonLabels.all')),
    [entityTypeMap, t]
  );
  const countryOptions = useMemo(
    () => buildOptionsFromCodes(countryMap, t('commonLabels.all')),
    [countryMap, t]
  );

  const handleChange = (key: keyof EntityFilters, value: string | undefined) => {
    onFiltersChange({ ...filters, [key]: value || undefined });
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
      <TextField
        size="small"
        placeholder={t('entities.filter.searchPlaceholder')}
        value={filters.q ?? ''}
        onChange={(e) => handleChange('q', e.target.value)}
        sx={{ minWidth: { xs: 1, md: 220 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="solar:magnifer-bold" width={18} sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
        }}
      />
      <FormControl size="small" sx={{ minWidth: { xs: 1, md: 140 } }}>
        <InputLabel>{t('entities.filter.type')}</InputLabel>
        <Select
          value={filters.type ?? ''}
          label={t('entities.filter.type')}
          onChange={(e: SelectChangeEvent) =>
            handleChange('type', (e.target.value as '' | 'VENDOR' | 'CUSTOMER') || undefined)
          }
        >
          {typeOptions.map((opt) => (
            <MenuItem key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: { xs: 1, md: 180 } }}>
        <InputLabel>{t('entities.filter.country')}</InputLabel>
        <Select
          value={filters.country ?? ''}
          label={t('entities.filter.country')}
          onChange={(e: SelectChangeEvent) =>
            handleChange('country', e.target.value || undefined)
          }
        >
          {countryOptions.map((opt) => (
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
        {t('entities.filter.reset')}
      </Box>
    </Stack>
  );
};
