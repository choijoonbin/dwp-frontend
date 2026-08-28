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
  displayProviderFeatureValue,
  providerFeatureEvaluationResultMatches,
  providerFeatureEvaluationSelectionMatches,
  resolveProviderFeatureEvaluationOption,
} from './provider-feature-rollout-evaluation-model';
import { ProviderSectionHeading, providerError } from './provider-ui';

export function ProviderFeatureRolloutEvaluationPreview({
  flags,
  tenants,
}: {
  flags: ProviderFeatureFlag[];
  tenants: ProviderTenant[];
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
          <Alert severity="error">{providerError(evaluation.error, t('errors.operation'))}</Alert>
        )}
        {currentEvaluation && (
          <Alert severity={currentEvaluation.reasonCode === 'ROLLOUT_MATCH' ? 'success' : 'info'}>
            <Typography variant="subtitle2">
              {t(`featureRollouts.evaluation.reasons.${currentEvaluation.reasonCode}`)}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t('featureRollouts.evaluation.result', {
                tenant: currentEvaluation.tenantKey,
                value: displayProviderFeatureValue(currentEvaluation.value),
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
