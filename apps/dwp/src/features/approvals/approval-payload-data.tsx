import { useTranslation } from 'react-i18next';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { isApprovalTypedFormSchema } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { ApprovalFormSchema, ApprovalTypedField } from '@dwp-frontend/shared-utils';

type ApprovalPayloadDataProps = {
  payload: Record<string, unknown>;
  formSchema?: ApprovalFormSchema;
  hideSystemFields?: boolean;
  labelWidth?: string;
};

function displayValue(value: unknown) {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function ApprovalRepeatingPayload({
  field,
  value,
  korean,
}: {
  field: Extract<ApprovalTypedField, { type: 'REPEATING_GROUP' }>;
  value: unknown;
  korean: boolean;
}) {
  if (!Array.isArray(value))
    return (
      <Typography component="dd" sx={{ m: 0 }}>
        —
      </Typography>
    );
  return (
    <Box component="dd" sx={{ m: 0, display: 'grid', gap: 1.5 }}>
      {value.map((row, index) => (
        <Box key={index} component="dl" sx={{ m: 0, p: 0, display: 'grid', gap: 0.75 }}>
          {field.fields.map((child) => (
            <Box key={child.key} sx={{ minWidth: 0 }}>
              <Typography component="dt" variant="caption" color="text.secondary">
                {korean ? child.labelKo : child.labelEn}
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                {displayValue(row && typeof row === 'object' ? row[child.key] : undefined)}
              </Typography>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

export function ApprovalPayloadData({
  payload,
  formSchema,
  hideSystemFields = false,
  labelWidth = 'minmax(120px, .4fr)',
}: ApprovalPayloadDataProps) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const repeatingFields = new Map(
    formSchema && isApprovalTypedFormSchema(formSchema)
      ? formSchema.fields
          .filter((field) => field.type === 'REPEATING_GROUP')
          .map((field) => [field.key, field])
      : []
  );
  const labels = new Map(
    (formSchema?.fields ?? []).map((field) => [
      field.key,
      (korean ? field.labelKo : field.labelEn) || field.key,
    ])
  );

  return (
    <Box component="dl" sx={{ m: 0, p: 2, display: 'grid', gap: 1.25 }}>
      {Object.entries(payload)
        .filter(([key]) => !hideSystemFields || key !== 'createdFrom')
        .map(([key, value]) => (
          <Box
            key={key}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: `${labelWidth} 1fr` },
              gap: { xs: 0.25, sm: 2 },
            }}
          >
            <Typography component="dt" variant="caption" color="text.secondary">
              {labels.get(key) ?? t(`requestFields.${key}`, { defaultValue: key })}
            </Typography>
            {repeatingFields.has(key) ? (
              <ApprovalRepeatingPayload
                field={repeatingFields.get(key)!}
                value={value}
                korean={korean}
              />
            ) : (
              <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                {displayValue(value)}
              </Typography>
            )}
          </Box>
        ))}
    </Box>
  );
}
