import { useTranslation } from 'react-i18next';
import { ActionButton, ContentDialog } from '@dwp-frontend/design-system';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { RecommendationUndoSnackbar } from '../recommendation-undo-snackbar';

import type { useHomeRecommendationFeedback } from './use-home-recommendation-feedback';
import type { useHomeRecommendationCommand } from './use-home-recommendation-command';

export type HomeRecommendationAction = Readonly<{
  busy: boolean;
  command: ReturnType<typeof useHomeRecommendationCommand>;
  dismiss:
    | ReturnType<typeof useHomeRecommendationCommand>['dismiss']
    | ReturnType<typeof useHomeRecommendationFeedback>['dismiss'];
  legacy: ReturnType<typeof useHomeRecommendationFeedback>;
  legacyEnabled: boolean;
}>;

const COMMAND_STATUS_LABELS = {
  ACCEPTED: 'command.status.accepted',
  COMPLETED: 'command.status.completed',
  CONFLICT: 'command.status.conflict',
  DENIED: 'command.status.denied',
  UNAVAILABLE: 'command.status.unavailable',
  UNKNOWN: 'command.status.unknown',
} as const;

export function HomeRecommendationActionFeedback({
  action,
}: Readonly<{ action: HomeRecommendationAction }>) {
  const { t } = useTranslation('home');
  const { command, legacy } = action;
  const commandStatusLabel =
    command.feedbackStatus && command.feedbackStatus in COMMAND_STATUS_LABELS
      ? COMMAND_STATUS_LABELS[command.feedbackStatus as keyof typeof COMMAND_STATUS_LABELS]
      : null;
  return (
    <>
      <RecommendationUndoSnackbar
        open={action.legacyEnabled && Boolean(legacy.hidden)}
        busy={legacy.undoBusy}
        onClose={legacy.clear}
        onUndo={legacy.undo}
      />
      <ContentDialog
        open={command.status === 'CONFIRMING' || command.status === 'PENDING'}
        title={t('command.dismiss.title')}
        description={t('command.dismiss.description')}
        closeLabel={t('actions.close', { ns: 'common' })}
        onClose={command.cancel}
        busy={command.busy}
        footerContent={
          <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ width: 1 }}>
            <ActionButton intent="quiet" onClick={command.cancel} disabled={command.busy}>
              {t('actions.cancel', { ns: 'common' })}
            </ActionButton>
            <ActionButton
              intent="primary"
              onClick={command.confirm}
              loading={command.busy}
              loadingLabel={t('command.dismiss.pending')}
            >
              {t('command.dismiss.confirm')}
            </ActionButton>
          </Stack>
        }
      >
        <Typography variant="body2" color="text.secondary">
          {command.pendingRecommendation?.title ?? t('command.dismiss.fallbackTitle')}
        </Typography>
      </ContentDialog>
      <Snackbar
        open={commandStatusLabel !== null}
        autoHideDuration={command.feedbackStatus === 'UNKNOWN' ? null : 8000}
        message={commandStatusLabel ? t(commandStatusLabel) : ''}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') command.clearStatus();
        }}
      />
    </>
  );
}
