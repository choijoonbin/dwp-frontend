/**
 * 거래처 허브 검색 필터
 * - type: Select (전체, 공급업체, 고객)
 * - country: Select (ISO 3166-1 alpha-3)
 * - q: 텍스트 검색 (이름/코드)
 */

import type { SelectChangeEvent } from '@mui/material/Select';

import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';

import type { EntityFilters } from '../types';

const TYPE_OPTIONS: { value: '' | 'VENDOR' | 'CUSTOMER'; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'VENDOR', label: '공급업체' },
  { value: 'CUSTOMER', label: '고객' },
];

/** ISO 3166-1 alpha-3 국가코드 (일반적 사용 국가) */
const COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'KOR', label: '대한민국 (KOR)' },
  { value: 'USA', label: '미국 (USA)' },
  { value: 'JPN', label: '일본 (JPN)' },
  { value: 'CHN', label: '중국 (CHN)' },
  { value: 'DEU', label: '독일 (DEU)' },
  { value: 'GBR', label: '영국 (GBR)' },
  { value: 'FRA', label: '프랑스 (FRA)' },
  { value: 'SGP', label: '싱가포르 (SGP)' },
  { value: 'HKG', label: '홍콩 (HKG)' },
  { value: 'TWN', label: '대만 (TWN)' },
  { value: 'VNM', label: '베트남 (VNM)' },
  { value: 'THA', label: '태국 (THA)' },
  { value: 'IND', label: '인도 (IND)' },
  { value: 'NLD', label: '네덜란드 (NLD)' },
  { value: 'CHE', label: '스위스 (CHE)' },
  { value: 'AUS', label: '호주 (AUS)' },
  { value: 'CAN', label: '캐나다 (CAN)' },
  { value: 'ITA', label: '이탈리아 (ITA)' },
  { value: 'ESP', label: '스페인 (ESP)' },
];

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
  const handleChange = (key: keyof EntityFilters, value: string | undefined) => {
    onFiltersChange({ ...filters, [key]: value || undefined });
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
      <TextField
        size="small"
        placeholder="검색 (이름/코드)"
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
        <InputLabel>유형</InputLabel>
        <Select
          value={filters.type ?? ''}
          label="유형"
          onChange={(e: SelectChangeEvent) =>
            handleChange('type', (e.target.value as '' | 'VENDOR' | 'CUSTOMER') || undefined)
          }
        >
          {TYPE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: { xs: 1, md: 180 } }}>
        <InputLabel>국가</InputLabel>
        <Select
          value={filters.country ?? ''}
          label="국가"
          onChange={(e: SelectChangeEvent) =>
            handleChange('country', e.target.value || undefined)
          }
        >
          {COUNTRY_OPTIONS.map((opt) => (
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
  );
};
