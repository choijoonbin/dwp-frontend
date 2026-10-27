import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Blocks,
  BriefcaseBusiness,
  Building2,
  Landmark,
  Layers3,
  MessagesSquare,
  RadioTower,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';

import type { LucideIcon } from 'lucide-react';
import type { SpaceSummary } from '@dwp-frontend/shared-utils';

const ICONS: Record<string, LucideIcon> = {
  'briefcase-business': BriefcaseBusiness,
  'messages-square': MessagesSquare,
  'radio-tower': RadioTower,
  landmark: Landmark,
  'building-2': Building2,
  sparkles: Sparkles,
  blocks: Blocks,
  'layers-3': Layers3,
};

const TONES: Record<string, { strong: string; soft: string; ink: string }> = {
  cobalt: { strong: '#2C63A3', soft: '#E5EEF8', ink: '#173653' },
  violet: { strong: '#7552A6', soft: '#F0EAF7', ink: '#3C2858' },
  amber: { strong: '#A86612', soft: '#F7EDDD', ink: '#5D390D' },
  teal: { strong: '#187B72', soft: '#E3F2EF', ink: '#0F4642' },
  crimson: { strong: '#A7464B', soft: '#F6E8E9', ink: '#5F292C' },
  indigo: { strong: '#315B7A', soft: '#E6EDF2', ink: '#1C374A' },
};

export function getSpaceTone(accent: string) {
  return TONES[accent] ?? TONES.indigo;
}

export function SpaceGlyph({
  iconKey,
  accentToken,
  size = 42,
}: {
  iconKey: string;
  accentToken: string;
  size?: number;
}) {
  const Icon = ICONS[iconKey] ?? Layers3;
  const tone = getSpaceTone(accentToken);
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        display: 'grid',
        placeItems: 'center',
        color: 'common.white',
        bgcolor: tone.strong,
        border: 1,
        borderColor: 'rgba(255,255,255,0.38)',
        borderRadius: 1,
        boxShadow: `0 8px 22px ${tone.strong}33`,
      }}
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.8} />
    </Box>
  );
}

export function localizedSpace(
  value: Pick<SpaceSummary, 'nameKo' | 'nameEn' | 'summaryKo' | 'summaryEn'>,
  language: string
) {
  const korean = language.startsWith('ko');
  return {
    name: korean ? value.nameKo : value.nameEn,
    summary: korean ? value.summaryKo : value.summaryEn,
  };
}

export function SpaceCard({ space }: { space: SpaceSummary }) {
  const { t, i18n } = useTranslation('spaces');
  const label = localizedSpace(space, i18n.resolvedLanguage ?? i18n.language);
  const tone = getSpaceTone(space.accentToken);
  return (
    <Tooltip title={label.name} describeChild enterDelay={600}>
      <Paper
        component={RouterLink}
        to={`/spaces/${space.spaceKey}/overview`}
        aria-label={label.name}
        elevation={0}
        sx={{
          width: 1,
          minWidth: 0,
          minHeight: 194,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridTemplateRows: '60px 1fr',
          textAlign: 'left',
          textDecoration: 'none',
          color: 'text.primary',
          alignItems: 'stretch',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          transition: (theme) => theme.transitions.create(['border-color', 'box-shadow']),
          '&:hover': {
            borderColor: tone.strong,
            boxShadow: `0 3px 12px ${tone.strong}1f`,
          },
          '&:focus-visible': {
            outline: (theme) => `3px solid ${theme.palette.primary.main}`,
            outlineOffset: 3,
          },
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          '@media (forced-colors: active)': {
            '&:focus-visible': { outlineColor: 'Highlight' },
          },
        }}
      >
        <Box
          sx={{
            px: 1.75,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            color: tone.ink,
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? alpha(tone.strong, 0.24) : tone.soft,
            minWidth: 0,
            borderBottom: 1,
            borderColor: 'divider',
            borderTopLeftRadius: 'inherit',
            borderTopRightRadius: 'inherit',
          }}
        >
          <SpaceGlyph iconKey={space.iconKey} accentToken={space.accentToken} size={36} />
          <Stack direction="row" gap={0.75} flexWrap="wrap" justifyContent="flex-end">
            <Chip
              size="small"
              label={t(`visibility.${space.visibility}`)}
              sx={{ bgcolor: 'background.paper' }}
            />
            {space.memberRole && <Chip size="small" variant="outlined" label={t('card.joined')} />}
            {space.unreadCount > 0 && (
              <Chip
                size="small"
                color="primary"
                label={space.unreadCount}
                aria-label={t('card.unread')}
              />
            )}
          </Stack>
        </Box>
        <Box sx={{ p: 1.75, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography component="h3" variant="h6" noWrap sx={{ flex: 1, minWidth: 0 }}>
              {label.name}
            </Typography>
            <ArrowRight size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.65,
              minHeight: 36,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
            }}
          >
            {label.summary}
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            flexWrap="wrap"
            sx={{ mt: 'auto', pt: 1.5 }}
          >
            <Stack direction="row" gap={1.25} alignItems="center">
              <Box
                aria-hidden="true"
                sx={{
                  width: 24,
                  height: 24,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  color: tone.ink,
                  bgcolor: tone.soft,
                }}
              >
                <UsersRound size={14} strokeWidth={1.9} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('card.members', { count: space.memberCount })}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {t('card.lastActivity', {
                date: formatDate(space.lastActivityAt, { dateStyle: 'medium' }),
              })}
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Tooltip>
  );
}

export function SpaceStatusChip({ value }: { value: string }) {
  const { t } = useTranslation('spaces');
  const tone =
    value === 'ACTIVE' || value === 'PUBLISHED' || value === 'APPROVED'
      ? 'success'
      : value === 'PENDING' || value === 'IN_REVIEW' || value === 'OVERDUE'
        ? 'warning'
        : value === 'REJECTED' || value === 'RESTRICTED'
          ? 'error'
          : 'default';
  return (
    <Chip
      size="small"
      color={tone}
      variant="outlined"
      label={t(`status.${value}`, { defaultValue: value })}
    />
  );
}
