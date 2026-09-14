import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { ActionIconButton, FormField, SelectField } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import type {
  ApprovalTypedCondition,
  ApprovalTypedField,
} from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

const operators = [
  'PRESENT',
  'EQ',
  'NE',
  'IN',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'AND',
  'OR',
  'NOT',
] as const;
const seed = (field: string): ApprovalTypedCondition => ({ op: 'PRESENT', field });

export function ApprovalFormConditionEditor({
  label,
  rule,
  fields,
  onChange,
  depth = 0,
}: {
  label: string;
  rule: ApprovalTypedCondition | null | undefined;
  fields: readonly ApprovalTypedField[];
  onChange: (rule: ApprovalTypedCondition | null) => void;
  depth?: number;
}) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const scalar = fields.filter((field) => field.type !== 'REPEATING_GROUP');
  const first = scalar[0]?.key ?? '';
  const changeOperator = (op: (typeof operators)[number]) => {
    if (op === 'AND' || op === 'OR') onChange({ op, args: [seed(first), seed(first)] });
    else if (op === 'NOT') onChange({ op, args: [seed(first)] });
    else if (op === 'PRESENT') onChange(seed(first));
    else if (op === 'IN') onChange({ op, field: first, values: [''] });
    else
      onChange({
        op,
        field: ['GT', 'GTE', 'LT', 'LTE'].includes(op)
          ? (scalar.find((field) => ['NUMBER', 'CALCULATED_NUMBER'].includes(field.type))?.key ??
            '')
          : first,
        value: '',
      });
  };
  return (
    <Stack
      component="section"
      aria-label={label}
      gap={1}
      sx={{ borderLeft: depth ? 1 : 0, borderColor: 'divider', pl: depth ? 1 : 0 }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Box sx={{ typography: 'subtitle2' }}>{label}</Box>
        <ActionIconButton
          label={t(rule ? 'admin.typedForm.removeCondition' : 'admin.typedForm.addCondition')}
          disabled={!rule && !first}
          tooltipDisablePortal
          onClick={() => onChange(rule ? null : seed(first))}
        >
          {rule ? <Trash2 size={16} /> : <Plus size={16} />}
        </ActionIconButton>
      </Stack>
      {rule ? (
        <>
          <SelectField
            label={t('admin.typedForm.operator')}
            size="small"
            value={rule.op}
            options={operators.map((op) => ({
              value: op,
              label: t(`admin.typedForm.conditionOperators.${op}`),
              disabled:
                (depth >= 8 && ['AND', 'OR', 'NOT'].includes(op)) ||
                (['GT', 'GTE', 'LT', 'LTE'].includes(op) &&
                  !scalar.some((field) => ['NUMBER', 'CALCULATED_NUMBER'].includes(field.type))),
            }))}
            onValueChange={(op) => {
              if (op) changeOperator(op);
            }}
          />
          {'args' in rule ? (
            <>
              {rule.args.map((child, index) => (
                <ApprovalFormConditionEditor
                  key={index}
                  label={`${t('admin.typedForm.condition')} ${index + 1}`}
                  rule={child}
                  fields={fields}
                  depth={depth + 1}
                  onChange={(next) => {
                    const args = next
                      ? rule.args.map((item, i) => (i === index ? next : item))
                      : rule.args.filter((_, i) => i !== index);
                    if (rule.op === 'NOT') onChange(next ? { op: 'NOT', args: [next] } : null);
                    else if (args.length < 2) onChange(args[0] ?? null);
                    else onChange({ op: rule.op, args });
                  }}
                />
              ))}
              {rule.op !== 'NOT' ? (
                <ActionIconButton
                  label={t('admin.typedForm.addCondition')}
                  tooltipDisablePortal
                  disabled={rule.args.length >= 20}
                  onClick={() => onChange({ ...rule, args: [...rule.args, seed(first)] })}
                >
                  <Plus size={16} />
                </ActionIconButton>
              ) : null}
            </>
          ) : (
            <>
              <SelectField
                label={t('admin.typedForm.reference')}
                size="small"
                value={rule.field}
                options={scalar
                  .filter(
                    (field) =>
                      !['GT', 'GTE', 'LT', 'LTE'].includes(rule.op) ||
                      ['NUMBER', 'CALCULATED_NUMBER'].includes(field.type)
                  )
                  .map((field) => ({
                    value: field.key,
                    label: `${field.key} · ${korean ? field.labelKo : field.labelEn}`,
                  }))}
                onValueChange={(field) => onChange({ ...rule, field })}
              />
              {rule.op === 'IN' ? (
                <FormField
                  label={t('admin.typedForm.values')}
                  multiline
                  minRows={2}
                  size="small"
                  value={rule.values.join('\n')}
                  onChange={(event) =>
                    onChange({ ...rule, values: event.target.value.split('\n') })
                  }
                />
              ) : rule.op !== 'PRESENT' ? (
                <FormField
                  label={t('admin.typedForm.value')}
                  size="small"
                  value={rule.value}
                  onChange={(event) => onChange({ ...rule, value: event.target.value })}
                />
              ) : null}
            </>
          )}
        </>
      ) : !first ? (
        <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
          {t('admin.typedForm.noReference')}
        </Box>
      ) : null}
    </Stack>
  );
}
