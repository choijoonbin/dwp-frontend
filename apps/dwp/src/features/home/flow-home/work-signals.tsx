import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BellDot, BriefcaseBusiness, CalendarRange, Gauge, Timer } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, type Theme } from '@mui/material/styles';

import type { HomeOverview, HomeWidgetHeight, HomeWidgetSize } from '@dwp-frontend/shared-utils';
import type { FlowSignal } from './flow-home-model';
import { flowSourceLabel } from './flow-source-label';

type WorkSignalsProps = {
  overview?: HomeOverview;
  signals: readonly FlowSignal[];
  height: HomeWidgetHeight;
  size: HomeWidgetSize;
  loading: boolean;
  fetching: boolean;
  requestFailed: boolean;
  compact?: boolean;
  supportStack?: boolean;
  onRetry: () => void;
};

const signalBudget: Record<HomeWidgetHeight, number> = {
  // These are four distinct health dimensions, not interchangeable feed
  // rows. Every height keeps all four; height changes detail density only.
  short: 4,
  standard: 4,
  tall: 4,
  expanded: 4,
};

const toneColor = {
  neutral: 'text.secondary',
  info: 'info.main',
  success: 'success.main',
  warning: 'warning.main',
  risk: 'error.main',
} as const;

function signalAccent(theme: Theme, tone: FlowSignal['tone']): string {
  if (tone === 'risk') return theme.palette.error.main;
  if (tone === 'warning') return theme.palette.warning.main;
  if (tone === 'success') return theme.palette.success.main;
  if (tone === 'info') return theme.palette.info.main;
  return theme.palette.text.secondary;
}

const signalIcon = {
  'open-work': BriefcaseBusiness,
  'focus-time': Timer,
  'schedule-load': CalendarRange,
  'activity-attention': BellDot,
} as const;

const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  p: 0,
  m: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

function targetProgress(signal: FlowSignal): number | undefined {
  if (signal.comparison.kind !== 'target' || signal.comparison.value <= 0) return undefined;
  return Math.min(100, Math.max(0, (signal.value / signal.comparison.value) * 100));
}

function comparisonLabel(signal: FlowSignal, t: TFunction<'home'>) {
  if (signal.comparison.kind === 'target') {
    return t('flow.signals.target', {
      value: signal.comparison.value,
      unit: t(`flow.signals.unit.${signal.unit}`),
    });
  }
  if (signal.comparison.kind === 'threshold') {
    if (signal.key === 'open-work') {
      return signal.comparison.value > 0
        ? t('flow.signals.dueSoonCount', { value: signal.comparison.value })
        : t('flow.signals.noDueSoon');
    }
    if (signal.key === 'schedule-load') {
      return signal.comparison.value > 0
        ? t('flow.signals.conflictCount', { value: signal.comparison.value })
        : t('flow.signals.noConflicts');
    }
    return signal.comparison.value > 0
      ? t('flow.signals.threshold', { value: signal.comparison.value })
      : t('flow.signals.healthy');
  }
  return t('flow.signals.baselinePending');
}

function SignalSeries({ signal, compact = false }: { signal: FlowSignal; compact?: boolean }) {
  const { t } = useTranslation('home');
  const series = signal.series ?? [];
  const chronological = series.every(
    (point, index) => index === 0 || series[index - 1]!.date <= point.date
  );
  if (series.length < 4 || signal.comparison.kind === 'none' || !chronological) return null;
  const max = Math.max(1, ...series.map((point) => point.loadPercent));
  const hasConflicts = series.some((point) => point.conflictCount > 0);

  return (
    <>
      <Box
        aria-hidden="true"
        data-signal-series
        sx={{
          mt: compact ? 0 : 1,
          height: compact ? 24 : 38,
          ...(compact
            ? {
                position: 'absolute',
                insetInlineEnd: 12,
                bottom: 36,
                width: 'min(92px, 34%)',
              }
            : {}),
          display: 'flex',
          alignItems: 'end',
          gap: 0.5,
          borderBlockEnd: '1px solid',
          borderColor: 'divider',
        }}
      >
        {series.map((point) => (
          <Box
            key={point.date}
            sx={(theme) => ({
              flex: 1,
              minWidth: 4,
              height: `${Math.max(8, (point.loadPercent / max) * 100)}%`,
              borderRadius: '3px 3px 0 0',
              bgcolor: alpha(theme.palette.primary.main, point.conflictCount > 0 ? 0.78 : 0.3),
              borderTop: point.conflictCount > 0 ? 3 : 0,
              borderTopStyle: point.conflictCount > 0 ? 'dashed' : 'solid',
              borderTopColor: 'error.main',
              '@media (prefers-reduced-transparency: reduce)': { bgcolor: 'primary.main' },
              '@media (forced-colors: active)': {
                bgcolor: 'CanvasText',
                border: point.conflictCount > 0 ? '2px dashed Highlight' : '1px solid CanvasText',
              },
            })}
          />
        ))}
      </Box>
      {!compact && (
        <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {t('flow.signals.recentWeek')}
          </Typography>
          {hasConflicts && (
            <Typography variant="caption" color="error.main">
              {t('flow.signals.conflictMarker')}
            </Typography>
          )}
        </Stack>
      )}
      <Box sx={visuallyHidden}>
        <Box component="table">
          <caption>
            {t('flow.signals.seriesCaption', { signal: t(`flow.signals.${signal.label}`) })}
          </caption>
          <thead>
            <tr>
              <th>{t('flow.signals.date')}</th>
              <th>{t('flow.signals.load')}</th>
              <th>{t('flow.signals.conflicts')}</th>
            </tr>
          </thead>
          <tbody>
            {series.map((point) => (
              <tr key={point.date}>
                <td>{point.date}</td>
                <td>{point.loadPercent}%</td>
                <td>{point.conflictCount}</td>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </>
  );
}

export function WorkSignals({
  overview,
  signals,
  height,
  size,
  loading,
  fetching,
  requestFailed,
  compact = false,
  supportStack = false,
  onRetry,
}: WorkSignalsProps) {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const narrow = compact || size === 'compact' || supportStack;
  const dense = height === 'short';
  const detailed = height === 'tall' || height === 'expanded';
  // Height changes detail density, not the four domain dimensions. Legacy
  // source-widget row limits must never silently remove a composite KPI.
  const visible = signals.slice(0, signalBudget[height]);
  const sections = [overview?.work, overview?.calendar, overview?.activity].filter(Boolean);
  const unavailableCount = requestFailed
    ? sections.length
    : sections.filter((section) => section?.status === 'UNAVAILABLE').length;
  const forbiddenCount = sections.filter((section) => section?.status === 'FORBIDDEN').length;
  const availableCount = sections.filter((section) => section?.status === 'AVAILABLE').length;
  const hasNoAvailableSource = sections.length > 0 && availableCount === 0;
  const allUnavailable =
    requestFailed || (hasNoAvailableSource && unavailableCount > 0 && forbiddenCount === 0);
  const allForbidden =
    !requestFailed && hasNoAvailableSource && unavailableCount === 0 && forbiddenCount > 0;
  const mixedUnavailableAndForbidden =
    !requestFailed && hasNoAvailableSource && unavailableCount > 0 && forbiddenCount > 0;
  const availabilityPartial = availableCount > 0 && unavailableCount > 0;
  const permissionPartial = availableCount > 0 && forbiddenCount > 0;
  const hasInlineStatus = availabilityPartial || permissionPartial;
  const compressedContent = dense || hasInlineStatus;
  return (
    <Box
      component="section"
      aria-labelledby="work-signals-heading"
      data-flow-section="work-signals"
      data-flow-support-stack={supportStack ? 'true' : 'false'}
      data-work-signals-density={dense ? 'compact' : detailed ? 'detailed' : 'standard'}
      sx={{
        minWidth: 0,
        minHeight: 0,
        height: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Gauge size={19} aria-hidden="true" />
            <Typography id="work-signals-heading" component="h2" variant="h5" fontWeight={700}>
              {t('flow.signals.title')}
            </Typography>
          </Stack>
          {!narrow && !dense && !hasInlineStatus && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {t('flow.signals.description')}
            </Typography>
          )}
        </Box>
        <ActionButton
          intent="quiet"
          size="small"
          endIcon={<ArrowRight size={15} aria-hidden="true" />}
          onClick={() => navigate('/work')}
          sx={{ minHeight: 44, flex: '0 0 auto' }}
        >
          {t('flow.signals.viewWork')}
        </ActionButton>
      </Stack>

      {loading && <LoadingState label={t('flow.signals.loading')} variant="skeleton" />}
      {!loading && allUnavailable && (
        <ErrorState
          title={t('flow.signals.loadError')}
          retryLabel={requestFailed ? undefined : t('page.retry')}
          onRetry={requestFailed ? undefined : onRetry}
          retrying={fetching}
          size="compact"
        />
      )}
      {!loading && !allUnavailable && allForbidden && (
        <GuidedEmptyState
          kind="permission"
          title={t('widgets.common.restrictedTitle')}
          description={t('widgets.common.restrictedDescription')}
          size="compact"
        />
      )}
      {!loading && mixedUnavailableAndForbidden && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {t('flow.signals.loadError')}
          </Typography>
          <Typography variant="body2">{t('widgets.common.restrictedDescription')}</Typography>
        </Alert>
      )}
      {!loading && availabilityPartial && (
        <Alert severity="warning" sx={{ mt: 0.5, py: 0, '& .MuiAlert-message': { py: 0.25 } }}>
          <Typography variant="body2">
            {t(narrow ? 'flow.signals.partialCompact' : 'flow.signals.partial')}
          </Typography>
          {permissionPartial && (
            <Typography variant="body2">{t('widgets.common.restrictedDescription')}</Typography>
          )}
        </Alert>
      )}
      {!loading && !availabilityPartial && permissionPartial && (
        <Alert severity="info" sx={{ mt: 0.5, py: 0, '& .MuiAlert-message': { py: 0.25 } }}>
          {t('widgets.common.restrictedDescription')}
        </Alert>
      )}
      {!loading &&
        !allUnavailable &&
        !allForbidden &&
        !mixedUnavailableAndForbidden &&
        visible.length === 0 && (
          <GuidedEmptyState
            kind="empty"
            title={t('flow.signals.empty')}
            description={t('flow.signals.description')}
            size="compact"
          />
        )}
      {!loading &&
        !allUnavailable &&
        !allForbidden &&
        !mixedUnavailableAndForbidden &&
        visible.length > 0 && (
          <Box
            component="ul"
            data-work-signals-grid
            data-work-signals-layout="two-by-two"
            data-work-signals-boundary="segmented"
            data-work-signals-count={visible.length}
            sx={{
              p: 0,
              mt: dense ? 0.75 : hasInlineStatus ? 0.5 : 1.5,
              mb: 0,
              flex: '1 1 auto',
              minHeight: 0,
              display: 'grid',
              // Product IA: Work overview is a stable 2 x 2 matrix at every
              // supported width and height. Never turn height into item loss or
              // silently recompose the four dimensions into a one-row strip.
              gridTemplateColumns:
                visible.length === 1 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
              gridTemplateRows:
                visible.length <= 2 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
              gap: 1,
              listStyle: 'none',
              overflow: 'visible',
              ...(visible.length === 3
                ? {
                    '& > li:last-of-type': {
                      gridColumn: '1 / -1',
                    },
                  }
                : {}),
              '@media (forced-colors: active)': {
                gap: 1,
              },
            }}
          >
            {visible.map((signal) => {
              const progress = targetProgress(signal);
              const Icon = signalIcon[signal.key];
              const label = t(`flow.signals.${signal.label}`);
              const unit = t(`flow.signals.unit.${signal.unit}`);
              const comparison = comparisonLabel(signal, t);
              return (
                <Box
                  component="li"
                  key={signal.key}
                  data-work-signal={signal.key}
                  data-work-signal-tone={signal.tone}
                  sx={(theme) => {
                    const accent = signalAccent(theme, signal.tone);
                    return {
                      position: 'relative',
                      minWidth: 0,
                      minHeight: 0,
                      display: 'flex',
                      overflow: 'hidden',
                      border: '1px solid',
                      // Four independent interactive decisions need a stronger
                      // non-text boundary than the decorative divider token.
                      borderColor: alpha(theme.palette.text.primary, 0.52),
                      borderRadius: 2.25,
                      bgcolor:
                        theme.palette.mode === 'dark'
                          ? alpha(theme.palette.common.white, 0.035)
                          : alpha(theme.palette.text.primary, 0.018),
                      '&::before':
                        signal.tone === 'risk' || signal.tone === 'warning'
                          ? {
                              content: '""',
                              position: 'absolute',
                              zIndex: 1,
                              insetBlock: 10,
                              insetInlineStart: 0,
                              width: signal.tone === 'risk' ? 3 : 2,
                              borderRadius: '0 999px 999px 0',
                              bgcolor: alpha(accent, signal.tone === 'risk' ? 0.9 : 0.62),
                              pointerEvents: 'none',
                            }
                          : undefined,
                      '@media (forced-colors: active)': {
                        bgcolor: 'Canvas',
                        borderColor: 'CanvasText',
                        '&::before': { bgcolor: 'CanvasText' },
                      },
                    };
                  }}
                >
                  <ButtonBase
                    onClick={() => navigate(signal.route)}
                    aria-label={t('flow.signals.openSummary', {
                      signal: label,
                      value: signal.value,
                      unit,
                      comparison,
                    })}
                    sx={{
                      width: 1,
                      height: 1,
                      position: 'relative',
                      minWidth: 0,
                      minHeight: dense
                        ? 80
                        : hasInlineStatus
                          ? 72
                          : supportStack
                            ? 88
                            : narrow
                              ? 112
                              : 122,
                      px: compressedContent ? 1.1 : supportStack ? 1.15 : narrow ? 1.25 : 1.5,
                      py: compressedContent
                        ? 0.75
                        : supportStack
                          ? 1
                          : narrow
                            ? 1.1
                            : detailed
                              ? 1.5
                              : 1.1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      borderRadius: 0,
                      bgcolor: 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                      '&:focus-visible': {
                        outline: 'none',
                        boxShadow: 'inset 0 0 0 3px var(--dwp-focus-ring, currentColor)',
                      },
                      '@media (forced-colors: active)': {
                        bgcolor: 'Canvas',
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Stack direction="row" alignItems="center" gap={0.75} minWidth={0}>
                        <Box
                          aria-hidden="true"
                          sx={(theme) => {
                            const accent = signalAccent(theme, signal.tone);
                            return {
                              width: compressedContent ? 26 : 28,
                              height: compressedContent ? 26 : 28,
                              flex: '0 0 auto',
                              display: 'grid',
                              placeItems: 'center',
                              borderRadius: 1.5,
                              color: toneColor[signal.tone],
                              bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.18 : 0.1),
                              '@media (forced-colors: active)': {
                                color: 'CanvasText',
                                bgcolor: 'Canvas',
                                border: '1px solid CanvasText',
                              },
                            };
                          }}
                        >
                          <Icon size={15} />
                        </Box>
                        <Typography
                          component="h3"
                          variant="caption"
                          fontWeight={700}
                          sx={{
                            lineHeight: 1.35,
                            overflowWrap: 'break-word',
                          }}
                        >
                          {label}
                        </Typography>
                      </Stack>
                      <Box
                        aria-hidden="true"
                        sx={{
                          width: 26,
                          height: 26,
                          flex: '0 0 auto',
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '50%',
                          bgcolor: 'action.hover',
                          color: 'text.secondary',
                        }}
                      >
                        <ArrowRight size={14} />
                      </Box>
                    </Stack>
                    <Stack
                      direction={compressedContent ? 'row' : 'column'}
                      alignItems={compressedContent ? 'baseline' : 'stretch'}
                      justifyContent={compressedContent ? 'space-between' : 'flex-start'}
                      flexWrap={compressedContent ? 'wrap' : 'nowrap'}
                      columnGap={1}
                      rowGap={0.25}
                      sx={{ mt: compressedContent ? 0.25 : 0.75 }}
                    >
                      <Typography
                        sx={{
                          fontSize: compressedContent || supportStack ? 22 : narrow ? 24 : 28,
                          lineHeight: 1.05,
                          fontWeight: 720,
                          color: 'text.primary',
                          fontVariantNumeric: 'tabular-nums',
                          flex: '0 0 auto',
                        }}
                      >
                        {signal.value}
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 0.5 }}
                        >
                          {unit}
                        </Typography>
                      </Typography>
                      <Box
                        data-work-signal-comparison
                        sx={(theme) => {
                          const accent = signalAccent(theme, signal.tone);
                          return {
                            minWidth: 0,
                            width: 'fit-content',
                            maxWidth: 1,
                            px: 0.75,
                            py: 0.2,
                            border: '1px solid',
                            borderColor: alpha(accent, theme.palette.mode === 'dark' ? 0.4 : 0.22),
                            borderRadius: 999,
                            bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.13 : 0.065),
                            '@media (forced-colors: active)': {
                              bgcolor: 'Canvas',
                              borderColor: 'CanvasText',
                            },
                          };
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', overflowWrap: 'anywhere' }}
                        >
                          {comparison}
                        </Typography>
                      </Box>
                    </Stack>
                    {progress !== undefined && (
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        aria-label={t('flow.signals.targetProgress', {
                          value: Math.round(progress),
                        })}
                        sx={{ mt: compressedContent ? 0.35 : 1, height: 5, borderRadius: 3 }}
                      />
                    )}
                    {detailed && (!narrow || supportStack) && (
                      <SignalSeries signal={signal} compact={height === 'tall' || supportStack} />
                    )}
                    {detailed && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mt: 1 }}
                      >
                        {flowSourceLabel(signal.source, t)} ·{' '}
                        {formatDate(signal.generatedAt, { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    )}
                  </ButtonBase>
                </Box>
              );
            })}
          </Box>
        )}
    </Box>
  );
}
