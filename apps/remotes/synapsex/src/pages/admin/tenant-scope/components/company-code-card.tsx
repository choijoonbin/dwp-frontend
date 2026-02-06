import type { UseMutationResult } from '@tanstack/react-query';

import { useMemo, useState } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';
import { showToast, useCompanyCodeCatalogQuery, type TenantScopeCompanyCode } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { CatalogAddDialog } from './catalog-add-dialog';

type FilterType = 'all' | 'enabled' | 'disabled';

type PatchCompanyCodeMutation = UseMutationResult<
  unknown,
  Error,
  { bukrs: string; enabled: boolean; currentItems: { bukrs: string; enabled: boolean }[] },
  unknown
>;
type AddCompanyCodesMutation = UseMutationResult<
  unknown,
  Error,
  { bukrsList: string[]; currentItems: { bukrs: string; enabled: boolean }[] },
  unknown
>;

type CompanyCodeCardProps = {
  items: TenantScopeCompanyCode[];
  isLoading?: boolean;
  patchMutation: PatchCompanyCodeMutation;
  addMutation: AddCompanyCodesMutation;
  refetch: () => void;
};


export const CompanyCodeCard = ({
  items,
  isLoading,
  patchMutation,
  addMutation,
  refetch,
}: CompanyCodeCardProps) => {
  const { t } = useTranslation('common');
  const [filter, setFilter] = useState<FilterType>('all');
  const [addOpen, setAddOpen] = useState(false);

  const { data: catalogData, isLoading: catalogLoading, error: catalogError } = useCompanyCodeCatalogQuery({
    enabled: addOpen,
  });

  const filteredItems = useMemo(() => {
    if (filter === 'enabled') return items.filter((i) => i.enabled);
    if (filter === 'disabled') return items.filter((i) => !i.enabled);
    return items;
  }, [items, filter]);

  const existingKeys = useMemo(() => items.map((i) => i.bukrs), [items]);
  const catalogItems = catalogData ?? [];

  const handleToggle = async (bukrs: string, enabled: boolean) => {
    patchMutation.mutate(
      {
        bukrs,
        enabled,
        currentItems: items.map((i) => ({ bukrs: i.bukrs, enabled: i.enabled })),
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
        bukrsList: selectedKeys,
        currentItems: items.map((i) => ({ bukrs: i.bukrs, enabled: i.enabled })),
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
              <Iconify icon="solar:buildings-bold-duotone" width={18} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('tenantScope.companyCodes')}
              </Typography>
            </Stack>
          }
          subheader={t('tenantScope.companyCodesSubheader')}
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
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1}
              sx={{ mb: 0.5 }}
            >
              <Typography variant="caption" color="text.secondary">
                {t('tenantScope.included')}: {items.filter((i) => i.enabled).length} / {t('tenantScope.total')}: {items.length}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
              <ToggleButtonGroup
                size="small"
                value={filter}
                exclusive
                onChange={(_, v) => v != null && setFilter(v)}
              >
                <ToggleButton value="all">{t('tenantScope.all')}</ToggleButton>
                <ToggleButton value="enabled">{t('tenantScope.enabled')}</ToggleButton>
                <ToggleButton value="disabled">{t('tenantScope.disabled')}</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            {isLoading ? (
              <Typography variant="body2" color="text.secondary">
                {t('tenantScope.loading')}
              </Typography>
            ) : filteredItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {items.length === 0 ? t('tenantScope.noCompanyCodes') : t('tenantScope.noMatchFilter')}
              </Typography>
            ) : (
              filteredItems.map((item) => (
                <Box
                  key={item.bukrs}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        BUKRS {item.bukrs}
                      </Typography>
                      {item.source && (
                        <Label color="default" variant="soft" sx={{ fontSize: 10 }}>
                          {item.source === 'MANUAL'
                            ? t('tenantScope.sourceManual')
                            : item.source === 'SEED'
                              ? t('tenantScope.sourceSeed')
                              : item.source === 'SAP'
                                ? t('tenantScope.sourceSap')
                                : item.source}
                        </Label>
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {item.enabled ? t('tenantScope.includedInScope') : t('tenantScope.excluded')}
                    </Typography>
                  </Box>
                  <Switch
                    checked={item.enabled}
                    onChange={(_, checked) => handleToggle(item.bukrs, checked)}
                    disabled={patchMutation.isPending}
                  />
                </Box>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>

      <CatalogAddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('tenantScope.addCompanyCodes')}
        keyField="bukrs"
        items={catalogItems}
        existingKeys={existingKeys}
        onConfirm={handleAddConfirm}
        isLoading={catalogLoading}
        catalogError={catalogError ?? undefined}
      />
    </>
  );
};
