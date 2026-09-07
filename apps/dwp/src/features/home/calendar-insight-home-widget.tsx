import { ArrowUpRight, CalendarClock, RefreshCw, ShieldAlert, TimerReset } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionButton, LoadingState, foundationTokens } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, type Theme } from '@mui/material/styles';

import { buildFlowSignals, type FlowSignal } from './flow-home/flow-home-model';
import { flowSourceLabel } from './flow-home/flow-source-label';

import type { CalendarDayLoad, HomeOverview, HomeWidgetHeight } from '@dwp-frontend/shared-utils';

export type CalendarInsightWidgetKey = 'focus-balance' | 'meeting-load';

type CalendarInsightHomeWidgetProps = Readonly<{
  widgetKey: CalendarInsightWidgetKey;
  overview?: HomeOverview;
  loading: boolean;
  fetching?: boolean;
  requestFailed: boolean;
  compact?: boolean;
  height?: HomeWidgetHeight;
  onRetry: () => void;
}>;

export type CalendarInsightState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'restricted' }>
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{ kind: 'empty' }>
  | Readonly<{
      kind: 'available';
      signal: FlowSignal;
      weekLoad: readonly CalendarDayLoad[];
      meetingMinutes: number;
      focusMinutes: number;
      focusTargetMinutes: number;
      conflictCount: number;
    }>;

export function resolveCalendarInsightState(
  widgetKey: CalendarInsightWidgetKey,
  overview: HomeOverview | undefined,
  loading: boolean,
  requestFailed: boolean
): CalendarInsightState {
  if (loading && !overview) return { kind: 'loading' };
  if (overview?.calendar.status === 'FORBIDDEN') return { kind: 'restricted' };
  if (requestFailed || !overview || overview.calendar.status === 'UNAVAILABLE') {
    return { kind: 'unavailable' };
  }
  if (overview.calendar.status !== 'AVAILABLE' || !overview.calendar.data) {
    return { kind: 'empty' };
  }
  const signalKey = widgetKey === 'focus-balance' ? 'focus-time' : 'schedule-load';
  const signal = buildFlowSignals(overview).find((candidate) => candidate.key === signalKey);
  if (!signal) return { kind: 'empty' };
  return {
    kind: 'available',
    signal,
    weekLoad: overview.calendar.data.weekLoad,
    meetingMinutes: Math.max(0, overview.calendar.data.metrics.meetingMinutes),
    focusMinutes: Math.max(0, overview.calendar.data.metrics.focusMinutes),
    focusTargetMinutes: Math.max(0, overview.calendar.data.metrics.focusTargetMinutes),
    conflictCount: Math.max(0, overview.calendar.data.metrics.conflictCount),
  };
}

function insightAccent(theme: Theme, widgetKey: CalendarInsightWidgetKey): string {
  return widgetKey === 'focus-balance' ? theme.palette.success.main : theme.palette.info.main;
}

const narrowGraphicStackSx = {
  '@media (max-width: 479.95px)': {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 0.25,
    '& > .MuiTypography-root': { wordBreak: 'keep-all', overflowWrap: 'break-word' },
  },
} as const;

function FocusBalanceGraphic({
  state,
}: {
  state: Extract<CalendarInsightState, { kind: 'available' }>;
}) {
  const { t } = useTranslation('home');
  const total = state.focusMinutes + state.meetingMinutes;
  const focusShare = total > 0 ? Math.round((state.focusMinutes / total) * 100) : 0;
  const targetProgress =
    state.focusTargetMinutes > 0
      ? Math.min(100, Math.round((state.focusMinutes / state.focusTargetMinutes) * 100))
      : null;
  const remaining = Math.max(0, state.focusTargetMinutes - state.focusMinutes);
  const balanceSummary = t('flow.calendarInsights.focusVsMeetings', {
    focus: state.focusMinutes,
    meetings: state.meetingMinutes,
  });

  return (
    <Box data-calendar-insight-graphic="focus-balance" sx={{ minWidth: 0 }}>
      <Stack
        data-calendar-insight-graphic-header="focus-balance"
        direction="row"
        alignItems="baseline"
        justifyContent="space-between"
        gap={1}
        sx={narrowGraphicStackSx}
      >
        <Typography variant="caption" color="text.secondary" fontWeight="fontWeightBold">
          {t('flow.calendarInsights.weekBalance')}
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight="fontWeightBold">
          {focusShare}%
        </Typography>
      </Stack>
      <Box
        role="img"
        aria-label={balanceSummary}
        sx={{
          mt: 0.75,
          height: 8,
          display: 'flex',
          overflow: 'hidden',
          borderRadius: 'var(--home-radius-item)',
          bgcolor: 'action.disabledBackground',
          '@media (forced-colors: active)': { border: '1px solid CanvasText' },
        }}
      >
        {total > 0 && (
          <>
            <Box
              aria-hidden="true"
              sx={{
                width: `${focusShare}%`,
                bgcolor: 'success.main',
                minWidth: focusShare ? 2 : 0,
              }}
            />
            <Box aria-hidden="true" sx={{ flex: 1, bgcolor: 'info.main', opacity: 0.46 }} />
          </>
        )}
      </Box>
      <Stack
        data-calendar-insight-legend="focus-balance"
        direction="row"
        justifyContent="space-between"
        gap={1}
        sx={{ mt: 0.65, ...narrowGraphicStackSx }}
      >
        <Typography variant="caption" color="success.main" fontWeight="fontWeightBold">
          {t('flow.signals.focusTime')}{' '}
          <Box
            component="span"
            data-calendar-insight-value-unit="focus-minutes"
            sx={{ whiteSpace: 'nowrap' }}
          >
            {state.focusMinutes}
            {t('flow.signals.unit.minutes')}
          </Box>
        </Typography>
        <Typography
          data-calendar-insight-value-unit="meeting-minutes"
          variant="caption"
          color="text.secondary"
          sx={{ whiteSpace: 'nowrap' }}
        >
          {t('flow.calendarInsights.meetingMinutes', { minutes: state.meetingMinutes })}
        </Typography>
      </Stack>
      <Typography
        data-calendar-insight-comparison
        variant="caption"
        color={remaining > 0 ? 'warning.main' : 'success.main'}
        fontWeight="fontWeightBold"
        sx={{ mt: 0.6, display: 'block' }}
      >
        {targetProgress === null
          ? t('flow.signals.baselinePending')
          : remaining > 0
            ? t('flow.calendarInsights.focusRemaining', {
                minutes: remaining,
              })
            : t('flow.calendarInsights.focusTargetReached')}
      </Typography>
    </Box>
  );
}

function MeetingLoadGraphic({
  state,
}: {
  state: Extract<CalendarInsightState, { kind: 'available' }>;
}) {
  const { t } = useTranslation('home');
  const chartLabel = t('flow.calendarInsights.weekProfile');

  return (
    <Box data-calendar-insight-graphic="meeting-load" sx={{ minWidth: 0 }}>
      <Stack
        data-calendar-insight-graphic-header="meeting-load"
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={narrowGraphicStackSx}
      >
        <Typography variant="caption" color="text.secondary" fontWeight="fontWeightBold">
          {chartLabel}
        </Typography>
        <Typography
          variant="caption"
          color={state.conflictCount > 0 ? 'warning.main' : 'success.main'}
          fontWeight="fontWeightBold"
        >
          {state.conflictCount > 0
            ? t('flow.calendarInsights.conflicts', { count: state.conflictCount })
            : t('flow.calendarInsights.noConflicts')}
        </Typography>
      </Stack>
      <Box
        role="img"
        aria-label={t('flow.signals.weekSeriesLabel')}
        title={t('flow.signals.weekSeriesLabel')}
        data-calendar-insight-week-bars
        data-calendar-insight-week-scale="daily-limit-100"
        sx={{
          height: 54,
          mt: 0.5,
          display: 'grid',
          gridTemplateColumns: `repeat(${state.weekLoad.length}, minmax(0, 1fr))`,
          alignItems: 'end',
          justifyItems: 'center',
          gap: 0.6,
          borderBlockEnd: '1px solid',
          borderColor: 'divider',
        }}
      >
        {state.weekLoad.map((point) => {
          const current = point.date === state.signal.seriesCurrentDate;
          const risky = point.conflictCount > 0 || point.loadPercent > 100;
          return (
            <Box
              key={point.date}
              data-calendar-insight-day={point.date}
              data-calendar-insight-day-load={Math.round(point.loadPercent)}
              data-calendar-insight-day-current={current ? 'true' : 'false'}
              data-calendar-insight-day-conflict={point.conflictCount > 0 ? 'true' : 'false'}
              data-calendar-insight-day-over-limit={point.loadPercent > 100 ? 'true' : 'false'}
              style={{ borderRadius: foundationTokens.radius.compact }}
              title={t('flow.signals.seriesPoint', {
                date: formatDate(point.date, { month: 'short', day: 'numeric' }),
                load: Math.round(point.loadPercent),
                conflicts: point.conflictCount,
              })}
              sx={{
                width: '100%',
                minWidth: 4,
                maxWidth: 26,
                boxSizing: 'border-box',
                height: `${Math.max(4, Math.min(100, point.loadPercent))}%`,
                bgcolor: risky ? 'warning.main' : current ? 'info.main' : 'action.selected',
                borderBlockStart: risky
                  ? `3px ${point.conflictCount > 0 ? 'dashed' : 'double'}`
                  : '0 solid transparent',
                borderBlockStartColor: 'text.primary',
                outline: current ? '2px solid' : 'none',
                outlineColor: 'info.main',
                outlineOffset: 1,
                '@media (forced-colors: active)': {
                  bgcolor: 'CanvasText',
                  outlineColor: current ? 'Highlight' : 'CanvasText',
                },
              }}
            />
          );
        })}
      </Box>
      <Box
        aria-hidden="true"
        sx={{
          mt: 0.35,
          display: 'grid',
          gridTemplateColumns: `repeat(${state.weekLoad.length}, minmax(0, 1fr))`,
          gap: 0.6,
        }}
      >
        {state.weekLoad.map((point) => (
          <Typography
            key={point.date}
            variant="caption"
            color="text.secondary"
            sx={{
              textAlign: 'center',
              fontSize: 'caption.fontSize',
              lineHeight: 'body1.lineHeight',
              fontWeight:
                point.date === state.signal.seriesCurrentDate
                  ? 'fontWeightBold'
                  : 'fontWeightRegular',
              textDecoration: point.date === state.signal.seriesCurrentDate ? 'underline' : 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Number(point.date.slice(-2))}
          </Typography>
        ))}
      </Box>
      <Box sx={visuallyHidden}>
        <Box
          component="table"
          sx={{
            width: 1,
            maxWidth: 1,
            tableLayout: 'fixed',
            '& caption, & th, & td': { maxWidth: 1, overflow: 'hidden' },
          }}
        >
          <caption>{chartLabel}</caption>
          <thead>
            <tr>
              <th>{t('flow.signals.date')}</th>
              <th>{t('flow.signals.load')}</th>
              <th>{t('flow.signals.conflicts')}</th>
            </tr>
          </thead>
          <tbody>
            {state.weekLoad.map((point) => (
              <tr key={point.date}>
                <td>{point.date}</td>
                <td>{point.loadPercent}%</td>
                <td>{point.conflictCount}</td>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </Box>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  maxWidth: '1px',
  maxHeight: '1px',
  p: 0,
  m: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  contain: 'strict',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

export function CalendarInsightHomeWidget({
  widgetKey,
  overview,
  loading,
  fetching = false,
  requestFailed,
  compact = false,
  height = 'short',
  onRetry,
}: CalendarInsightHomeWidgetProps) {
  const { t } = useTranslation('home');
  const state = resolveCalendarInsightState(widgetKey, overview, loading, requestFailed);
  const Icon = widgetKey === 'focus-balance' ? TimerReset : CalendarClock;
  const title = t(
    widgetKey === 'focus-balance'
      ? 'flow.calendarInsights.focusTitle'
      : 'flow.calendarInsights.meetingTitle'
  );
  const description = t(
    widgetKey === 'focus-balance'
      ? 'flow.calendarInsights.focusDescription'
      : 'flow.calendarInsights.meetingDescription'
  );
  const dense = compact || height === 'short';
  const availableState = state.kind === 'available' ? state : null;
  const comparison = availableState
    ? widgetKey === 'focus-balance'
      ? availableState.signal.comparison.kind === 'target'
        ? t('flow.signals.target', {
            value: availableState.signal.comparison.value,
            unit: t('flow.signals.unit.minutes'),
          })
        : t('flow.signals.baselinePending')
      : t('flow.calendarInsights.dailyLimit')
    : '';

  return (
    <Box
      component="section"
      data-calendar-insight-widget={widgetKey}
      data-calendar-insight-state={state.kind}
      aria-labelledby={`${widgetKey}-home-heading`}
      aria-busy={loading || fetching || undefined}
      sx={(theme) => {
        const accent = insightAccent(theme, widgetKey);
        return {
          height: 1,
          minHeight: dense ? 154 : 184,
          p: dense ? 1.5 : 2,
          display: 'flex',
          flexDirection: 'column',
          gap: dense ? 1.1 : 1.5,
          overflow: 'hidden',
          position: 'relative',
          bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.045 : 0.018),
          "[data-flow-large-text='true'] &": {
            height: 'auto',
            minHeight: 0,
            overflow: 'visible',
          },
          '@media (forced-colors: active)': {
            bgcolor: 'Canvas',
          },
        };
      }}
    >
      <Stack direction="row" alignItems="center" gap={1.1} sx={{ minWidth: 0 }}>
        <Box
          aria-hidden="true"
          sx={(theme) => {
            const accent = insightAccent(theme, widgetKey);
            return {
              width: dense ? 32 : 36,
              height: dense ? 32 : 36,
              flex: `0 0 ${dense ? 32 : 36}px`,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 'var(--home-radius-item)',
              color: accent,
              bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.17 : 0.09),
              border: '1px solid',
              borderColor: alpha(accent, 0.22),
              boxShadow: 'none',
              '@media (forced-colors: active)': { color: 'CanvasText', borderColor: 'CanvasText' },
            };
          }}
        >
          <Icon size={dense ? 17 : 19} strokeWidth={2} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            id={`${widgetKey}-home-heading`}
            component="h2"
            variant="subtitle2"
            fontWeight="fontWeightBold"
            sx={{ lineHeight: 'body1.lineHeight' }}
          >
            {title}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              mt: 0.15,
              display: 'block',
              lineHeight: 'body1.lineHeight',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              "[data-flow-large-text='true'] &": {
                whiteSpace: 'normal',
                overflow: 'visible',
                textOverflow: 'clip',
              },
            }}
          >
            {description}
          </Typography>
        </Box>
      </Stack>

      {state.kind === 'loading' && (
        <Stack
          data-calendar-insight-loading
          gap={0.75}
          aria-label={t('flow.calendarInsights.loading')}
        >
          <LoadingState
            label={t('flow.calendarInsights.loading')}
            variant="skeleton"
            embedded
            skeletonHeights={[36, 44]}
            skeletonGap={1}
          />
        </Stack>
      )}

      {(state.kind === 'unavailable' || state.kind === 'restricted' || state.kind === 'empty') && (
        <Box
          role={state.kind === 'unavailable' ? 'alert' : 'status'}
          sx={{
            minHeight: 76,
            flex: 1,
            px: 1,
            py: 0.75,
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            alignItems: 'center',
            gap: 1,
            borderRadius: 'var(--home-radius-item)',
            bgcolor: 'action.hover',
            "[data-flow-large-text='true'] &": {
              gridTemplateColumns: 'minmax(0, 1fr)',
              justifyItems: 'start',
            },
          }}
        >
          <ShieldAlert size={18} aria-hidden="true" />
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t(
              state.kind === 'restricted'
                ? 'flow.calendarInsights.restricted'
                : state.kind === 'empty'
                  ? 'flow.calendarInsights.empty'
                  : 'flow.calendarInsights.unavailable'
            )}
          </Typography>
          {state.kind === 'unavailable' && (
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<RefreshCw size={14} aria-hidden="true" />}
              onClick={onRetry}
              loading={fetching}
              sx={{
                gridColumn: 2,
                justifySelf: 'start',
                minHeight: 44,
                whiteSpace: 'nowrap',
                "[data-flow-large-text='true'] &": { gridColumn: 1 },
              }}
            >
              {t('flow.calendarInsights.retry')}
            </ActionButton>
          )}
        </Box>
      )}

      {availableState && (
        <Box
          component={Link}
          to={availableState.signal.route}
          aria-label={t('flow.signals.openSummary', {
            signal: title,
            value: availableState.signal.value,
            unit: t(`flow.signals.unit.${availableState.signal.unit}`),
            comparison,
          })}
          data-calendar-insight-open
          sx={(theme) => ({
            minWidth: 0,
            flex: 1,
            display: 'grid',
            gridTemplateColumns: dense ? 'minmax(108px, 0.72fr) minmax(0, 1.28fr)' : '0.8fr 1.2fr',
            alignItems: 'center',
            gap: dense ? 1.25 : 2,
            px: dense ? 1 : 1.25,
            py: dense ? 0.75 : 1,
            color: 'text.primary',
            textDecoration: 'none',
            borderRadius: 'var(--home-radius-item)',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(
              theme.palette.background.paper,
              theme.palette.mode === 'dark' ? 0.6 : 0.72
            ),
            transition: theme.transitions.create(
              ['border-color', 'background-color', 'transform'],
              {
                duration: 150,
              }
            ),
            '&:hover': {
              borderColor: alpha(insightAccent(theme, widgetKey), 0.5),
              bgcolor: alpha(
                insightAccent(theme, widgetKey),
                theme.palette.mode === 'dark' ? 0.1 : 0.045
              ),
              transform: 'translateY(-1px)',
            },
            '&:focus-visible': {
              outline: '3px solid var(--dwp-focus-ring, currentColor)',
              outlineOffset: 2,
            },
            "[data-flow-large-text='true'] &": {
              gridTemplateColumns: 'minmax(0, 1fr)',
              alignItems: 'start',
            },
            "[data-flow-read-template='adaptive-wide'] &": {
              gridTemplateColumns: 'minmax(0, 1fr)',
              alignItems: 'start',
              alignContent: 'start',
              border: 0,
              bgcolor: 'transparent',
              px: 0,
              gap: 1.5,
            },
            '@media (max-width: 359.95px)': {
              gridTemplateColumns: 'minmax(96px, 0.66fr) minmax(0, 1.34fr)',
              gap: 1,
            },
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
              '&:hover': { transform: 'none' },
            },
            '@media (forced-colors: active)': {
              bgcolor: 'Canvas',
              borderColor: 'CanvasText',
            },
          })}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack
              data-calendar-insight-value-unit="primary"
              direction="row"
              alignItems="baseline"
              gap={0.45}
              sx={{ whiteSpace: 'nowrap', flexWrap: 'nowrap', '& > *': { flexShrink: 0 } }}
            >
              <Typography
                data-calendar-insight-value
                sx={{
                  fontSize: dense ? 'h2.fontSize' : 'h1.fontSize',
                  lineHeight: 'h4.lineHeight',
                  fontWeight: 'fontWeightBold',
                  letterSpacing: 'h4.letterSpacing',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {availableState.signal.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight="fontWeightBold">
                {t(`flow.signals.unit.${availableState.signal.unit}`)}
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: 'block', lineHeight: 'body1.lineHeight' }}
            >
              {comparison}
            </Typography>
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.75 }}>
              <Typography
                variant="caption"
                color="primary.main"
                fontWeight="fontWeightBold"
                sx={{ lineHeight: 'body1.lineHeight' }}
              >
                {t('flow.calendarInsights.openDetails')}
              </Typography>
              <ArrowUpRight size={13} aria-hidden="true" />
            </Stack>
          </Box>
          {widgetKey === 'focus-balance' ? (
            <FocusBalanceGraphic state={availableState} />
          ) : (
            <MeetingLoadGraphic state={availableState} />
          )}
        </Box>
      )}

      {availableState && height !== 'short' && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ lineHeight: 'body1.lineHeight' }}
        >
          {t('flow.next.sourceUpdated', {
            source: flowSourceLabel(availableState.signal.source, t),
            time: formatDate(availableState.signal.generatedAt, {
              hour: '2-digit',
              minute: '2-digit',
            }),
          })}
        </Typography>
      )}
    </Box>
  );
}
