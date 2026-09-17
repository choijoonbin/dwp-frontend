import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';

import { useDwaionAdminAdvancementCopy } from './dwaion-admin-advancement-copy';

export type DwaionIncidentOperationDraft =
  | {
      operation: 'INCIDENT_CONTAIN';
      isolationScopes: string;
      fallbackRoute: string;
      inFlightAction: 'PAUSE' | 'CANCEL' | 'COMPLETE_SAFE';
      correlationId: string;
      ownerRef: string;
    }
  | { operation: 'RUN_QUARANTINE'; runIds: string; quarantineReason: string }
  | {
      operation: 'RUN_REPLAY';
      sourceRunIds: string;
      checkpointRef: string;
      inputPolicy: string;
      idempotencyScope: string;
    }
  | {
      operation: 'RUN_COMPENSATE';
      targetRunIds: string;
      domainAction: string;
      compensationPolicy: string;
      ownerRef: string;
    }
  | {
      operation: 'INCIDENT_RECOVERY';
      validationEvidence: string;
      canaryPercent: string;
      canaryMinutes: string;
      reQuarantineCriteria: string;
    }
  | {
      operation: 'INCIDENT_CLOSE';
      falsePositive: 'NO' | 'YES';
      ticketRef: string;
      communicationsRef: string;
      postmortemRef: string;
      resolutionSummary: string;
    };

export function DwaionIncidentOperationDialog({
  value,
  onChange,
  onClose,
  onSubmit,
  title,
}: {
  value: DwaionIncidentOperationDraft | null;
  onChange: (value: DwaionIncidentOperationDraft | null) => void;
  onClose: () => void;
  onSubmit: () => void;
  title: string;
}) {
  const copy = useDwaionAdminAdvancementCopy();
  if (!value) return null;
  return (
    <FormDialog
      open
      title={title}
      description={copy.ui.incidents.operationDescription}
      cancelLabel="Cancel"
      submitLabel="Review operation"
      submitDisabled={!validDraft(value)}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Stack spacing={1.5}>{fields(value, onChange, copy.ui.incidents)}</Stack>
    </FormDialog>
  );
}

function fields(
  value: DwaionIncidentOperationDraft,
  onChange: (value: DwaionIncidentOperationDraft | null) => void,
  copy: ReturnType<typeof useDwaionAdminAdvancementCopy>['ui']['incidents']
) {
  if (value.operation === 'INCIDENT_CONTAIN') {
    return (
      <>
        <FormField
          required
          multiline
          minRows={2}
          label={copy.isolationScope}
          value={value.isolationScopes}
          onChange={(event) => onChange({ ...value, isolationScopes: event.target.value })}
        />
        <FormField
          required
          label={copy.verifiedFallbackRoute}
          value={value.fallbackRoute}
          onChange={(event) => onChange({ ...value, fallbackRoute: event.target.value })}
        />
        <SelectField
          label={copy.inFlightHandling}
          value={value.inFlightAction}
          options={(['PAUSE', 'CANCEL', 'COMPLETE_SAFE'] as const).map((item) => ({
            value: item,
            label: item,
          }))}
          onValueChange={(inFlightAction) =>
            inFlightAction && onChange({ ...value, inFlightAction })
          }
        />
        <FormField label={copy.correlationId} value={value.correlationId} disabled />
        <FormField
          required
          label={copy.owner}
          value={value.ownerRef}
          onChange={(event) => onChange({ ...value, ownerRef: event.target.value })}
        />
      </>
    );
  }
  if (value.operation === 'RUN_QUARANTINE') {
    return (
      <>
        <FormField
          required
          multiline
          minRows={2}
          label={copy.runIdsSelector}
          value={value.runIds}
          onChange={(event) => onChange({ ...value, runIds: event.target.value })}
        />
        <FormField
          required
          multiline
          minRows={2}
          label={copy.quarantineReason}
          value={value.quarantineReason}
          onChange={(event) => onChange({ ...value, quarantineReason: event.target.value })}
        />
      </>
    );
  }
  if (value.operation === 'RUN_REPLAY') {
    return (
      <>
        <FormField
          required
          label={copy.sourceRunIds}
          value={value.sourceRunIds}
          onChange={(event) => onChange({ ...value, sourceRunIds: event.target.value })}
        />
        <FormField
          required
          label={copy.verifiedCheckpoint}
          value={value.checkpointRef}
          onChange={(event) => onChange({ ...value, checkpointRef: event.target.value })}
        />
        <FormField
          required
          label={copy.inputReusePolicy}
          value={value.inputPolicy}
          onChange={(event) => onChange({ ...value, inputPolicy: event.target.value })}
        />
        <FormField
          required
          label={copy.idempotencyScope}
          value={value.idempotencyScope}
          onChange={(event) => onChange({ ...value, idempotencyScope: event.target.value })}
        />
      </>
    );
  }
  if (value.operation === 'RUN_COMPENSATE') {
    return (
      <>
        <FormField
          required
          label={copy.targetRunIds}
          value={value.targetRunIds}
          onChange={(event) => onChange({ ...value, targetRunIds: event.target.value })}
        />
        <FormField
          required
          label={copy.domainAction}
          value={value.domainAction}
          onChange={(event) => onChange({ ...value, domainAction: event.target.value })}
        />
        <FormField
          required
          multiline
          minRows={2}
          label={copy.compensationPolicy}
          value={value.compensationPolicy}
          onChange={(event) => onChange({ ...value, compensationPolicy: event.target.value })}
        />
        <FormField
          required
          label={copy.compensationOwner}
          value={value.ownerRef}
          onChange={(event) => onChange({ ...value, ownerRef: event.target.value })}
        />
      </>
    );
  }
  if (value.operation === 'INCIDENT_RECOVERY') {
    return (
      <>
        <FormField
          required
          multiline
          minRows={3}
          label={copy.validationEvidence}
          value={value.validationEvidence}
          onChange={(event) => onChange({ ...value, validationEvidence: event.target.value })}
        />
        <FormField
          required
          type="number"
          label={copy.canaryTrafficPercent}
          value={value.canaryPercent}
          onChange={(event) => onChange({ ...value, canaryPercent: event.target.value })}
        />
        <FormField
          required
          type="number"
          label={copy.validationMinutes}
          value={value.canaryMinutes}
          onChange={(event) => onChange({ ...value, canaryMinutes: event.target.value })}
        />
        <FormField
          required
          multiline
          minRows={2}
          label={copy.automaticRequarantineCriteria}
          value={value.reQuarantineCriteria}
          onChange={(event) => onChange({ ...value, reQuarantineCriteria: event.target.value })}
        />
      </>
    );
  }
  return (
    <>
      <SelectField
        label={copy.falsePositive}
        value={value.falsePositive}
        options={[
          { value: 'NO', label: 'No' },
          { value: 'YES', label: 'Yes' },
        ]}
        onValueChange={(falsePositive) => falsePositive && onChange({ ...value, falsePositive })}
      />
      <FormField
        required
        label={copy.incidentTicket}
        value={value.ticketRef}
        onChange={(event) => onChange({ ...value, ticketRef: event.target.value })}
      />
      <FormField
        required
        label={copy.communicationsEvidence}
        value={value.communicationsRef}
        onChange={(event) => onChange({ ...value, communicationsRef: event.target.value })}
      />
      <FormField
        required
        label={copy.postmortemReference}
        value={value.postmortemRef}
        onChange={(event) => onChange({ ...value, postmortemRef: event.target.value })}
      />
      <FormField
        required
        multiline
        minRows={3}
        label={copy.resolutionSummary}
        value={value.resolutionSummary}
        onChange={(event) => onChange({ ...value, resolutionSummary: event.target.value })}
      />
    </>
  );
}

function validDraft(value: DwaionIncidentOperationDraft) {
  if (value.operation === 'INCIDENT_CONTAIN') {
    return Boolean(
      value.isolationScopes.trim() && value.fallbackRoute.trim() && value.ownerRef.trim()
    );
  }
  if (value.operation === 'RUN_QUARANTINE') {
    return Boolean(value.runIds.trim() && value.quarantineReason.trim());
  }
  if (value.operation === 'RUN_REPLAY') {
    return Boolean(
      value.sourceRunIds.trim() &&
      value.checkpointRef.trim() &&
      value.inputPolicy.trim() &&
      value.idempotencyScope.trim()
    );
  }
  if (value.operation === 'RUN_COMPENSATE') {
    return Boolean(
      value.targetRunIds.trim() &&
      value.domainAction.trim() &&
      value.compensationPolicy.trim() &&
      value.ownerRef.trim()
    );
  }
  if (value.operation === 'INCIDENT_RECOVERY') {
    const percent = Number(value.canaryPercent);
    const minutes = Number(value.canaryMinutes);
    return Boolean(
      value.validationEvidence.trim() &&
      value.reQuarantineCriteria.trim() &&
      Number.isFinite(percent) &&
      percent > 0 &&
      percent <= 100 &&
      Number.isFinite(minutes) &&
      minutes > 0
    );
  }
  return Boolean(
    value.ticketRef.trim() &&
    value.communicationsRef.trim() &&
    value.postmortemRef.trim() &&
    value.resolutionSummary.trim()
  );
}
