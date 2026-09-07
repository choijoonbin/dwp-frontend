import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronRight, DoorOpen, Focus, ListChecks, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ActionButton,
  ActionIconButton,
  LiveStatus,
  LoadingState,
  SectionHeader,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { calendarDate, calendarTime } from './calendar-components';
import { CalendarHomeShortcuts } from './calendar-home-shortcuts';
import { CalendarHomeTeamPanel } from './calendar-home-team-panel';
import { calendarHomeSurface, CALENDAR_HOME_ROW_RADIUS } from './calendar-home-surfaces';
import { calendarInternalPath } from './calendar-schedule-state';

import type { CalendarAttentionItem, CalendarHome } from '@dwp-frontend/shared-utils';
import type { CalendarReadSourceState } from './calendar-read-source-state';

function minutesLabel(value: number, hour: string, minute: string) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return `${minutes}${minute}`;
  if (!minutes) return `${hours}${hour}`;
  return `${hours}${hour} ${minutes}${minute}`;
}

function CalendarFocusMeter({
  data,
  currentSearch,
  canCreate,
  onCreateFocus,
}: {
  data: CalendarHome;
  currentSearch: string;
  canCreate: boolean;
  onCreateFocus?: () => void;
}) {
  const { t } = useTranslation('calendar');
  const minutes = Number.isFinite(data.metrics.focusMinutes)
    ? Math.max(0, data.metrics.focusMinutes)
    : null;
  const target = data.metrics.focusTargetMinutes;
  const hasTarget = Number.isFinite(target) && target > 0;
  const percentage = hasTarget && minutes !== null ? Math.round((minutes / target) * 100) : null;
  const progress = percentage === null ? null : Math.max(0, Math.min(100, percentage));
  const targetLabel = hasTarget
    ? t('workspace.focusTarget', {
        target: minutesLabel(target, t('units.hour'), t('units.minute')),
      })
    : t('workspace.focusTargetUnavailable');

  return (
    <Box
      component="section"
      aria-labelledby="calendar-workspace-focus-title"
      data-testid="calendar-workspace-focus"
      sx={(theme) => ({
        m: 2,
        p: 1.5,
        borderRadius: CALENDAR_HOME_ROW_RADIUS,
        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.045),
        '@media (forced-colors: active)': { bgcolor: 'Canvas', border: '1px solid CanvasText' },
      })}
    >
      <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
        <Box sx={{ minWidth: 0, flex: '1 1 120px' }}>
          <Typography
            id="calendar-workspace-focus-title"
            component="h3"
            variant="caption"
            color="text.secondary"
            fontWeight="fontWeightBold"
          >
            {t('workspace.focusTitle')}
          </Typography>
          <Typography
            component="p"
            variant="h3"
            sx={{
              mt: 0.5,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {minutes === null ? '—' : minutesLabel(minutes, t('units.hour'), t('units.minute'))}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {targetLabel}
          </Typography>
        </Box>
        {progress !== null ? (
          <Box
            role="meter"
            aria-label={`${t('workspace.focusTitle')} · ${targetLabel}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-valuetext={t('workspace.focusProgress', { value: percentage })}
            data-testid="calendar-workspace-focus-meter"
            sx={{
              position: 'relative',
              width: 64,
              height: 64,
              flex: '0 0 64px',
              color: 'primary.main',
              '@media (forced-colors: active)': { color: 'Highlight' },
            }}
          >
            <Box
              component="svg"
              viewBox="0 0 64 64"
              aria-hidden="true"
              sx={{ width: 1, height: 1, display: 'block' }}
            >
              <Box
                component="circle"
                cx="32"
                cy="32"
                r="27"
                fill="none"
                strokeWidth="5"
                sx={(theme) => ({
                  stroke: theme.palette.divider,
                  '@media (forced-colors: active)': { stroke: 'CanvasText' },
                })}
              />
              <circle
                cx="32"
                cy="32"
                r="27"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                pathLength="100"
                strokeDasharray={`${progress} 100`}
                transform="rotate(-90 32 32)"
              />
            </Box>
            <Typography
              aria-hidden="true"
              variant="caption"
              fontWeight="fontWeightBold"
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                fontVariantNumeric: 'tabular-nums',
                '@media (forced-colors: active)': { color: 'CanvasText' },
              }}
            >
              {percentage}%
            </Typography>
          </Box>
        ) : null}
      </Stack>
      <Stack spacing={0.5} sx={{ mt: 1.25 }}>
        <ActionButton
          component={Link}
          to={calendarInternalPath('/calendar/focus', new URLSearchParams(currentSearch))}
          intent="quiet"
          size="small"
          sx={{ minHeight: 44, whiteSpace: 'normal', justifyContent: 'flex-start' }}
        >
          {t('workspace.openFocusPlan')}
        </ActionButton>
        {canCreate && onCreateFocus ? (
          <ActionButton
            intent="secondary"
            size="small"
            onClick={onCreateFocus}
            sx={{ minHeight: 44, whiteSpace: 'normal' }}
          >
            {t('actions.addFocus')}
          </ActionButton>
        ) : null}
      </Stack>
    </Box>
  );
}

function attentionPath(item: CalendarAttentionItem, currentSearch: string) {
  const target = new URL(item.actionPath, 'https://calendar.internal');
  if (item.eventId) target.searchParams.set('event', item.eventId);
  return calendarInternalPath(
    `${target.pathname}${target.search}${target.hash}`,
    new URLSearchParams(currentSearch)
  );
}

function CalendarAttentionList({
  items,
  currentSearch,
}: {
  items: readonly CalendarAttentionItem[];
  currentSearch: string;
}) {
  const { t } = useTranslation('calendar');
  return (
    <Box component="section" aria-labelledby="calendar-workspace-attention-title">
      <Box sx={{ px: 2, py: 1.5 }}>
        <SectionHeader
          id="calendar-workspace-attention-title"
          headingComponent="h3"
          icon={ListChecks}
          title={t('workspace.attentionTitle')}
          meta={items.length}
        />
      </Box>
      {items.length ? (
        <Stack component="ul" spacing={1} sx={{ px: 2, pb: 0, pt: 0, m: 0, listStyle: 'none' }}>
          {items.slice(0, 3).map((item) => (
            <Box component="li" key={item.key}>
              <Box
                component={Link}
                to={attentionPath(item, currentSearch)}
                aria-label={t('workspace.attentionItemLabel', {
                  severity: t(`workspace.severity.${item.severity}`),
                  title: item.title,
                  description: item.description,
                })}
                data-calendar-attention-severity={item.severity}
                sx={(theme) => ({
                  minHeight: 64,
                  px: 1.25,
                  py: 1.25,
                  display: 'grid',
                  gridTemplateColumns: '16px minmax(0, 1fr) auto',
                  gap: 1,
                  alignItems: 'start',
                  color: 'text.primary',
                  textDecoration: 'none',
                  border: 1,
                  borderRadius: CALENDAR_HOME_ROW_RADIUS,
                  borderColor: alpha(
                    theme.palette[
                      item.severity === 'HIGH'
                        ? 'error'
                        : item.severity === 'MEDIUM'
                          ? 'warning'
                          : 'info'
                    ].main,
                    0.4
                  ),
                  bgcolor: alpha(
                    theme.palette[
                      item.severity === 'HIGH'
                        ? 'error'
                        : item.severity === 'MEDIUM'
                          ? 'warning'
                          : 'info'
                    ].main,
                    theme.palette.mode === 'dark' ? 0.12 : 0.05
                  ),
                  transition: theme.transitions.create('background-color'),
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: -2,
                  },
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  '@media (forced-colors: active)': {
                    borderColor: 'CanvasText',
                    bgcolor: 'Canvas',
                    '&:focus-visible': { outlineColor: 'Highlight' },
                  },
                })}
              >
                <Box
                  aria-hidden="true"
                  sx={{
                    mt: 0.25,
                    color:
                      item.severity === 'HIGH'
                        ? 'error.main'
                        : item.severity === 'MEDIUM'
                          ? 'warning.main'
                          : 'primary.main',
                    '@media (forced-colors: active)': { color: 'CanvasText' },
                  }}
                >
                  <AlertTriangle size={16} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    fontWeight="fontWeightBold"
                    color={
                      item.severity === 'HIGH'
                        ? 'error.main'
                        : item.severity === 'MEDIUM'
                          ? 'warning.main'
                          : 'primary.main'
                    }
                    sx={{ display: 'block', mb: 0.2 }}
                  >
                    {t(`workspace.severity.${item.severity}`)}
                  </Typography>
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {item.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      mt: 0.3,
                      display: 'block',
                    }}
                  >
                    {item.description}
                  </Typography>
                </Box>
                <ChevronRight size={15} aria-hidden="true" />
              </Box>
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
          {t('home.noAttention')}
        </Typography>
      )}
    </Box>
  );
}

function CalendarRoomAvailability({ count, roomsPath }: { count: number; roomsPath: string }) {
  const { t } = useTranslation('calendar');
  if (count <= 0) return null;
  return (
    <Box component="section" aria-labelledby="calendar-workspace-rooms-title" sx={{ p: 2 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
        <DoorOpen size={16} aria-hidden="true" />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            id="calendar-workspace-rooms-title"
            variant="caption"
            color="text.secondary"
            fontWeight="fontWeightBold"
          >
            {t('home.metrics.rooms')}
          </Typography>
          <Typography variant="h6" sx={{ mt: 0.35 }}>
            {count}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('home.metrics.roomsHint')}
          </Typography>
        </Box>
      </Stack>
      <ActionButton
        component={Link}
        to={roomsPath}
        intent="quiet"
        size="small"
        sx={{ mt: 1, ml: 2.75 }}
      >
        {t('workspace.openRooms')}
      </ActionButton>
    </Box>
  );
}

export function CalendarWorkspaceRail({
  data,
  state,
  isFetching,
  language,
  currentSearch,
  roomsPath,
  onRetry,
  onClose,
  canCreate = false,
  onCreateFocus,
  onOpenCommands,
}: {
  data: CalendarHome | undefined;
  state: CalendarReadSourceState;
  isFetching: boolean;
  language: string;
  currentSearch: string;
  roomsPath?: string | null;
  onRetry: () => void;
  onClose?: () => void;
  canCreate?: boolean;
  onCreateFocus?: () => void;
  onOpenCommands?: () => void;
}) {
  const { t } = useTranslation('calendar');
  const unavailable = state === 'DENIED' || state === 'UNAVAILABLE';
  const visibleData = unavailable || state === 'LOADING' ? undefined : data;

  return (
    <Stack
      data-testid="calendar-workspace-rail"
      data-calendar-rail-state={state}
      sx={{
        width: 1,
        minWidth: 0,
        minHeight: 0,
        height: onClose ? 1 : 'auto',
        maxHeight: onClose ? 1 : 'inherit',
        overflow: 'hidden',
        bgcolor: 'transparent',
        overflowWrap: 'anywhere',
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={1}
        sx={{ px: onClose ? 2 : 0, pb: 1.5, pt: onClose ? 2 : 0, flexShrink: 0 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="primary.main">
            {t('workspace.railEyebrow')}
          </Typography>
          <SectionHeader icon={ListChecks} title={t('workspace.railTitle')} />
          {visibleData ? (
            <Typography variant="caption" color="text.secondary">
              {t('workspace.summaryContext', {
                date: calendarDate(visibleData.date, language),
                timeZone: visibleData.timeZone,
              })}
            </Typography>
          ) : null}
        </Box>
        {onClose && (
          <ActionIconButton size="small" label={t('workspace.closeRail')} onClick={onClose}>
            <X size={17} aria-hidden="true" />
          </ActionIconButton>
        )}
      </Stack>
      {state === 'STALE' && (
        <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, pb: 1.5 }}>
          <LiveStatus
            state="stale"
            label={t('workspace.railTitle')}
            detail={t('readState.stale')}
          />
          <ActionButton intent="quiet" size="small" onClick={onRetry} sx={{ ml: 'auto' }}>
            {t('actions.retry')}
          </ActionButton>
        </Stack>
      )}
      {isFetching && <Box aria-hidden="true" sx={{ height: 2, bgcolor: 'primary.main' }} />}
      {state === 'LOADING' ? (
        <Box sx={{ p: 2 }}>
          <LoadingState
            label={t('schedule.loading')}
            variant="skeleton"
            embedded
            skeletonHeights={[94, 150, 190]}
            skeletonGap={1.5}
          />
        </Box>
      ) : !visibleData ? (
        <Stack alignItems="center" textAlign="center" spacing={1.25} sx={{ px: 2.5, py: 5 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 42,
              height: 42,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              bgcolor: 'action.hover',
            }}
          >
            <Focus size={19} />
          </Box>
          <Typography variant="subtitle2">{t('workspace.summaryUnavailable')}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t(state === 'DENIED' ? 'readState.denied' : 'home.loadError')}
          </Typography>
          <ActionButton intent="secondary" size="small" onClick={onRetry}>
            {t('actions.retry')}
          </ActionButton>
        </Stack>
      ) : (
        <Box
          sx={{
            minHeight: 0,
            flex: 1,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            scrollbarGutter: onClose ? 'stable' : 'auto',
            scrollPaddingBlockEnd: onClose ? 0 : 2.5,
            pb: onClose ? 'max(16px, env(safe-area-inset-bottom))' : 2.5,
            px: onClose ? 2 : 0,
          }}
        >
          <Box data-testid="calendar-workspace-insights" sx={calendarHomeSurface}>
            <CalendarAttentionList items={visibleData.attention} currentSearch={currentSearch} />
            <CalendarFocusMeter
              data={visibleData}
              currentSearch={currentSearch}
              canCreate={state === 'READY' && canCreate}
              onCreateFocus={onCreateFocus}
            />
            {roomsPath && visibleData.metrics.availableRoomCount > 0 ? (
              <>
                <Divider />
                <CalendarRoomAvailability
                  count={visibleData.metrics.availableRoomCount}
                  roomsPath={roomsPath}
                />
              </>
            ) : null}
          </Box>
          <Box sx={{ mt: 2 }}>
            <CalendarHomeTeamPanel
              state={state}
              timeZone={visibleData.timeZone}
              language={language}
              currentSearch={currentSearch}
            />
          </Box>
          {state === 'READY' ? (
            <Box sx={{ mt: 2 }}>
              <CalendarHomeShortcuts
                currentSearch={currentSearch}
                onOpenCommands={onOpenCommands}
              />
            </Box>
          ) : null}
          <Typography
            component="p"
            variant="caption"
            color="text.secondary"
            sx={{ px: 2, py: 1.5, textAlign: 'right' }}
          >
            {t('home.updatedAt', { time: calendarTime(visibleData.generatedAt, language) })}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}
