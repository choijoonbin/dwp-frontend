import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3, Zap } from 'lucide-react';
import { formatDate, formatRelativeTime } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { flowSourceLabel } from './flow-source-label';

import type { HomeOverview, HomeWidgetHeight, WorkspaceWorkItem } from '@dwp-frontend/shared-utils';

type PriorityNowProps = {
  overview?: HomeOverview;
  items: readonly WorkspaceWorkItem[];
  height: HomeWidgetHeight;
  loading: boolean;
  fetching: boolean;
  requestFailed: boolean;
  compact?: boolean;
  priorityCompact?: boolean;
  fillStage?: boolean;
  onRetry: () => void;
};

function workRoute(item: WorkspaceWorkItem): string {
  return item.sourceRoute || `/work?item=${encodeURIComponent(item.id)}`;
}

function relativeDeadline(dueAt: string | null | undefined): string | null {
  if (!dueAt) return null;
  const remainingMs = Date.parse(dueAt) - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;
  const minutes = remainingMs / 60_000;
  if (minutes < 60) {
    return formatRelativeTime(Math.max(1, Math.ceil(minutes)), 'minute', { numeric: 'always' });
  }
  const hours = minutes / 60;
  if (hours < 48) {
    return formatRelativeTime(Math.max(1, Math.ceil(hours)), 'hour', { numeric: 'always' });
  }
  return formatRelativeTime(Math.max(1, Math.ceil(hours / 24)), 'day', { numeric: 'always' });
}

export function PriorityNow({
  overview,
  items,
  height,
  loading,
  fetching,
  requestFailed,
  compact = false,
  priorityCompact = false,
  fillStage = false,
  onRetry,
}: PriorityNowProps) {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const unavailable = requestFailed || overview?.work.status === 'UNAVAILABLE';
  const forbidden = overview?.work.status === 'FORBIDDEN';
  const [primary, ...secondary] = items;
  const actionable = !loading && !unavailable && !forbidden && Boolean(primary);
  const primaryOverdue = Boolean(primary?.dueAt && Date.parse(primary.dueAt) < Date.now());
  const priorityTone = primaryOverdue
    ? 'risk'
    : primary?.priority === 'high'
      ? 'attention'
      : 'default';
  const priorityColor =
    priorityTone === 'risk'
      ? 'error.main'
      : priorityTone === 'attention'
        ? 'warning.main'
        : 'primary.main';
  const condensed = priorityCompact || height === 'short';
  const visibleSecondary = secondary.slice(0, 2);
  const deadlineSignal = relativeDeadline(primary?.dueAt);

  return (
    <Box
      component="section"
      aria-labelledby="flow-now-heading"
      data-flow-section="now"
      data-testid="flow-home-now"
      data-actionable={actionable ? 'true' : 'false'}
      data-priority-tone={priorityTone}
      data-flow-stage-fill={fillStage && visibleSecondary.length > 0 ? 'content' : 'natural'}
      sx={{
        minWidth: 0,
        height: compact || (fillStage && visibleSecondary.length === 0) ? 'auto' : 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        px: compact ? 2 : 'var(--flow-section-space)',
        py: compact ? 2.25 : 'var(--flow-section-space)',
        overflow: 'hidden',
        borderRadius: compact ? 3 : 'var(--flow-surface-radius)',
        bgcolor: 'var(--home-surface)',
        color: 'text.primary',
        border: 1,
        borderColor: 'divider',
        boxShadow: 'none',
        '@media (forced-colors: active)': {
          bgcolor: 'Canvas',
          borderColor: 'CanvasText',
          boxShadow: 'none',
        },
        '@media (prefers-reduced-transparency: reduce)': {
          bgcolor: 'background.paper',
          boxShadow: 'none',
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={2}
        flexWrap="wrap"
      >
        <Box sx={{ minWidth: 0, flex: '1 1 240px' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Box sx={{ display: 'inline-flex', color: priorityColor }}>
              <Zap size={20} aria-hidden="true" />
            </Box>
            <Typography
              id="flow-now-heading"
              component="h2"
              fontWeight={700}
              sx={{ fontSize: 'var(--flow-now-title-size)', lineHeight: 1.25 }}
            >
              {t('flow.now.title')}
            </Typography>
          </Stack>
          {!condensed && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {t('flow.now.description')}
            </Typography>
          )}
        </Box>
      </Stack>

      {loading && <LoadingState label={t('page.loadingPriorities')} variant="skeleton" />}
      {!loading && unavailable && (
        <ErrorState
          title={t('page.priorityLoadError')}
          retryLabel={requestFailed ? undefined : t('page.retry')}
          onRetry={requestFailed ? undefined : onRetry}
          retrying={fetching}
          size="compact"
        />
      )}
      {!loading && !unavailable && forbidden && (
        <GuidedEmptyState
          kind="permission"
          title={t('widgets.common.restrictedTitle')}
          description={t('widgets.common.restrictedDescription')}
          size="compact"
        />
      )}
      {!loading && !unavailable && !forbidden && !primary && (
        <GuidedEmptyState
          kind="empty"
          title={t('page.clearTitle')}
          description={t('page.clearDescription')}
          size="compact"
        />
      )}
      {!loading && !unavailable && !forbidden && primary && (
        <Box
          sx={{
            mt: condensed ? 1 : compact ? 1.5 : 2.25,
            minHeight: 0,
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            data-priority-spotlight
            sx={(theme) => {
              const semanticColor = primaryOverdue
                ? theme.palette.error.main
                : primary?.priority === 'high'
                  ? theme.palette.warning.main
                  : theme.palette.primary.main;
              return {
                flex: fillStage ? '1 1 auto' : undefined,
                minHeight: fillStage ? 180 : 0,
                p: fillStage ? 2 : 0,
                display: 'grid',
                gridTemplateColumns: fillStage
                  ? 'minmax(0, 2fr) minmax(180px, 0.8fr)'
                  : compact
                    ? '1fr'
                    : { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                gridTemplateAreas: fillStage ? '"copy visual" "action visual"' : undefined,
                alignItems: fillStage ? 'center' : 'end',
                alignContent: fillStage ? 'center' : undefined,
                gap: priorityCompact ? 1 : 2,
                border: fillStage ? 1 : 0,
                borderColor: 'divider',
                borderRadius: fillStage ? 2 : 0,
                background: fillStage
                  ? `linear-gradient(135deg, ${alpha(semanticColor, 0.075)}, ${alpha(
                      semanticColor,
                      0.018
                    )} 58%, transparent)`
                  : 'transparent',
                '@media (forced-colors: active)': {
                  background: 'Canvas',
                  borderColor: 'CanvasText',
                },
              };
            }}
          >
            <Box sx={{ minWidth: 0, gridArea: fillStage ? 'copy' : undefined }}>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Chip
                  size="small"
                  color={
                    primaryOverdue ? 'error' : primary.priority === 'high' ? 'warning' : 'default'
                  }
                  variant="outlined"
                  label={
                    primaryOverdue ? t('flow.now.overdue') : t(`page.priority.${primary.priority}`)
                  }
                />
                <Typography variant="caption" color="text.secondary">
                  {t(`flow.workType.${primary.type.toLowerCase()}`, {
                    defaultValue: primary.type,
                  })}{' '}
                  · {flowSourceLabel(primary.sourceSystem, t)}
                </Typography>
              </Stack>
              <Typography
                component="h3"
                variant="h6"
                fontWeight={700}
                sx={{
                  mt: condensed ? 0.75 : 1,
                  fontSize: fillStage ? '1.45rem' : undefined,
                  lineHeight: fillStage ? 1.25 : undefined,
                  overflowWrap: 'anywhere',
                }}
              >
                {primary.title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: priorityCompact ? 0.25 : 0.5,
                  ...(condensed
                    ? {
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                      }
                    : {}),
                }}
              >
                {primary.reason || primary.summary || t('flow.now.defaultReason')}
              </Typography>
              {primary.dueAt && (
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={0.75}
                  sx={{ mt: condensed ? 0.5 : 1 }}
                >
                  <Clock3 size={15} aria-hidden="true" />
                  <Typography variant="caption" color="text.secondary">
                    {t(primaryOverdue ? 'flow.now.overdueSince' : 'flow.now.due', {
                      time: formatDate(primary.dueAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    })}
                  </Typography>
                </Stack>
              )}
            </Box>
            <ActionButton
              data-flow-primary-action
              intent="primary"
              endIcon={<ArrowRight size={16} aria-hidden="true" />}
              onClick={() => navigate(workRoute(primary))}
              sx={{
                minHeight: 44,
                gridArea: fillStage ? 'action' : undefined,
                justifySelf: fillStage ? 'start' : undefined,
              }}
            >
              {t('flow.now.openInSource', {
                source: flowSourceLabel(primary.sourceSystem, t),
              })}
            </ActionButton>
            {fillStage && (
              <Box
                aria-hidden="true"
                data-priority-visual-anchor
                sx={(theme) => {
                  const semanticColor = primaryOverdue
                    ? theme.palette.error.main
                    : primary.priority === 'high'
                      ? theme.palette.warning.main
                      : theme.palette.primary.main;
                  return {
                    gridArea: 'visual',
                    alignSelf: 'stretch',
                    minWidth: 0,
                    minHeight: 210,
                    px: 2,
                    py: 2.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    borderInlineStart: '1px solid',
                    borderColor: alpha(semanticColor, 0.24),
                    background: `radial-gradient(circle at 50% 42%, ${alpha(
                      semanticColor,
                      0.13
                    )}, transparent 62%)`,
                    '@media (forced-colors: active)': {
                      background: 'Canvas',
                      borderColor: 'CanvasText',
                    },
                  };
                }}
              >
                <Box
                  sx={{
                    width: 104,
                    height: 104,
                    display: 'grid',
                    placeItems: 'center',
                    border: '1px solid',
                    borderColor: priorityColor,
                    borderRadius: '34% 66% 58% 42% / 42% 38% 62% 58%',
                    color: priorityColor,
                    bgcolor: 'var(--home-surface)',
                    boxShadow: '0 18px 38px rgba(15, 23, 42, 0.08)',
                    transform: 'rotate(-4deg)',
                  }}
                >
                  <Zap size={42} strokeWidth={1.8} />
                </Box>
                <Typography variant="overline" color="text.secondary" sx={{ mt: 2 }}>
                  {primaryOverdue ? t('flow.now.overdue') : t('flow.now.deadlineSignal')}
                </Typography>
                <Typography variant="h6" fontWeight={760} sx={{ mt: 0.2 }}>
                  {primaryOverdue
                    ? t('flow.now.overdue')
                    : (deadlineSignal ?? t(`page.priority.${primary.priority}`))}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75 }}>
                  {flowSourceLabel(primary.sourceSystem, t)}
                </Typography>
              </Box>
            )}
          </Box>

          {secondary.length > 0 && (compact || height === 'short') && (
            <ActionButton
              intent="quiet"
              endIcon={<ArrowRight size={15} aria-hidden="true" />}
              onClick={() => navigate('/work')}
              sx={{ mt: 1, minHeight: 44 }}
            >
              {t('flow.now.morePriorities', { count: secondary.length })}
            </ActionButton>
          )}

          {visibleSecondary.length > 0 && !compact && height !== 'short' && (
            <Box
              component="ol"
              sx={{
                p: 0,
                mt: 2,
                mb: 0,
                minHeight: 0,
                flex:
                  !fillStage && (height === 'tall' || height === 'expanded')
                    ? '1 1 auto'
                    : '0 0 auto',
                display: 'grid',
                gridTemplateRows: fillStage
                  ? `repeat(${visibleSecondary.length}, minmax(52px, auto))`
                  : `repeat(${visibleSecondary.length}, minmax(0, 1fr))`,
                listStyle: 'none',
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              {visibleSecondary.map((item) => (
                <Box
                  component="li"
                  key={item.id}
                  sx={{ minHeight: 0, borderBottom: 1, borderColor: 'divider' }}
                >
                  <ActionButton
                    intent="quiet"
                    onClick={() => navigate(workRoute(item))}
                    sx={{
                      width: 1,
                      height: fillStage ? 'auto' : 1,
                      minHeight: 52,
                      justifyContent: 'space-between',
                      px: 0,
                      color: 'inherit',
                    }}
                  >
                    <Box
                      component="span"
                      data-priority-secondary-copy
                      sx={{ minWidth: 0, textAlign: 'left' }}
                    >
                      <Typography component="span" variant="subtitle2" display="block">
                        {item.title}
                      </Typography>
                      <Typography component="span" variant="caption" color="text.secondary">
                        {item.reason || flowSourceLabel(item.sourceSystem, t)}
                      </Typography>
                    </Box>
                    <ArrowRight size={16} aria-hidden="true" />
                  </ActionButton>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
