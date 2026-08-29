import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applyMailLifecycle, useToast } from '@dwp-frontend/shared-utils';
import { ActionButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

import type { MailLifecycleAction, MailThread } from '@dwp-frontend/shared-utils';

type ReversibleMailLifecycleAction = Extract<MailLifecycleAction, 'ARCHIVE' | 'SPAM' | 'TRASH'>;

export type MailLifecycleUndoState = {
  action: ReversibleMailLifecycleAction;
  thread: MailThread;
};

export function MailLifecycleUndo({
  state,
  onClose,
  onRestored,
}: {
  state: MailLifecycleUndoState | null;
  onClose: () => void;
  onRestored: (thread: MailThread) => void | Promise<void>;
}) {
  const { t } = useTranslation('mail');
  const toast = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => {
      if (!state) throw new Error('A reversible mail lifecycle action is required.');
      return applyMailLifecycle(state.thread.threadId, 'RESTORE', state.thread.version);
    },
    onSuccess: async (result) => {
      if (!result.thread) throw new Error('Restored mail thread is required.');
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      await onRestored(result.thread);
      onClose();
      toast.success(t('lifecycle.success.RESTORE'));
    },
    onError: () => toast.error(t('lifecycle.undoError')),
  });

  return (
    <Snackbar
      open={Boolean(state)}
      autoHideDuration={7_000}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      onClose={(_event, reason) => {
        if (reason !== 'clickaway' && !mutation.isPending) onClose();
      }}
    >
      <Alert
        severity="success"
        variant="filled"
        action={
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<RotateCcw size={15} />}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
            sx={{ color: 'inherit' }}
          >
            {t('lifecycle.undo')}
          </ActionButton>
        }
        sx={{ alignItems: 'center' }}
      >
        {state ? t(`lifecycle.success.${state.action}`) : ''}
      </Alert>
    </Snackbar>
  );
}
