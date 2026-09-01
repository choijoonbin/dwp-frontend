import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Building2, Eye, LayoutGrid, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTenantExperiencePreview } from '@dwp-frontend/shared-utils';
import {
  providerSupportContextFingerprint,
  useCurrentProviderSupportContext,
} from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { ActionButton, GuidedEmptyState } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ProviderLoading } from './provider-ui';
import { resolveTenantExperiencePreviewAccess } from './provider-diagnosis-policy';
import {
  isTenantExperiencePreviewFreshAtRender,
  TENANT_EXPERIENCE_PREVIEW_MAX_STALE_MS,
  tenantExperiencePreviewDeadline,
} from './provider-tenant-experience-preview-model';

import type { HomeCompositionPolicyPayload } from '@dwp-frontend/shared-utils';

export { TENANT_EXPERIENCE_PREVIEW_MAX_STALE_MS } from './provider-tenant-experience-preview-model';

const TENANT_EXPERIENCE_PREVIEW_REFRESH_MS = 8_000;

function configuredExperienceVariant(policy: HomeCompositionPolicyPayload): string {
  return 'experienceVariant' in policy ? policy.experienceVariant : 'CLASSIC';
}

function PreviewBlockedState({
  state,
  tenantId,
}: {
  state: 'no-session' | 'wrong-tenant' | 'expired' | 'scope-denied' | 'context-error';
  tenantId: string;
}) {
  const { t } = useTranslation('provider');
  const navigate = useNavigate();
  const startable = state === 'no-session' || state === 'expired';
  return (
    <GuidedEmptyState
      kind="permission"
      title={t(`tenantExperiencePreview.blocked.${state}.title`)}
      description={t(`tenantExperiencePreview.blocked.${state}.description`)}
      actionLabel={t(
        startable
          ? 'tenantExperiencePreview.actions.startDiagnosis'
          : 'tenantExperiencePreview.actions.manageSession'
      )}
      onAction={() =>
        navigate(
          startable
            ? `/provider/support?tenantId=${encodeURIComponent(tenantId)}`
            : '/provider/support'
        )
      }
      size="standard"
    />
  );
}

export function ProviderTenantExperiencePreview({ tenantId }: { tenantId: string }) {
  const { t, i18n } = useTranslation('provider');
  const navigate = useNavigate();
  const supportContext = useCurrentProviderSupportContext();
  const [now, setNow] = useState(() => Date.now());
  const [previewFreshnessNow, setPreviewFreshnessNow] = useState(() => Date.now());
  const access = resolveTenantExperiencePreviewAccess(
    supportContext.isError ? null : supportContext.rawData,
    tenantId,
    now
  );
  const preview = useQuery({
    queryKey: [
      'provider',
      'tenant-experience-preview',
      tenantId,
      access.state === 'allowed' ? providerSupportContextFingerprint(access.context) : 'blocked',
    ],
    queryFn: ({ signal }) => getTenantExperiencePreview(signal),
    enabled: access.state === 'allowed',
    meta: {
      accessSensitive: true,
      tenantId,
      supportSessionId: access.state === 'allowed' ? access.context.supportSessionId : undefined,
    },
    retry: false,
    staleTime: TENANT_EXPERIENCE_PREVIEW_MAX_STALE_MS,
    // Refresh ahead of the ten-second freshness boundary so transport and render
    // latency cannot extend a stale configuration beyond the accepted budget.
    refetchInterval: TENANT_EXPERIENCE_PREVIEW_REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const expiresAt = supportContext.rawData
      ? Date.parse(supportContext.rawData.expiresAt)
      : Number.NaN;
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(expiresAt - now + 50, 250), 60_000)
    );
    return () => window.clearTimeout(timer);
  }, [now, supportContext.rawData]);

  useEffect(() => {
    if (preview.dataUpdatedAt <= 0) return;
    const deadline = tenantExperiencePreviewDeadline(preview.dataUpdatedAt);
    const updateClock = () => setPreviewFreshnessNow((current) => Math.max(current, Date.now()));
    const expire = () =>
      setPreviewFreshnessNow((current) => Math.max(current, deadline, Date.now()));
    const timer = window.setTimeout(expire, Math.max(0, deadline - Date.now()));
    const updateVisibleClock = () => {
      if (document.visibilityState === 'visible') updateClock();
    };
    window.addEventListener('focus', updateClock);
    document.addEventListener('visibilitychange', updateVisibleClock);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', updateClock);
      document.removeEventListener('visibilitychange', updateVisibleClock);
    };
  }, [preview.dataUpdatedAt]);

  const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0] ?? 'en';
  const content = preview.data?.home.localizedContent?.[locale];
  const launchpadGroups = useMemo(
    () =>
      [...(preview.data?.home.launchpadConfiguration?.groups ?? [])]
        .filter((group) => group.enabled)
        .sort((left, right) => left.sortOrder - right.sortOrder),
    [preview.data?.home.launchpadConfiguration?.groups]
  );
  const previewIsFresh = isTenantExperiencePreviewFreshAtRender(
    preview.dataUpdatedAt,
    previewFreshnessNow
  );

  return (
    <Stack data-testid="provider-tenant-preview-canvas" gap={2.5} sx={{ width: 1, minWidth: 0 }}>
      <Box>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<ArrowLeft size={16} />}
          onClick={() => navigate(`/provider/tenants/${encodeURIComponent(tenantId)}`)}
          sx={{ mb: 1, color: 'inherit' }}
        >
          {t('tenantExperiencePreview.actions.back')}
        </ActionButton>
        <Stack direction="row" alignItems="flex-start" gap={1.25}>
          <Box
            aria-hidden="true"
            sx={{
              width: 38,
              height: 38,
              flex: '0 0 38px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1,
              color: 'primary.main',
              bgcolor: 'action.selected',
            }}
          >
            <Eye size={20} />
          </Box>
          <Box>
            <Typography component="h1" variant="h4">
              {t('tenantExperiencePreview.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {t('tenantExperiencePreview.description')}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {supportContext.isLoading ? (
        <ProviderLoading />
      ) : supportContext.isError ? (
        <PreviewBlockedState state="context-error" tenantId={tenantId} />
      ) : access.state !== 'allowed' ? (
        <PreviewBlockedState state={access.state} tenantId={tenantId} />
      ) : preview.isLoading ? (
        <ProviderLoading />
      ) : preview.isError || !preview.data || !previewIsFresh ? (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void preview.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          <Typography variant="subtitle2">
            {t('tenantExperiencePreview.partialFailure.title')}
          </Typography>
          <Typography variant="body2">
            {t('tenantExperiencePreview.partialFailure.description')}
          </Typography>
        </Alert>
      ) : (
        <Stack gap={2.5}>
          <Alert severity="info" icon={<ShieldCheck size={20} />}>
            <Typography variant="subtitle2">
              {t('tenantExperiencePreview.boundary.title')}
            </Typography>
            <Typography variant="body2">
              {t('tenantExperiencePreview.boundary.description')}
            </Typography>
          </Alert>

          <Paper
            component="section"
            variant="outlined"
            role="region"
            aria-label={t('tenantExperiencePreview.canvas.label')}
            sx={{ overflow: 'hidden' }}
          >
            <Box
              sx={{
                position: 'relative',
                minHeight: { xs: 260, md: 320 },
                p: { xs: 3, md: 5 },
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 4,
                bgcolor: preview.data.branding.accentColor,
                color: (theme) => theme.palette.getContrastText(preview.data.branding.accentColor),
              }}
            >
              <Box
                data-testid="tenant-configuration-preview-watermark"
                sx={{
                  alignSelf: 'flex-end',
                  width: { xs: 1, sm: 'fit-content' },
                  maxWidth: '100%',
                  p: 1,
                  borderRadius: 1,
                  bgcolor: 'rgba(8, 15, 28, 0.78)',
                  color: 'common.white',
                  border: '1px solid rgba(255, 255, 255, 0.42)',
                  overflowWrap: 'anywhere',
                }}
              >
                <Typography variant="caption" component="p" fontWeight={800}>
                  {t('tenantExperiencePreview.canvas.watermark')}
                </Typography>
                <Typography variant="caption" component="p">
                  {t('tenantExperiencePreview.canvas.traceTarget', {
                    tenantKey: access.context.tenantKey,
                    environmentKey: access.context.environmentKey ?? '—',
                  })}
                </Typography>
                <Typography variant="caption" component="p">
                  {t('tenantExperiencePreview.canvas.traceVersions', {
                    brandingVersion: preview.data.branding.version,
                    homeVersion: preview.data.home.version,
                  })}
                </Typography>
                <Typography variant="caption" component="p">
                  {t('tenantExperiencePreview.canvas.traceGeneratedAt', {
                    value: preview.data.generatedAt ?? '—',
                  })}
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center" gap={1.25}>
                <Building2 size={30} aria-hidden="true" />
                <Typography variant="subtitle1" fontWeight={750}>
                  {preview.data.branding.organizationName ?? access.context.tenantName}
                </Typography>
                {preview.data.branding.logoConfigured && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t('tenantExperiencePreview.canvas.logoRedacted')}
                    sx={{ color: 'inherit', borderColor: 'currentColor' }}
                  />
                )}
              </Stack>
              <Box sx={{ maxWidth: 720 }}>
                <Typography component="h2" variant="h3">
                  {content?.headline ??
                    preview.data.home.headline ??
                    t('tenantExperiencePreview.canvas.headlineFallback')}
                </Typography>
                <Typography variant="body1" sx={{ mt: 1, opacity: 0.9 }}>
                  {content?.subheadline ??
                    preview.data.home.subheadline ??
                    t('tenantExperiencePreview.canvas.subheadlineFallback')}
                </Typography>
              </Box>
            </Box>
          </Paper>

          <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <LayoutGrid size={18} aria-hidden="true" />
              <Typography component="h2" variant="h6">
                {t('tenantExperiencePreview.configuration.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('tenantExperiencePreview.configuration.description')}
            </Typography>
            <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.5 }}>
              <Chip
                size="small"
                label={t('tenantExperiencePreview.configuration.variant', {
                  value:
                    preview.data.home.effectiveExperienceVariant ??
                    configuredExperienceVariant(preview.data.home.compositionPolicy),
                })}
              />
              <Chip
                size="small"
                color="info"
                label={t('tenantExperiencePreview.configuration.mode', {
                  value: preview.data.previewMode,
                })}
              />
              <Chip
                size="small"
                variant="outlined"
                label={t('tenantExperiencePreview.configuration.personalization', {
                  value: preview.data.home.compositionPolicy?.personalCustomizationEnabled
                    ? t('tenantExperiencePreview.configuration.enabled')
                    : t('tenantExperiencePreview.configuration.disabled'),
                })}
              />
              <Chip
                size="small"
                variant="outlined"
                label={t('tenantExperiencePreview.configuration.version', {
                  value: preview.data.home.version,
                })}
              />
              <Chip
                size="small"
                variant="outlined"
                label={t('tenantExperiencePreview.configuration.assets', {
                  value: preview.data.home.backgroundConfigured
                    ? t('tenantExperiencePreview.configuration.redacted')
                    : t('tenantExperiencePreview.configuration.notConfigured'),
                })}
              />
              <Chip
                size="small"
                variant="outlined"
                label={t('tenantExperiencePreview.configuration.contract', {
                  value: preview.data.contractVersion,
                })}
              />
            </Stack>
            {launchpadGroups.length > 0 ? (
              <Box
                component="ul"
                sx={{
                  m: 0,
                  mt: 2,
                  p: 0,
                  listStyle: 'none',
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1,
                }}
              >
                {launchpadGroups.map((group) => (
                  <Box
                    component="li"
                    key={group.groupKey}
                    sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}
                  >
                    <Typography variant="subtitle2">
                      {group.labels[locale] ?? group.labels.en ?? group.groupKey}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('tenantExperiencePreview.configuration.apps', {
                        count: preview.data.home.launchpadConfiguration.placements.filter(
                          (placement) => placement.groupKey === group.groupKey
                        ).length,
                      })}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {t('tenantExperiencePreview.configuration.empty')}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              {t('tenantExperiencePreview.configuration.excluded', {
                values: preview.data.excludedData.join(', '),
              })}
            </Typography>
          </Paper>
        </Stack>
      )}
    </Stack>
  );
}
