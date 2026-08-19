import { ExternalLink, FileText, LockKeyhole } from 'lucide-react';
import { ActionButton, ContentDialog } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { AskCitation } from '@dwp-frontend/shared-utils';

type DwaionCitationDialogProps = {
  citation: AskCitation | null;
  onClose: () => void;
  onOpenSource: (citation: AskCitation) => void;
};

export function DwaionCitationDialog({
  citation,
  onClose,
  onOpenSource,
}: DwaionCitationDialogProps) {
  const { t, i18n } = useTranslation('work');
  return (
    <ContentDialog
      open={Boolean(citation)}
      title={citation?.title ?? ''}
      description={t('askPage.citationPreview.description')}
      closeLabel={t('askPage.citationPreview.close')}
      onClose={onClose}
      maxWidth="sm"
    >
      {citation && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip size="small" label={t(`askPage.sourceTypes.${citation.sourceType}`)} />
            <Chip size="small" variant="outlined" label={citation.sourceSystem} />
            {citation.occurredAt && (
              <Chip
                size="small"
                variant="outlined"
                label={formatDate(
                  citation.occurredAt,
                  { dateStyle: 'medium', timeStyle: 'short' },
                  resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
                )}
              />
            )}
          </Stack>
          <Box sx={{ p: 2, bgcolor: 'action.hover', borderLeft: 3, borderColor: 'primary.main' }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <FileText size={18} aria-hidden="true" />
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {citation.excerpt || t('askPage.citationPreview.noExcerpt')}
              </Typography>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <LockKeyhole size={15} aria-hidden="true" />
            <Typography variant="caption" color="text.secondary">
              {t('askPage.citationPreview.scope')}
            </Typography>
          </Stack>
          {citation.route && (
            <ActionButton
              intent="primary"
              endIcon={<ExternalLink size={16} aria-hidden="true" />}
              onClick={() => onOpenSource(citation)}
            >
              {t('askPage.citationPreview.openSource')}
            </ActionButton>
          )}
        </Stack>
      )}
    </ContentDialog>
  );
}
