import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gauge } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { evaluateProviderFeatureFlag } from '@dwp-frontend/shared-utils';
import { ActionButton, SelectField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ProviderFeatureFlag, ProviderTenant } from '@dwp-frontend/shared-utils';

import {
  providerFeatureEvaluationReason,
  providerFeatureEvaluationResultMatches,
  providerFeatureEvaluationSelectionMatches,
  providerFeatureValuePresentation,
  resolveProviderFeatureEvaluationOption,
} from './provider-feature-rollout-evaluation-model';
import { ProviderSectionHeading } from './provider-ui';

export function ProviderFeatureRolloutEvaluationPreview({
  flags,
  tenants,
  canReadEstate,
  tenantLoading,
  tenantError,
  tenantReady,
  onTenantRetry,
}: {
  flags: ProviderFeatureFlag[];
  tenants: ProviderTenant[];
  canReadEstate: boolean;
  tenantLoading: boolean;
  tenantError: unknown;
  tenantReady: boolean;
  onTenantRetry: () => void;
}) {
  const { t } = useTranslation('provider');
  const [featureKey, setFeatureKey] = useState(flags[0]?.featureKey ?? '');
  const [tenantId, setTenantId] = useState(tenants[0]?.tenantId ?? '');
  const effectiveFeatureKey = resolveProviderFeatureEvaluationOption(
    featureKey,
    flags.map((flag) => flag.featureKey)
  );
  const effectiveTenantId = resolveProviderFeatureEvaluationOption(
    tenantId,
    tenants.map((tenant) => tenant.tenantId)
  );
  const evaluation = useMutation({
    mutationFn: (selection: { featureKey: string; tenantId: string }) =>
      evaluateProviderFeatureFlag(selection.featureKey, selection.tenantId),
  });
  const mutationMatchesSelection = providerFeatureEvaluationSelectionMatches(
    evaluation.variables,
    effectiveFeatureKey,
    effectiveTenantId
  );
  const currentEvaluation = providerFeatureEvaluationResultMatches(
    evaluation.data,
    effectiveFeatureKey,
    effectiveTenantId
  )
    ? evaluation.data
    : undefined;
  const currentValue = providerFeatureValuePresentation(currentEvaluation?.value);
  const changeFeature = (next: string) => {
    evaluation.reset();
    setFeatureKey(next);
  };
  const changeTenant = (next: string) => {
    evaluation.reset();
    setTenantId(next);
  };

  return (
    <Paper component="section" variant="outlined" sx={{ p: 2 }}>
      <ProviderSectionHeading
        title={t('featureRollouts.evaluation.title')}
        description={t('featureRollouts.evaluation.description')}
      />
      <Stack gap={1.5} sx={{ mt: 2 }}>
        {!canReadEstate && (
          <Alert severity="warning">{t('featureRollouts.evaluation.tenantDenied')}</Alert>
        )}
        {canReadEstate && tenantLoading && (
          <Alert severity="info">{t('featureRollouts.evaluation.tenantLoading')}</Alert>
        )}
        {canReadEstate && Boolean(tenantError) && (
          <Alert
            severity="error"
            action={
              <ActionButton intent="quiet" size="small" onClick={onTenantRetry}>
                {t('actions.retryLoad')}
              </ActionButton>
            }
          >
            {t('featureRollouts.evaluation.tenantError')}
          </Alert>
        )}
        {canReadEstate && tenantReady && tenants.length === 0 && (
          <Alert severity="info">{t('featureRollouts.evaluation.tenantEmpty')}</Alert>
        )}
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5}>
          <SelectField
            label={t('featureRollouts.fields.feature')}
            value={effectiveFeatureKey}
            options={flags.map((flag) => ({
              value: flag.featureKey,
              label: flag.displayName,
            }))}
            onValueChange={changeFeature}
          />
          <SelectField
            label={t('featureRollouts.fields.tenant')}
            value={effectiveTenantId}
            options={tenants.map((tenant) => ({
              value: tenant.tenantId,
              label: `${tenant.displayName} · ${tenant.tenantKey}`,
            }))}
            onValueChange={changeTenant}
            disabled={!canReadEstate || !tenantReady || tenants.length === 0}
          />
          <ActionButton
            intent="secondary"
            startIcon={<Gauge size={16} />}
            loading={evaluation.isPending && mutationMatchesSelection}
            disabled={!effectiveFeatureKey || !effectiveTenantId}
            onClick={() =>
              evaluation.mutate({
                featureKey: effectiveFeatureKey,
                tenantId: effectiveTenantId,
              })
            }
            sx={{ flexShrink: 0 }}
          >
            {t('featureRollouts.evaluation.action')}
          </ActionButton>
        </Stack>
        {evaluation.isError && mutationMatchesSelection && (
          <Alert severity="error">{t('errors.operation')}</Alert>
        )}
        {currentEvaluation && (
          <Alert severity={currentEvaluation.reasonCode === 'ROLLOUT_MATCH' ? 'success' : 'info'}>
            <Typography variant="subtitle2">
              {t(
                `featureRollouts.evaluation.reasons.${providerFeatureEvaluationReason(currentEvaluation.reasonCode)}`
              )}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t('featureRollouts.evaluation.result', {
                tenant: currentEvaluation.tenantKey,
                value:
                  currentValue.kind === 'scalar'
                    ? currentValue.value
                    : currentValue.kind === 'collection'
                      ? t('featureRollouts.evaluation.collectionValue', {
                          type: t(
                            `featureRollouts.evaluation.collectionTypes.${currentValue.collection}`
                          ),
                          count: currentValue.count,
                        })
                      : t('notAvailable'),
                bucket: currentEvaluation.deterministicBucket,
                exposure: currentEvaluation.exposurePercentage,
              })}
            </Typography>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
