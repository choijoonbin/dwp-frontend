import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, RotateCcw, ShieldCheck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getManagedTenantEffectiveSettings,
  getMyTenantPreferredLocale,
  restoreMyTenantPreferredLocale,
  useToast,
  type ManagedTenantEffectiveSetting,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormDialog, GuidedEmptyState } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  managedEffectiveFreshness,
  managedEffectiveSourceLabelKey,
  managedOverrideState,
  managedOwnerLabelKey,
} from './account-settings-state-presentation';

const effectiveSettingsKey = ['account', 'tenant-settings', 'effective-settings'] as const;
const preferredLocaleKey = ['account', 'tenant-settings', 'preferred-locale'] as const;
const provenanceReasonKeys: Record<string, string> = {
  PUBLISHED_AUTH_POLICY: 'managed.effective.lineageReasons.PUBLISHED_AUTH_POLICY',
  DIRECT_OWNER_BASELINE: 'managed.effective.lineageReasons.DIRECT_OWNER_BASELINE',
  PUBLISHED_TENANT_OVERRIDE: 'managed.effective.lineageReasons.PUBLISHED_TENANT_OVERRIDE',
  PUBLISHED_INHERIT_RESTORE: 'managed.effective.lineageReasons.PUBLISHED_INHERIT_RESTORE',
  OWNER_CHANGED_OUTSIDE_WORKFLOW: 'managed.effective.lineageReasons.OWNER_CHANGED_OUTSIDE_WORKFLOW',
  OWNER_CHANGED_OUTSIDE_REGISTRY: 'managed.effective.lineageReasons.OWNER_CHANGED_OUTSIDE_REGISTRY',
};

export function ManagedEffectiveSettings() {
  const { t } = useTranslation('account');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const effectiveSettings = useQuery({
    queryKey: effectiveSettingsKey,
    queryFn: getManagedTenantEffectiveSettings,
    retry: false,
  });
  const preference = useQuery({
    queryKey: preferredLocaleKey,
    queryFn: getMyTenantPreferredLocale,
    retry: false,
  });

  const restoreLocaleInheritance = async () => {
    if (!preference.data) return;
    setRestoreBusy(true);
    try {
      await restoreMyTenantPreferredLocale(preference.data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: effectiveSettingsKey }),
        queryClient.invalidateQueries({ queryKey: preferredLocaleKey }),
        queryClient.invalidateQueries({
          queryKey: ['admin', 'tenant-settings', 'governance-snapshot'],
        }),
      ]);
      setRestoreOpen(false);
      toast.success(t('managed.effective.restore.completed'));
    } catch {
      toast.error(t('managed.effective.restore.failed'));
    } finally {
      setRestoreBusy(false);
    }
  };

  return (
    <Box
      component="section"
      aria-labelledby="managed-effective-settings-title"
      data-testid="managed-effective-settings"
      sx={{ mt: 4 }}
    >
      <Typography id="managed-effective-settings-title" component="h2" variant="h6">
        {t('managed.effective.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t('managed.effective.description')}
      </Typography>

      {effectiveSettings.isLoading ? (
        <Stack gap={1} sx={{ mt: 1.5 }}>
          <Skeleton variant="rounded" height={108} />
          <Skeleton variant="rounded" height={108} />
        </Stack>
      ) : effectiveSettings.isError ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {t('managed.effective.loadError')}
        </Alert>
      ) : (effectiveSettings.data?.length ?? 0) === 0 ? (
        <Box sx={{ mt: 1.5 }}>
          <GuidedEmptyState
            kind="empty"
            title={t('managed.effective.emptyTitle')}
            description={t('managed.effective.emptyDescription')}
          />
        </Box>
      ) : (
        <Stack sx={{ mt: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          {(effectiveSettings.data ?? []).map((setting, index) => (
            <ManagedEffectiveSettingRow
              key={setting.settingKey}
              setting={setting}
              divider={index > 0}
            />
          ))}
        </Stack>
      )}

      {preference.isLoading ? (
        <Skeleton
          variant="rounded"
          height={72}
          aria-label={t('managed.effective.preferenceLoading')}
          sx={{ mt: 1.5 }}
        />
      ) : preference.isError ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {t('managed.effective.preferenceLoadError')}
        </Alert>
      ) : preference.data ? (
        <Alert
          severity={preference.data.preferredLocale ? 'info' : 'success'}
          action={
            preference.data.preferredLocale ? (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<RotateCcw size={15} />}
                onClick={() => setRestoreOpen(true)}
              >
                {t('managed.effective.restore.action')}
              </ActionButton>
            ) : undefined
          }
          sx={{ mt: 1.5 }}
        >
          {preference.data.preferredLocale
            ? t('managed.effective.localeOverride', {
                current: preference.data.preferredLocale,
                inherited: preference.data.tenantDefaultLocale,
              })
            : t('managed.effective.localeInherited', {
                inherited: preference.data.tenantDefaultLocale,
              })}
        </Alert>
      ) : null}

      <FormDialog
        open={restoreOpen}
        title={t('managed.effective.restore.title')}
        description={t('managed.effective.restore.description')}
        cancelLabel={t('managed.effective.restore.cancel')}
        submitLabel={t('managed.effective.restore.confirm')}
        busy={restoreBusy}
        onClose={() => setRestoreOpen(false)}
        onSubmit={restoreLocaleInheritance}
      >
        <Alert severity="info">
          {t('managed.effective.restore.preview', {
            before: preference.data?.preferredLocale,
            after: preference.data?.tenantDefaultLocale,
            version: preference.data?.version,
          })}
        </Alert>
      </FormDialog>
    </Box>
  );
}

function ManagedEffectiveSettingRow({
  setting,
  divider,
}: {
  setting: ManagedTenantEffectiveSetting;
  divider: boolean;
}) {
  const { t } = useTranslation('account');
  const knownSetting = [
    'authentication.defaultLoginType',
    'authentication.requireMfa',
    'authentication.tokenTtlSec',
    'identity.defaultLocale',
  ].includes(setting.settingKey);
  const title = knownSetting
    ? t(`managed.effective.settings.${setting.settingKey}.title`)
    : t('managed.effective.settings.unknown.title');
  const displayValue = (value: unknown): string => {
    if (!knownSetting) return t('managed.effective.settings.unknown.value');
    if (setting.settingKey === 'authentication.requireMfa') {
      return value === true
        ? t('managed.effective.values.required')
        : t('managed.effective.values.optional');
    }
    if (setting.settingKey === 'authentication.defaultLoginType') {
      return value === 'LOCAL' || value === 'SSO'
        ? t(`managed.effective.values.login.${value}`)
        : t('managed.effective.settings.unknown.value');
    }
    if (setting.settingKey === 'authentication.tokenTtlSec') {
      return typeof value === 'number'
        ? t('managed.effective.values.minutes', { count: Math.round(value / 60) })
        : t('managed.effective.settings.unknown.value');
    }
    return typeof value === 'string' ? value : t('managed.effective.settings.unknown.value');
  };
  const freshness = managedEffectiveFreshness(setting.freshnessState);
  return (
    <Box sx={{ p: 2 }}>
      {divider && <Divider sx={{ mb: 2 }} />}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
            <Typography component="h3" variant="subtitle2">
              {title}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              color={freshness === 'FRESH' ? 'default' : 'warning'}
              icon={<CheckCircle2 size={14} />}
              label={t(
                freshness === 'FRESH'
                  ? 'managed.effective.evidence.observed'
                  : freshness === 'DRIFTED'
                    ? 'managed.effective.evidence.drifted'
                    : 'managed.effective.evidence.unavailable'
              )}
            />
          </Stack>
          <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>
            {displayValue(setting.effectiveValue)}
          </Typography>
        </Box>
        <Stack direction="row" gap={0.5} flexWrap="wrap">
          <Chip size="small" label={t(managedEffectiveSourceLabelKey(setting.effectiveSource))} />
          <Chip
            size="small"
            variant="outlined"
            icon={<ShieldCheck size={14} />}
            label={t(
              `managed.effective.overrideState.${managedOverrideState(setting.overrideState)}`
            )}
          />
        </Stack>
      </Stack>
      <Stack gap={0.5} sx={{ mt: 1.25 }}>
        {setting.provenance.map((source) => (
          <Stack
            key={`${setting.settingKey}:${source.level}:${source.localizedOwnerLabelKey}`}
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            gap={0.5}
            sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}
          >
            <Typography variant="caption">
              {t('managed.effective.lineage.owner', {
                owner: t(managedOwnerLabelKey(source.localizedOwnerLabelKey)),
                version: source.ownerVersion,
              })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t(provenanceReasonKeys[source.reason] ?? 'managed.effective.lineageReasons.UNKNOWN')}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
