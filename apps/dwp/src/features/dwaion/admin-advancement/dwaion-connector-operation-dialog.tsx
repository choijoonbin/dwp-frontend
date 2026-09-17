import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';

export type DwaionConnectorOperationDraft =
  | { operation: 'CONNECTOR_PROBE'; repositoryScope: string; principalSamples: string }
  | {
      operation: 'CONNECTOR_SYNC';
      repositoryScope: string;
      mode: 'INCREMENTAL' | 'FULL';
    }
  | {
      operation: 'CONNECTOR_REINDEX';
      repositoryScope: string;
      staleIndexPolicy: 'KEEP_UNTIL_VERIFIED' | 'PURGE_AFTER_SWAP';
    }
  | { operation: 'CONNECTOR_SECRET_ROTATE'; newSecretRef: string; overlapMinutes: string }
  | {
      operation: 'CONNECTOR_SCOPE_REDUCE';
      newTenantScope: string;
      excludedRepositories: string;
      groupMappingSource: string;
    }
  | {
      operation: 'CONNECTOR_REVOKE';
      inFlightPolicy: 'DRAIN' | 'CANCEL';
      revokeAt: string;
    }
  | { operation: 'CONNECTOR_DELETE'; confirmation: string; retentionEvidenceRef: string };

export function DwaionConnectorOperationDialog({
  value,
  connectorName,
  title,
  onChange,
  onClose,
  onSubmit,
}: {
  value: DwaionConnectorOperationDraft | null;
  connectorName: string;
  title: string;
  onChange: (value: DwaionConnectorOperationDraft | null) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!value) return null;
  return (
    <FormDialog
      open
      title={title}
      description="Confirm the exact connector scope and recovery inputs before governed review."
      cancelLabel="Cancel"
      submitLabel="Review operation"
      submitDisabled={!validDraft(value, connectorName)}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Stack spacing={1.5}>{operationFields(value, connectorName, onChange)}</Stack>
    </FormDialog>
  );
}

function operationFields(
  value: DwaionConnectorOperationDraft,
  connectorName: string,
  onChange: (value: DwaionConnectorOperationDraft | null) => void
) {
  if (value.operation === 'CONNECTOR_PROBE') {
    return (
      <>
        <FormField
          required
          label="Repository scope"
          value={value.repositoryScope}
          onChange={(event) => onChange({ ...value, repositoryScope: event.target.value })}
        />
        <FormField
          required
          multiline
          minRows={2}
          label="Principal samples"
          value={value.principalSamples}
          onChange={(event) => onChange({ ...value, principalSamples: event.target.value })}
        />
      </>
    );
  }
  if (value.operation === 'CONNECTOR_SYNC') {
    return (
      <>
        <FormField
          required
          label="Repository scope"
          value={value.repositoryScope}
          onChange={(event) => onChange({ ...value, repositoryScope: event.target.value })}
        />
        <SelectField
          label="Sync mode"
          value={value.mode}
          options={(['INCREMENTAL', 'FULL'] as const).map((mode) => ({ value: mode, label: mode }))}
          onValueChange={(mode) => mode && onChange({ ...value, mode })}
        />
      </>
    );
  }
  if (value.operation === 'CONNECTOR_REINDEX') {
    return (
      <>
        <FormField
          required
          label="Repository scope"
          value={value.repositoryScope}
          onChange={(event) => onChange({ ...value, repositoryScope: event.target.value })}
        />
        <SelectField
          label="Stale index handling"
          value={value.staleIndexPolicy}
          options={(['KEEP_UNTIL_VERIFIED', 'PURGE_AFTER_SWAP'] as const).map((policy) => ({
            value: policy,
            label: policy,
          }))}
          onValueChange={(staleIndexPolicy) =>
            staleIndexPolicy && onChange({ ...value, staleIndexPolicy })
          }
        />
      </>
    );
  }
  if (value.operation === 'CONNECTOR_SECRET_ROTATE') {
    return (
      <>
        <FormField
          required
          label="New secret reference"
          value={value.newSecretRef}
          onChange={(event) => onChange({ ...value, newSecretRef: event.target.value })}
        />
        <FormField
          required
          type="number"
          label="Credential overlap minutes"
          value={value.overlapMinutes}
          onChange={(event) => onChange({ ...value, overlapMinutes: event.target.value })}
        />
      </>
    );
  }
  if (value.operation === 'CONNECTOR_SCOPE_REDUCE') {
    return (
      <>
        <FormField
          required
          label="Reduced tenant scope"
          value={value.newTenantScope}
          onChange={(event) => onChange({ ...value, newTenantScope: event.target.value })}
        />
        <FormField
          required
          label="Excluded repositories"
          value={value.excludedRepositories}
          onChange={(event) => onChange({ ...value, excludedRepositories: event.target.value })}
        />
        <FormField
          required
          label="Group mapping source"
          value={value.groupMappingSource}
          onChange={(event) => onChange({ ...value, groupMappingSource: event.target.value })}
        />
      </>
    );
  }
  if (value.operation === 'CONNECTOR_REVOKE') {
    return (
      <>
        <SelectField
          label="In-flight sync"
          value={value.inFlightPolicy}
          options={(['DRAIN', 'CANCEL'] as const).map((policy) => ({
            value: policy,
            label: policy,
          }))}
          onValueChange={(inFlightPolicy) =>
            inFlightPolicy && onChange({ ...value, inFlightPolicy })
          }
        />
        <FormField
          required
          label="Revoke at (ISO timestamp)"
          value={value.revokeAt}
          onChange={(event) => onChange({ ...value, revokeAt: event.target.value })}
        />
      </>
    );
  }
  return (
    <>
      <FormField
        required
        label={`Type “${connectorName}” to confirm`}
        value={value.confirmation}
        onChange={(event) => onChange({ ...value, confirmation: event.target.value })}
      />
      <FormField
        required
        label="Retention or legal-hold evidence"
        value={value.retentionEvidenceRef}
        onChange={(event) => onChange({ ...value, retentionEvidenceRef: event.target.value })}
      />
    </>
  );
}

function validDraft(value: DwaionConnectorOperationDraft, connectorName: string) {
  if (value.operation === 'CONNECTOR_PROBE')
    return Boolean(value.repositoryScope.trim() && value.principalSamples.trim());
  if (value.operation === 'CONNECTOR_SYNC' || value.operation === 'CONNECTOR_REINDEX')
    return Boolean(value.repositoryScope.trim());
  if (value.operation === 'CONNECTOR_SECRET_ROTATE')
    return Boolean(value.newSecretRef.trim() && Number(value.overlapMinutes) >= 0);
  if (value.operation === 'CONNECTOR_SCOPE_REDUCE')
    return Boolean(
      value.newTenantScope.trim() &&
      value.excludedRepositories.trim() &&
      value.groupMappingSource.trim()
    );
  if (value.operation === 'CONNECTOR_REVOKE') return Number.isFinite(Date.parse(value.revokeAt));
  return value.confirmation === connectorName && Boolean(value.retentionEvidenceRef.trim());
}
