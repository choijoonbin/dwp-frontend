import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';

export type DwaionDatasetDraft = {
  name: string;
  ownerRef: string;
  format: 'CSV' | 'JSON';
  checksumSha256: string;
  schemaMapping: string;
  piiHandling: string;
};

export type DwaionComparisonDraft = {
  datasetId: string;
  baseline: string;
  candidate: string;
  promptVersion: string;
  policyVersion: string;
  toolVersion: string;
  evaluatorVersion: string;
};

export type DwaionPiiDecisionDraft = {
  datasetId: string;
  name: string;
  version: number;
  before: 'PENDING' | 'PASS' | 'REVIEW' | 'BLOCKED';
  decision: 'PASS' | 'BLOCKED';
  evidenceRefs: string;
  reviewerNote: string;
};

const SHA_256 = /^[a-f\d]{64}$/i;

type DialogProps<T> = {
  value: T | null;
  onChange: (value: T | null) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function DwaionDatasetDialog({
  value,
  onChange,
  onClose,
  onSubmit,
}: DialogProps<DwaionDatasetDraft>) {
  if (!value) return null;
  const checksumValid = SHA_256.test(value.checksumSha256.trim());
  const valid = Boolean(
    value.name.trim() &&
    value.ownerRef.trim() &&
    checksumValid &&
    value.schemaMapping.trim() &&
    value.piiHandling.trim()
  );
  return (
    <FormDialog
      open
      title="Dataset import"
      description="Register immutable source metadata and schema mapping before PII review."
      cancelLabel="Cancel"
      submitLabel="Review import"
      submitDisabled={!valid}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Stack spacing={1.5}>
        <FormField
          required
          label="Name"
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
        <FormField
          required
          label="Owner"
          value={value.ownerRef}
          onChange={(event) => onChange({ ...value, ownerRef: event.target.value })}
        />
        <SelectField
          label="Format"
          value={value.format}
          options={(['CSV', 'JSON'] as const).map((format) => ({ value: format, label: format }))}
          onValueChange={(format) => format && onChange({ ...value, format })}
        />
        <FormField
          required
          errorMessage={
            value.checksumSha256.length > 0 && !checksumValid
              ? 'Enter exactly 64 hexadecimal characters.'
              : undefined
          }
          label="SHA-256 checksum"
          value={value.checksumSha256}
          onChange={(event) => onChange({ ...value, checksumSha256: event.target.value })}
        />
        <FormField
          required
          multiline
          minRows={2}
          label="Schema mapping"
          value={value.schemaMapping}
          onChange={(event) => onChange({ ...value, schemaMapping: event.target.value })}
        />
        <FormField
          required
          multiline
          minRows={2}
          label="PII handling"
          value={value.piiHandling}
          onChange={(event) => onChange({ ...value, piiHandling: event.target.value })}
        />
      </Stack>
    </FormDialog>
  );
}

export function DwaionComparisonDialog({
  datasets,
  value,
  onChange,
  onClose,
  onSubmit,
}: DialogProps<DwaionComparisonDraft> & { datasets: Array<{ datasetId: string; name: string }> }) {
  if (!value) return null;
  const valid = Object.values(value).every((item) => item.trim());
  return (
    <FormDialog
      open
      title="Pinned comparison"
      description="Pin every model, prompt, policy, tool, and evaluator version for reproducible evidence."
      cancelLabel="Cancel"
      submitLabel="Review comparison"
      submitDisabled={!valid}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Stack spacing={1.5}>
        <SelectField
          label="Dataset"
          value={value.datasetId}
          options={datasets.map((item) => ({ value: item.datasetId, label: item.name }))}
          onValueChange={(datasetId) => datasetId && onChange({ ...value, datasetId })}
        />
        {(
          [
            'baseline',
            'candidate',
            'promptVersion',
            'policyVersion',
            'toolVersion',
            'evaluatorVersion',
          ] as const
        ).map((key) => (
          <FormField
            key={key}
            required
            label={key}
            value={value[key]}
            onChange={(event) => onChange({ ...value, [key]: event.target.value })}
          />
        ))}
      </Stack>
    </FormDialog>
  );
}

export function DwaionPiiDecisionDialog({
  value,
  onChange,
  onClose,
  onSubmit,
}: DialogProps<DwaionPiiDecisionDraft>) {
  if (!value) return null;
  const valid = Boolean(value.evidenceRefs.trim() && value.reviewerNote.trim());
  return (
    <FormDialog
      open
      title={`PII review · ${value.name}`}
      description="Record the independent decision and evidence before changing dataset eligibility."
      cancelLabel="Cancel"
      submitLabel="Review decision"
      submitDisabled={!valid}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <Stack spacing={1.5}>
        <SelectField
          label="Decision"
          value={value.decision}
          options={[
            { value: 'PASS', label: 'Approve for evaluation' },
            { value: 'BLOCKED', label: 'Block and quarantine' },
          ]}
          onValueChange={(decision) => decision && onChange({ ...value, decision })}
        />
        <FormField
          required
          label="Evidence references"
          value={value.evidenceRefs}
          onChange={(event) => onChange({ ...value, evidenceRefs: event.target.value })}
        />
        <FormField
          required
          multiline
          minRows={3}
          label="Reviewer note"
          value={value.reviewerNote}
          onChange={(event) => onChange({ ...value, reviewerNote: event.target.value })}
        />
      </Stack>
    </FormDialog>
  );
}
