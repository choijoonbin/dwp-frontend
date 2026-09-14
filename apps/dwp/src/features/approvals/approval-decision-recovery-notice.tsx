import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ApprovalDecisionKind } from './approval-decision-detail';

export type ApprovalDecisionRecovery = {
  kind: 'CONFLICT' | 'DENIED' | 'UNAVAILABLE';
  command: 'CLAIM' | 'DECISION';
  decision?: ApprovalDecisionKind;
  taskId: string;
};

export function ApprovalDecisionRecoveryNotice({
  recovery,
  busy,
  onRecover,
}: {
  recovery: ApprovalDecisionRecovery;
  busy: boolean;
  onRecover: () => void;
}) {
  const { t } = useTranslation('approvals');
  const copyKey = recovery.command === 'CLAIM' ? 'inbox.claimRecovery' : 'inbox.decisionRecovery';
  return (
    <Box
      role="alert"
      sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1}
      >
        <Box>
          <Typography component="p" variant="subtitle2">
            {t(`${copyKey}.${recovery.kind}.title`)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(`${copyKey}.${recovery.kind}.description`)}
          </Typography>
        </Box>
        <ActionButton intent="secondary" size="small" loading={busy} onClick={onRecover}>
          {t(
            recovery.kind === 'CONFLICT' ? `${copyKey}.reviewLatest` : `${copyKey}.retryAuthority`
          )}
        </ActionButton>
      </Stack>
    </Box>
  );
}
