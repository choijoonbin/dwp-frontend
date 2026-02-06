import type { SelectChangeEvent } from '@mui/material/Select';

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

import type { DocumentFilters } from '../types';

type DocumentsFilterBarProps = {
  filters: DocumentFilters;
  onFiltersChange: (f: DocumentFilters) => void;
  companyCodes: { code: string; name: string }[];
};

export const DocumentsFilterBar = ({
  filters,
  onFiltersChange,
  companyCodes,
}: DocumentsFilterBarProps) => {
  const { t } = useTranslation('common');
  const integrityOptions = [
    { value: '', label: t('documents.filter.allStatus') },
    { value: 'pass', label: t('documents.integrity.pass') },
    { value: 'warn', label: t('documents.integrity.warn') },
    { value: 'fail', label: t('documents.integrity.fail') },
  ];
  const handleChange = (key: keyof DocumentFilters, value: unknown) => {
    onFiltersChange({ ...filters, [key]: value || undefined });
  };

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            fullWidth
            size="small"
            placeholder={t('documents.filter.searchPlaceholder')}
            value={filters.xblnr ?? ''}
            onChange={(e) => handleChange('xblnr', e.target.value || undefined)}
            InputProps={{
              startAdornment: (
                <Iconify
                  icon="solar:magnifer-linear"
                  width={20}
                  sx={{ mr: 1, color: 'text.secondary' }}
                />
              ),
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>{t('documents.filter.company')}</InputLabel>
            <Select
              value={filters.bukrs ?? 'all'}
              label={t('documents.filter.company')}
              onChange={(e: SelectChangeEvent) =>
                handleChange('bukrs', e.target.value === 'all' ? undefined : e.target.value)
              }
            >
              <MenuItem value="all">{t('documents.filter.allCompanies')}</MenuItem>
              {companyCodes.map((cc) => (
                <MenuItem key={cc.code} value={cc.code}>
                  {cc.code} - {cc.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>{t('documents.filter.integrity')}</InputLabel>
            <Select
              value={filters.status ?? 'all'}
              label={t('documents.filter.integrity')}
              onChange={(e: SelectChangeEvent) =>
                handleChange('status', e.target.value === 'all' ? undefined : e.target.value)
              }
            >
              {integrityOptions.map((o) => (
                <MenuItem key={o.value || 'all'} value={o.value || 'all'}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <TextField
            fullWidth
            size="small"
            type="date"
            label={t('documents.filter.dateFrom')}
            value={filters.dateFrom ?? ''}
            onChange={(e) => handleChange('dateFrom', e.target.value || undefined)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <TextField
            fullWidth
            size="small"
            type="date"
            label={t('documents.filter.dateTo')}
            value={filters.dateTo ?? ''}
            onChange={(e) => handleChange('dateTo', e.target.value || undefined)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      </Grid>
    </Box>
  );
};
