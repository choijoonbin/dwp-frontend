import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleAlert, LockKeyhole, MinusCircle } from 'lucide-react';
import { ActionButton, FormDialog } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { Link } from 'react-router-dom';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { WorkHubSourceId, WorkHubSourceSnapshot } from './work-hub-contracts';

const sourceListRoutes: Partial<Record<WorkHubSourceId, string>> = {
  'approval-inbox': '/approvals/inbox',
  'approval-completed': '/approvals/completed',
  'approval-needs-info': '/approvals/requests/needs-info',
  services: '/services/my',
};

export function WorkHubSourceStatusDialog({
  open,
  sources,
  onClose,
  onRetry,
  onRetrySource,
  retrying,
  onOpenBatchResults,
  batchResultCount = 0,
}: {
  open: boolean;
  sources: readonly WorkHubSourceSnapshot[];
  onClose: () => void;
  onRetry: () => void;
  onRetrySource?: (sourceId: WorkHubSourceId) => void;
  retrying: boolean;
  onOpenBatchResults?: () => void;
  batchResultCount?: number;
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
      maxWidth="md"
    >
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Chip
          color="success"
          variant="outlined"
          label={t('work:workHub.sourcesDialog.readyCount', {
            count: sources.filter((source) => source.state === 'READY').length,
          })}
        />
        <Chip
          color="warning"
          variant="outlined"
          label={t('work:workHub.sourcesDialog.attentionCount', {
            count: sources.filter((source) => ['UNAVAILABLE', 'FORBIDDEN'].includes(source.state))
              .length,
          })}
        />
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
          gap: 1.5,
        }}
      >
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
                borderColor: source.state === 'UNAVAILABLE' ? 'error.main' : 'divider',
                bgcolor: source.state === 'UNAVAILABLE' ? 'action.hover' : 'background.paper',
                borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              }}
            >
              <Stack direction="row" justifyContent="space-between" gap={2} alignItems="flex-start">
                <Stack direction="row" gap={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                  <Icon size={19} aria-hidden="true" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2">
                      {t(`work:workHub.sourceIds.${source.sourceId}`)}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {source.state === 'READY'
                        ? t('work:workHub.sourcesDialog.itemCount', { count: source.items.length })
                        : t(`work:workHub.sourcesDialog.stateHelp.${source.state}`)}
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
              {source.state !== 'NOT_REQUESTED' && (
                <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                  {onRetrySource && (
                    <ActionButton
                      intent="secondary"
                      disabled={retrying}
                      onClick={() => onRetrySource(source.sourceId)}
                      aria-label={t('work:workHub.sourcesDialog.retrySourceLabel', {
                        source: t(`work:workHub.sourceIds.${source.sourceId}`),
                      })}
                      sx={{ minHeight: 44 }}
                    >
                      {t('work:workHub.sourcesDialog.retrySource')}
                    </ActionButton>
                  )}
                  {sourceListRoutes[source.sourceId] && source.state !== 'FORBIDDEN' && (
                    <ActionButton
                      intent="quiet"
                      component={Link}
                      to={sourceListRoutes[source.sourceId]}
                      sx={{ minHeight: 44 }}
                    >
                      {t('work:workHub.sourcesDialog.openSource')}
                    </ActionButton>
                  )}
                </Stack>
              )}
            </Box>
          );
        })}
      </Box>
      {onOpenBatchResults && batchResultCount > 0 && (
        <Box
          sx={{
            mt: 2,
            p: 2,
            bgcolor: 'action.hover',
            borderRadius: (theme) => `${theme.shape.borderRadius}px`,
          }}
        >
          <Typography variant="subtitle2">{t('work:workHub.batch.reportTitle')}</Typography>
          <ActionButton
            intent="secondary"
            sx={{ mt: 1, '@media (max-width:599.95px)': { minHeight: 44 } }}
            onClick={onOpenBatchResults}
          >
            {t('work:workHub.batch.reopenReport')} ({batchResultCount})
          </ActionButton>
        </Box>
      )}
    </FormDialog>
  );
}
