import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import type { TFunction } from 'i18next';
import type {
  ApprovalTypedCalculation,
  ApprovalTypedCondition,
  ApprovalTypedField,
  ApprovalTypedFormSchema,
} from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

function conditionText(rule: ApprovalTypedCondition, t: TFunction<'approvals'>): string {
  const op = t(`admin.typedForm.conditionOperators.${rule.op}`);
  if ('args' in rule)
    return `${op} (${rule.args.map((child) => conditionText(child, t)).join('; ')})`;
  if (rule.op === 'PRESENT') return `${rule.field}: ${op}`;
  return `${rule.field}: ${op} ${rule.op === 'IN' ? rule.values.join(', ') : String(rule.value)}`;
}
function calculationText(expression: ApprovalTypedCalculation, t: TFunction<'approvals'>): string {
  if (expression.op === 'CONST') return String(expression.value);
  if (expression.op === 'FIELD') return expression.field;
  if (expression.op === 'SUM')
    return `${t('admin.typedForm.calculationOperators.SUM')} (${expression.group}.${expression.field})`;
  return `${t(`admin.typedForm.calculationOperators.${expression.op}`)} (${expression.args.map((child) => calculationText(child, t)).join(', ')}${expression.op === 'ROUND' ? `; ${expression.scale}` : ''})`;
}

export function ApprovalTypedDefinitionInspector({
  schema,
  korean,
}: {
  schema: ApprovalTypedFormSchema;
  korean: boolean;
}) {
  const { t } = useTranslation('approvals');
  const item = (field: ApprovalTypedField, path: string) => (
    <Box key={path} sx={{ p: 2, borderBottom: 1, borderColor: 'divider', minWidth: 0 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <Box minWidth={0}>
          <Box sx={{ typography: 'subtitle2', overflowWrap: 'anywhere' }}>
            {(korean ? field.labelKo : field.labelEn) || field.key}
          </Box>
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{path}</Box>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          label={t(`admin.typedForm.fieldTypes.${field.type}`)}
        />
      </Stack>
      <Stack
        component="dl"
        gap={0.75}
        sx={{ m: 0, mt: 1, typography: 'caption', overflowWrap: 'anywhere' }}
      >
        {[
          [
            t('admin.studio.required'),
            t(field.required ? 'admin.studio.required' : 'admin.studio.optional'),
          ],
          ...(field.visibleWhen
            ? [[t('admin.typedForm.visibleWhen'), conditionText(field.visibleWhen, t)]]
            : []),
          ...(field.requiredWhen
            ? [[t('admin.typedForm.requiredWhen'), conditionText(field.requiredWhen, t)]]
            : []),
          ...(field.type === 'CALCULATED_NUMBER'
            ? [[t('admin.typedForm.calculation'), calculationText(field.calculation, t)]]
            : []),
          ...(field.type === 'SELECT'
            ? [[t('admin.studio.options'), field.options.join(', ')]]
            : []),
          ...('min' in field && field.min != null
            ? [[t('admin.typedForm.minimum'), String(field.min)]]
            : []),
          ...('max' in field && field.max != null
            ? [[t('admin.typedForm.maximum'), String(field.max)]]
            : []),
          ...('minLength' in field && field.minLength != null
            ? [[t('admin.typedForm.minLength'), String(field.minLength)]]
            : []),
          ...('maxLength' in field && field.maxLength != null
            ? [[t('admin.typedForm.maxLength'), String(field.maxLength)]]
            : []),
          ...(field.type === 'REPEATING_GROUP'
            ? [
                [t('admin.typedForm.minRows'), String(field.minRows ?? 0)],
                [t('admin.typedForm.maxRows'), String(field.maxRows ?? 20)],
              ]
            : []),
        ].map(([label, value]) => (
          <Box
            key={label}
            sx={{ display: 'grid', gridTemplateColumns: 'minmax(80px,.4fr) minmax(0,1fr)', gap: 1 }}
          >
            <Box component="dt" color="text.secondary">
              {label}
            </Box>
            <Box component="dd" sx={{ m: 0 }}>
              {value}
            </Box>
          </Box>
        ))}
      </Stack>
      {(korean ? field.helpKo : field.helpEn) ? (
        <Box sx={{ mt: 1, typography: 'caption', color: 'text.secondary' }}>
          {korean ? field.helpKo : field.helpEn}
        </Box>
      ) : null}
      {field.type === 'REPEATING_GROUP' ? (
        <Box sx={{ pl: 1, mt: 1, borderLeft: 2, borderColor: 'divider' }}>
          {field.fields.map((child) => item(child, `${path}.${child.key}`))}
        </Box>
      ) : null}
    </Box>
  );
  return <Box>{schema.fields.map((field) => item(field, field.key))}</Box>;
}
