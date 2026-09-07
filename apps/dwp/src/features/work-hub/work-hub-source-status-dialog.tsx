import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleAlert, LockKeyhole, MinusCircle } from 'lucide-react';
import { FormDialog } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { WorkHubSourceSnapshot } from './work-hub-contracts';

export function WorkHubSourceStatusDialog({
  open,
  sources,
  onClose,
  onRetry,
  retrying,
}: {
  open: boolean;
  sources: readonly WorkHubSourceSnapshot[];
  onClose: () => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { t } = useTranslation(['work', 'common']);
  return (
    <FormDialog
      open={open}
      title={t('work:workHub.sourcesDialog.title')}
      description={t('work:workHub.sourcesDialog.description')}
      cancelLabel={t('common:actions.close')}
      submitLabel={t('work:workHub.sourcesDialog.retry')}
      submittingLabel={t('work:workHub.sourcesDialog.retrying')}
      busy={retrying}
      onClose={onClose}
      onSubmit={onRetry}
      mobileFullScreen
    >
      <Stack gap={1.25}>
        {sources.map((source) => {
          const Icon =
            source.state === 'READY'
              ? CheckCircle2
              : source.state === 'FORBIDDEN'
                ? LockKeyhole
                : source.state === 'NOT_REQUESTED'
                  ? MinusCircle
                  : CircleAlert;
          return (
            <Box
              key={source.sourceId}
              sx={{
                p: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: 'shape.borderRadius',
              }}
            >
              <Stack direction="row" justifyContent="space-between" gap={2} alignItems="flex-start">
                <Stack direction="row" gap={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                  <Icon size={19} aria-hidden="true" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2">
                      {t(`work:workHub.sourceIds.${source.sourceId}`)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.25 }}
                    >
                      {source.receivedAt
                        ? t('work:workHub.sourcesDialog.receivedAt', {
                            date: formatDate(source.receivedAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }),
                          })
                        : t(`work:workHub.sourcesDialog.stateHelp.${source.state}`)}
                    </Typography>
                    {source.hasMore && (
                      <Typography
                        variant="caption"
                        color="warning.main"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {t('work:workHub.sourcesDialog.moreResults')}
                      </Typography>
                    )}
                  </Box>
                </Stack>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t(`work:workHub.sourcesDialog.states.${source.state}`)}
                  color={
                    source.state === 'READY'
                      ? 'success'
                      : source.state === 'UNAVAILABLE'
                        ? 'error'
                        : 'default'
                  }
                />
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </FormDialog>
  );
}
