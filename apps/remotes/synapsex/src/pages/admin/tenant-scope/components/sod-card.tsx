import type { UseMutationResult } from '@tanstack/react-query';

import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';
import { showToast, type TenantScopeSodRule } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';

type PatchSodRuleMutation = UseMutationResult<
  unknown,
  Error,
  {
    currentItems: { ruleKey: string; enabled: boolean; severity?: 'INFO' | 'WARN' | 'BLOCK' }[];
    enabled?: boolean;
    ruleKey: string;
    severity?: 'INFO' | 'WARN' | 'BLOCK';
  },
  unknown
>;

type SodCardProps = {
  items: TenantScopeSodRule[];
  isLoading?: boolean;
  patchMutation: PatchSodRuleMutation;
  refetch: () => void;
  sodMode?: 'PLANNED' | 'BASELINE' | 'ENFORCED';
};

export const SodCard = ({ items, isLoading, patchMutation, refetch, sodMode }: SodCardProps) => {
  const { t } = useTranslation('common');

  const toCurrentItems = () =>
    items.map((i) => ({
      enabled: i.enabled,
      ruleKey: i.ruleKey,
      severity: i.severity ?? 'WARN',
    }));

  const handleToggle = async (ruleKey: string, enabled: boolean) => {
    patchMutation.mutate(
      {
        currentItems: toCurrentItems(),
        enabled,
        ruleKey,
      },
      {
        onSuccess: () => {
          showToast(t('toast.saved'));
          refetch();
        },
        onError: (err: Error) => {
          showToast(err instanceof Error ? err.message : t('toast.failedToUpdate'), 'error');
        },
      }
    );
  };

  const handleSeverityChange = (ruleKey: string, severity: 'INFO' | 'WARN' | 'BLOCK') => {
    patchMutation.mutate(
      {
        currentItems: toCurrentItems(),
        ruleKey,
        severity,
      },
      {
        onSuccess: () => {
          showToast(t('toast.saved'));
          refetch();
        },
        onError: (err: Error) => {
          showToast(err instanceof Error ? err.message : t('toast.failedToUpdate'), 'error');
        },
      }
    );
  };

  return (
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Iconify icon="solar:shield-check-bold-duotone" width={18} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('tenantScope.segregationOfDuties')}
            </Typography>
          </Stack>
        }
        subheader={t('tenantScope.sodSubheader')}
        action={
          sodMode && (
            <Label
              variant="soft"
              color={sodMode === 'ENFORCED' ? 'success' : sodMode === 'BASELINE' ? 'warning' : 'default'}
            >
              {sodMode}
            </Label>
          )
        }
        sx={{ pb: 2 }}
      />
      <CardContent>
        <Stack spacing={1.5}>
          {isLoading ? (
            <Typography variant="body2" color="text.secondary">
              {t('tenantScope.loading')}
            </Typography>
          ) : items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('tenantScope.noSodRules')}
            </Typography>
          ) : (
            items.map((item) => (
              <Box
                key={item.ruleKey}
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
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {item.description ?? item.ruleKey}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <InputLabel>{t('tenantScope.severity')}</InputLabel>
                    <Select
                      value={item.severity ?? 'WARN'}
                      label={t('tenantScope.severity')}
                      onChange={(e) =>
                        handleSeverityChange(item.ruleKey, e.target.value as 'INFO' | 'WARN' | 'BLOCK')
                      }
                      disabled={patchMutation.isPending || !item.enabled}
                    >
                      {[
                        { value: 'INFO' as const, key: 'severityInfo' },
                        { value: 'WARN' as const, key: 'severityWarn' },
                        { value: 'BLOCK' as const, key: 'severityBlock' },
                      ].map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {t(`tenantScope.${o.key}`)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Switch
                    checked={item.enabled}
                    onChange={(_, checked) => handleToggle(item.ruleKey, checked)}
                    disabled={patchMutation.isPending}
                  />
                </Stack>
              </Box>
            ))
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
