import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { ApprovalFormSchema } from '@dwp-frontend/shared-utils';

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

export function ApprovalPayloadData({
  payload,
  formSchema,
  hideSystemFields = false,
  labelWidth = 'minmax(120px, .4fr)',
}: ApprovalPayloadDataProps) {
  const { t, i18n } = useTranslation('approvals');
  const korean = i18n.resolvedLanguage?.startsWith('ko');
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
            <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
              {displayValue(value)}
            </Typography>
          </Box>
        ))}
    </Box>
  );
}
