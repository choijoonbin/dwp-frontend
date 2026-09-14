import { useTranslation } from 'react-i18next';
import { FormField, SelectField } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';

import type { ApprovalWorkflowDraft } from './approval-workflow-model';

export function ApprovalWorkflowDefinitionFields<
  T extends Omit<ApprovalWorkflowDraft, 'steps' | 'typedDefinition'>,
>({
  draft,
  creating,
  disabled,
  onChange,
}: {
  draft: T;
  creating: boolean;
  disabled: boolean;
  onChange: (draft: T) => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Stack gap={1.5}>
      <FormField
        size="small"
        label={t('admin.studio.workflowKey')}
        value={draft.workflowKey}
        disabled={disabled || !creating}
        inputProps={{ maxLength: 100 }}
        onChange={(event) =>
          onChange({
            ...draft,
            workflowKey: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
          })
        }
      />
      <SelectField
        size="small"
        label={t('admin.studio.category')}
        value={draft.category}
        disabled={disabled}
        options={['GENERAL', 'FINANCE', 'PEOPLE', 'PROCUREMENT', 'ACCESS'].map((value) => ({
          value,
          label: value,
        }))}
        onValueChange={(value) => value && onChange({ ...draft, category: value })}
      />
      {(['nameKo', 'nameEn', 'descriptionKo', 'descriptionEn'] as const).map((field) => (
        <FormField
          key={field}
          size="small"
          label={t(`admin.studio.${field}`)}
          value={draft[field]}
          disabled={disabled}
          multiline={field.startsWith('description')}
          minRows={field.startsWith('description') ? 2 : undefined}
          inputProps={{ maxLength: field.startsWith('description') ? 1000 : 200 }}
          onChange={(event) => onChange({ ...draft, [field]: event.target.value })}
        />
      ))}
      <SelectField
        size="small"
        label={t('admin.studio.classification')}
        value={draft.dataClassification}
        disabled={disabled}
        options={['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].map((value) => ({
          value,
          label: value,
        }))}
        onValueChange={(value) => value && onChange({ ...draft, dataClassification: value })}
      />
      <FormField
        size="small"
        label={t('admin.studio.owner')}
        value={draft.ownerGroupRef}
        disabled={disabled}
        inputProps={{ maxLength: 160 }}
        onChange={(event) =>
          onChange({ ...draft, ownerGroupRef: event.target.value.toUpperCase() })
        }
      />
      <FormField
        size="small"
        type="number"
        label={t('admin.studio.workflowSlaMinutes')}
        value={draft.slaMinutes}
        disabled={disabled}
        inputProps={{ min: 15, max: 525600, step: 1 }}
        onChange={(event) => onChange({ ...draft, slaMinutes: Number(event.target.value) })}
      />
    </Stack>
  );
}
