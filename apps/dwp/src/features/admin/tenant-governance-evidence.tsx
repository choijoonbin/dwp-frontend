import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleAlert, RotateCcw, ShieldCheck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyTenantPreferredLocale,
  getTenantGovernanceSnapshot,
  restoreMyTenantPreferredLocale,
  useToast,
  type TenantEffectiveSetting,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { ActionButton, FormDialog } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { TenantProviderDomainEvidence } from './tenant-owner-projection-evidence';
import {
  effectiveSettingLineageLabelKey,
  effectiveSettingSourceLabelKey,
  effectiveSettingValuePresentation,
  isKnownEffectiveSetting,
} from './tenant-governance-evidence-model';

const snapshotKey = ['admin', 'tenant-settings', 'governance-snapshot'] as const;
const preferenceKey = ['account', 'tenant-settings', 'preferred-locale'] as const;

function evidenceColor(state: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (state === 'OBSERVED' || state === 'READY') return 'success';
  if (state === 'BLOCKED') return 'error';
  if (state === 'UNAVAILABLE' || state.includes('ATTENTION')) return 'warning';
  return state.includes('READY') ? 'info' : 'default';
}

export function TenantGovernanceEvidence() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const snapshot = useQuery({
    queryKey: snapshotKey,
    queryFn: getTenantGovernanceSnapshot,
    retry: false,
  });
  const preference = useQuery({
    queryKey: preferenceKey,
    queryFn: getMyTenantPreferredLocale,
    retry: false,
  });

  if (snapshot.isLoading) {
    return (
      <Typography color="text.secondary">
        {t('settingsHome.overview.governance.loading')}
      </Typography>
    );
  }
  if (snapshot.isError || !snapshot.data) {
    return <Alert severity="warning">{t('settingsHome.overview.governance.loadError')}</Alert>;
  }

  const data = snapshot.data;
  const restoreAvailable = Boolean(preference.data?.preferredLocale);
  const restore = async () => {
    if (!preference.data) return;
    setBusy(true);
    try {
      await restoreMyTenantPreferredLocale(preference.data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: snapshotKey }),
        queryClient.invalidateQueries({ queryKey: preferenceKey }),
      ]);
      setRestoreOpen(false);
      toast.success(t('settingsHome.overview.governance.restore.completed'));
    } catch {
      toast.error(t('settingsHome.overview.governance.restore.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box component="section" aria-labelledby="tenant-governance-evidence-title">
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Box>
          <Typography id="tenant-governance-evidence-title" component="h2" variant="h6">
            {t('settingsHome.overview.governance.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('settingsHome.overview.governance.description', {
              observedAt: formatDate(data.observedAt, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </Typography>
        </Box>
        {restoreAvailable && (
          <ActionButton
            intent="secondary"
            startIcon={<RotateCcw size={16} />}
            onClick={() => setRestoreOpen(true)}
          >
            {t('settingsHome.overview.governance.restore.action')}
          </ActionButton>
        )}
      </Stack>

      <Box
        sx={{
          mt: 1.25,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.25,
        }}
      >
        <EvidenceCard
          title={t('settingsHome.overview.governance.directory.title')}
          state={data.tenantDirectory.state}
          rows={[
            [
              t('settingsHome.overview.governance.directory.tenant'),
              data.tenantDirectory.tenantName,
            ],
            [t('settingsHome.overview.governance.directory.code'), data.tenantDirectory.tenantCode],
            [
              t('settingsHome.overview.governance.directory.locale'),
              data.tenantDirectory.defaultLocale,
            ],
          ]}
        />
        <EvidenceCard
          title={t('settingsHome.overview.governance.login.title')}
          state={data.loginVerification.internalPrerequisiteState}
          rows={[
            [
              t('settingsHome.overview.governance.login.provider'),
              data.loginVerification.configuredProviderKey || '—',
            ],
            [
              t('settingsHome.overview.governance.login.externalProbe'),
              t(
                `settingsHome.overview.governance.states.${data.loginVerification.externalProbeState}`,
                { defaultValue: t('settingsHome.overview.governance.states.UNKNOWN') }
              ),
            ],
            [
              t('settingsHome.overview.governance.login.blocks'),
              data.loginVerification.blockingReasons
                .map((reason) =>
                  t(`settingsHome.overview.governance.reasons.${reason}`, {
                    defaultValue: t('settingsHome.overview.governance.reasons.UNKNOWN'),
                  })
                )
                .join(', ') || '—',
            ],
          ]}
        />
        <EvidenceCard
          title={t('settingsHome.overview.governance.recovery.title')}
          state={data.recoveryVerification.state}
          rows={[
            [
              t('settingsHome.overview.governance.recovery.total'),
              String(data.recoveryVerification.total),
            ],
            [
              t('settingsHome.overview.governance.recovery.verified'),
              String(data.recoveryVerification.verified),
            ],
            [
              t('settingsHome.overview.governance.recovery.overdue'),
              String(data.recoveryVerification.overdue),
            ],
          ]}
        />
      </Box>

      <TenantProviderDomainEvidence />

      {data.loginVerification.externalProbeState === 'UNAVAILABLE' && (
        <Alert severity="warning" icon={<CircleAlert size={19} />} sx={{ mt: 1.25 }}>
          {t('settingsHome.overview.governance.externalBoundary')}
        </Alert>
      )}

      <Typography component="h3" variant="subtitle1" sx={{ mt: 2 }}>
        {t('settingsHome.overview.governance.effective.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('settingsHome.overview.governance.effective.description')}
      </Typography>
      <Stack sx={{ mt: 1.25, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        {data.effectiveSettings.map((setting, index) => (
          <EffectiveSettingRow key={setting.settingKey} setting={setting} divider={index > 0} />
        ))}
      </Stack>

      <FormDialog
        open={restoreOpen}
        title={t('settingsHome.overview.governance.restore.title')}
        description={t('settingsHome.overview.governance.restore.description')}
        cancelLabel={t('common.actions.cancel')}
        submitLabel={t('settingsHome.overview.governance.restore.confirm')}
        busy={busy}
        onClose={() => setRestoreOpen(false)}
        onSubmit={restore}
      >
        <Alert severity="info">
          {t('settingsHome.overview.governance.restore.preview', {
            before: preference.data?.preferredLocale,
            after: preference.data?.tenantDefaultLocale,
            version: preference.data?.version,
          })}
        </Alert>
      </FormDialog>
    </Box>
  );
}

function EvidenceCard({
  title,
  state,
  rows,
}: {
  title: string;
  state: string;
  rows: Array<readonly [string, string]>;
}) {
  const { t } = useTranslation('admin');
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
      <Stack direction="row" justifyContent="space-between" gap={1}>
        <Typography component="h3" variant="subtitle2">
          {title}
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          color={evidenceColor(state)}
          label={t(`settingsHome.overview.governance.states.${state}`, {
            defaultValue: t('settingsHome.overview.governance.states.UNKNOWN'),
          })}
        />
      </Stack>
      <Stack component="dl" gap={0.75} sx={{ m: 0, mt: 1.25 }}>
        {rows.map(([label, value]) => (
          <Stack key={label} direction="row" justifyContent="space-between" gap={2}>
            <Typography component="dt" variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" variant="body2" textAlign="right" sx={{ m: 0 }}>
              {value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function EffectiveSettingRow({
  setting,
  divider,
}: {
  setting: TenantEffectiveSetting;
  divider: boolean;
}) {
  const { t } = useTranslation('admin');
  const knownSetting = isKnownEffectiveSetting(setting.settingKey);
  const displayValue = (value: unknown): string => {
    const presentation = effectiveSettingValuePresentation(setting.settingKey, value);
    return t(presentation.labelKey, { count: presentation.count });
  };
  return (
    <Box sx={{ p: 2 }}>
      {divider && <Divider sx={{ mb: 2 }} />}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Typography component="h4" variant="subtitle2">
              {knownSetting
                ? t(`settingsHome.overview.governance.effective.settings.${setting.settingKey}`)
                : t('settingsHome.overview.governance.effective.unknownSetting')}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              icon={setting.evidenceState === 'OBSERVED' ? <CheckCircle2 size={14} /> : undefined}
              label={t(`settingsHome.overview.governance.states.${setting.evidenceState}`, {
                defaultValue: t('settingsHome.overview.governance.states.UNKNOWN'),
              })}
            />
          </Stack>
          <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>
            {displayValue(setting.effectiveValue)}
          </Typography>
        </Box>
        <Stack direction="row" gap={0.5} flexWrap="wrap">
          <Chip size="small" label={t(effectiveSettingSourceLabelKey(setting.effectiveSource))} />
          <Chip
            size="small"
            variant="outlined"
            icon={setting.locked ? <ShieldCheck size={14} /> : undefined}
            label={
              setting.locked
                ? t('settingsHome.overview.governance.effective.locked')
                : t('settingsHome.overview.governance.effective.overrideAllowed')
            }
          />
        </Stack>
      </Stack>
      <Stack gap={0.5} sx={{ mt: 1.25 }}>
        {setting.sources.map((source) => (
          <Stack
            key={`${setting.settingKey}:${source.level}`}
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            gap={0.5}
            sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}
          >
            <Typography variant="caption">
              {t(effectiveSettingLineageLabelKey(source.level), {
                value: displayValue(source.value),
              })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t(`settingsHome.overview.governance.effective.evaluations.${source.evaluation}`, {
                defaultValue: t('settingsHome.overview.governance.effective.evaluations.UNKNOWN'),
              })}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
