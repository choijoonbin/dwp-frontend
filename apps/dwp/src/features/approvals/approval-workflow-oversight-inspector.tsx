import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import { StatusChip } from './approval-ui';

import type { ApprovalWorkflowOversightProjection } from '@dwp-frontend/shared-utils';

export function ApprovalWorkflowOversightInspector({
  workflow,
  locale,
}: {
  workflow: ApprovalWorkflowOversightProjection;
  locale?: string;
}) {
  const { t, i18n } = useTranslation('approvals');
  const resolvedLocale = resolveSupportedLocale(locale, i18n.resolvedLanguage, i18n.language);
  const korean = resolvedLocale === 'ko';

  return (
    <Stack gap={2} minWidth={0}>
      <InlineFeedback severity="info">{t('admin.workflows.metadataOnly')}</InlineFeedback>
      <Box
        component="section"
        sx={{
          p: { xs: 2, md: 2.5 },
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Box component="h2" sx={{ m: 0, typography: 'h5' }}>
            {korean ? workflow.nameKo : workflow.nameEn}
          </Box>
          <StatusChip status={workflow.lifecycleState} />
          <Chip size="small" variant="outlined" label={workflow.category} />
        </Stack>
        <Box sx={{ mt: 1, typography: 'caption', color: 'text.secondary' }}>
          {workflow.workflowKey}
          {' · '}
          {t('admin.formCatalog.forms.updatedAt', {
            date: formatDate(workflow.updatedAt, { dateStyle: 'short' }, resolvedLocale),
          })}
        </Box>
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2,minmax(0,1fr))',
              md: 'repeat(4,minmax(0,1fr))',
            },
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          {[
            [t('admin.studio.category'), workflow.category],
            [t('admin.studio.classification'), workflow.dataClassification],
            [t('admin.studio.workflowSla'), t('admin.minutes', { count: workflow.slaMinutes })],
            [t('admin.formCatalog.inspector.version'), `v${workflow.currentVersion}`],
          ].map(([label, value]) => (
            <Box key={String(label)} sx={{ pt: 1.5, pr: 2 }}>
              <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{String(label)}</Box>
              <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold' }}>{String(value)}</Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Stack>
  );
}
