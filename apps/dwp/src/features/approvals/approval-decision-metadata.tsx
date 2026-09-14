import { Building2, CalendarClock, GitBranch, RefreshCw, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

type MetadataItem = {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
};

export function ApprovalDecisionMetadata({
  detail,
  verifiedAt,
}: {
  detail: ApprovalTaskDetail;
  verifiedAt?: number;
}) {
  const { t, i18n } = useTranslation('approvals');
  const english = i18n.resolvedLanguage?.toLowerCase().startsWith('en') ?? false;
  const task = detail.task;
  const items: MetadataItem[] = [
    {
      key: 'requester',
      label: t('inbox.metadata.requester'),
      value: task.requesterName ?? t('home.unknownRequester'),
      icon: UserRound,
    },
    {
      key: 'organization',
      label: t('inbox.metadata.organization'),
      value: task.requesterOrgName ?? t('inbox.metadata.unknown'),
      icon: Building2,
    },
    {
      key: 'workflow',
      label: t('inbox.metadata.workflow'),
      value: english ? task.workflowNameEn : task.workflowNameKo,
      icon: GitBranch,
    },
    {
      key: 'due',
      label: t('inbox.metadata.dueAt'),
      value: task.dueAt
        ? formatDate(task.dueAt, { dateStyle: 'medium', timeStyle: 'short' })
        : t('home.commandCenter.noDueDate'),
      icon: CalendarClock,
    },
    {
      key: 'verified',
      label: t('inbox.metadata.verifiedAt'),
      value: verifiedAt
        ? formatDate(new Date(verifiedAt).toISOString(), {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : t('home.commandCenter.checkingFreshness'),
      icon: RefreshCw,
    },
  ];

  return (
    <Box
      component="ul"
      sx={{
        m: 0,
        mt: 1.5,
        p: 0,
        listStyle: 'none',
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          sm: 'repeat(2, minmax(0, 1fr))',
          xl: 'repeat(5, minmax(0, 1fr))',
        },
        gap: 1,
      }}
    >
      {items.map(({ key, label, value, icon: Icon }) => (
        <Stack
          component="li"
          key={key}
          direction="row"
          alignItems="flex-start"
          gap={0.75}
          sx={{ minWidth: 0 }}
        >
          <Box sx={{ mt: 0.15, color: 'text.secondary', flex: '0 0 auto' }}>
            <Icon size={15} aria-hidden="true" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="span" variant="caption" color="text.secondary" display="block">
              {label}
            </Typography>
            <Typography
              component="span"
              variant="caption"
              fontWeight="fontWeightBold"
              display="block"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {value}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Box>
  );
}
