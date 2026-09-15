import { ArrowRight, FileCheck2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GlyphSurface } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';

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
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        gap: 1.5,
        pb: 2,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" gap={1.25} alignItems="flex-start" sx={{ width: 1, minWidth: 0 }}>
        <GlyphSurface size={38} variant="soft">
          <Icon size={19} strokeWidth={1.8} />
        </GlyphSurface>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="primary.main" fontWeight={740}>
            {t(`pages.${view}.eyebrow`)}
          </Typography>
          <Typography
            component="h1"
            variant="h5"
            fontWeight={760}
            sx={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
          >
            {t(`pages.${view}.title`)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, maxWidth: 760 }}>
            {t(`pages.${view}.description`)}
          </Typography>
        </Box>
      </Stack>
      <Chip
        size="small"
        variant="outlined"
        icon={<FileCheck2 size={14} />}
        label={t('governance.evidence')}
        sx={(theme) => ({
          flexShrink: 0,
          height: 28,
          color: 'text.secondary',
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.04),
          borderColor: alpha(theme.palette.primary.main, 0.2),
          '& .MuiChip-label': { fontWeight: 700 },
        })}
      />
    </Box>
  );
}

export function ApprovalSurface({
  title,
  meta,
  action,
  children,
  appearance = 'standard',
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  appearance?: 'standard' | 'executive';
}) {
  return (
    <Paper
      component="section"
      variant="outlined"
      style={{ borderRadius: foundationTokens.radius.surface }}
      sx={(theme) => ({
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative',
        backgroundImage: 'none',
        ...(appearance === 'executive' && { containerType: 'inline-size' }),
        borderColor:
          appearance === 'executive'
            ? alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.16 : 0.08)
            : 'divider',
        boxShadow:
          appearance === 'executive'
            ? 'none'
            : theme.palette.mode === 'dark'
              ? '0 8px 24px rgba(0, 0, 0, 0.16)'
              : '0 8px 24px rgba(16, 25, 35, 0.055)',
        '@media (forced-colors: active)': { boxShadow: 'none' },
      })}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={(theme) => ({
          px: 2,
          py: appearance === 'executive' ? 1.25 : 1.6,
          minHeight: appearance === 'executive' ? 48 : 52,
          bgcolor:
            appearance === 'executive'
              ? alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.025 : 0.012)
              : alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.035 : 0.018),
          borderBottom: 1,
          borderColor:
            appearance === 'executive'
              ? alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.12 : 0.05)
              : 'divider',
          '@media (forced-colors: active)': { borderColor: 'CanvasText' },
        })}
      >
        <Box minWidth={0}>
          <Typography
            component="h2"
            variant={appearance === 'executive' ? 'subtitle2' : 'subtitle1'}
            fontWeight={760}
          >
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
  const { t } = useTranslation('approvals');
  const normalized = status.toUpperCase();
  const color = ['APPROVED', 'ACTIVE', 'PUBLISHED', 'HEALTHY'].includes(normalized)
    ? 'success'
    : ['REJECTED', 'FAILED', 'DEAD'].includes(normalized)
      ? 'error'
      : ['URGENT', 'OVERDUE', 'ATTENTION', 'NEEDS_INFO', 'INFO_REQUESTED'].includes(normalized)
        ? 'warning'
        : 'default';
  return (
    <Chip
      size="small"
      variant="outlined"
      color={color}
      label={t(`status.${normalized}`, { defaultValue: normalized.split('_').join(' ') })}
      sx={(theme) => {
        const tone =
          color === 'success'
            ? theme.palette.success.main
            : color === 'error'
              ? theme.palette.error.main
              : color === 'warning'
                ? theme.palette.warning.main
                : theme.palette.text.secondary;
        return {
          height: 24,
          color: tone,
          bgcolor: alpha(tone, theme.palette.mode === 'dark' ? 0.14 : 0.065),
          borderColor: alpha(tone, 0.28),
          '& .MuiChip-label': { px: 0.9, fontWeight: 720 },
        };
      }}
    />
  );
}

export function PriorityChip({ priority }: { priority: ApprovalPriority }) {
  const { t } = useTranslation('approvals');
  const color = priority === 'URGENT' ? 'error' : priority === 'HIGH' ? 'warning' : 'default';
  return (
    <Chip
      size="small"
      variant="outlined"
      color={color}
      label={t(`priority.${priority}`, { defaultValue: priority })}
      sx={(theme) => {
        const tone =
          color === 'error'
            ? theme.palette.error.main
            : color === 'warning'
              ? theme.palette.warning.main
              : theme.palette.text.secondary;
        return {
          height: 24,
          color: tone,
          bgcolor: alpha(tone, theme.palette.mode === 'dark' ? 0.14 : 0.06),
          borderColor: alpha(tone, 0.3),
          '& .MuiChip-label': { px: 0.9, fontWeight: 720 },
        };
      }}
    />
  );
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
      sx={(theme) => ({
        width: 1,
        minHeight: 68,
        px: 1.75,
        py: 1.25,
        display: 'flex',
        justifyContent: 'flex-start',
        textAlign: 'left',
        gap: 1.25,
        position: 'relative',
        borderInlineStart: '3px solid transparent',
        borderBottom: 1,
        borderColor: 'divider',
        transition: theme.transitions.create(['background-color', 'border-color']),
        '&:last-of-type': { borderBottom: 0 },
        '&:hover': {
          bgcolor: alpha(tone, theme.palette.mode === 'dark' ? 0.1 : 0.045),
          borderInlineStartColor: tone,
        },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      })}
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
          border: 1,
          borderColor: alpha(tone, 0.16),
        }}
      >
        <Icon size={18} strokeWidth={1.8} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          fontWeight={720}
          sx={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            overflowWrap: 'anywhere',
          }}
        >
          {title}
        </Typography>
        {detail && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
              overflowWrap: 'anywhere',
            }}
          >
            {detail}
          </Typography>
        )}
      </Box>
      {trailing ?? <ArrowRight size={16} color="currentColor" opacity={0.62} />}
    </ButtonBase>
  );
}
