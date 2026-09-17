import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';

export type DwaionEmergencyOperationDraft =
  | {
      mode: 'STOP';
      affectedScope: string;
      providerModelScope: string;
      fallbackRoute: string;
      inFlightPolicy: 'DRAIN' | 'MIGRATE' | 'CANCEL';
    }
  | {
      mode: 'RECOVER';
      validationEvidence: string;
      canaryPercent: string;
      canaryMinutes: string;
      failureThreshold: string;
      reStopCriteria: string;
    };

export function DwaionEmergencyOperationDialog({
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  value: DwaionEmergencyOperationDraft | null;
  onChange: (value: DwaionEmergencyOperationDraft | null) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!value) return null;
  const valid = validDraft(value);
  return (
    <FormDialog
      open
      title={value.mode === 'STOP' ? 'Emergency traffic stop' : 'Emergency service recovery'}
      description={
        value.mode === 'STOP'
          ? 'Define the exact blast radius, verified fallback, and in-flight handling before approval.'
          : 'Attach validation evidence and a bounded canary with automatic re-stop criteria.'
      }
      cancelLabel="Cancel"
      submitLabel="Review governed command"
      submitDisabled={!valid}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Stack spacing={1.5}>
        {value.mode === 'STOP' ? (
          <>
            <FormField
              required
              label="Affected route or Agent scope"
              value={value.affectedScope}
              onChange={(event) => onChange({ ...value, affectedScope: event.target.value })}
            />
            <FormField
              required
              multiline
              minRows={2}
              label="Provider and model scope"
              value={value.providerModelScope}
              onChange={(event) => onChange({ ...value, providerModelScope: event.target.value })}
            />
            <FormField
              required
              label="Verified fallback route"
              value={value.fallbackRoute}
              onChange={(event) => onChange({ ...value, fallbackRoute: event.target.value })}
            />
            <SelectField
              label="In-flight jobs"
              value={value.inFlightPolicy}
              options={(['DRAIN', 'MIGRATE', 'CANCEL'] as const).map((policy) => ({
                value: policy,
                label: policy,
              }))}
              onValueChange={(inFlightPolicy) =>
                inFlightPolicy && onChange({ ...value, inFlightPolicy })
              }
            />
          </>
        ) : (
          <>
            <FormField
              required
              multiline
              minRows={3}
              label="Validation evidence references"
              value={value.validationEvidence}
              onChange={(event) => onChange({ ...value, validationEvidence: event.target.value })}
            />
            <FormField
              required
              type="number"
              label="Canary traffic percent"
              value={value.canaryPercent}
              onChange={(event) => onChange({ ...value, canaryPercent: event.target.value })}
            />
            <FormField
              required
              type="number"
              label="Validation minutes"
              value={value.canaryMinutes}
              onChange={(event) => onChange({ ...value, canaryMinutes: event.target.value })}
            />
            <FormField
              required
              label="Failure threshold"
              value={value.failureThreshold}
              onChange={(event) => onChange({ ...value, failureThreshold: event.target.value })}
            />
            <FormField
              required
              multiline
              minRows={2}
              label="Automatic re-stop criteria"
              value={value.reStopCriteria}
              onChange={(event) => onChange({ ...value, reStopCriteria: event.target.value })}
            />
          </>
        )}
      </Stack>
    </FormDialog>
  );
}

function validDraft(value: DwaionEmergencyOperationDraft) {
  if (value.mode === 'STOP') {
    return Boolean(
      value.affectedScope.trim() && value.providerModelScope.trim() && value.fallbackRoute.trim()
    );
  }
  const percent = Number(value.canaryPercent);
  const minutes = Number(value.canaryMinutes);
  return Boolean(
    value.validationEvidence.trim() &&
    value.failureThreshold.trim() &&
    value.reStopCriteria.trim() &&
    Number.isFinite(percent) &&
    percent > 0 &&
    percent <= 100 &&
    Number.isFinite(minutes) &&
    minutes > 0
  );
}
