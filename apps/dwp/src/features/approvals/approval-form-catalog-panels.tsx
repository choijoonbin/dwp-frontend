import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { FormField, SelectField } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

import { StatusChip, approvalTone } from './approval-ui';

import type { ApprovalForm } from '@dwp-frontend/shared-utils';
import type { ComponentType } from 'react';
import type { ApprovalFormCatalogSort } from './approval-form-catalog-query';

export function ApprovalFormCatalogControls({
  search,
  onSearch,
  lifecycle,
  onLifecycle,
  sort,
  onSort,
}: {
  search: string;
  onSearch: (value: string) => void;
  lifecycle: string;
  onLifecycle: (value: string) => void;
  sort: ApprovalFormCatalogSort;
  onSort: (value: ApprovalFormCatalogSort) => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Stack gap={1.25} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      <FormField
        fullWidth
        size="small"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={t('admin.formCatalog.forms.search')}
        inputProps={{ 'aria-label': t('admin.formCatalog.forms.search') }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search size={16} />
            </InputAdornment>
          ),
        }}
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 1 }}>
        <SelectField
          size="small"
          label={t('admin.formCatalog.forms.lifecycle')}
          value={lifecycle}
          options={[
            { value: 'ALL', label: t('admin.formCatalog.categories.all') },
            ...['DRAFT', 'PUBLISHED', 'RETIRED'].map((value) => ({
              value,
              label: t(`status.${value}`),
            })),
          ]}
          onValueChange={(value) => value && onLifecycle(value)}
        />
        <SelectField
          size="small"
          label={t('admin.formCatalog.forms.sort')}
          value={sort}
          options={[
            { value: 'updated', label: t('admin.formCatalog.forms.sortUpdated') },
            { value: 'name', label: t('admin.formCatalog.forms.sortName') },
          ]}
          onValueChange={(value) => (value === 'updated' || value === 'name') && onSort(value)}
        />
      </Box>
    </Stack>
  );
}

export function ApprovalFormCatalogMetrics({
  values,
}: {
  values: Array<[string, number, ComponentType<{ size?: number }>]>;
}) {
  return (
    <Box
      sx={{
        mb: 2,
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0,1fr))',
          lg: 'repeat(4, minmax(0,1fr))',
        },
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {values.map(([label, value, Icon], index) => (
        <Stack
          key={label}
          direction="row"
          gap={1.25}
          alignItems="center"
          sx={{
            minHeight: 76,
            px: 2,
            borderRight: index % 4 === 3 ? 0 : 1,
            borderBottom: { xs: index < 2 ? 1 : 0, lg: 0 },
            borderColor: 'divider',
          }}
        >
          <Box sx={{ color: 'primary.main' }}>
            <Icon size={19} />
          </Box>
          <Box>
            <Box sx={{ typography: 'h6' }}>{value}</Box>
            <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{label}</Box>
          </Box>
        </Stack>
      ))}
    </Box>
  );
}

export function ApprovalFormListItem({
  form,
  selected,
  locale,
  onSelect,
}: {
  form: ApprovalForm;
  selected: boolean;
  locale?: string;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(locale, i18n.resolvedLanguage, i18n.language) === 'ko';
  return (
    <Box component="li">
      <ButtonBase
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        sx={{
          width: 1,
          minHeight: 82,
          px: 1.75,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          textAlign: 'left',
          borderBottom: 1,
          borderColor: 'divider',
          borderInlineStart: 3,
          borderInlineStartColor: selected ? 'primary.main' : 'transparent',
          bgcolor: selected ? alpha(approvalTone.primary, 0.075) : 'transparent',
          '&:hover': { bgcolor: alpha(approvalTone.primary, 0.05) },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              typography: 'body2',
              fontWeight: 'fontWeightBold',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {korean ? form.nameKo : form.nameEn}
          </Box>
          <Box
            sx={{
              typography: 'caption',
              color: 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {korean ? form.categoryNameKo : form.categoryNameEn}
          </Box>
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
            {t('admin.formListMeta', {
              count: form.fieldCount,
              version: form.currentVersion,
            })}
          </Box>
          <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
            {t('admin.formCatalog.forms.recordMeta', {
              key: form.formKey,
              routes: form.routeCount,
              usage: form.usageCount,
            })}
          </Box>
          <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
            {form.ownerGroupRef ?? t('admin.integrations.notAvailable')}
            {' · '}
            {t('admin.formCatalog.forms.updatedAt', {
              date: formatDate(
                form.updatedAt,
                { dateStyle: 'short' },
                resolveSupportedLocale(locale, i18n.resolvedLanguage, i18n.language)
              ),
            })}
          </Box>
        </Box>
        <StatusChip status={form.lifecycleState} />
      </ButtonBase>
    </Box>
  );
}
