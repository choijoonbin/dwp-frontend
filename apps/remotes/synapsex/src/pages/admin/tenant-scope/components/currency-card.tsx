import type { UseMutationResult } from '@tanstack/react-query';

import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import {
  showToast,
  useCurrencyCatalogQuery,
  type TenantScopeCurrency,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';

import { CatalogAddDialog } from './catalog-add-dialog';


type PatchCurrencyMutation = UseMutationResult<
  unknown,
  Error,
  {
    currentItems: { waers: string; enabled: boolean; fxControlMode?: 'ALLOW' | 'FX_REQUIRED' | 'FX_LOCKED' }[];
    enabled?: boolean;
    fxControlMode?: 'ALLOW' | 'FX_REQUIRED' | 'FX_LOCKED';
    waers: string;
  },
  unknown
>;
type AddCurrenciesMutation = UseMutationResult<
  unknown,
  Error,
  {
    currentItems: { waers: string; enabled: boolean; fxControlMode?: 'ALLOW' | 'FX_REQUIRED' | 'FX_LOCKED' }[];
    waersList: string[];
  },
  unknown
>;

type CurrencyCardProps = {
  items: TenantScopeCurrency[];
  isLoading?: boolean;
  patchMutation: PatchCurrencyMutation;
  addMutation: AddCurrenciesMutation;
  refetch: () => void;
};

export const CurrencyCard = ({
  items,
  isLoading,
  patchMutation,
  addMutation,
  refetch,
}: CurrencyCardProps) => {
  const { t } = useTranslation('common');
  const [addOpen, setAddOpen] = useState(false);

  const { data: catalogData, isLoading: catalogLoading, error: catalogError } = useCurrencyCatalogQuery({
    enabled: addOpen,
  });

  const existingKeys = items.map((i) => i.waers);
  const catalogItems = catalogData ?? [];

  const toCurrentItems = () =>
    items.map((i) => ({
      enabled: i.enabled,
      fxControlMode: i.fxControlMode ?? 'ALLOW',
      waers: i.waers,
    }));

  const handleToggle = async (waers: string, enabled: boolean) => {
    patchMutation.mutate(
      {
        currentItems: toCurrentItems(),
        enabled,
        waers,
      },
      {
        onSuccess: () => {
          showToast(t('toast.saved'));
          refetch();
        },
        onError: (err) => {
          showToast(err instanceof Error ? err.message : t('toast.failedToUpdate'), 'error');
        },
      }
    );
  };

  const handleFxModeChange = (waers: string, fxControlMode: 'ALLOW' | 'FX_REQUIRED' | 'FX_LOCKED') => {
    patchMutation.mutate(
      {
        currentItems: toCurrentItems(),
        fxControlMode,
        waers,
      },
      {
        onSuccess: () => {
          showToast(t('toast.saved'));
          refetch();
        },
        onError: (err) => {
          showToast(err instanceof Error ? err.message : t('toast.failedToUpdate'), 'error');
        },
      }
    );
  };

  const handleAddConfirm = async (selectedKeys: string[]) => {
    try {
      await addMutation.mutateAsync({
        currentItems: toCurrentItems(),
        waersList: selectedKeys,
      });
      showToast(t('toast.saved'));
      refetch();
      setAddOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('toast.failedToAdd'), 'error');
      throw err;
    }
  };

  return (
    <>
      <Card variant="outlined">
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:global-bold-duotone" width={18} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('tenantScope.currencies')}
              </Typography>
            </Stack>
          }
          subheader={t('tenantScope.currenciesSubheader')}
          action={
            <Button
              size="small"
              variant="outlined"
              startIcon={<Iconify icon="solar:add-circle-bold" width={16} />}
              onClick={() => setAddOpen(true)}
            >
              {t('tenantScope.add')}
            </Button>
          }
          sx={{ pb: 2 }}
        />
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
              {t('tenantScope.included')}: {items.filter((i) => i.enabled).length} / {t('tenantScope.total')}: {items.length}
            </Typography>
            {isLoading ? (
              <Typography variant="body2" color="text.secondary">
                {t('tenantScope.loading')}
              </Typography>
            ) : items.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('tenantScope.noCurrencies')}
              </Typography>
            ) : (
              items.map((item) => (
                <Box
                  key={item.waers}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.waers}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.enabled ? t('tenantScope.allowedPostings') : t('tenantScope.disabled')}
                    </Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>{t('tenantScope.fxMode')}</InputLabel>
                      <Select
                        value={item.fxControlMode ?? 'ALLOW'}
                        label={t('tenantScope.fxMode')}
                        onChange={(e) =>
                          handleFxModeChange(item.waers, e.target.value as 'ALLOW' | 'FX_REQUIRED' | 'FX_LOCKED')
                        }
                        disabled={patchMutation.isPending || !item.enabled}
                      >
                        {[
                          { value: 'ALLOW' as const, key: 'fxAllow' },
                          { value: 'FX_REQUIRED' as const, key: 'fxRequired' },
                          { value: 'FX_LOCKED' as const, key: 'fxLocked' },
                        ].map((m) => (
                          <MenuItem key={m.value} value={m.value}>
                            {t(`tenantScope.${m.key}`)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Switch
                      checked={item.enabled}
                      onChange={(_, checked) => handleToggle(item.waers, checked)}
                      disabled={patchMutation.isPending}
                    />
                  </Stack>
                </Box>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>

      <CatalogAddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('tenantScope.addCurrencies')}
        keyField="waers"
        items={catalogItems}
        existingKeys={existingKeys}
        onConfirm={handleAddConfirm}
        isLoading={catalogLoading}
        catalogError={catalogError ?? undefined}
      />
    </>
  );
};
