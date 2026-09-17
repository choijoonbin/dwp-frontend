import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

import type { EmergencyAccessPrincipal } from '@dwp-frontend/shared-utils';

type VerificationMethod = 'OPERATOR_ATTESTED' | 'RECOVERY_DRILL_COMPLETED';

export function RecoveryAccountVerificationDialog({
  principal,
  busy,
  onClose,
  onSubmit,
}: Readonly<{
  principal: EmergencyAccessPrincipal | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (request: {
    method: VerificationMethod;
    evidenceReference: string;
    nextVerificationDueAt: string;
  }) => Promise<void>;
}>) {
  const { t } = useTranslation('admin');
  const [method, setMethod] = useState<VerificationMethod>('RECOVERY_DRILL_COMPLETED');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [nextVerificationDueAt, setNextVerificationDueAt] = useState('');

  useEffect(() => {
    if (!principal) return;
    setMethod('RECOVERY_DRILL_COMPLETED');
    setEvidenceReference('');
    const nextDue = new Date();
    nextDue.setUTCDate(nextDue.getUTCDate() + 90);
    setNextVerificationDueAt(nextDue.toISOString().slice(0, 16));
  }, [principal]);

  return (
    <FormDialog
      open={Boolean(principal)}
      title={t('privilegedAccess.verification.title')}
      description={t('privilegedAccess.verification.description', {
        name: principal?.displayName ?? '',
      })}
      cancelLabel={t('common.cancel')}
      submitLabel={t('privilegedAccess.verification.submit')}
      busy={busy}
      submitDisabled={evidenceReference.trim().length < 10 || !nextVerificationDueAt}
      onClose={onClose}
      onSubmit={() =>
        onSubmit({
          method,
          evidenceReference: evidenceReference.trim(),
          nextVerificationDueAt: new Date(nextVerificationDueAt).toISOString(),
        })
      }
    >
      <Stack gap={2}>
        <Alert severity="info">{t('privilegedAccess.verification.boundary')}</Alert>
        <SelectField
          label={t('privilegedAccess.verification.method')}
          value={method}
          options={(['RECOVERY_DRILL_COMPLETED', 'OPERATOR_ATTESTED'] as const).map((value) => ({
            value,
            label: t(`privilegedAccess.verification.methods.${value}`),
          }))}
          onValueChange={(value) => setMethod(value as VerificationMethod)}
        />
        <FormField
          required
          multiline
          minRows={3}
          label={t('privilegedAccess.verification.evidence')}
          value={evidenceReference}
          onChange={(event) => setEvidenceReference(event.target.value)}
          supportingText={t('privilegedAccess.verification.evidenceHelp')}
        />
        <FormField
          required
          type="datetime-local"
          label={t('privilegedAccess.verification.nextDue')}
          value={nextVerificationDueAt}
          onChange={(event) => setNextVerificationDueAt(event.target.value)}
          slotProps={{ htmlInput: { min: new Date().toISOString().slice(0, 16) } }}
        />
      </Stack>
    </FormDialog>
  );
}
