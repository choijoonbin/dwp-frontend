import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

import type {
  ProviderResourceCommitment,
  ProviderResourceLedgerCommand,
  ProviderResourceLedgerEntry,
} from '@dwp-frontend/shared-utils';

import { providerResourceUnitLabel } from './provider-resource-presentation';

const LEDGER_TYPES = [
  'ALLOCATE',
  'RELEASE',
  'METER',
  'ADJUST',
  'BUDGET_RESERVE',
  'BUDGET_RELEASE',
  'BUDGET_SPEND',
] as const;

export function ProviderResourceLedgerDialog({
  commitment,
  busy,
  onClose,
  onSave,
}: {
  commitment: ProviderResourceCommitment;
  busy: boolean;
  onClose: () => void;
  onSave: (request: ProviderResourceLedgerCommand) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [entryType, setEntryType] = useState<ProviderResourceLedgerEntry['entryType']>('ALLOCATE');
  const [amount, setAmount] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('internal://');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isBudget = entryType.startsWith('BUDGET_');
  const save = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(t('resourceGovernance.validation.amount'));
      return;
    }
    if (!evidenceRef.trim() || !reason.trim()) {
      setError(t('resourceGovernance.validation.ledgerEvidence'));
      return;
    }
    if (isBudget && !commitment.currencyCode) {
      setError(t('resourceGovernance.validation.currency'));
      return;
    }
    try {
      const common = {
        amount: numericAmount,
        evidenceRef: evidenceRef.trim(),
        idempotencyKey: crypto.randomUUID(),
        reason: reason.trim(),
        occurredAt: new Date().toISOString(),
      };
      if (isBudget) {
        await onSave({
          ...common,
          entryType: entryType as 'BUDGET_RESERVE' | 'BUDGET_RELEASE' | 'BUDGET_SPEND',
          unit: 'CURRENCY_MINOR',
          currencyCode: commitment.currencyCode,
        });
      } else {
        await onSave({
          ...common,
          entryType: entryType as 'ALLOCATE' | 'RELEASE' | 'METER' | 'ADJUST',
          unit: commitment.unit,
          currencyCode: null,
        });
      }
    } catch {
      setError(t('errors.operation'));
    }
  };
  return (
    <FormDialog
      open
      title={t('resourceGovernance.ledgerTitle', { key: commitment.resourceKey })}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('resourceGovernance.recordEvidence')}
      busy={busy}
      submitDisabled={!amount || !evidenceRef.trim() || !reason.trim()}
      onClose={onClose}
      onSubmit={save}
    >
      <Stack gap={2}>
        <Alert severity="warning">{t('resourceGovernance.ledgerGuidance')}</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <SelectField
          label={t('resourceGovernance.fields.entryType')}
          value={entryType}
          options={LEDGER_TYPES.map((type) => ({
            value: type,
            label: t(`resourceGovernance.entryTypes.${type}`),
          }))}
          onValueChange={(value) => setEntryType(value as ProviderResourceLedgerEntry['entryType'])}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            required
            type="number"
            label={t('resourceGovernance.fields.amount')}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 'any' } }}
          />
          <FormField
            disabled
            label={t('resourceGovernance.fields.unit')}
            value={providerResourceUnitLabel(t, isBudget ? 'CURRENCY_MINOR' : commitment.unit)}
          />
          {isBudget && (
            <FormField
              disabled
              label={t('resourceGovernance.fields.currency')}
              value={commitment.currencyCode ?? ''}
            />
          )}
        </Stack>
        <FormField
          required
          label={t('resourceGovernance.fields.evidenceRef')}
          value={evidenceRef}
          onChange={(event) => setEvidenceRef(event.target.value)}
        />
        <FormField
          required
          multiline
          minRows={3}
          label={t('resourceGovernance.fields.reason')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}
