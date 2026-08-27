import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock3,
  TriangleAlert,
} from 'lucide-react';
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
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { HomeOverview, HomeWidgetHeight } from '@dwp-frontend/shared-utils';
import type { FlowlineDateState, FlowlineItem } from './flow-home-model';

type TodayFlowlineProps = {
  overview?: HomeOverview;
  items: readonly FlowlineItem[];
  overflow: number;
  overflowKinds: readonly FlowlineItem['kind'][];
  dateState: FlowlineDateState;
  height: HomeWidgetHeight;
  loading: boolean;
  fetching: boolean;
  requestFailed: boolean;
  compact?: boolean;
  sidecar?: boolean;
  fillStage?: boolean;
  itemLimit?: number;
  onRetry: () => void;
};

type FlowlineSectionStatus = HomeOverview['calendar']['status'];

export type TodayFlowlineSourceState = Readonly<{
  unavailable: boolean;
  hasAvailableSource: boolean;
  hasForbiddenSource: boolean;
  availabilityPartial: boolean;
  permissionPartial: boolean;
}>;

export function resolveTodayFlowlineSourceState(
  calendarStatus: FlowlineSectionStatus | undefined,
  workStatus: FlowlineSectionStatus | undefined,
  requestFailed: boolean
): TodayFlowlineSourceState {
  const statuses: readonly (FlowlineSectionStatus | undefined)[] = requestFailed
    ? ['UNAVAILABLE', 'UNAVAILABLE']
    : [calendarStatus, workStatus];
  const availableCount = statuses.filter((status) => status === 'AVAILABLE').length;
  const unavailableCount = statuses.filter((status) => status === 'UNAVAILABLE').length;
  const forbiddenCount = statuses.filter((status) => status === 'FORBIDDEN').length;
  return {
    unavailable: availableCount === 0 && unavailableCount > 0,
    hasAvailableSource: availableCount > 0,
    hasForbiddenSource: forbiddenCount > 0,
    availabilityPartial: availableCount > 0 && unavailableCount > 0,
    permissionPartial: availableCount > 0 && forbiddenCount > 0,
  };
}

export function resolveFlowlineOverflowDetailRoute(
  hiddenKinds: ReadonlySet<FlowlineItem['kind']>,
  fallbackRoute: string
): string {
  if (hiddenKinds.size !== 1) return fallbackRoute;
  return hiddenKinds.has('work') ? '/work' : '/calendar/schedule';
}

const budgetByHeight: Record<HomeWidgetHeight, number> = {
  // The short footprint must leave room for the header and the explicit
  // overflow action. Rendering two 84px rows makes the content intrinsically
  // taller than the 288px token and prevents the picker from shrinking it.
  short: 1,
  standard: 3,
  tall: 4,
  expanded: 5,
};

const stateIcon = {
  completed: CheckCircle2,
  current: CircleDot,
  upcoming: Clock3,
  attention: TriangleAlert,
  risk: TriangleAlert,
};

const stateColor = {
  completed: 'success.main',
  current: 'primary.main',
  upcoming: 'info.main',
  attention: 'warning.main',
  risk: 'error.main',
} as const;

export function TodayFlowline({
  overview,
  items,
  overflow,
  overflowKinds,
  dateState,
  height,
  loading,
  fetching,
  requestFailed,
  compact = false,
  sidecar = false,
  fillStage = false,
  itemLimit,
  onRetry,
}: TodayFlowlineProps) {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const rowBudget = Math.min(
    fillStage ? 4 : budgetByHeight[height],
    itemLimit ?? Number.MAX_SAFE_INTEGER
  );
  const needsOverflowAction = overflow > 0 || items.length > rowBudget;
  // The wide decision stage has its own room for the overflow action. In the
  // regular widget footprint it still consumes one semantic row.
  const visibleBudget = fillStage
    ? rowBudget
    : Math.max(1, rowBudget - (needsOverflowAction ? 1 : 0));
  const visible = items.slice(0, visibleBudget);
  const hiddenCount = overflow + Math.max(0, items.length - visible.length);
  const fillAvailableHeight =
    !compact && (fillStage || !sidecar) && height !== 'short' && visible.length > 0;
  const hiddenKinds = new Set([
    ...overflowKinds,
    ...items.slice(visible.length).map((item) => item.kind),
  ]);
  const sourceState = resolveTodayFlowlineSourceState(
    overview?.calendar.status,
    overview?.work.status,
    requestFailed
  );
  const restrictedWithoutItems =
    sourceState.hasForbiddenSource && !sourceState.hasAvailableSource && visible.length === 0;
  const flowlineDetailRoute = visible.some((item) => item.kind === 'calendar')
    ? '/calendar/schedule'
    : visible.some((item) => item.kind === 'work') || overview?.calendar.status !== 'AVAILABLE'
      ? '/work'
      : '/calendar/schedule';
  const overflowDetailRoute = resolveFlowlineOverflowDetailRoute(hiddenKinds, flowlineDetailRoute);
  const staleCalendarTime = overview?.calendar.generatedAt
    ? formatDate(overview.calendar.generatedAt, { dateStyle: 'medium', timeStyle: 'short' })
    : (dateState.payloadDate ?? dateState.expectedDate);
  const sourceLabel = (item: FlowlineItem) => {
    if (!/^DWP(?:_|-)/iu.test(item.source)) return item.source;
    return item.kind === 'calendar'
      ? t('apps.items.dwp-calendar.shortName')
      : t('apps.items.dwp-work.shortName');
  };

  return (
    <Box
      component="section"
      aria-labelledby="flowline-heading"
      data-flow-section="today-flowline"
      data-flowline-layout={fillAvailableHeight ? 'fill' : 'list'}
      data-flow-stage-fill={fillStage && fillAvailableHeight ? 'content' : 'natural'}
      sx={{
        minWidth: 0,
        minHeight: 0,
        height: fillStage && !fillAvailableHeight ? 'auto' : 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={2}
        flexWrap={sidecar ? 'nowrap' : 'wrap'}
      >
        <Box sx={{ minWidth: 0, flex: sidecar ? '1 1 140px' : '1 1 220px' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <CalendarClock size={20} aria-hidden="true" />
            <Typography id="flowline-heading" component="h2" variant="h5" fontWeight={760}>
              {t('flow.flowline.title')}
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.35, wordBreak: 'keep-all', overflowWrap: 'break-word' }}
          >
            {t('flow.flowline.description')}
          </Typography>
        </Box>
        <ActionButton
          intent="quiet"
          size="small"
          endIcon={<ArrowRight size={15} aria-hidden="true" />}
          onClick={() => navigate(flowlineDetailRoute)}
          sx={{ minHeight: 44, flex: '0 0 auto' }}
        >
          {t('flow.viewAll')}
        </ActionButton>
      </Stack>

      {loading && <LoadingState label={t('widgets.schedule.loading')} variant="skeleton" />}
      {!loading && sourceState.unavailable && (
        <ErrorState
          title={t('widgets.schedule.loadError')}
          retryLabel={requestFailed ? undefined : t('page.retry')}
          onRetry={requestFailed ? undefined : onRetry}
          retrying={fetching}
          size="compact"
        />
      )}
      {!loading && sourceState.availabilityPartial && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {t('flow.flowline.partial')}
        </Alert>
      )}
      {!loading && sourceState.unavailable && sourceState.hasForbiddenSource && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {t('widgets.common.restrictedDescription')}
        </Alert>
      )}
      {!loading && sourceState.permissionPartial && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {t('widgets.common.restrictedDescription')}
        </Alert>
      )}
      {!loading && dateState.mismatch && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {t('flow.flowline.dateMismatch', { time: staleCalendarTime })}
        </Alert>
      )}
      {!loading && !sourceState.unavailable && restrictedWithoutItems && (
        <GuidedEmptyState
          kind="permission"
          title={t('widgets.common.restrictedTitle')}
          description={t('widgets.common.restrictedDescription')}
          size="compact"
        />
      )}
      {!loading &&
        !sourceState.unavailable &&
        !restrictedWithoutItems &&
        !dateState.mismatch &&
        sourceState.hasAvailableSource &&
        visible.length === 0 && (
          <GuidedEmptyState
            kind="empty"
            title={t('flow.flowline.empty')}
            description={t('flow.flowline.emptyDescription')}
            size="compact"
          />
        )}
      {!loading && !sourceState.unavailable && visible.length > 0 && (
        <Box
          component="ol"
          aria-label={t('flow.flowline.listLabel')}
          sx={{
            p: 0,
            mt: 2,
            mb: 0,
            minHeight: 0,
            flex: fillAvailableHeight ? '1 1 auto' : '0 0 auto',
            display: fillAvailableHeight ? 'grid' : 'block',
            gridTemplateRows: fillAvailableHeight
              ? `repeat(${visible.length}, minmax(0, 1fr))`
              : undefined,
            listStyle: 'none',
            borderBlock: '1px solid',
            borderColor: 'divider',
          }}
        >
          {visible.map((item, index) => {
            const Icon = stateIcon[item.state];
            return (
              <Box
                component="li"
                key={item.key}
                data-flowline-state={item.state}
                sx={{
                  position: 'relative',
                  minWidth: 0,
                  borderBlockStart: index ? '1px solid' : 0,
                  borderColor: 'divider',
                }}
              >
                <ButtonBase
                  onClick={() => navigate(item.route)}
                  sx={{
                    width: 1,
                    height: fillAvailableHeight ? 1 : 'auto',
                    minWidth: 0,
                    minHeight: compact || sidecar ? 84 : 92,
                    px: compact || sidecar ? 0 : { xs: 0, sm: 0.75 },
                    py: 'var(--flow-row-space)',
                    display: 'grid',
                    gridTemplateColumns:
                      compact || sidecar
                        ? '44px 24px minmax(0, 1fr)'
                        : { xs: '44px 24px minmax(0, 1fr)', sm: '72px 28px minmax(0, 1fr)' },
                    alignItems: fillAvailableHeight ? 'center' : 'stretch',
                    columnGap: compact ? 0.75 : { xs: 0.75, sm: 1.25 },
                    borderRadius: 1.5,
                    textAlign: 'left',
                    bgcolor: item.state === 'current' ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                    '&:focus-visible': {
                      outline: '3px solid var(--dwp-focus-ring, currentColor)',
                      outlineOffset: -3,
                    },
                  }}
                >
                  <Typography
                    component="span"
                    variant="caption"
                    fontWeight={800}
                    sx={{
                      pt: 0.25,
                      fontVariantNumeric: 'tabular-nums',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {item.allDay
                      ? t('flow.flowline.allDay')
                      : formatDate(item.startsAt, { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}
                  >
                    {index < visible.length - 1 && (
                      <Box
                        component="span"
                        sx={{
                          position: 'absolute',
                          top: 25,
                          bottom: 'var(--flow-line-overhang)',
                          width: 2,
                          bgcolor: 'divider',
                        }}
                      />
                    )}
                    <Box
                      component="span"
                      sx={{
                        position: 'relative',
                        zIndex: 1,
                        mt: 0.125,
                        width: 24,
                        height: 24,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: '50%',
                        bgcolor: 'background.paper',
                        color: stateColor[item.state],
                        border: 2,
                        borderColor: 'currentColor',
                      }}
                    >
                      <Icon size={13} strokeWidth={2.4} />
                    </Box>
                  </Box>
                  <Box component="span" data-flowline-item-copy sx={{ minWidth: 0, pb: 0.25 }}>
                    <Stack
                      component="span"
                      direction="row"
                      alignItems="center"
                      gap={0.75}
                      flexWrap="wrap"
                    >
                      <Chip
                        component="span"
                        size="small"
                        variant="outlined"
                        label={t(`flow.flowline.state.${item.state}`)}
                      />
                    </Stack>
                    <Typography
                      component="span"
                      variant="subtitle2"
                      sx={{ mt: 0.5, display: 'block', overflowWrap: 'anywhere' }}
                    >
                      {item.title}
                    </Typography>
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.2, display: 'block', overflowWrap: 'anywhere' }}
                    >
                      {item.detail || sourceLabel(item)}
                    </Typography>
                  </Box>
                </ButtonBase>
              </Box>
            );
          })}
        </Box>
      )}
      {!loading && !sourceState.unavailable && hiddenCount > 0 && (
        <ActionButton
          data-flowline-overflow-action
          intent="quiet"
          size="small"
          onClick={() => navigate(overflowDetailRoute)}
          sx={{ mt: 1, minHeight: 44 }}
        >
          {t('flow.flowline.more', { count: hiddenCount })}
        </ActionButton>
      )}
    </Box>
  );
}
