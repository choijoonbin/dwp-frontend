import { useTranslation } from 'react-i18next';
import { DatePickerField, FormField } from '@dwp-frontend/design-system';

import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';

import type { ApprovalFormField } from '@dwp-frontend/shared-utils';

type ApprovalRequestDynamicFieldsProps = {
  fields: readonly ApprovalFormField[];
  values: Readonly<Record<string, string>>;
  korean: boolean;
  idPrefix: string;
  disabled?: boolean;
  onChange: (key: string, value: string) => void;
};

export function approvalRequestFieldLabel(
  field: ApprovalFormField,
  korean: boolean,
  fallback: (key: string) => string
): string {
  return korean ? (field.labelKo ?? fallback(field.key)) : (field.labelEn ?? fallback(field.key));
}

export function ApprovalRequestDynamicField({
  field,
  value,
  korean,
  idPrefix,
  disabled,
  onChange,
}: {
  field: ApprovalFormField;
  value: string;
  korean: boolean;
  idPrefix: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation('approvals');
  const label = approvalRequestFieldLabel(field, korean, (key) =>
    t(`requestFields.${key}`, { defaultValue: key })
  );
  const help = korean ? field.helpKo : field.helpEn;
  const id = `${idPrefix}-${field.key}`;

  if (field.type === 'SELECT') {
    const labelId = `${id}-label`;
    return (
      <FormControl fullWidth required={field.required} disabled={disabled}>
        <InputLabel id={labelId}>{label}</InputLabel>
        <Select
          id={id}
          labelId={labelId}
          label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {(field.options ?? []).map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>{help || t('requests.template.fieldHelp.SELECT')}</FormHelperText>
      </FormControl>
    );
  }

  if (field.type === 'DATE') {
    return (
      <DatePickerField
        required={field.required}
        disabled={disabled}
        label={label}
        value={value || null}
        onValueChange={(next) => onChange(next ?? '')}
        supportingText={help}
      />
    );
  }

  return (
    <FormField
      id={id}
      required={field.required}
      disabled={disabled}
      multiline={field.type === 'TEXTAREA'}
      minRows={field.type === 'TEXTAREA' ? 3 : undefined}
      type={field.type === 'NUMBER' ? 'number' : 'text'}
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      supportingText={
        help || (field.type === 'USER' ? t('requests.template.fieldHelp.USER') : undefined)
      }
    />
  );
}

export function ApprovalRequestDynamicFields({
  fields,
  values,
  korean,
  idPrefix,
  disabled,
  onChange,
}: ApprovalRequestDynamicFieldsProps) {
  return fields.map((field) => (
    <ApprovalRequestDynamicField
      key={field.key}
      field={field}
      value={values[field.key] ?? ''}
      korean={korean}
      idPrefix={idPrefix}
      disabled={disabled}
      onChange={(value) => onChange(field.key, value)}
    />
  ));
}
