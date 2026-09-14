import { useState } from 'react';
import { Copy, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionIconButton } from '@dwp-frontend/design-system';
import { useToast } from '@dwp-frontend/shared-utils';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

export function ApprovalDecisionUtilities({
  detail,
  revalidate,
}: {
  detail: ApprovalTaskDetail;
  revalidate: () => Promise<ApprovalTaskDetail>;
}) {
  const { t } = useTranslation('approvals');
  const toast = useToast();
  const [copying, setCopying] = useState(false);
  const copyIdentifier = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const latest = await revalidate();
      await navigator.clipboard.writeText(latest.task.requestNumber);
      toast.success(t('inbox.utilities.identifierCopied'));
    } catch {
      toast.error(t('inbox.utilities.copyFailed'));
    } finally {
      setCopying(false);
    }
  };
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap={1}
      sx={{ mb: 1 }}
    >
      <Typography variant="caption" color="primary.main" sx={{ overflowWrap: 'anywhere' }}>
        {detail.task.requestNumber}
      </Typography>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <ActionIconButton
          label={t('inbox.utilities.copyIdentifier')}
          loading={copying}
          onClick={() => void copyIdentifier()}
        >
          <Copy size={16} />
        </ActionIconButton>
        <ActionIconButton
          label={t('inbox.utilities.history')}
          onClick={() => {
            const heading = document.getElementById('approval-audit-timeline-title');
            heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
            heading?.focus({ preventScroll: true });
          }}
        >
          <History size={16} />
        </ActionIconButton>
      </Stack>
    </Stack>
  );
}
