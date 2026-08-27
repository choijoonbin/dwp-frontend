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
  },
  standard: {
    gap: 0.75,
    readRowHeight: 58,
    editingRowHeight: 58,
  },
  tall: {
    gap: 0.75,
    readRowHeight: 76,
    editingRowHeight: 76,
  },
} as const satisfies Record<
  RolePulseInsightDensity,
  Readonly<{ gap: number; readRowHeight: number; editingRowHeight: number }>
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
  const maxLoad = Math.max(1, ...series.map((point) => point.loadPercent));

  return (
    <>
      <Box
        data-home-role-series
        aria-hidden="true"
        sx={{
          height: density === 'short' ? 8 : 13,
          minWidth: density === 'short' ? 32 : 56,
          display: 'flex',
          alignItems: 'end',
          gap: '2px',
          borderBlockEnd: '1px solid',
          borderColor: 'divider',
        }}
      >
        {series.map((point) => (
          <Box
            key={point.date}
            sx={(theme) => ({
              flex: '1 1 0',
              minWidth: 2,
              height: `${(point.loadPercent / maxLoad) * 100}%`,
              minHeight: point.loadPercent > 0 ? 2 : 0,
              borderRadius: '2px 2px 0 0',
              bgcolor: alpha(
                point.conflictCount > 0 ? theme.palette.error.main : theme.palette.primary.main,
                point.conflictCount > 0 ? 0.78 : 0.42
              ),
              '@media (forced-colors: active)': {
                bgcolor: 'CanvasText',
                borderBlockStart:
                  point.conflictCount > 0 ? '2px dashed Highlight' : '1px solid CanvasText',
              },
            })}
          />
        ))}
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
  const label = t(`flow.signals.${signal.label}`);
  const unit = t(`flow.signals.unit.${signal.unit}`);
  const comparison = comparisonLabel(signal, t);
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
          minWidth: 0,
          minHeight: layout.readRowHeight,
          px: density === 'short' ? 0.5 : 1,
          py: density === 'short' ? 0.25 : 0.65,
          display: 'grid',
          gridTemplateColumns:
            density === 'short' ? '18px minmax(0, 1fr) auto' : '24px minmax(0, 1fr) auto',
          gridTemplateRows:
            density === 'tall'
              ? '24px minmax(14px, auto) auto'
              : density === 'short'
                ? '16px minmax(11px, auto)'
                : '24px minmax(14px, auto)',
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
        variant="caption"
        fontWeight={720}
        noWrap
        sx={{
          minWidth: 0,
          fontSize: density === 'short' ? 10.5 : undefined,
          lineHeight: density === 'short' ? 1.1 : 1.2,
        }}
      >
        {label}
      </Typography>
      <Typography
        data-home-role-value
        sx={{
          alignSelf: 'baseline',
          fontSize: density === 'short' ? 17 : 22,
          lineHeight: 1,
          fontWeight: 760,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {signal.value}
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ ml: 0.35, letterSpacing: 0, fontSize: density === 'short' ? 9.5 : undefined }}
        >
          {unit}
        </Typography>
      </Typography>

      <Typography
        data-home-role-comparison
        variant="caption"
        color="text.secondary"
        noWrap
        sx={{
          minWidth: 0,
          fontSize: density === 'short' ? 9.5 : undefined,
          lineHeight: density === 'short' ? 1.1 : 1.2,
        }}
      >
        {comparison}
      </Typography>
      <Box sx={{ minWidth: density === 'short' ? 32 : { xs: 44, sm: 50 } }}>
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
            fontSize: 10.5,
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
      const label = t(`flow.signals.${signal.label}`);
      const unit = t(`flow.signals.unit.${signal.unit}`);
      return `${label} ${signal.value}${unit}, ${comparisonLabel(signal, t)}`;
    })
    .join('; ');

  return (
    <Box
      data-home-role-insight
      data-home-role-density={density}
      data-home-role-layout="2x2"
      data-home-role-tall-detail={density === 'tall' ? 'true' : 'false'}
      data-home-role-edit-row-height={layout.editingRowHeight}
      role="region"
      aria-label={t('flow.signals.title')}
      sx={{
        width: 1,
        minWidth: 0,
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
