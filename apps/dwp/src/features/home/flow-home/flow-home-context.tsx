import { useTranslation } from 'react-i18next';
import { Clock3, Pencil, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { HomeAudienceProfile, HomeBackgroundPosition } from '@dwp-frontend/shared-utils';

type FlowHomeContextProps = {
  audience: HomeAudienceProfile;
  currentDate: string;
  headline: string;
  subheadline: string;
  updatedAt: string;
  backgroundPosition: HomeBackgroundPosition;
  partial: boolean;
  stale: boolean;
  staleDetail?: string;
  editing: boolean;
  customizationEnabled: boolean;
  customizationBusy: boolean;
  compact?: boolean;
  priorityCompact?: boolean;
  onEdit?: () => void;
  onOpenStudio?: () => void;
  onRetry: () => void;
};

export function FlowHomeContext({
  audience,
  currentDate,
  headline,
  subheadline,
  updatedAt,
  backgroundPosition,
  partial,
  stale,
  staleDetail,
  editing,
  customizationEnabled,
  customizationBusy,
  compact = false,
  priorityCompact = false,
  onEdit,
  onOpenStudio,
  onRetry,
}: FlowHomeContextProps) {
  const { t } = useTranslation('home');
  const degraded = partial || stale;
  const copyOnRight = backgroundPosition === 'LEFT' && !compact;

  return (
    <Box
      component="header"
      data-testid="flow-home-context"
      sx={{
        position: 'relative',
        minWidth: 0,
        minHeight: compact ? 'auto' : 'var(--flow-workscape-context-min-height)',
        px: compact ? 1 : { xs: 1, sm: 1.5, md: 'var(--flow-section-space)' },
        py: compact ? 1 : { xs: 1, sm: 1, md: 1 },
        display: 'grid',
        gridTemplateAreas: compact
          ? '"copy" "actions"'
          : {
              xs: '"copy" "actions"',
              md: copyOnRight ? '"actions copy"' : '"copy actions"',
            },
        gridTemplateColumns: compact
          ? '1fr'
          : {
              xs: '1fr',
              md: copyOnRight ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr) auto',
            },
        alignItems: 'center',
        gap: compact ? 1 : { xs: 1, md: 2 },
        color: '#F8FAFC',
        '@media (forced-colors: active)': {
          color: 'CanvasText',
        },
      }}
    >
      <Box
        data-flow-context-copy
        sx={{
          gridArea: 'copy',
          minWidth: 0,
          width: 'fit-content',
          maxWidth: 840,
          justifySelf: copyOnRight ? { md: 'end' } : 'start',
          textShadow: '0 2px 12px rgba(0,0,0,0.34)',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          gap={1}
          flexWrap="wrap"
          sx={{ display: priorityCompact ? 'none' : 'flex' }}
        >
          <Typography
            variant="overline"
            fontWeight={700}
            sx={{ color: 'rgba(248,250,252,0.8)', letterSpacing: '0.035em', lineHeight: 1.4 }}
          >
            {currentDate}
          </Typography>
          <Chip
            size="small"
            icon={<ShieldCheck size={14} aria-hidden="true" />}
            label={t(`dayRail.audience.${audience.toLowerCase()}`)}
            variant="outlined"
            sx={{
              color: '#F8FAFC',
              bgcolor: 'rgba(5,15,35,0.44)',
              borderColor: 'rgba(255,255,255,0.38)',
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
          {editing && (
            <Chip
              size="small"
              label={t('flow.context.editing')}
              sx={{ color: '#07111F', bgcolor: '#E9F0FF', fontWeight: 700 }}
            />
          )}
        </Stack>
        <Typography
          component="h1"
          sx={{
            mt: 0.25,
            maxWidth: 880,
            fontSize: compact ? 24 : { xs: 25, md: 'var(--flow-title-size)' },
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.022em',
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
          }}
        >
          {headline}
        </Typography>
        <Typography
          data-flow-context-description
          variant="body2"
          sx={{
            mt: 0.25,
            maxWidth: 780,
            color: 'rgba(248,250,252,0.82)',
            lineHeight: 1.3,
            wordBreak: 'keep-all',
            overflowWrap: 'break-word',
            display: priorityCompact ? 'none' : '-webkit-box',
            '@media (max-width: 599.95px)': {
              overflow: 'hidden',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
            },
          }}
        >
          {subheadline}
        </Typography>
      </Box>

      <Stack
        direction={compact ? 'column' : 'row'}
        alignItems={compact ? 'stretch' : 'center'}
        justifyContent={compact ? 'flex-start' : 'space-between'}
        gap={compact ? 0.75 : { xs: 0.75, sm: 1 }}
        flexWrap="wrap"
        sx={{
          gridArea: 'actions',
          minWidth: 0,
          width: { xs: 1, md: 'auto' },
          justifySelf: copyOnRight ? { md: 'start' } : { md: 'end' },
          p: compact ? 0 : { md: 0.5 },
          borderRadius: 2,
          bgcolor: { md: 'rgba(4,13,30,0.3)' },
          backdropFilter: { md: 'blur(10px)' },
          WebkitBackdropFilter: { md: 'blur(10px)' },
          '@media (prefers-reduced-transparency: reduce)': {
            bgcolor: { md: 'rgba(4,13,30,0.78)' },
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          gap={0.75}
          flexWrap="wrap"
          justifyContent={{ sm: 'flex-end' }}
        >
          <Clock3 size={15} aria-hidden="true" />
          <Typography
            variant="caption"
            sx={{
              color: degraded ? '#FFD28A' : 'rgba(248,250,252,0.78)',
              overflowWrap: 'anywhere',
            }}
          >
            {stale
              ? (staleDetail ?? t('flow.context.stale', { time: updatedAt }))
              : partial
                ? t('flow.context.partial', { time: updatedAt })
                : t('flow.context.updated', { time: updatedAt })}
          </Typography>
          {degraded && (
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<RefreshCw size={14} aria-hidden="true" />}
              onClick={onRetry}
              aria-label={t('page.retry')}
              title={t('page.retry')}
              sx={{
                minHeight: 44,
                color: '#F8FAFC',
                '@media (max-width: 599.95px)': {
                  minWidth: 44,
                  px: 1,
                  '& .MuiButton-startIcon': { m: 0 },
                },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                {t('page.retry')}
              </Box>
            </ActionButton>
          )}
        </Stack>
        {!editing && (onEdit || onOpenStudio) && (
          <Stack direction="row" gap={0.5} flexWrap="wrap" justifyContent={{ sm: 'flex-end' }}>
            {onOpenStudio && (
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<SlidersHorizontal size={15} aria-hidden="true" />}
                onClick={onOpenStudio}
                disabled={customizationBusy}
                aria-label={t('flow.context.studio')}
                title={t('flow.context.studio')}
                sx={{
                  minHeight: 44,
                  color: '#F8FAFC',
                  borderColor: 'rgba(255,255,255,0.5)',
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '@media (max-width: 599.95px)': {
                    minWidth: 44,
                    px: 1,
                    '& .MuiButton-startIcon': { m: 0 },
                  },
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {t('flow.context.studio')}
                </Box>
              </ActionButton>
            )}
            {customizationEnabled && onEdit && (
              <ActionButton
                data-home-edit-trigger
                intent="quiet"
                size="small"
                startIcon={<Pencil size={15} aria-hidden="true" />}
                onClick={onEdit}
                disabled={customizationBusy}
                aria-label={t('launchpad.editHome')}
                title={t('launchpad.editHome')}
                sx={{
                  minHeight: 44,
                  color: '#F8FAFC',
                  border: '1px solid rgba(255,255,255,0.46)',
                  bgcolor: 'rgba(255,255,255,0.12)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                  '@media (max-width: 599.95px)': {
                    px: 1.25,
                  },
                }}
              >
                {t('launchpad.editHome')}
              </ActionButton>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
