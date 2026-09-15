import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

export function ApprovalDecisionConfirmationSummary({
  detail,
  verifiedAt,
}: {
  detail: ApprovalTaskDetail;
  verifiedAt?: number;
}) {
  const { t } = useTranslation('approvals');
  const titleId = useId();
  const task = detail.task;
  const items = [
    {
      key: 'requester',
      label: t('inbox.confirmation.requester'),
      value: task.requesterName ?? t('home.unknownRequester'),
    },
    {
      key: 'stage',
      label: t('inbox.confirmation.stage'),
      value: t('inbox.stageProgress', { current: task.stepSequence, name: task.stepName }),
    },
    {
      key: 'risk',
      label: t('inbox.confirmation.risk'),
      value: t('inbox.confirmation.riskValue', { score: task.riskScore }),
    },
    {
      key: 'version',
      label: t('inbox.confirmation.version'),
      value: String(task.version),
    },
    {
      key: 'verifiedAt',
      label: t('inbox.confirmation.verifiedAt'),
      value: verifiedAt
        ? formatDate(new Date(verifiedAt).toISOString(), {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        : t('inbox.metadata.unknown'),
    },
  ];

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{
        mb: 2,
        p: 1.5,
        border: 1,
        borderColor: 'divider',
        borderLeft: 3,
        borderLeftColor:
          task.riskScore >= 80
            ? 'error.main'
            : task.riskScore >= 60
              ? 'warning.main'
              : 'primary.main',
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography id={titleId} component="h3" variant="subtitle2">
          {t('inbox.confirmation.targetTitle')}
        </Typography>
        <Chip size="small" variant="outlined" label={task.requestNumber} />
      </Stack>
      <Typography variant="body2" fontWeight="fontWeightBold" sx={{ mt: 0.75 }}>
        {task.title}
      </Typography>
      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 1.25,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        {items.map(({ key, label, value }) => (
          <Box key={key} sx={{ minWidth: 0 }}>
            <Typography component="dt" variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography
              component="dd"
              variant="body2"
              sx={{ m: 0, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
