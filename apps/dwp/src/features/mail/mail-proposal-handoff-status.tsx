import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MailProposalHandoff } from '@dwp-frontend/shared-utils';

function handoffSeverity(status: MailProposalHandoff['status']) {
  if (status === 'EXECUTED') return 'success' as const;
  if (status === 'FAILED') return 'error' as const;
  if (status === 'CANCELLED') return 'info' as const;
  return 'warning' as const;
}

export function MailProposalHandoffStatus({
  handoff,
  loading,
  error,
  onRetry,
}: {
  handoff?: MailProposalHandoff;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('mail');
  if (loading) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        {t('proposal.handoff.loading')}
      </Alert>
    );
  }
  if (error || !handoff) {
    return (
      <Alert
        severity="error"
        sx={{ mt: 2 }}
        action={
          <ActionButton intent="quiet" size="small" onClick={onRetry}>
            {t('actions.retry')}
          </ActionButton>
        }
      >
        {t('proposal.handoff.loadError')}
      </Alert>
    );
  }
  return (
    <Alert severity={handoffSeverity(handoff.status)} sx={{ mt: 2 }}>
      <Stack spacing={0.35}>
        <Typography variant="body2" fontWeight={750}>
          {t(`proposal.handoff.status.${handoff.status}`)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('proposal.handoff.command', { commandId: handoff.commandId })}
        </Typography>
        {handoff.resultRef && (
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t('proposal.handoff.result', { resultRef: handoff.resultRef })}
          </Typography>
        )}
      </Stack>
    </Alert>
  );
}
