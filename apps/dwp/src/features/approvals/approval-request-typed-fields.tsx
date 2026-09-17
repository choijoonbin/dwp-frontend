import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  ActionIconButton,
  DatePickerField,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { typedObject } from './approval-form-typed-model';
import { approvalRequestFieldValue } from './approval-request-schema-model';
import { ApprovalRequestUserPicker } from './approval-request-user-picker';

import type {
  ApprovalTypedField,
  ApprovalTypedFormEvaluation,
  ApprovalTypedScalarField,
} from '@dwp-frontend/shared-utils';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';
import type {
  ApprovalRequestUserContext,
  ApprovalRequestUserBinding,
  ApprovalRequestUserSourceState,
} from './approval-request-user-picker';

function rows(value: unknown): Record<string, unknown>[] | undefined {
  if (value == null) return [];
  if (!Array.isArray(value)) return undefined;
  try {
    return value.map(typedObject);
  } catch {
    return undefined;
  }
}

function Scalar({
  field,
  value,
  required,
  korean,
  disabled,
  calculatedValue,
  onChange,
  userBinding,
  onUserSourceReadyChange,
  verifyOnlyUserValues,
  errorMessage,
}: {
  field: ApprovalTypedScalarField;
  value: unknown;
  required: boolean;
  korean: boolean;
  disabled: boolean;
  calculatedValue: unknown;
  onChange: (value: string) => void;
  userBinding?: ApprovalRequestUserBinding;
  onUserSourceReadyChange?: (state: ApprovalRequestUserSourceState) => void;
  verifyOnlyUserValues: boolean;
  errorMessage?: string;
}) {
  const { t } = useTranslation('approvals');
  const label = korean ? field.labelKo : field.labelEn;
  const help = korean ? field.helpKo : field.helpEn;
  const calculated = field.type === 'CALCULATED_NUMBER';
  const displayed = calculated ? calculatedValue : value;
  const valid =
    displayed == null ||
    typeof displayed === 'string' ||
    (typeof displayed === 'number' && Number.isSafeInteger(displayed));
  if (!valid)
    return (
      <InlineFeedback severity="error">
        {t('requests.typed.fieldInvalid', { field: label })}
      </InlineFeedback>
    );
  const text = displayed == null ? '' : String(displayed);
  if (field.type === 'USER')
    return (
      <Stack gap={0.5}>
        <ApprovalRequestUserPicker
          binding={userBinding}
          label={label}
          required={required}
          disabled={disabled}
          verifyOnlyValue={verifyOnlyUserValues}
          value={text}
          supportingText={errorMessage ? undefined : (help ?? undefined)}
          onChange={onChange}
          onSourceReadyChange={onUserSourceReadyChange}
        />
        {errorMessage && <InlineFeedback severity="error">{errorMessage}</InlineFeedback>}
      </Stack>
    );
  if (field.type === 'DATE')
    return (
      <DatePickerField
        label={label}
        required={required}
        disabled={disabled}
        value={text || null}
        onValueChange={(next) => onChange(next ?? '')}
        supportingText={help ?? undefined}
        errorMessage={errorMessage}
      />
    );
  if (field.type === 'SELECT')
    return (
      <SelectField
        label={label}
        required={required}
        disabled={disabled}
        value={text}
        options={field.options.map((option) => ({ value: option, label: option }))}
        onValueChange={onChange}
        supportingText={help ?? undefined}
        errorMessage={errorMessage}
      />
    );
  return (
    <FormField
      label={label}
      required={required}
      disabled={disabled}
      value={text}
      multiline={field.type === 'TEXTAREA'}
      minRows={field.type === 'TEXTAREA' ? 3 : undefined}
      type="text"
      onChange={calculated ? undefined : (event) => onChange(event.target.value)}
      InputProps={calculated ? { readOnly: true } : undefined}
      inputProps={field.type === 'NUMBER' ? { inputMode: 'decimal', maxLength: 40 } : undefined}
      supportingText={calculated ? t('requests.typed.calculated') : (help ?? undefined)}
      errorMessage={errorMessage}
    />
  );
}

export function ApprovalRequestTypedFields({
  compiled,
  evaluation,
  values,
  korean,
  disabled = false,
  onChange,
  includeSummary = false,
  userBinding,
  onUserSourceReadyChange,
  verifyOnlyUserValues = false,
  invalidPaths,
}: {
  compiled: CompiledApprovalTypedForm;
  evaluation?: ApprovalTypedFormEvaluation;
  values: Readonly<Record<string, unknown>>;
  korean: boolean;
  disabled?: boolean;
  verifyOnlyUserValues?: boolean;
  onChange: (key: string, value: unknown) => void;
  includeSummary?: boolean;
  userBinding?: ApprovalRequestUserContext;
  onUserSourceReadyChange?: (
    path: string,
    value: unknown,
    state: ApprovalRequestUserSourceState
  ) => void;
  invalidPaths?: ReadonlySet<string>;
}) {
  const { t } = useTranslation('approvals');
  const visible = new Set(
    evaluation?.visibleFields ??
      compiled.scope.order.filter((field) => field.visibleWhen === null).map((field) => field.key)
  );
  const required = new Set(
    evaluation?.requiredFields ??
      compiled.scope.order.filter((field) => field.required).map((field) => field.key)
  );
  const input = (
    field: ApprovalTypedScalarField,
    path: string,
    value: unknown,
    change: (value: string) => void,
    groupKey?: string
  ) => (
    <Scalar
      key={path}
      field={field}
      value={value}
      required={required.has(path)}
      korean={korean}
      disabled={disabled}
      verifyOnlyUserValues={verifyOnlyUserValues}
      calculatedValue={evaluation ? approvalRequestFieldValue(evaluation.payload, path) : undefined}
      onChange={change}
      userBinding={userBinding ? { ...userBinding, fieldKey: field.key, groupKey } : undefined}
      onUserSourceReadyChange={(state) => onUserSourceReadyChange?.(path, value ?? '', state)}
      errorMessage={
        invalidPaths?.has(path)
          ? t('requests.typed.fieldInvalid', {
              field: korean ? field.labelKo : field.labelEn,
            })
          : undefined
      }
    />
  );
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        gap: 1.5,
      }}
    >
      {compiled.definition.fields
        .filter((field) => (includeSummary || field.key !== 'summary') && visible.has(field.key))
        .map((field: ApprovalTypedField) => {
          if (field.type !== 'REPEATING_GROUP')
            return (
              <Box key={field.key} minWidth={0} data-approval-field-path={field.key}>
                {input(field, field.key, values[field.key], (next) => onChange(field.key, next))}
              </Box>
            );
          const currentRows = rows(values[field.key]);
          const label = korean ? field.labelKo : field.labelEn;
          const maxRows = compiled.scope.fields[field.key]!.maxRows;
          return (
            <Box
              key={field.key}
              component="fieldset"
              data-approval-field-path={field.key}
              sx={{ m: 0, p: 0, border: 0, minWidth: 0, gridColumn: '1 / -1' }}
            >
              <Typography component="legend" variant="subtitle2">
                {label}
              </Typography>
              <Stack gap={1.5}>
                {(korean ? field.helpKo : field.helpEn) && (
                  <Typography variant="caption" color="text.secondary">
                    {korean ? field.helpKo : field.helpEn}
                  </Typography>
                )}
                {currentRows === undefined ? (
                  <InlineFeedback severity="error">
                    {t('requests.typed.fieldInvalid', { field: label })}
                  </InlineFeedback>
                ) : (
                  currentRows.map((row, index) => (
                    <Box
                      key={index}
                      sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider', minWidth: 0 }}
                    >
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={1}
                        sx={{ mb: 1 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {t('requests.typed.row', { index: index + 1 })}
                        </Typography>
                        <ActionIconButton
                          size="small"
                          label={t('requests.typed.removeRow', { index: index + 1 })}
                          tooltip={t('requests.typed.removeRow', { index: index + 1 })}
                          disabled={disabled}
                          onClick={() =>
                            onChange(
                              field.key,
                              currentRows.filter((_, rowIndex) => rowIndex !== index)
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </ActionIconButton>
                      </Stack>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                          gap: 1.5,
                        }}
                      >
                        {field.fields
                          .filter((child) =>
                            evaluation
                              ? visible.has(`${field.key}[${index}].${child.key}`)
                              : !child.visibleWhen
                          )
                          .map((child) => (
                            <Box
                              key={child.key}
                              minWidth={0}
                              data-approval-field-path={`${field.key}[${index}].${child.key}`}
                            >
                              {input(
                                child,
                                `${field.key}[${index}].${child.key}`,
                                row[child.key],
                                (next) =>
                                  onChange(
                                    field.key,
                                    currentRows.map((original, rowIndex) =>
                                      rowIndex === index
                                        ? { ...original, [child.key]: next }
                                        : original
                                    )
                                  ),
                                field.key
                              )}
                            </Box>
                          ))}
                      </Box>
                    </Box>
                  ))
                )}
                <ActionButton
                  type="button"
                  size="small"
                  intent="secondary"
                  startIcon={<Plus size={16} />}
                  disabled={disabled || currentRows === undefined || currentRows.length >= maxRows}
                  onClick={() => {
                    if (currentRows) onChange(field.key, [...currentRows, {}]);
                  }}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {t('requests.typed.addRow')}
                </ActionButton>
              </Stack>
            </Box>
          );
        })}
    </Box>
  );
}
