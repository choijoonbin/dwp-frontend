import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';

import { ApprovalFormConditionEditor } from './approval-form-builder-condition-editor';
import { ApprovalFormCalculationEditor } from './approval-form-builder-calculation-editor';
import { ApprovalFormIntegerField } from './approval-form-builder-integer-field';
import { APPROVAL_TYPED_FIELD_TYPES } from './approval-form-builder-typed-model';
import type { ApprovalTypedField } from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

export function ApprovalTypedFormFieldEditor({
  field,
  fields,
  summary,
  lockKey,
  rowScope,
  onPatch,
  onTypeChange,
  busy,
}: {
  field: ApprovalTypedField;
  fields: readonly ApprovalTypedField[];
  summary: boolean;
  lockKey: boolean;
  rowScope: boolean;
  onPatch: (patch: Readonly<Record<string, unknown>>) => void;
  onTypeChange: (type: ApprovalTypedField['type']) => void;
  busy: boolean;
}) {
  const { t } = useTranslation('approvals');
  const [pendingType, setPendingType] = useState<ApprovalTypedField['type'] | null>(null);
  const references = fields.filter((item) => item.key !== field.key);
  return (
    <Stack gap={1.5}>
      {summary ? (
        <InlineFeedback severity="info">{t('admin.typedForm.summaryLocked')}</InlineFeedback>
      ) : null}
      <FormField
        size="small"
        label={t('admin.studio.fieldKey')}
        disabled={summary || lockKey}
        value={field.key}
        slotProps={{ htmlInput: { maxLength: 80, 'data-approval-field-property': 'key' } }}
        onChange={(event) => onPatch({ key: event.target.value })}
      />
      <SelectField
        size="small"
        label={t('admin.studio.fieldType')}
        aria-label={t('admin.studio.fieldType')}
        value={field.type}
        disabled={summary || lockKey || busy}
        options={APPROVAL_TYPED_FIELD_TYPES.filter(
          (type) => !rowScope || type !== 'REPEATING_GROUP'
        ).map((type) => ({ value: type, label: t(`admin.typedForm.fieldTypes.${type}`) }))}
        onValueChange={(type) => {
          if (type && type !== field.type) setPendingType(type);
        }}
      />
      <FormField
        size="small"
        label={t('admin.studio.labelKo')}
        value={field.labelKo}
        slotProps={{ htmlInput: { maxLength: 160, 'data-approval-field-property': 'labelKo' } }}
        onChange={(event) => onPatch({ labelKo: event.target.value })}
      />
      <FormField
        size="small"
        label={t('admin.studio.labelEn')}
        value={field.labelEn}
        slotProps={{ htmlInput: { maxLength: 160 } }}
        onChange={(event) => onPatch({ labelEn: event.target.value })}
      />
      <FormField
        size="small"
        multiline
        minRows={2}
        label={t('admin.studio.helpKo')}
        value={field.helpKo ?? ''}
        slotProps={{ htmlInput: { maxLength: 500 } }}
        onChange={(event) => onPatch({ helpKo: event.target.value })}
      />
      <FormField
        size="small"
        multiline
        minRows={2}
        label={t('admin.studio.helpEn')}
        value={field.helpEn ?? ''}
        slotProps={{ htmlInput: { maxLength: 500 } }}
        onChange={(event) => onPatch({ helpEn: event.target.value })}
      />
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={Boolean(field.required)}
            onChange={(_, required) => onPatch({ required })}
          />
        }
        label={t('admin.studio.required')}
      />
      {field.type === 'TEXT' || field.type === 'TEXTAREA' || field.type === 'USER' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 1 }}>
          <ApprovalFormIntegerField
            label={t('admin.typedForm.minLength')}
            value={'minLength' in field ? field.minLength : undefined}
            min={0}
            max={10000}
            onChange={(minLength) => onPatch({ minLength })}
          />
          <ApprovalFormIntegerField
            label={t('admin.typedForm.maxLength')}
            value={'maxLength' in field ? field.maxLength : undefined}
            min={0}
            max={10000}
            onChange={(maxLength) => onPatch({ maxLength })}
          />
        </Box>
      ) : null}
      {field.type === 'NUMBER' || field.type === 'CALCULATED_NUMBER' ? (
        <Stack direction="row" gap={1}>
          <FormField
            size="small"
            label={t('admin.typedForm.minimum')}
            value={field.min ?? ''}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            onChange={(event) => onPatch({ min: event.target.value || undefined })}
          />
          <FormField
            size="small"
            label={t('admin.typedForm.maximum')}
            value={field.max ?? ''}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            onChange={(event) => onPatch({ max: event.target.value || undefined })}
          />
        </Stack>
      ) : null}
      {field.type === 'SELECT' ? (
        <FormField
          size="small"
          label={t('admin.studio.options')}
          multiline
          minRows={3}
          value={field.options.join('\n')}
          onChange={(event) => onPatch({ options: event.target.value.split('\n') })}
        />
      ) : null}
      {field.type === 'REPEATING_GROUP' ? (
        <Stack direction="row" gap={1}>
          <ApprovalFormIntegerField
            label={t('admin.typedForm.minRows')}
            value={field.minRows}
            min={0}
            max={50}
            onChange={(minRows) => onPatch({ minRows })}
          />
          <ApprovalFormIntegerField
            label={t('admin.typedForm.maxRows')}
            value={field.maxRows}
            min={1}
            max={50}
            onChange={(maxRows) => onPatch({ maxRows })}
          />
        </Stack>
      ) : null}
      {!summary ? (
        <ApprovalFormConditionEditor
          label={t('admin.typedForm.visibleWhen')}
          rule={field.visibleWhen}
          fields={references}
          onChange={(visibleWhen) => onPatch({ visibleWhen })}
        />
      ) : null}
      <ApprovalFormConditionEditor
        label={t('admin.typedForm.requiredWhen')}
        rule={field.requiredWhen}
        fields={references}
        onChange={(requiredWhen) => onPatch({ requiredWhen })}
      />
      {field.type === 'CALCULATED_NUMBER' ? (
        <ApprovalFormCalculationEditor
          expression={field.calculation}
          fields={references}
          rowScope={rowScope}
          onChange={(calculation) => onPatch({ calculation })}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingType)}
        title={t('admin.typedForm.typeChangeTitle')}
        description={t('admin.typedForm.typeChangeDescription')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('admin.typedForm.typeChangeConfirm')}
        intent="danger"
        busy={busy}
        focusCancelAfterOpen
        onClose={() => setPendingType(null)}
        onConfirm={() => {
          if (pendingType && !busy && !summary && !lockKey) onTypeChange(pendingType);
          setPendingType(null);
        }}
      />
    </Stack>
  );
}
