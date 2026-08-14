import { ArrowRight, FileCheck2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GlyphSurface } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type {
  ApprovalPriority,
  ApprovalRequestStatus,
  ApprovalTaskStatus,
} from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

export const approvalTone = {
  primary: '#2856C7',
  teal: '#087E72',
  amber: '#B06B00',
  red: '#B93C45',
  ink: '#101923',
} as const;

export function ApprovalPageHeader({ view, icon: Icon }: { view: string; icon: LucideIcon }) {
  const { t } = useTranslation('approvals');
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        pb: 2.5,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" gap={1.5} alignItems="flex-start">
        <GlyphSurface size={42} variant="soft">
          <Icon size={21} strokeWidth={1.8} />
        </GlyphSurface>
        <Box>
          <Typography variant="overline" color="primary.main">
            {t(`pages.${view}.eyebrow`)}
          </Typography>
          <Typography component="h1" variant="h4">
            {t(`pages.${view}.title`)}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.35 }}>
            {t(`pages.${view}.description`)}
          </Typography>
        </Box>
      </Stack>
      <Chip
        size="small"
        variant="outlined"
        icon={<FileCheck2 size={14} />}
        label={t('governance.evidence')}
        sx={{ bgcolor: 'background.paper' }}
      />
    </Box>
  );
}

export function ApprovalSurface({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{ minWidth: 0, overflow: 'hidden', borderRadius: 1 }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ px: 2, py: 1.6, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box minWidth={0}>
          <Typography component="h2" variant="subtitle1" fontWeight={760}>
            {title}
          </Typography>
          {meta && (
            <Typography variant="caption" color="text.secondary">
              {meta}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

export function StatusChip({
  status,
}: {
  status: ApprovalTaskStatus | ApprovalRequestStatus | string;
}) {
  const normalized = status.toUpperCase();
  const color = ['APPROVED', 'ACTIVE', 'PUBLISHED', 'HEALTHY'].includes(normalized)
    ? 'success'
    : ['REJECTED', 'FAILED', 'DEAD'].includes(normalized)
      ? 'error'
      : ['URGENT', 'OVERDUE', 'ATTENTION', 'NEEDS_INFO', 'INFO_REQUESTED'].includes(normalized)
        ? 'warning'
        : 'default';
  return (
    <Chip size="small" variant="outlined" color={color} label={normalized.split('_').join(' ')} />
  );
}

export function PriorityChip({ priority }: { priority: ApprovalPriority }) {
  const color = priority === 'URGENT' ? 'error' : priority === 'HIGH' ? 'warning' : 'default';
  return <Chip size="small" variant="outlined" color={color} label={priority} />;
}

export function ApprovalLinkRow({
  title,
  detail,
  route,
  icon: Icon = FileCheck2,
  tone = approvalTone.primary,
  trailing,
}: {
  title: string;
  detail?: string;
  route: string;
  icon?: LucideIcon;
  tone?: string;
  trailing?: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <ButtonBase
      onClick={() => navigate(route)}
      sx={{
        width: 1,
        minHeight: 68,
        px: 2,
        py: 1.25,
        display: 'flex',
        justifyContent: 'flex-start',
        textAlign: 'left',
        gap: 1.25,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
        '&:hover': { bgcolor: alpha(tone, 0.045) },
      }}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          flex: '0 0 34px',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          color: tone,
          bgcolor: alpha(tone, 0.1),
        }}
      >
        <Icon size={18} strokeWidth={1.8} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={720} noWrap>
          {title}
        </Typography>
        {detail && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {detail}
          </Typography>
        )}
      </Box>
      {trailing ?? <ArrowRight size={16} />}
    </ButtonBase>
  );
}
