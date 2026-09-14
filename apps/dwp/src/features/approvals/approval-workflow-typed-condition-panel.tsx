import { useTranslation } from 'react-i18next';
import { Plus, RefreshCcw, Trash2 } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { approvalTypedWorkflowRouteFieldOptions } from './approval-workflow-typed-conditions';
import { typedNumeric } from './approval-form-typed-model';

import type {
  ApprovalTypedWorkflowClause,
  ApprovalTypedWorkflowCondition,
  ApprovalTypedWorkflowScalar,
} from './approval-workflow-typed-model';
import type { ApprovalWorkflowConditionSource } from './approval-workflow-typed-source';

function replacementValue(
  value: ApprovalTypedWorkflowScalar,
  text: string
): ApprovalTypedWorkflowScalar {
  if (typeof value === 'boolean') return text === 'true';
  if (
    typeof value === 'number' &&
    /^-?(0|[1-9][0-9]*)$/.test(text) &&
    Number.isSafeInteger(Number(text))
  )
    return Number(text);
  return text;
}

export function ApprovalWorkflowTypedConditionPanel({
  condition,
  source,
  disabled,
  sourceLocked,
  onChange,
}: {
  condition?: ApprovalTypedWorkflowCondition;
  source: ApprovalWorkflowConditionSource;
  disabled: boolean;
  sourceLocked: boolean;
  onChange: (condition?: ApprovalTypedWorkflowCondition) => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const fields = source.compiled ? approvalTypedWorkflowRouteFieldOptions(source.compiled) : [];
  const editable = !disabled && source.available;
  const fieldLabel = (key: string) => {
    const definition = source.compiled?.definition.fields.find((field) => field.key === key);
    return `${(locale === 'ko' ? definition?.labelKo : definition?.labelEn) || key} · ${key}`;
  };
  const changeClause = (index: number, clause: ApprovalTypedWorkflowClause) =>
    onChange({
      all: condition!.all.map((current, ordinal) => (ordinal === index ? clause : current)),
    });
  const newClause = (): ApprovalTypedWorkflowClause => ({
    field: fields[0].key,
    operator: 'EQ',
    value: typedNumeric(fields[0]) ? '0' : '',
  });
  return (
    <Stack gap={1.5} sx={{ pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
      <Box component="h3" sx={{ m: 0, typography: 'subtitle2' }}>
        {t('admin.typedWorkflow.condition')}
      </Box>
      <SelectField
        size="small"
        label={t('admin.typedWorkflow.sourceForm')}
        value={source.selectedId}
        disabled={sourceLocked || source.busy}
        placeholder={t('admin.typedWorkflow.sourceForm')}
        options={source.forms.map((form) => ({
          value: form.formId,
          label: `${locale === 'ko' ? form.nameKo : form.nameEn} · v${form.currentVersion}`,
        }))}
        onValueChange={(formId) => source.select(formId)}
      />
      {source.selectedId ? (
        <>
          {!source.available ? (
            <InlineFeedback
              severity="warning"
              action={
                <ActionIconButton
                  label={t('admin.typedWorkflow.reloadSource')}
                  disabled={source.busy}
                  onClick={() => void source.reload()}
                >
                  <RefreshCcw size={16} />
                </ActionIconButton>
              }
            >
              {t(
                source.changed
                  ? 'admin.typedWorkflow.sourceChanged'
                  : 'admin.typedWorkflow.sourceUnavailable'
              )}
            </InlineFeedback>
          ) : null}
          {source.pin ? (
            <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
              {source.pin.formVersionId} · {source.pin.schemaHash.slice(0, 12)}
            </Box>
          ) : null}
        </>
      ) : null}
      {condition ? (
        <>
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
            {t('admin.typedWorkflow.conditionMatchAll')}
          </Box>
          {condition.all.map((clause, index) => {
            const field = fields.find((candidate) => candidate.key === clause.field);
            const operators =
              field && typedNumeric(field)
                ? (['EQ', 'IN', 'GT', 'GTE', 'LT', 'LTE'] as const)
                : (['EQ', 'IN'] as const);
            const values = clause.operator === 'IN' ? clause.value : [clause.value];
            const options = fields.map((option) => ({
              value: option.key,
              label: fieldLabel(option.key),
            }));
            if (!field) options.push({ value: clause.field, label: clause.field });
            return (
              <Box
                component="fieldset"
                key={index}
                sx={{
                  m: 0,
                  px: 0,
                  py: 1.5,
                  minWidth: 0,
                  border: 0,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Stack gap={1.25}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Box component="legend" sx={{ typography: 'caption' }}>
                      {t('admin.typedWorkflow.condition')} {index + 1}
                    </Box>
                    <ActionIconButton
                      size="small"
                      intent="danger"
                      label={t('admin.typedWorkflow.removeCondition')}
                      disabled={disabled}
                      onClick={() =>
                        onChange(
                          condition.all.length === 1
                            ? undefined
                            : {
                                all: condition.all.filter((_current, ordinal) => ordinal !== index),
                              }
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </ActionIconButton>
                  </Stack>
                  <SelectField
                    size="small"
                    label={t('admin.typedWorkflow.conditionField')}
                    disabled={!editable}
                    value={clause.field}
                    options={options}
                    onValueChange={(key) => {
                      const next = fields.find((option) => option.key === key);
                      if (next)
                        changeClause(index, {
                          field: key,
                          operator: 'EQ',
                          value: typedNumeric(next) ? '0' : '',
                        });
                    }}
                  />
                  <SelectField
                    size="small"
                    label={t('admin.typedWorkflow.conditionOperator')}
                    disabled={!editable || !field}
                    value={clause.operator}
                    options={operators.map((value) => ({
                      value,
                      label: t(`admin.typedWorkflow.operators.${value}`),
                    }))}
                    onValueChange={(operator) => {
                      if (operator === 'IN')
                        changeClause(index, { field: clause.field, operator, value: values });
                      else if (operator)
                        changeClause(index, { field: clause.field, operator, value: values[0] });
                    }}
                  />
                  {values.map((value, valueIndex) => (
                    <Stack key={valueIndex} direction="row" alignItems="center" gap={0.5}>
                      {typeof value === 'boolean' ? (
                        <SelectField
                          size="small"
                          disabled={!editable}
                          label={t('admin.typedWorkflow.conditionValue')}
                          value={String(value)}
                          options={[
                            { value: 'true', label: 'true' },
                            { value: 'false', label: 'false' },
                          ]}
                          onValueChange={(text) =>
                            changeClause(
                              index,
                              clause.operator === 'IN'
                                ? {
                                    ...clause,
                                    value: values.map((current, ordinal) =>
                                      ordinal === valueIndex
                                        ? replacementValue(value, text)
                                        : current
                                    ),
                                  }
                                : { ...clause, value: replacementValue(value, text) }
                            )
                          }
                        />
                      ) : (
                        <FormField
                          size="small"
                          disabled={!editable}
                          label={t('admin.typedWorkflow.conditionValue')}
                          value={value}
                          inputProps={{
                            maxLength: field && typedNumeric(field) ? 40 : 2000,
                            inputMode: field && typedNumeric(field) ? 'decimal' : 'text',
                          }}
                          onChange={(event) => {
                            const next = replacementValue(value, event.target.value);
                            changeClause(
                              index,
                              clause.operator === 'IN'
                                ? {
                                    ...clause,
                                    value: values.map((current, ordinal) =>
                                      ordinal === valueIndex ? next : current
                                    ),
                                  }
                                : { ...clause, value: next }
                            );
                          }}
                        />
                      )}
                      {clause.operator === 'IN' ? (
                        <ActionIconButton
                          size="small"
                          label={t('admin.typedWorkflow.removeValue')}
                          disabled={!editable || values.length <= 1}
                          onClick={() =>
                            changeClause(index, {
                              ...clause,
                              value: values.filter((_current, ordinal) => ordinal !== valueIndex),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </ActionIconButton>
                      ) : null}
                    </Stack>
                  ))}
                  {clause.operator === 'IN' ? (
                    <ActionButton
                      size="small"
                      intent="quiet"
                      startIcon={<Plus size={16} />}
                      disabled={!editable || values.length >= 50}
                      onClick={() =>
                        changeClause(index, {
                          ...clause,
                          value: [...values, field && typedNumeric(field) ? '0' : ''],
                        })
                      }
                    >
                      {t('admin.typedWorkflow.addValue')}
                    </ActionButton>
                  ) : null}
                </Stack>
              </Box>
            );
          })}
        </>
      ) : null}
      <ActionButton
        size="small"
        intent="quiet"
        startIcon={<Plus size={16} />}
        disabled={!editable || !fields.length || (condition?.all.length ?? 0) >= 50}
        onClick={() => onChange({ all: [...(condition?.all ?? []), newClause()] })}
      >
        {t('admin.typedWorkflow.addCondition')}
      </ActionButton>
    </Stack>
  );
}
