import { useTranslation } from 'react-i18next';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PriorityChip } from './approval-ui';
import { ApprovalPayloadData } from './approval-payload-data';

import type {
  ApprovalFormField,
  ApprovalPriority,
  ApprovalFormSchema,
} from '@dwp-frontend/shared-utils';

export function ApprovalRequestPreflightSummary({
  title,
  summary,
  priority,
  fields,
  values,
  typedPayload,
  formSchema,
}: {
  title: string;
  summary: string;
  priority: ApprovalPriority;
  fields: readonly ApprovalFormField[];
  values: Readonly<Record<string, string>>;
  typedPayload?: Readonly<Record<string, unknown>>;
  formSchema?: ApprovalFormSchema;
}) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  return (
    <Box component="section" aria-label={t('requests.detail.title')}>
      <Stack gap={1.5} sx={{ pb: 2 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Typography component="h3" variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
          <PriorityChip priority={priority} />
        </Stack>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {summary}
        </Typography>
        {typedPayload ? (
          <ApprovalPayloadData
            payload={{ ...typedPayload }}
            formSchema={formSchema}
            hideSystemFields
          />
        ) : (
          <Box component="dl" sx={{ m: 0 }}>
            {fields
              .filter((field) => values[field.key]?.trim())
              .map((field) => (
                <Box
                  key={field.key}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'minmax(110px, .4fr) minmax(0, 1fr)' },
                    gap: 0.75,
                    py: 1,
                    borderTop: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography component="dt" variant="caption" color="text.secondary">
                    {(korean ? field.labelKo : field.labelEn) || field.key}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="body2"
                    sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {values[field.key]}
                  </Typography>
                </Box>
              ))}
          </Box>
        )}
      </Stack>
      <Divider />
    </Box>
  );
}
