import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Braces, EyeOff, GitCompareArrows, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import {
  getProviderEffectiveSetting,
  listProviderSettings,
} from '@dwp-frontend/shared-utils/api/provider-settings-api';
import {
  ActionButton,
  EmptyState,
  InlineFeedback,
  LoadingState,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ProviderTenant } from '@dwp-frontend/shared-utils';

import { formatProviderDate, providerError, ProviderSectionHeading } from './provider-ui';
import {
  displayProviderSettingValue,
  providerSettingManagementPath,
  providerSettingStateTone,
  resolveProviderSettingTenantTarget,
} from './provider-settings-resolution-model';
import { ProviderTenantPicker } from './provider-tenant-picker';

function errorStatus(error: unknown): number | undefined {
  return error instanceof Error && 'status' in error && typeof error.status === 'number'
    ? error.status
    : undefined;
}

function DetailBlock({
  label,
  state,
  version,
  children,
}: {
  label: string;
  state: React.ReactNode;
  version: string;
  children?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 'shape.borderRadius',
        minWidth: 0,
        p: 1.5,
      }}
    >
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ mt: 0.5 }}>{state}</Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {version}
      </Typography>
      {children}
    </Box>
  );
}

export function ProviderSettingsResolution({
  tenants,
  canReadEstate,
  tenantLoading,
  tenantError,
  onTenantRetry,
}: {
  tenants: ProviderTenant[];
  canReadEstate: boolean;
  tenantLoading: boolean;
  tenantError: unknown;
  onTenantRetry: () => void;
}) {
  const { t } = useTranslation('provider');
  const [selectedSettingId, setSelectedSettingId] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<ProviderTenant | null>(null);
  const catalog = useQuery({
    queryKey: ['provider', 'settings', 'catalog', 'TENANT'],
    queryFn: ({ signal }) => listProviderSettings({ scopeType: 'TENANT' }, signal),
  });
  const effectiveSettingId = catalog.data?.some(
    (setting) => setting.settingId === selectedSettingId
  )
    ? selectedSettingId
    : (catalog.data?.[0]?.settingId ?? '');
  const effectiveTenant = resolveProviderSettingTenantTarget(
    selectedTenantId,
    selectedTenant,
    tenants
  );
  const effectiveTenantId = effectiveTenant?.tenantId ?? '';
  const resolution = useQuery({
    queryKey: [
      'provider',
      'settings',
      'effective',
      effectiveSettingId,
      effectiveTenantId,
      effectiveTenant?.environmentKey,
    ],
    queryFn: ({ signal }) => {
      if (!effectiveSettingId || !effectiveTenant) {
        throw new Error('Provider setting target is unavailable');
      }
      return getProviderEffectiveSetting(
        effectiveSettingId,
        {
          scopeType: 'TENANT',
          scopeId: effectiveTenant.tenantId,
          environment: effectiveTenant.environmentKey,
        },
        signal
      );
    },
    enabled: Boolean(effectiveSettingId && effectiveTenant),
  });
  const definition =
    resolution.data?.definition ??
    catalog.data?.find((setting) => setting.settingId === effectiveSettingId);
  const applicationStatus = resolution.data?.applicationStatus;
  const managementPath = definition
    ? providerSettingManagementPath(definition.owner.managementPath)
    : null;
  const catalogDenied = errorStatus(catalog.error) === 403;

  return (
    <Paper component="section" variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <ProviderSectionHeading
        title={t('settingsResolution.title')}
        description={t('settingsResolution.description')}
        action={
          <Chip
            size="small"
            variant="outlined"
            icon={<GitCompareArrows size={14} aria-hidden="true" />}
            label={t('settingsResolution.journey')}
          />
        }
      />

      {catalog.isLoading && !catalog.data && (
        <Box sx={{ mt: 2 }}>
          <LoadingState
            label={t('settingsResolution.catalog.loading')}
            variant="skeleton"
            skeletonRows={1}
            skeletonHeight={4}
            embedded
            size="compact"
          />
        </Box>
      )}
      {catalog.error && !catalog.data && (
        <InlineFeedback
          severity={catalogDenied ? 'warning' : 'error'}
          sx={{ mt: 2 }}
          action={
            catalogDenied ? undefined : (
              <ActionButton
                intent="quiet"
                size="small"
                loading={catalog.isFetching}
                startIcon={<RefreshCw size={15} aria-hidden="true" />}
                onClick={() => void catalog.refetch()}
              >
                {t('actions.retryLoad')}
              </ActionButton>
            )
          }
        >
          {catalogDenied
            ? t('settingsResolution.catalog.denied')
            : providerError(catalog.error, t('settingsResolution.catalog.error'))}
        </InlineFeedback>
      )}
      {catalog.error && catalog.data && (
        <InlineFeedback severity="warning" sx={{ mt: 2 }}>
          {t('settingsResolution.catalog.stale')}
        </InlineFeedback>
      )}
      {catalog.data && catalog.data.length === 0 && (
        <Box sx={{ mt: 2 }}>
          <EmptyState
            title={t('settingsResolution.catalog.emptyTitle')}
            description={t('settingsResolution.catalog.emptyDescription')}
          />
        </Box>
      )}

      {catalog.data && catalog.data.length > 0 && (
        <Stack gap={2} sx={{ mt: 2 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
              gap: 1.5,
            }}
          >
            <SelectField
              label={t('settingsResolution.fields.setting')}
              value={effectiveSettingId}
              options={catalog.data.map((setting) => ({
                value: setting.settingId,
                label: setting.displayName,
              }))}
              onValueChange={(value) => setSelectedSettingId(String(value))}
            />
            <ProviderTenantPicker
              label={t('settingsResolution.fields.tenant')}
              value={effectiveTenantId}
              disabled={!canReadEstate || tenantLoading || tenants.length === 0}
              initialOptions={tenants}
              supportingText={t('settingsResolution.tenant.searchHelp')}
              loadingText={t('settingsResolution.tenant.searchLoading')}
              emptyText={t('settingsResolution.tenant.searchEmpty')}
              errorText={t('settingsResolution.tenant.searchError')}
              onChange={setSelectedTenantId}
              onTenantChange={setSelectedTenant}
            />
          </Box>

          {!canReadEstate && (
            <InlineFeedback severity="warning">
              {t('settingsResolution.tenant.denied')}
            </InlineFeedback>
          )}
          {canReadEstate && tenantLoading && (
            <LoadingState
              label={t('settingsResolution.tenant.loading')}
              variant="skeleton"
              skeletonRows={1}
              skeletonHeight={4}
              embedded
              size="compact"
            />
          )}
          {canReadEstate && Boolean(tenantError) && (
            <InlineFeedback
              severity={errorStatus(tenantError) === 403 ? 'warning' : 'error'}
              action={
                errorStatus(tenantError) === 403 ? undefined : (
                  <ActionButton intent="quiet" size="small" onClick={onTenantRetry}>
                    {t('actions.retryLoad')}
                  </ActionButton>
                )
              }
            >
              {errorStatus(tenantError) === 403
                ? t('settingsResolution.tenant.denied')
                : providerError(tenantError, t('settingsResolution.tenant.error'))}
            </InlineFeedback>
          )}
          {canReadEstate && !tenantLoading && !tenantError && tenants.length === 0 && (
            <InlineFeedback severity="info">{t('settingsResolution.tenant.empty')}</InlineFeedback>
          )}

          {definition && (
            <Box>
              <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
                <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
                  {definition.displayName}
                </Typography>
                <Chip size="small" variant="outlined" label={definition.owner.service} />
                <Chip size="small" variant="outlined" label={definition.validation.valueType} />
                <Chip size="small" variant="outlined" label={definition.change.riskTier} />
                <Chip
                  size="small"
                  variant="outlined"
                  label={t(`settingsResolution.lifecycle.${definition.lifecycleState}`)}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {definition.description}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.75 }}
              >
                {t('settingsResolution.definitionMeta', {
                  id: definition.settingId,
                  version: definition.definitionVersion,
                  workflow: definition.change.workflow,
                })}
              </Typography>
            </Box>
          )}

          {resolution.isFetching && !resolution.data && effectiveTenantId && (
            <LoadingState
              label={t('settingsResolution.effective.loading')}
              variant="skeleton"
              skeletonRows={1}
              skeletonHeight={4}
              embedded
              size="compact"
            />
          )}
          {resolution.error && (
            <InlineFeedback
              severity={errorStatus(resolution.error) === 403 ? 'warning' : 'error'}
              action={
                errorStatus(resolution.error) === 403 ? undefined : (
                  <ActionButton
                    intent="quiet"
                    size="small"
                    loading={resolution.isFetching}
                    onClick={() => void resolution.refetch()}
                  >
                    {t('actions.retryLoad')}
                  </ActionButton>
                )
              }
            >
              {errorStatus(resolution.error) === 403
                ? t('settingsResolution.effective.denied')
                : providerError(resolution.error, t('settingsResolution.effective.error'))}
            </InlineFeedback>
          )}

          {resolution.data && (
            <>
              {resolution.data.resolutionState !== 'RESOLVED' && (
                <InlineFeedback
                  severity={resolution.data.resolutionState === 'REDACTED' ? 'info' : 'warning'}
                  icon={
                    resolution.data.resolutionState === 'REDACTED' ? (
                      <EyeOff size={20} aria-hidden="true" />
                    ) : undefined
                  }
                >
                  {t(`settingsResolution.resolution.${resolution.data.resolutionState}`, {
                    reason: resolution.data.reasonCode,
                  })}
                </InlineFeedback>
              )}
              {applicationStatus?.state === 'OBSERVATION_UNSUPPORTED' && (
                <InlineFeedback severity="info">
                  {t('settingsResolution.observationUnsupported')}
                </InlineFeedback>
              )}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                  gap: 1.25,
                }}
              >
                <DetailBlock
                  label={t('settingsResolution.stages.desired')}
                  state={
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(
                        `settingsResolution.desiredStates.${applicationStatus?.desiredState ?? 'NONE'}`
                      )}
                    />
                  }
                  version={t('settingsResolution.version', {
                    value: applicationStatus?.desiredVersion ?? t('notAvailable'),
                  })}
                >
                  {applicationStatus?.publishAcceptedAt && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 1 }}
                    >
                      {t('settingsResolution.publishAcceptedAt', {
                        value: formatProviderDate(applicationStatus.publishAcceptedAt),
                      })}
                    </Typography>
                  )}
                </DetailBlock>
                <DetailBlock
                  label={t('settingsResolution.stages.effective')}
                  state={
                    <Chip
                      size="small"
                      variant="outlined"
                      color={resolution.data.resolutionState === 'RESOLVED' ? 'success' : 'warning'}
                      label={t(
                        `settingsResolution.resolutionStates.${resolution.data.resolutionState}`
                      )}
                    />
                  }
                  version={t('settingsResolution.version', {
                    value: resolution.data.effectiveVersion ?? t('notAvailable'),
                  })}
                >
                  {resolution.data.resolutionState === 'RESOLVED' && (
                    <Typography
                      component="pre"
                      variant="body2"
                      sx={{ m: 0, mt: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                    >
                      {displayProviderSettingValue(resolution.data.effectiveValue)}
                    </Typography>
                  )}
                </DetailBlock>
                <DetailBlock
                  label={t('settingsResolution.stages.applied')}
                  state={
                    applicationStatus ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        color={providerSettingStateTone(applicationStatus.state)}
                        label={t(`settingsResolution.applicationStates.${applicationStatus.state}`)}
                      />
                    ) : (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t('settingsResolution.applicationStates.NOT_CONFIGURED')}
                      />
                    )
                  }
                  version={t('settingsResolution.observedVersion', {
                    value: applicationStatus?.uniformlyObservedVersion ?? t('notAvailable'),
                  })}
                >
                  {applicationStatus && applicationStatus.expectedTargetCount > 0 && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 1 }}
                    >
                      {t('settingsResolution.observationCounts', {
                        observed: applicationStatus.observedTargetCount,
                        expected: applicationStatus.expectedTargetCount,
                        converged: applicationStatus.convergedTargetCount,
                        failed: applicationStatus.failedTargetCount,
                        drifted: applicationStatus.driftedTargetCount,
                      })}
                    </Typography>
                  )}
                </DetailBlock>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                  {t('settingsResolution.resolvedAt', {
                    resolvedAt: formatProviderDate(resolution.data.resolvedAt),
                    observedAt: formatProviderDate(applicationStatus?.latestObservationAt),
                  })}
                </Typography>
                {managementPath && (
                  <ActionButton
                    component={NavLink}
                    to={managementPath}
                    intent="secondary"
                    size="small"
                    endIcon={<ArrowUpRight size={15} aria-hidden="true" />}
                  >
                    {t('settingsResolution.openOwner')}
                  </ActionButton>
                )}
              </Stack>

              <Divider />
              <Box>
                <Typography component="h3" variant="subtitle2">
                  {t('settingsResolution.provenance.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {t('settingsResolution.provenance.description')}
                </Typography>
                {resolution.data.provenance.length ? (
                  <Stack gap={1} sx={{ mt: 1.25 }}>
                    {resolution.data.provenance.map((entry) => (
                      <Box
                        key={`${entry.precedence}:${entry.sourceType}:${entry.sourceId}:${entry.version}`}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'auto minmax(0, 1fr) auto' },
                          gap: 1,
                          alignItems: 'center',
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 'shape.borderRadius',
                          p: 1.25,
                        }}
                      >
                        <Chip
                          size="small"
                          variant="outlined"
                          icon={<Braces size={13} aria-hidden="true" />}
                          label={`${entry.precedence} · ${entry.sourceType}`}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight="fontWeightBold" noWrap>
                            {entry.sourceId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {entry.decisionCode}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('settingsResolution.provenance.version', {
                            version: entry.version,
                            date: formatProviderDate(entry.decidedAt),
                          })}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {t('settingsResolution.provenance.empty')}
                  </Typography>
                )}
              </Box>
            </>
          )}
        </Stack>
      )}
    </Paper>
  );
}
