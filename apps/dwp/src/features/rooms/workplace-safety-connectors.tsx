import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PlugZap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  configureWorkplaceSafetyConnector,
  createWorkplaceIdempotencyKey,
  getWorkplaceSafetyConnectorCommand,
  resolveIdempotentMutationIntent,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  WorkplaceSafetyConnectorEvidence,
  WorkplaceSafetyReceiptEvidence,
} from './workplace-safety-evidence';

import type {
  IdempotentMutationIntent,
  WorkplaceSafetyConnectorCommandResult,
  WorkplaceSafetyConnectorKind,
  WorkplaceSafetyConnectorTruth,
} from '@dwp-frontend/shared-utils';

export function WorkplaceSafetyConnectors({
  connectors,
  canManage,
  onChanged,
}: {
  connectors: readonly WorkplaceSafetyConnectorTruth[];
  canManage: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const { t } = useTranslation('rooms');
  const [kind, setKind] = useState<WorkplaceSafetyConnectorKind>(
    connectors[0]?.kind ?? 'EMERGENCY_119'
  );
  const selected = connectors.find((connector) => connector.kind === kind) ?? null;
  const [providerCode, setProviderCode] = useState(selected?.providerCode ?? '');
  const [configurationVersion, setConfigurationVersion] = useState(
    String(Math.max(1, (selected?.configurationVersion ?? 0) + 1))
  );
  const [configured, setConfigured] = useState(selected?.state !== 'NOT_CONFIGURED');
  const [reason, setReason] = useState('Update the governed safety connector configuration');
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<WorkplaceSafetyConnectorCommandResult | null>(null);
  const intentRef = useRef<IdempotentMutationIntent | null>(null);

  useEffect(() => {
    setProviderCode(selected?.providerCode ?? '');
    setConfigurationVersion(String(Math.max(1, (selected?.configurationVersion ?? 0) + 1)));
    setConfigured(selected?.state !== 'NOT_CONFIGURED');
    setConfirmed(false);
    setResult(null);
  }, [selected]);

  const mutation = useMutation({
    mutationFn: () => {
      if (
        !selected ||
        !canManage ||
        !providerCode.trim() ||
        Number(configurationVersion) < 1 ||
        !reason.trim() ||
        !confirmed
      ) {
        throw new Error('SAFETY_CONNECTOR_BLOCKED');
      }
      const input = {
        kind,
        providerCode: providerCode.trim(),
        configurationVersion: Number(configurationVersion),
        expectedVersion: selected.version,
        configured,
        reason: reason.trim(),
        explicitConfirmation: true as const,
      };
      const intent = resolveIdempotentMutationIntent(intentRef.current, input, () =>
        createWorkplaceIdempotencyKey('safety-connector')
      );
      intentRef.current = intent;
      return configureWorkplaceSafetyConnector(input, {
        idempotencyKey: intent.key,
        correlationId: crypto.randomUUID(),
        activeAccessMode: 'ELEVATED',
      });
    },
    retry: false,
    onSuccess: async (next) => {
      intentRef.current = null;
      setResult(next);
      setConfirmed(false);
      await onChanged();
    },
  });

  const recheckMutation = useMutation({
    mutationFn: () => {
      if (!result || result.receipt.state !== 'RESULT_UNKNOWN') {
        throw new Error('SAFETY_CONNECTOR_RECHECK_BLOCKED');
      }
      return getWorkplaceSafetyConnectorCommand(result.receipt.commandId);
    },
    retry: false,
    onSuccess: async (receipt) => {
      setResult((current) => (current ? { ...current, receipt } : current));
      if (receipt.state !== 'RESULT_UNKNOWN') await onChanged();
    },
  });

  const getOnlyRecovery = result?.receipt.state === 'RESULT_UNKNOWN';

  return (
    <Stack spacing={1.5} data-testid="safety-connectors">
      <WorkplaceSafetyConnectorEvidence connectors={connectors} />
      <InlineFeedback severity="info">{t('workplace.safety.connectors.failClosed')}</InlineFeedback>
      <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
        {t('workplace.safety.connectors.configure')}
      </Typography>
      <SelectField
        label={t('workplace.safety.connectors.kind')}
        value={kind}
        options={connectors.map((connector) => ({
          value: connector.kind,
          label: t(`workplace.safety.connectorKinds.${connector.kind}`),
        }))}
        onValueChange={(value) => value && setKind(value)}
      />
      <FormField
        label={t('workplace.safety.connectors.providerCode')}
        value={providerCode}
        onChange={(event) => setProviderCode(event.target.value)}
      />
      <FormField
        label={t('workplace.safety.connectors.configurationVersion')}
        value={configurationVersion}
        onChange={(event) => setConfigurationVersion(event.target.value)}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={configured}
            onChange={(event) => setConfigured(event.target.checked)}
          />
        }
        label={t('workplace.safety.connectors.configured')}
      />
      <FormField
        label={t('workplace.safety.fields.reason')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <FormControlLabel
        control={
          <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        }
        label={t('workplace.safety.connectors.confirmation')}
      />
      <ActionButton
        intent="primary"
        startIcon={<PlugZap size={16} />}
        disabled={
          !canManage ||
          getOnlyRecovery ||
          !selected ||
          !providerCode.trim() ||
          Number(configurationVersion) < 1 ||
          !reason.trim() ||
          !confirmed
        }
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {t('workplace.safety.actions.configureConnector')}
      </ActionButton>
      {mutation.isError && (
        <InlineFeedback severity="error">
          {t('workplace.safety.connectors.configureError')}
        </InlineFeedback>
      )}
      {result && (
        <>
          <WorkplaceSafetyReceiptEvidence receipt={result.receipt} />
          <InlineFeedback severity={result.connector.state === 'READY' ? 'success' : 'warning'}>
            {t('workplace.safety.connectors.savedState', {
              state: t(`workplace.safety.connectorStates.${result.connector.state}`),
              version: result.connector.version,
            })}
          </InlineFeedback>
        </>
      )}
      {getOnlyRecovery && (
        <InlineFeedback severity="warning">
          {t('workplace.safety.recovery.getOnly')}
          <ActionButton
            intent="quiet"
            size="small"
            loading={recheckMutation.isPending}
            onClick={() => recheckMutation.mutate()}
          >
            {t('workplace.safety.actions.recheck')}
          </ActionButton>
        </InlineFeedback>
      )}
      {recheckMutation.isError && (
        <InlineFeedback severity="error">
          {t('workplace.safety.recovery.recheckError')}
        </InlineFeedback>
      )}
    </Stack>
  );
}
