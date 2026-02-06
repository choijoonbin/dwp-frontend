import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';

import { SodCard } from './components/sod-card';
import { ErrorState } from './components/error-state';
import { useTenantScope } from './hooks/use-tenant-scope';
import { CurrencyCard } from './components/currency-card';
import { LoadingSkeleton } from './components/loading-skeleton';
import { CompanyCodeCard } from './components/company-code-card';

function formatLastUpdated(isoString: string | undefined): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}

export const TenantScopeTab = () => {
  const { t } = useTranslation('common');
  const {
    companyCodes,
    currencies,
    sodRules,
    meta,
    isLoading,
    error,
    refetch,
    profileId,
    setProfileId,
    profileOptions,
    hasProfiles,
    patchCompanyCode,
    patchCurrency,
    patchSodRule,
    addCompanyCodes,
    addCurrencies,
  } = useTenantScope();

  if (isLoading && !hasProfiles) {
    return (
      <Box sx={{ mt: 3 }}>
        <LoadingSkeleton />
      </Box>
    );
  }

  if (!hasProfiles) {
    return (
      <Box sx={{ mt: 3 }}>
        <ErrorState
          message={`${t('tenantScope.noProfilesFound')} ${t('tenantScope.noProfilesHint')}`}
          onRetry={refetch}
        />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 3 }}>
        <ErrorState
          message={error instanceof Error ? error.message : t('tenantScope.failedToLoad')}
          onRetry={() => refetch()}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>{t('tenantScope.profile')}</InputLabel>
          <Select
            value={profileId ?? ''}
            label={t('tenantScope.profile')}
            onChange={(e) => setProfileId(e.target.value || null)}
          >
            {profileOptions.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
                {p.isDefault ? ` ${t('tenantScope.profileDefault')}` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        <CompanyCodeCard
          items={companyCodes}
          isLoading={isLoading}
          patchMutation={patchCompanyCode}
          addMutation={addCompanyCodes}
          refetch={refetch}
        />
        <CurrencyCard
          items={currencies}
          isLoading={isLoading}
          patchMutation={patchCurrency}
          addMutation={addCurrencies}
          refetch={refetch}
        />
        <SodCard
          items={sodRules}
          isLoading={isLoading}
          patchMutation={patchSodRule}
          refetch={refetch}
          sodMode={meta?.sodMode ?? (sodRules.length > 0 ? 'ENFORCED' : undefined)}
        />
      </Box>
      {meta?.lastUpdatedAt && (
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {t('tenantScope.lastUpdated')}: {formatLastUpdated(meta.lastUpdatedAt)}
          </Typography>
        </Stack>
      )}
    </Box>
  );
};
