import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';
import {
  addDwaionOperationalGateEvidence,
  configureDwaionOperationalGate,
  decideDwaionOperationalGate,
  getDwaionOperationalGate,
  toDwaionOperationalGateProblem,
  validateDwaionOperationalGate,
  type DwaionGateEnvironment,
  type DwaionGateEvidenceType,
  type DwaionOperationalGate,
  useAuth,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionGateReview } from './dwaion-gate-review';
import { gateOptionLabel, gateTitle } from './dwaion-gate-ui';

export type GateDialogKind = 'REVIEW' | 'CONFIGURE' | 'EVIDENCE' | 'VALIDATE' | 'DECIDE';
export type GateDialogAction = { kind: GateDialogKind; gate: DwaionOperationalGate } | null;

type Props = {
  action: GateDialogAction;
  environment: DwaionGateEnvironment;
  onClose: () => void;
  onCompleted: () => void;
};

const EVIDENCE_TYPES: DwaionGateEvidenceType[] = [
  'CONFIGURATION_REFERENCE',
  'TEST_RESULT',
  'SECURITY_REVIEW',
  'LEGAL_APPROVAL',
  'BUSINESS_APPROVAL',
  'RUNBOOK',
  'OTHER',
];

export function DwaionGateDialogHost({ action, environment, onClose, onCompleted }: Props) {
  const { t } = useTranslation('work');
  const auth = useAuth();
  const queryClient = useQueryClient();
  const gate = action?.gate;
  const [selectedOption, setSelectedOption] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [configurationRef, setConfigurationRef] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceType, setEvidenceType] = useState<DwaionGateEvidenceType>('TEST_RESULT');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [validationOutcome, setValidationOutcome] = useState<'PASS' | 'FAIL'>('PASS');
  const [validationSummary, setValidationSummary] = useState('');
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [validDays, setValidDays] = useState('365');
  const [changeReason, setChangeReason] = useState('');

  useEffect(() => {
    if (!gate) return;
    setSelectedOption(
      gate.selectedOption ?? gate.options.find((item) => item.recommended)?.code ?? ''
    );
    setOwnerUserId(gate.ownerUserId ?? String(auth.user?.userId ?? ''));
    setConfigurationRef(gate.configurationRef ?? '');
    setNotes(gate.notes ?? '');
    setEvidenceType(gate.requiredEvidenceTypes[0] ?? 'TEST_RESULT');
    setEvidenceTitle('');
    setEvidenceReference('');
    setValidationOutcome('PASS');
    setValidationSummary(gate.validationSummary ?? '');
    setDecision('APPROVE');
    setValidDays('365');
    setChangeReason('');
  }, [action, auth.user?.userId, gate]);

  const detailQuery = useQuery({
    queryKey: ['dwaion', 'admin', 'gates', environment, gate?.gateKey],
    queryFn: () => getDwaionOperationalGate(gate!.gateKey, environment),
    enabled: Boolean(gate && action?.kind !== 'CONFIGURE'),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!action) throw new Error('Operational gate action is not selected.');
      const current = action.gate;
      const expectedVersion = detailQuery.data?.gate.policyVersion ?? current.policyVersion;
      if (action.kind === 'CONFIGURE') {
        return configureDwaionOperationalGate(current.gateKey, environment, {
          selectedOption,
          ownerUserId: ownerUserId.trim(),
          configurationRef: configurationRef.trim() || undefined,
          notes: notes.trim() || undefined,
          expectedVersion,
          changeReason: changeReason.trim(),
        });
      }
      if (action.kind === 'EVIDENCE') {
        return addDwaionOperationalGateEvidence(current.gateKey, environment, {
          evidenceType,
          title: evidenceTitle.trim(),
          reference: evidenceReference.trim(),
          expectedVersion,
          changeReason: changeReason.trim(),
        });
      }
      if (action.kind === 'VALIDATE') {
        return validateDwaionOperationalGate(current.gateKey, environment, {
          outcome: validationOutcome,
          validationSummary: validationSummary.trim(),
          expectedVersion,
          changeReason: changeReason.trim(),
        });
      }
      if (action.kind !== 'DECIDE') {
        throw new Error('Read-only gate review cannot submit a mutation.');
      }
      return decideDwaionOperationalGate(current.gateKey, environment, {
        decision,
        validDays: Math.max(1, Math.min(Number(validDays) || 365, 730)),
        expectedVersion,
        changeReason: changeReason.trim(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dwaion', 'admin', 'gates'] });
      onCompleted();
      onClose();
    },
  });

  const optionItems = useMemo(
    () =>
      (gate?.options ?? []).map((option) => ({
        value: option.code,
        label: `${gateOptionLabel(t, gate!.gateKey, option.code)}${
          option.recommended ? ` · ${t('dwaionAdmin.gates.recommended')}` : ''
        }`,
      })),
    [gate, t]
  );
  const evidenceItems = EVIDENCE_TYPES.map((value) => ({
    value,
    label: t(`dwaionAdmin.gates.evidenceTypes.${value}`),
  }));
  const approvalEligible = detailQuery.data?.approvalEligibility.eligible ?? false;
  const invalid =
    !gate ||
    (action?.kind !== 'REVIEW' && changeReason.trim().length < 10) ||
    (action?.kind === 'CONFIGURE' && (!selectedOption || !ownerUserId.trim())) ||
    (action?.kind === 'EVIDENCE' &&
      (evidenceTitle.trim().length < 2 || evidenceReference.trim().length < 3)) ||
    (action?.kind === 'VALIDATE' && validationSummary.trim().length < 10) ||
    (action?.kind === 'DECIDE' && !approvalEligible);
  const problem = mutation.isError ? toDwaionOperationalGateProblem(mutation.error) : null;

  return (
    <FormDialog
      open={Boolean(action)}
      title={action ? t(`dwaionAdmin.gates.dialogs.${action.kind}.title`) : ''}
      description={gate ? gateTitle(t, gate.gateKey) : undefined}
      cancelLabel={
        action?.kind === 'REVIEW'
          ? t('dwaionAdmin.gates.review.close')
          : t('dwaionAdmin.shared.cancel')
      }
      submitLabel={
        action && action.kind !== 'REVIEW'
          ? t(`dwaionAdmin.gates.dialogs.${action.kind}.submit`)
          : ''
      }
      submittingLabel={t('dwaionAdmin.shared.saving')}
      busy={mutation.isPending}
      submitDisabled={invalid}
      showSubmit={action?.kind !== 'REVIEW'}
      onClose={onClose}
      onSubmit={() => mutation.mutate()}
      maxWidth={action?.kind === 'REVIEW' || action?.kind === 'DECIDE' ? 'md' : 'sm'}
    >
      <Stack spacing={2.25}>
        {problem && (
          <Alert severity="error">
            {t(`dwaionAdmin.gates.errors.${problem.code}`, {
              defaultValue: t('dwaionAdmin.gates.error'),
            })}
            {problem.correlationId ? ` (${problem.correlationId})` : ''}
          </Alert>
        )}
        {gate && (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              size="small"
              variant="outlined"
              label={t(`dwaionAdmin.gates.environments.${environment}`)}
            />
            {gate.requiredEvidenceTypes.map((item) => (
              <Chip
                key={item}
                size="small"
                variant="outlined"
                label={t(`dwaionAdmin.gates.evidenceTypes.${item}`)}
              />
            ))}
          </Stack>
        )}
        {action && ['REVIEW', 'VALIDATE', 'DECIDE'].includes(action.kind) && (
          <DwaionGateReview
            detail={detailQuery.data}
            loading={detailQuery.isLoading}
            error={detailQuery.isError}
          />
        )}
        {action?.kind === 'CONFIGURE' && (
          <>
            <SelectField<string>
              label={t('dwaionAdmin.gates.fields.option')}
              value={selectedOption}
              options={optionItems}
              onValueChange={(value) => value && setSelectedOption(value)}
            />
            <FormField
              label={t('dwaionAdmin.gates.fields.owner')}
              value={ownerUserId}
              onChange={(event) => setOwnerUserId(event.target.value)}
              supportingText={t('dwaionAdmin.gates.fields.ownerHelp')}
            />
            <FormField
              label={t('dwaionAdmin.gates.fields.configurationRef')}
              value={configurationRef}
              onChange={(event) => setConfigurationRef(event.target.value)}
              supportingText={t('dwaionAdmin.gates.fields.configurationRefHelp')}
            />
            <FormField
              label={t('dwaionAdmin.gates.fields.notes')}
              value={notes}
              multiline
              minRows={3}
              onChange={(event) => setNotes(event.target.value)}
            />
          </>
        )}
        {action?.kind === 'EVIDENCE' && (
          <>
            {action.gate.status === 'READY_FOR_APPROVAL' && (
              <Alert severity="info">{t('dwaionAdmin.gates.evidenceChangeNotice')}</Alert>
            )}
            <SelectField<DwaionGateEvidenceType>
              label={t('dwaionAdmin.gates.fields.evidenceType')}
              value={evidenceType}
              options={evidenceItems}
              onValueChange={(value) => value && setEvidenceType(value)}
            />
            <FormField
              label={t('dwaionAdmin.gates.fields.evidenceTitle')}
              value={evidenceTitle}
              onChange={(event) => setEvidenceTitle(event.target.value)}
            />
            <FormField
              label={t('dwaionAdmin.gates.fields.evidenceReference')}
              value={evidenceReference}
              onChange={(event) => setEvidenceReference(event.target.value)}
              supportingText={t('dwaionAdmin.gates.fields.evidenceReferenceHelp')}
            />
          </>
        )}
        {action?.kind === 'VALIDATE' && (
          <>
            <SelectField<'PASS' | 'FAIL'>
              label={t('dwaionAdmin.gates.fields.validationOutcome')}
              value={validationOutcome}
              options={[
                { value: 'PASS', label: t('dwaionAdmin.gates.validation.PASS') },
                { value: 'FAIL', label: t('dwaionAdmin.gates.validation.FAIL') },
              ]}
              onValueChange={(value) => value && setValidationOutcome(value)}
            />
            <FormField
              label={t('dwaionAdmin.gates.fields.validationSummary')}
              value={validationSummary}
              multiline
              minRows={4}
              onChange={(event) => setValidationSummary(event.target.value)}
            />
          </>
        )}
        {action?.kind === 'DECIDE' && (
          <>
            <SelectField<'APPROVE' | 'REJECT'>
              label={t('dwaionAdmin.gates.fields.decision')}
              value={decision}
              options={[
                { value: 'APPROVE', label: t('dwaionAdmin.gates.decisions.APPROVE') },
                { value: 'REJECT', label: t('dwaionAdmin.gates.decisions.REJECT') },
              ]}
              onValueChange={(value) => value && setDecision(value)}
            />
            {decision === 'APPROVE' && (
              <FormField
                label={t('dwaionAdmin.gates.fields.validDays')}
                type="number"
                value={validDays}
                inputProps={{ min: 1, max: 730 }}
                onChange={(event) => setValidDays(event.target.value)}
              />
            )}
          </>
        )}
        {action?.kind === 'EVIDENCE' && (
          <DwaionGateReview
            detail={detailQuery.data}
            loading={detailQuery.isLoading}
            error={detailQuery.isError}
          />
        )}
        {action?.kind !== 'REVIEW' && (
          <>
            <FormField
              label={t('dwaionAdmin.shared.reason')}
              value={changeReason}
              multiline
              minRows={3}
              onChange={(event) => setChangeReason(event.target.value)}
              errorMessage={
                changeReason && changeReason.trim().length < 10
                  ? t('dwaionAdmin.shared.reasonError')
                  : undefined
              }
            />
            <Typography variant="caption" color="text.secondary">
              {t('dwaionAdmin.gates.secretBoundary')}
            </Typography>
          </>
        )}
      </Stack>
    </FormDialog>
  );
}
