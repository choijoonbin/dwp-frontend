import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { ActionButton, FormField } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ArtifactRequirementDraft } from './provider-artifact-governance-model';

export function StringListEditor({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const { t } = useTranslation('provider');
  return (
    <Stack gap={1}>
      <Typography variant="subtitle2">{label}</Typography>
      {values.map((value, index) => (
        <Stack key={index} direction="row" gap={1} alignItems="flex-start">
          <FormField
            label={t('artifactGovernance.fields.listValue')}
            value={value}
            onChange={(event) =>
              onChange(
                values.map((candidate, itemIndex) =>
                  itemIndex === index ? event.target.value : candidate
                )
              )
            }
          />
          <ActionButton
            intent="quiet"
            aria-label={t('artifactGovernance.actions.removeItem')}
            onClick={() => onChange(values.filter((_candidate, itemIndex) => itemIndex !== index))}
          >
            <Trash2 size={16} />
          </ActionButton>
        </Stack>
      ))}
      <ActionButton
        intent="quiet"
        size="small"
        startIcon={<Plus size={16} />}
        onClick={() => onChange([...values, ''])}
      >
        {t('artifactGovernance.actions.addItem')}
      </ActionButton>
    </Stack>
  );
}

export function RequirementEditor({
  label,
  keyLabel,
  values,
  onChange,
}: {
  label: string;
  keyLabel: string;
  values: ArtifactRequirementDraft[];
  onChange: (values: ArtifactRequirementDraft[]) => void;
}) {
  const { t } = useTranslation('provider');
  return (
    <Stack gap={1}>
      <Typography variant="subtitle2">{label}</Typography>
      {values.map((value) => (
        <Stack key={value.id} direction="row" gap={1} alignItems="flex-start">
          <FormField
            required
            label={keyLabel}
            value={value.key}
            onChange={(event) =>
              onChange(
                values.map((candidate) =>
                  candidate.id === value.id ? { ...candidate, key: event.target.value } : candidate
                )
              )
            }
          />
          <FormField
            required
            label={t('artifactGovernance.fields.requiredVersion')}
            value={value.version}
            onChange={(event) =>
              onChange(
                values.map((candidate) =>
                  candidate.id === value.id
                    ? { ...candidate, version: event.target.value }
                    : candidate
                )
              )
            }
          />
          <ActionButton
            intent="quiet"
            aria-label={t('artifactGovernance.actions.removeItem')}
            onClick={() => onChange(values.filter((candidate) => candidate.id !== value.id))}
          >
            <Trash2 size={16} />
          </ActionButton>
        </Stack>
      ))}
      <ActionButton
        intent="quiet"
        size="small"
        startIcon={<Plus size={16} />}
        onClick={() => onChange([...values, { id: crypto.randomUUID(), key: '', version: '' }])}
      >
        {t('artifactGovernance.actions.addRequirement')}
      </ActionButton>
    </Stack>
  );
}

export type ArtifactEvidenceDraft = {
  sourceReference: string;
  summary: string;
  checks: string[];
};

export function EvidenceFields({
  value,
  onChange,
}: {
  value: ArtifactEvidenceDraft;
  onChange: (value: ArtifactEvidenceDraft) => void;
}) {
  const { t } = useTranslation('provider');
  return (
    <Stack gap={2}>
      <FormField
        required
        label={t('artifactGovernance.fields.sourceReference')}
        value={value.sourceReference}
        onChange={(event) => onChange({ ...value, sourceReference: event.target.value })}
      />
      <FormField
        required
        multiline
        minRows={2}
        label={t('artifactGovernance.fields.evidenceSummary')}
        value={value.summary}
        onChange={(event) => onChange({ ...value, summary: event.target.value })}
      />
      <StringListEditor
        label={t('artifactGovernance.fields.validationChecks')}
        values={value.checks}
        onChange={(checks) => onChange({ ...value, checks })}
      />
    </Stack>
  );
}
