import { useTranslation } from 'react-i18next';
import { FormField, SelectField } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { ApprovalFormIntegerField } from './approval-form-builder-integer-field';
import { canChangeTypedCalculationOperator } from './approval-form-builder-typed-model';
import type {
  ApprovalTypedCalculation,
  ApprovalTypedField,
} from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

const operators = [
  'CONST',
  'FIELD',
  'SUM',
  'ADD',
  'SUBTRACT',
  'MULTIPLY',
  'DIVIDE',
  'MIN',
  'MAX',
  'ROUND',
] as const;
const zero = (): ApprovalTypedCalculation => ({ op: 'CONST', value: '0' });

export function ApprovalFormCalculationEditor({
  expression,
  fields,
  onChange,
  label,
  rowScope = false,
  depth = 0,
}: {
  expression: ApprovalTypedCalculation;
  fields: readonly ApprovalTypedField[];
  onChange: (expression: ApprovalTypedCalculation) => void;
  label?: string;
  rowScope?: boolean;
  depth?: number;
}) {
  const { t } = useTranslation('approvals');
  const numeric = fields.filter((field) => ['NUMBER', 'CALCULATED_NUMBER'].includes(field.type));
  const groups = fields.filter(
    (field) =>
      field.type === 'REPEATING_GROUP' &&
      field.fields.some((child) => ['NUMBER', 'CALCULATED_NUMBER'].includes(child.type))
  );
  const setOperator = (op: (typeof operators)[number]) => {
    if (op === 'CONST') onChange(zero());
    else if (op === 'FIELD') onChange({ op, field: numeric[0]?.key ?? '' });
    else if (op === 'SUM') {
      const group = groups[0];
      onChange({
        op,
        group: group?.key ?? '',
        field:
          group?.type === 'REPEATING_GROUP'
            ? (group.fields.find((field) => ['NUMBER', 'CALCULATED_NUMBER'].includes(field.type))
                ?.key ?? '')
            : '',
      });
    } else if (op === 'ROUND') onChange({ op, args: [expression], scale: 2 });
    else onChange({ op, args: [zero(), zero()] });
  };
  const group =
    expression.op === 'SUM' ? groups.find((field) => field.key === expression.group) : undefined;
  return (
    <Stack
      component="section"
      aria-label={label ?? t('admin.typedForm.calculation')}
      gap={1}
      sx={{ borderLeft: depth ? 1 : 0, borderColor: 'divider', pl: depth ? 1 : 0 }}
    >
      <Box sx={{ typography: 'subtitle2' }}>{label ?? t('admin.typedForm.calculation')}</Box>
      <SelectField
        size="small"
        label={t('admin.typedForm.operator')}
        value={expression.op}
        options={operators.map((op) => ({
          value: op,
          label: t(`admin.typedForm.calculationOperators.${op}`),
          disabled:
            (op === 'FIELD' && !numeric.length) ||
            (op === 'SUM' &&
              (rowScope ||
                !groups.some(
                  (field) =>
                    field.type === 'REPEATING_GROUP' &&
                    field.fields.some((child) =>
                      ['NUMBER', 'CALCULATED_NUMBER'].includes(child.type)
                    )
                ))) ||
            !canChangeTypedCalculationOperator(expression, op, depth),
        }))}
        onValueChange={(op) => {
          if (op) setOperator(op);
        }}
      />
      {expression.op === 'CONST' ? (
        <FormField
          size="small"
          label={t('admin.typedForm.value')}
          value={expression.value}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          onChange={(event) => onChange({ ...expression, value: event.target.value })}
        />
      ) : null}
      {expression.op === 'FIELD' ? (
        <SelectField
          size="small"
          label={t('admin.typedForm.reference')}
          value={expression.field}
          options={numeric.map((field) => ({ value: field.key, label: field.key }))}
          onValueChange={(field) => onChange({ ...expression, field })}
        />
      ) : null}
      {expression.op === 'SUM' ? (
        <>
          <SelectField
            size="small"
            label={t('admin.typedForm.group')}
            value={expression.group}
            options={groups.map((field) => ({ value: field.key, label: field.key }))}
            onValueChange={(key) => {
              const next = groups.find((field) => field.key === key);
              onChange({
                ...expression,
                group: key,
                field:
                  next?.type === 'REPEATING_GROUP'
                    ? (next.fields.find((field) =>
                        ['NUMBER', 'CALCULATED_NUMBER'].includes(field.type)
                      )?.key ?? '')
                    : '',
              });
            }}
          />
          <SelectField
            size="small"
            label={t('admin.typedForm.rowField')}
            value={expression.field}
            options={
              group?.type === 'REPEATING_GROUP'
                ? group.fields
                    .filter((field) => ['NUMBER', 'CALCULATED_NUMBER'].includes(field.type))
                    .map((field) => ({ value: field.key, label: field.key }))
                : []
            }
            onValueChange={(field) => onChange({ ...expression, field })}
          />
        </>
      ) : null}
      {'args' in expression ? (
        <>
          {expression.args.map((operand, index) => (
            <ApprovalFormCalculationEditor
              key={index}
              expression={operand}
              fields={fields}
              label={t(
                index === 0 ? 'admin.typedForm.leftOperand' : 'admin.typedForm.rightOperand'
              )}
              rowScope={rowScope}
              depth={depth + 1}
              onChange={(next) =>
                onChange(
                  expression.op === 'ROUND'
                    ? { ...expression, args: [next] }
                    : {
                        ...expression,
                        args: [
                          index === 0 ? next : expression.args[0],
                          index === 1 ? next : expression.args[1],
                        ],
                      }
                )
              }
            />
          ))}
          {expression.op === 'ROUND' ? (
            <ApprovalFormIntegerField
              label={t('admin.typedForm.scale')}
              value={expression.scale}
              min={0}
              max={8}
              onChange={(scale) => {
                if (scale !== undefined) onChange({ ...expression, scale });
              }}
            />
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
