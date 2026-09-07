import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { BellDot, BriefcaseBusiness, CalendarRange, Timer } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, type Theme } from '@mui/material/styles';

import type { FlowSignal } from './flow-home-model';
import { flowSourceLabel } from './flow-source-label';

const signalOrder: readonly FlowSignal['key'][] = [
  'open-work',
  'focus-time',
  'schedule-load',
  'activity-attention',
];

const signalIcon = {
  'open-work': BriefcaseBusiness,
  'focus-time': Timer,
  'schedule-load': CalendarRange,
  'activity-attention': BellDot,
} as const;

export type RolePulseInsightDensity = 'short' | 'standard' | 'tall';

export const rolePulseLayoutPolicy = {
  short: {
    gap: 0.5,
    readRowHeight: 44,
    editingRowHeight: 34,
    metricRailWidth: 44,
    metricRailHeight: 8,
  },
  standard: {
    gap: 0.75,
    readRowHeight: 58,
    editingRowHeight: 58,
    metricRailWidth: 56,
    metricRailHeight: 13,
  },
  tall: {
    gap: 0.75,
    readRowHeight: 76,
    editingRowHeight: 76,
    metricRailWidth: 64,
    metricRailHeight: 13,
  },
} as const satisfies Record<
  RolePulseInsightDensity,
  Readonly<{
    gap: number;
    readRowHeight: number;
    editingRowHeight: number;
    metricRailWidth: number;
    metricRailHeight: number;
  }>
>;

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

function signalAccent(theme: Theme, tone: FlowSignal['tone']): string {
  if (tone === 'risk') return theme.palette.error.main;
  if (tone === 'warning') return theme.palette.warning.main;
  if (tone === 'success') return theme.palette.success.main;
  if (tone === 'info') return theme.palette.info.main;
  return theme.palette.text.secondary;
}

function comparisonLabel(signal: FlowSignal, t: TFunction<'home'>): string {
  if (signal.key === 'activity-attention' && signal.activityBreakdown) {
    return t('flow.signals.activityBreakdown', signal.activityBreakdown);
  }
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

function roleSignalLabel(signal: FlowSignal, t: TFunction<'home'>): string {
  return signal.key === 'schedule-load'
    ? t('flow.signals.scheduleLoadToday')
    : t(`flow.signals.${signal.label}`);
}

function roleComparisonLabel(signal: FlowSignal, t: TFunction<'home'>, compact = false): string {
  const comparison = comparisonLabel(signal, t);
  if (signal.key !== 'schedule-load' || !signal.series?.length) return comparison;
  return t(
    compact ? 'flow.signals.scheduleLoadContextCompact' : 'flow.signals.scheduleLoadContext',
    { comparison }
  );
}

function focusProgress(signal: FlowSignal): number | undefined {
  if (
    signal.key !== 'focus-time' ||
    signal.comparison.kind !== 'target' ||
    signal.comparison.value <= 0
  ) {
    return undefined;
  }
  return Math.min(100, Math.max(0, (signal.value / signal.comparison.value) * 100));
}

function ScheduleMiniBars({
  signal,
  density,
}: {
  signal: FlowSignal;
  density: RolePulseInsightDensity;
}) {
  const { t } = useTranslation('home');
  const series = signal.key === 'schedule-load' ? (signal.series ?? []) : [];
  if (series.length === 0) return null;
  const chartLabel = t('flow.signals.weekSeriesLabel');

  return (
    <>
      <Box
        data-home-role-series
        data-home-role-series-density={density}
        data-home-role-series-scale="daily-limit-100"
        role="img"
        aria-label={chartLabel}
        title={chartLabel}
        sx={{
          width: 1,
          height: 'var(--home-role-metric-rail-height)',
          minWidth: 0,
          display: 'flex',
          alignItems: 'end',
          gap: '2px',
          borderBlockEnd: '1px solid',
          borderColor: 'divider',
          '@media (max-width: 359.95px)': {
            minWidth: 0,
          },
        }}
      >
        {series.map((point) => {
          const isCurrent = point.date === signal.seriesCurrentDate;
          const hasConflict = point.conflictCount > 0;
          const exceedsLimit = point.loadPercent > 100;
          return (
            <Box
              key={point.date}
              data-home-role-series-point={point.date}
              data-home-role-series-load={Math.round(point.loadPercent)}
              data-home-role-series-current={isCurrent ? 'true' : 'false'}
              data-home-role-series-conflict={hasConflict ? 'true' : 'false'}
              data-home-role-series-over-limit={exceedsLimit ? 'true' : 'false'}
              aria-hidden="true"
              title={t('flow.signals.seriesPoint', {
                date: formatDate(point.date, { month: 'short', day: 'numeric' }),
                load: Math.round(point.loadPercent),
                conflicts: point.conflictCount,
              })}
              sx={(theme) => ({
                flex: '1 1 0',
                minWidth: 2,
                boxSizing: 'border-box',
                height: `${Math.min(100, Math.max(0, point.loadPercent))}%`,
                minHeight: isCurrent ? '3px' : '1px',
                borderRadius: '2px 2px 0 0',
                bgcolor: alpha(
                  hasConflict ? theme.palette.error.main : theme.palette.primary.main,
                  hasConflict ? 0.78 : isCurrent ? 0.88 : 0.34
                ),
                borderBlockStart:
                  hasConflict || exceedsLimit
                    ? `2px ${hasConflict ? 'dashed' : 'double'}`
                    : '0 solid transparent',
                borderBlockStartColor: hasConflict ? 'error.main' : 'warning.main',
                outline: isCurrent ? `1px solid ${alpha(theme.palette.primary.dark, 0.9)}` : 'none',
                outlineOffset: 1,
                '@media (forced-colors: active)': {
                  bgcolor: 'CanvasText',
                  borderBlockStart:
                    hasConflict || exceedsLimit
                      ? `2px ${hasConflict ? 'dashed' : 'double'} CanvasText`
                      : '0 solid transparent',
                  outline: isCurrent ? '1px solid Highlight' : 'none',
                },
              })}
            />
          );
        })}
      </Box>
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

function RolePulseLens({
  signal,
  density,
}: {
  signal: FlowSignal;
  density: RolePulseInsightDensity;
}) {
  const { t } = useTranslation('home');
  const Icon = signalIcon[signal.key];
  const label = roleSignalLabel(signal, t);
  const unit = t(`flow.signals.unit.${signal.unit}`);
  const comparison = roleComparisonLabel(signal, t);
  const compactComparison = roleComparisonLabel(signal, t, true);
  const progress = focusProgress(signal);
  const layout = rolePulseLayoutPolicy[density];
  const sourceDetail =
    density === 'tall'
      ? t('flow.next.sourceUpdated', {
          source: flowSourceLabel(signal.source, t),
          time: formatDate(signal.generatedAt, { hour: '2-digit', minute: '2-digit' }),
        })
      : null;

  return (
    <Box
      component={Link}
      to={signal.route}
      data-home-role-lens={signal.key}
      data-home-role-lens-density={density}
      aria-label={t('flow.signals.openSummary', {
        signal: label,
        value: signal.value,
        unit,
        comparison,
      })}
      sx={(theme) => {
        const accent = signalAccent(theme, signal.tone);
        return {
          '--home-role-metric-rail-width': `${layout.metricRailWidth}px`,
          '--home-role-metric-rail-height': `${layout.metricRailHeight}px`,
          minWidth: 0,
          minHeight: layout.readRowHeight,
          px: density === 'short' ? 0.5 : 1,
          py: density === 'short' ? 0.25 : 0.65,
          display: 'grid',
          gridTemplateColumns:
            density === 'short'
              ? '18px minmax(0, 1fr) var(--home-role-metric-rail-width)'
              : '24px minmax(0, 1fr) var(--home-role-metric-rail-width)',
          gridTemplateRows:
            density === 'tall'
              ? '1.5rem minmax(0.875rem, auto) auto'
              : density === 'short'
                ? 'minmax(1rem, auto) minmax(0.6875rem, auto)'
                : '1.5rem minmax(0.875rem, auto)',
          columnGap: density === 'short' ? 0.4 : 0.75,
          alignItems: 'center',
          color: 'text.primary',
          textDecoration: 'none',
          border: '1px solid',
          borderColor: alpha(accent, theme.palette.mode === 'dark' ? 0.34 : 0.2),
          borderRadius: 'var(--home-radius-item)',
          bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.1 : 0.035),
          boxShadow: `inset 0 1px 0 ${alpha(theme.palette.common.white, 0.24)}`,
          transition: theme.transitions.create(['transform', 'background-color', 'border-color'], {
            duration: 150,
          }),
          '&:hover': {
            transform: 'translateY(-2px)',
            bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.16 : 0.07),
            borderColor: alpha(accent, 0.46),
          },
          '&:focus-visible': {
            outline: '3px solid var(--dwp-focus-ring, currentColor)',
            outlineOffset: 1,
          },
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
            '&:hover': { transform: 'none' },
          },
          '@media (max-width: 359.95px)': {
            '--home-role-metric-rail-width': `${rolePulseLayoutPolicy.short.metricRailWidth}px`,
            '--home-role-metric-rail-height': `${rolePulseLayoutPolicy.short.metricRailHeight}px`,
            minHeight: rolePulseLayoutPolicy.short.readRowHeight,
            px: 0.5,
            py: 0.25,
            gridTemplateColumns: '18px minmax(0, 1fr) var(--home-role-metric-rail-width)',
            gridTemplateRows: 'minmax(1rem, auto) minmax(0.6875rem, auto)',
            columnGap: 0.4,
          },
          '@container home-role-pulse (max-width: 460px)': {
            '--home-role-metric-rail-width': `${rolePulseLayoutPolicy.short.metricRailWidth}px`,
            '--home-role-metric-rail-height': `${rolePulseLayoutPolicy.short.metricRailHeight}px`,
            minHeight:
              density === 'short'
                ? rolePulseLayoutPolicy.short.readRowHeight
                : density === 'tall'
                  ? rolePulseLayoutPolicy.tall.readRowHeight
                  : 64,
            px: 0.5,
            py: 0.35,
            gridTemplateColumns: '18px minmax(0, 1fr) var(--home-role-metric-rail-width)',
            gridTemplateRows:
              density === 'tall'
                ? 'minmax(1.125rem, auto) minmax(0.75rem, auto) auto'
                : 'minmax(1.125rem, auto) minmax(0.75rem, auto)',
            columnGap: 0.4,
          },
          "[data-flow-large-text='true'] &": {
            '--home-role-metric-rail-width': '4rem',
            minHeight: 'auto',
            gridTemplateRows:
              density === 'tall'
                ? 'minmax(1.5rem, auto) minmax(0.875rem, auto) auto'
                : density === 'short'
                  ? 'minmax(1rem, auto) minmax(0.6875rem, auto)'
                  : 'minmax(1.5rem, auto) minmax(0.875rem, auto)',
          },
          "[data-workspace-widget-content-state='editing-preview'] &": {
            minHeight: layout.editingRowHeight,
          },
          '@media (forced-colors: active)': {
            color: 'CanvasText',
            bgcolor: 'Canvas',
            borderColor: 'CanvasText',
            boxShadow: 'none',
          },
        };
      }}
    >
      <Box
        aria-hidden="true"
        sx={(theme) => {
          const accent = signalAccent(theme, signal.tone);
          return {
            gridRow: '1 / span 2',
            alignSelf: 'center',
            width: density === 'short' ? 18 : 24,
            height: density === 'short' ? 18 : 24,
            display: 'grid',
            placeItems: 'center',
            color: accent,
            borderRadius: 1.25,
            bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.16 : 0.09),
            '@media (max-width: 359.95px)': { width: 18, height: 18 },
            '@container home-role-pulse (max-width: 460px)': { width: 18, height: 18 },
            '@media (forced-colors: active)': {
              color: 'CanvasText',
              bgcolor: 'Canvas',
              border: '1px solid CanvasText',
            },
          };
        }}
      >
        <Icon size={density === 'short' ? 11 : 14} strokeWidth={2} />
      </Box>

      <Typography
        data-home-role-label
        data-home-role-label-layout={density === 'short' ? 'wrapped' : 'responsive'}
        variant="caption"
        fontWeight="fontWeightBold"
        sx={{
          minWidth: 0,
          alignSelf: 'baseline',
          fontSize: density === 'short' ? '0.65625rem' : undefined,
          lineHeight: 'caption.lineHeight',
          wordBreak: density === 'short' ? 'keep-all' : undefined,
          whiteSpace: density === 'short' ? 'normal' : 'nowrap',
          overflow: density === 'short' ? 'visible' : 'hidden',
          textOverflow: density === 'short' ? 'clip' : 'ellipsis',
          '@media (max-width: 359.95px)': {
            fontSize: '0.65625rem',
            lineHeight: 1.1,
            wordBreak: 'keep-all',
            whiteSpace: 'normal',
            overflow: 'visible',
            textOverflow: 'clip',
          },
          "[data-flow-large-text='true'] &": {
            whiteSpace: 'normal',
            overflow: 'visible',
            textOverflow: 'clip',
          },
          '@container home-role-pulse (max-width: 460px)': {
            fontSize: '0.65625rem',
            lineHeight: 1.1,
            wordBreak: 'keep-all',
            whiteSpace: 'normal',
            overflow: 'visible',
            textOverflow: 'clip',
          },
        }}
      >
        {label}
      </Typography>
      <Typography
        data-home-role-value
        sx={{
          width: 1,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'baseline',
          alignSelf: 'baseline',
          textAlign: 'end',
          fontSize: density === 'short' ? { xs: '0.9375rem', sm: '1.0625rem' } : '1.375rem',
          lineHeight: 1,
          fontWeight: 760,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          '@media (max-width: 359.95px)': { fontSize: '0.9375rem' },
          '@container home-role-pulse (max-width: 460px)': { fontSize: '1.0625rem' },
          "[data-flow-large-text='true'] &": { lineHeight: 1.2 },
        }}
      >
        {signal.value}
        <Typography
          component="span"
          data-home-role-unit
          variant="caption"
          color="text.secondary"
          sx={{
            ml: 0.35,
            alignSelf: 'baseline',
            lineHeight: 1,
            verticalAlign: 'baseline',
            letterSpacing: 0,
            fontSize: density === 'short' ? { xs: '0.53125rem', sm: '0.59375rem' } : undefined,
            '@media (max-width: 359.95px)': { fontSize: '0.53125rem' },
            '@container home-role-pulse (max-width: 460px)': { fontSize: '0.59375rem' },
            "[data-flow-large-text='true'] &": { lineHeight: 1.2 },
          }}
        >
          {unit}
        </Typography>
      </Typography>

      <Typography
        data-home-role-comparison
        variant="caption"
        color="text.secondary"
        sx={{
          minWidth: 0,
          fontSize: density === 'short' ? '0.59375rem' : undefined,
          lineHeight: density === 'short' ? 1.1 : 1.2,
          whiteSpace: density === 'short' ? 'normal' : 'nowrap',
          overflow: density === 'short' ? 'visible' : 'hidden',
          textOverflow: density === 'short' ? 'clip' : 'ellipsis',
          '@media (max-width: 359.95px)': {
            fontSize: '0.59375rem',
            lineHeight: 1.1,
            whiteSpace: 'normal',
            wordBreak: 'keep-all',
            overflow: 'visible',
            textOverflow: 'clip',
          },
          '@container home-role-pulse (max-width: 460px)': {
            fontSize: '0.59375rem',
            lineHeight: 1.1,
            minHeight: density === 'short' ? undefined : '2.2em',
            display: density === 'short' ? undefined : 'flex',
            alignItems: density === 'short' ? undefined : 'center',
            whiteSpace: 'normal',
            wordBreak: 'keep-all',
            overflow: 'visible',
            textOverflow: 'clip',
          },
          "[data-flow-large-text='true'] &": {
            whiteSpace: 'normal',
            overflow: 'visible',
            textOverflow: 'clip',
          },
        }}
      >
        {signal.key === 'schedule-load' ? (
          <>
            <Box
              component="span"
              data-home-role-comparison-full
              sx={{
                '@media (max-width: 359.95px)': { display: 'none' },
                '@container home-role-pulse (max-width: 460px)': { display: 'none' },
              }}
            >
              {comparison}
            </Box>
            <Box
              component="span"
              data-home-role-comparison-compact
              sx={{
                display: 'none',
                '@media (max-width: 359.95px)': { display: 'inline' },
                '@container home-role-pulse (max-width: 460px)': { display: 'inline' },
              }}
            >
              {compactComparison}
            </Box>
          </>
        ) : (
          comparison
        )}
      </Typography>
      <Box
        data-home-role-metric-rail
        sx={{
          width: 'var(--home-role-metric-rail-width)',
          height: 'var(--home-role-metric-rail-height)',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {progress !== undefined ? (
          <Box
            role="progressbar"
            aria-label={t('flow.signals.targetProgress', { value: Math.round(progress) })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            sx={{
              width: 1,
              height: density === 'short' ? 4 : 5,
              bgcolor: 'action.disabledBackground',
              borderRadius: 99,
              overflow: 'hidden',
              '@media (forced-colors: active)': {
                border: '1px solid CanvasText',
                bgcolor: 'Canvas',
              },
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: `${progress}%`,
                height: 1,
                bgcolor: signal.tone === 'warning' ? 'warning.main' : 'success.main',
                borderRadius: 'inherit',
                transition: 'width 240ms ease-out',
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                '@media (forced-colors: active)': { bgcolor: 'Highlight' },
              }}
            />
          </Box>
        ) : (
          <ScheduleMiniBars signal={signal} density={density} />
        )}
      </Box>
      {sourceDetail && (
        <Typography
          data-home-role-detail
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{
            gridColumn: '1 / -1',
            minWidth: 0,
            pt: 0.2,
            fontSize: '0.65625rem',
            lineHeight: 1.2,
          }}
        >
          {sourceDetail}
        </Typography>
      )}
    </Box>
  );
}

export function RolePulseInsight({
  signals,
  density = 'standard',
}: {
  signals: readonly FlowSignal[];
  density?: RolePulseInsightDensity;
}) {
  const { t } = useTranslation('home');
  const layout = rolePulseLayoutPolicy[density];
  const visible = signalOrder
    .map((key) => signals.find((signal) => signal.key === key))
    .filter((signal): signal is FlowSignal => Boolean(signal));
  if (visible.length === 0) return null;

  const accessibleSummary = visible
    .map((signal) => {
      const label = roleSignalLabel(signal, t);
      const unit = t(`flow.signals.unit.${signal.unit}`);
      return `${label} ${signal.value}${unit}, ${roleComparisonLabel(signal, t)}`;
    })
    .join('; ');

  return (
    <Box
      data-home-role-insight
      data-home-role-density={density}
      data-home-role-layout="2x2"
      data-home-role-tall-detail={density === 'tall' ? 'true' : 'false'}
      data-home-role-edit-row-height={layout.editingRowHeight}
      data-home-role-metric-rail-width={layout.metricRailWidth}
      data-home-role-metric-rail-height={layout.metricRailHeight}
      role="region"
      aria-label={t('flow.signals.title')}
      sx={{
        width: 1,
        minWidth: 0,
        containerName: 'home-role-pulse',
        containerType: 'inline-size',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gridAutoRows: `minmax(${layout.readRowHeight}px, auto)`,
        gap: layout.gap,
        "[data-workspace-widget-content-state='editing-preview'] &": {
          gridAutoRows: `${layout.editingRowHeight}px`,
        },
        '@media (forced-colors: active)': { gap: 1 },
      }}
    >
      <Typography component="p" sx={visuallyHidden}>
        {accessibleSummary}
      </Typography>
      {visible.map((signal) => (
        <RolePulseLens key={signal.key} signal={signal} density={density} />
      ))}
    </Box>
  );
}
