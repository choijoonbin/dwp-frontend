import { FormDialog, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';

import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';

import { FORM_STUDIO_V3_EDITABLE_FIELD_TYPES } from './form-studio-v3-editor-model';

import type { FormStudioV3FieldDraft } from './form-studio-v3-editor-model';

export type FormStudioV3FieldDialogCopy = Readonly<{
  addTitle: string;
  editTitle: string;
  description: string;
  fieldKey: string;
  fieldType: string;
  labelKo: string;
  labelEn: string;
  helpKo: string;
  helpEn: string;
  required: string;
  cancel: string;
  save: string;
}>;

export function FormStudioV3FieldDialog({
  mode,
  draft,
  copy,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: 'add' | 'edit' | null;
  draft: FormStudioV3FieldDraft | null;
  copy: FormStudioV3FieldDialogCopy;
  error: string | null;
  onChange: (draft: FormStudioV3FieldDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const patch = (value: Partial<FormStudioV3FieldDraft>) => {
    if (draft) onChange({ ...draft, ...value });
  };
  return (
    <FormDialog
      open={mode !== null && draft !== null}
      title={mode === 'edit' ? copy.editTitle : copy.addTitle}
      description={copy.description}
      cancelLabel={copy.cancel}
      submitLabel={copy.save}
      submitDisabled={!draft?.key.trim() || !draft.labelKo.trim() || !draft.labelEn.trim()}
      mobileFullScreen
      onClose={onClose}
      onSubmit={onSubmit}
    >
      {draft ? (
        <Stack gap={1.5}>
          {error ? <InlineFeedback severity="error">{error}</InlineFeedback> : null}
          <FormField
            size="small"
            label={copy.fieldKey}
            value={draft.key}
            disabled={mode === 'edit'}
            slotProps={{ htmlInput: { maxLength: 80 } }}
            onChange={(event) => patch({ key: event.target.value })}
          />
          <SelectField
            size="small"
            label={copy.fieldType}
            value={draft.type}
            options={[
              ...(!FORM_STUDIO_V3_EDITABLE_FIELD_TYPES.includes(
                draft.type as (typeof FORM_STUDIO_V3_EDITABLE_FIELD_TYPES)[number]
              )
                ? [{ value: draft.type, label: draft.type, disabled: true }]
                : []),
              ...FORM_STUDIO_V3_EDITABLE_FIELD_TYPES.map((type) => ({
                value: type,
                label: type,
              })),
            ]}
            onValueChange={(type) => type && patch({ type })}
          />
          <FormField
            size="small"
            label={copy.labelKo}
            value={draft.labelKo}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            onChange={(event) => patch({ labelKo: event.target.value })}
          />
          <FormField
            size="small"
            label={copy.labelEn}
            value={draft.labelEn}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            onChange={(event) => patch({ labelEn: event.target.value })}
          />
          <FormField
            size="small"
            multiline
            minRows={2}
            label={copy.helpKo}
            value={draft.helpKo}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            onChange={(event) => patch({ helpKo: event.target.value })}
          />
          <FormField
            size="small"
            multiline
            minRows={2}
            label={copy.helpEn}
            value={draft.helpEn}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            onChange={(event) => patch({ helpEn: event.target.value })}
          />
          <FormControlLabel
            control={
              <Switch
                checked={draft.required}
                onChange={(_event, required) => patch({ required })}
              />
            }
            label={copy.required}
          />
        </Stack>
      ) : null}
    </FormDialog>
  );
}
