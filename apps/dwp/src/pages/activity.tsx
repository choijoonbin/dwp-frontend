import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  Bot,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  ShieldX,
  UserRound,
  Wrench,
} from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  EmptyState,
  FilterBar,
  FormField,
  LiveStatus,
  LocalErrorState,
  LoadingState,
  mergeFilterSearchParams,
  OperationalKpiStrip,
  PageCanvas,
  ResourcePageHeader,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ButtonBase from '@mui/material/ButtonBase';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import useMediaQuery from '@mui/material/useMediaQuery';

import { SectionHeading } from '../components/workspace-ui';
import { GovernedSavedViewControl } from '../components/governed-saved-view-control';
import { useActivityData } from '../features/activity/use-activity-data';
import { ActivityEventDetail } from '../components/activity/activity-event-detail';
import {
  ACTIVITY_ACTORS as ACTOR_FILTERS,
  ACTIVITY_STATES as STATE_FILTERS,
  activityRefreshState,
  activitySavedConfiguration,
  applyActivitySavedConfiguration,
  readActivityFilters,
  validActivityTimeRange,
} from '../features/activity/activity-model';
import type { ActorFilter, StateFilter } from '../features/activity/activity-model';
import type { Theme } from '@mui/material/styles';

import type {
  WorkspaceActivityActor as ActivityActor,
  WorkspaceActivityEvent,
  WorkspaceActivityState as ActivityState,
} from '@dwp-frontend/shared-utils';

type ActivityRow = WorkspaceActivityEvent & { time: string };

const stateColor: Record<ActivityState, 'info' | 'warning' | 'success' | 'error'> = {
  running: 'info',
  'needs-input': 'warning',
  completed: 'success',
  'policy-blocked': 'error',
  failed: 'error',
  cancelled: 'warning',
  unknown: 'warning',
};

function ActorIcon({ actor }: { actor: ActivityActor }) {
  if (actor === 'agent') return <Bot size={18} strokeWidth={1.8} />;
  if (actor === 'person') return <UserRound size={18} strokeWidth={1.8} />;
  return <Wrench size={18} strokeWidth={1.8} />;
}

function StateIcon({ state }: { state: ActivityState }) {
  if (state === 'running') return <CircleDashed size={17} strokeWidth={1.8} />;
  if (state === 'needs-input') return <CircleAlert size={17} strokeWidth={1.8} />;
  if (state === 'policy-blocked' || state === 'failed')
    return <ShieldX size={17} strokeWidth={1.8} />;
  if (state === 'cancelled' || state === 'unknown')
    return <CircleAlert size={17} strokeWidth={1.8} />;
  return <CheckCircle2 size={17} strokeWidth={1.8} />;
}

export default function ActivityPage() {
  const { t } = useTranslation('work');
  const [searchParams, setSearchParams] = useSearchParams();
  const desktopDetail = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));
  const compactMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const filters = readActivityFilters(searchParams);
  const actorFilter = filters.actor ?? 'all';
  const stateFilter = filters.state ?? 'all';
  const query = filters.query ?? '';
  const selectedId = searchParams.get('event') ?? '';
  const {
    feed: activityQuery,
    summary,
    detail,
    now,
    refresh,
  } = useActivityData(filters, selectedId);
  const events = useMemo<ActivityRow[]>(
    () =>
      (activityQuery.data?.events ?? []).map((event) => ({
        ...event,
        time: formatDate(new Date(event.occurredAt), { hour: '2-digit', minute: '2-digit' }),
      })),
    [activityQuery.data?.events]
  );
  const visibleEvents = events;
  const refreshState = activityRefreshState(activityQuery, now);
  const changeFilter = (key: string, value: string | null) =>
    setSearchParams(
      mergeFilterSearchParams(searchParams, { [key]: value, cursor: null, event: null }),
      { replace: true }
    );
  const closeDetail = () =>
    setSearchParams(mergeFilterSearchParams(searchParams, { event: null }), { replace: true });

  const selectActor = (value: ActorFilter) => {
    setSearchParams(
      mergeFilterSearchParams(searchParams, {
        actor: value === 'all' ? null : value,
        event: null,
        cursor: null,
      }),
      { replace: true }
    );
  };
  const changeActor = (_event: React.MouseEvent<HTMLElement>, value: ActorFilter | null) => {
    if (value) selectActor(value);
  };
  const selectState = (value: StateFilter) => {
    setSearchParams(
      mergeFilterSearchParams(searchParams, {
        state: value === 'all' ? null : value,
        event: null,
        cursor: null,
      }),
      { replace: true }
    );
  };
  const header = (
    <Box
      sx={{
        '@media (forced-colors: active)': { '& .MuiTypography-overline': { color: 'CanvasText' } },
      }}
    >
      <ResourcePageHeader
        eyebrow={t('activityPage.header.eyebrow')}
        title={t('activityPage.header.title')}
        description={t('activityPage.header.description')}
        status={
          <LiveStatus
            state={refreshState}
            label={t(`activityFoundation.freshness.${refreshState}`)}
            detail={
              activityQuery.dataUpdatedAt
                ? t('activityFoundation.lastRefresh', {
                    at: formatDate(activityQuery.dataUpdatedAt, {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  })
                : undefined
            }
            refreshLabel={t('activityPage.retry')}
            refreshing={activityQuery.isFetching}
            onRefresh={() => void refresh()}
          />
        }
      />
    </Box>
  );
  const current = summary.isError ? undefined : summary.data;
  const summaryValues = {
    signals: current?.total ?? '—',
    agent: current?.running ?? '—',
    input: current?.needsInput ?? '—',
    blocked: current?.policyBlocked ?? '—',
  };
  const summaryStrip = (
    <>
      <OperationalKpiStrip
        ariaLabel={t('activityPage.summaryLabel')}
        items={[
          {
            key: 'signals',
            value: summaryValues.signals,
            label: t('activityPage.summary.signals.label'),
            detail: t('activityFoundation.summaryScope'),
          },
          {
            key: 'agent',
            value: summaryValues.agent,
            label: t('activityPage.summary.agent.label'),
            detail: t('activityFoundation.summaryScope'),
            tone: 'info' as const,
          },
          {
            key: 'input',
            value: summaryValues.input,
            label: t('activityPage.summary.input.label'),
            detail: t('activityFoundation.summaryScope'),
            tone: 'warning' as const,
          },
          {
            key: 'blocked',
            value: summaryValues.blocked,
            label: t('activityPage.summary.blocked.label'),
            detail: t('activityFoundation.summaryScope'),
            tone: 'critical' as const,
          },
        ]}
      />
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {t('activityFoundation.coverageNotice')}{' '}
        {t(`activityFoundation.freshness.${activityRefreshState(summary, now)}`)}
      </Typography>
    </>
  );

  return (
    <PageCanvas>
      {header}

      <Box sx={{ mt: 3 }}>
        {compactMobile ? (
          <Box
            component="details"
            sx={{
              borderBlock: 1,
              borderColor: 'divider',
              py: 1,
              '&[open] > summary': { mb: 1.5 },
              '& > summary': {
                minHeight: 40,
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                '&:focus-visible': {
                  outline: '3px solid var(--dwp-focus-ring, currentColor)',
                  outlineOffset: 2,
                },
              },
            }}
          >
            <Typography component="summary" variant="subtitle2">
              {t('activityPage.compactSummary', {
                total: summaryValues.signals,
                attention: current ? current.needsInput + current.policyBlocked : '—',
              })}
            </Typography>
            {summaryStrip}
          </Box>
        ) : (
          summaryStrip
        )}
      </Box>

      <Box sx={{ mt: 3 }}>
        <FilterBar
          ariaLabel={t('activityPage.actorFilter')}
          searchLabel={t('activityPage.searchLabel')}
          searchPlaceholder={t('activityPage.searchPlaceholder')}
          searchValue={query}
          onSearchChange={(value) =>
            setSearchParams(
              mergeFilterSearchParams(searchParams, {
                q: value || null,
                event: null,
                cursor: null,
              }),
              { replace: true }
            )
          }
          filters={
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
                minWidth: 0,
              }}
            >
              <ToggleButtonGroup
                exclusive
                size="small"
                value={actorFilter}
                onChange={changeActor}
                aria-label={t('activityPage.actorFilter')}
              >
                {ACTOR_FILTERS.map((value) => (
                  <ToggleButton key={value} value={value}>
                    {t(`activityPage.filters.${value}`)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <SelectField<StateFilter>
                label={t('activityPage.stateFilter')}
                value={stateFilter}
                size="small"
                fullWidth={false}
                sx={{ minWidth: { xs: 160, sm: 180 } }}
                options={STATE_FILTERS.map((value) => ({
                  value,
                  label:
                    value === 'all'
                      ? t('activityPage.allStates')
                      : t(`activityPage.states.${value}`),
                }))}
                onValueChange={(value) => value && selectState(value)}
              />
              <Box
                component="details"
                sx={{
                  minWidth: { xs: 1, md: 180 },
                  flexBasis: { xs: '100%', md: 'auto' },
                  '&[open]': { flexBasis: '100%' },
                  '& > summary': {
                    minHeight: 40,
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 'shape.borderRadius',
                    cursor: 'pointer',
                    listStyle: 'none',
                    color: 'text.primary',
                    '&::-webkit-details-marker': { display: 'none' },
                    '&:focus-visible': {
                      outline: '3px solid var(--dwp-focus-ring, currentColor)',
                      outlineOffset: 2,
                    },
                  },
                }}
              >
                <Typography component="summary" variant="body2" fontWeight="fontWeightMedium">
                  {t('activityFoundation.filters.advanced')}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr)',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(3, minmax(0, 1fr))',
                    },
                    gap: 1.25,
                    mt: 1.25,
                    p: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  {(['source', 'objectType', 'objectId', 'executionId', 'from', 'to'] as const).map(
                    (key) => (
                      <FormField
                        key={key}
                        label={t(`activityFoundation.filters.${key}`)}
                        size="small"
                        value={filters[key] ?? ''}
                        onChange={(event) => changeFilter(key, event.target.value || null)}
                        placeholder={
                          key === 'from' || key === 'to' ? '2026-09-04T00:00:00Z' : undefined
                        }
                        fullWidth
                      />
                    )
                  )}
                  <FormControlLabel
                    label={t('activityFoundation.filters.includeUsage')}
                    control={
                      <Checkbox
                        checked={filters.includeUsage === true}
                        onChange={(_, checked) =>
                          changeFilter('includeUsage', checked ? 'true' : null)
                        }
                      />
                    }
                  />
                </Box>
              </Box>
            </Box>
          }
          savedViews={
            <GovernedSavedViewControl
              surfaceKey="workspace.activity"
              currentConfiguration={activitySavedConfiguration(filters)}
              selectedBuiltInViewId={
                !query &&
                stateFilter === 'all' &&
                !filters.source &&
                !filters.objectType &&
                !filters.objectId &&
                !filters.executionId &&
                !filters.from &&
                !filters.to &&
                !filters.includeUsage
                  ? `builtin-${actorFilter}`
                  : null
              }
              builtInViews={ACTOR_FILTERS.map((value) => ({
                id: `builtin-${value}`,
                name: t(`activityPage.filters.${value}`),
                configuration: { q: '', actor: value, state: 'all' },
                isDefault: value === 'all',
              }))}
              onApply={(configuration) => {
                setSearchParams(applyActivitySavedConfiguration(searchParams, configuration), {
                  replace: true,
                });
              }}
            />
          }
          activeFilters={[
            ...(actorFilter === 'all'
              ? []
              : [
                  {
                    key: 'actor',
                    label: t(`activityPage.filters.${actorFilter}`),
                    onRemove: () => selectActor('all'),
                  },
                ]),
            ...(stateFilter === 'all'
              ? []
              : [
                  {
                    key: 'state',
                    label: t(`activityPage.states.${stateFilter}`),
                    onRemove: () => selectState('all'),
                  },
                ]),
            ...(['source', 'objectType', 'objectId', 'executionId', 'from', 'to'] as const).flatMap(
              (key) =>
                filters[key]
                  ? [
                      {
                        key,
                        label: `${t(`activityFoundation.filters.${key}`)}: ${filters[key]}`,
                        onRemove: () => changeFilter(key, null),
                      },
                    ]
                  : []
            ),
            ...(filters.includeUsage
              ? [
                  {
                    key: 'includeUsage',
                    label: t('activityFoundation.filters.includeUsage'),
                    onRemove: () => changeFilter('includeUsage', null),
                  },
                ]
              : []),
          ]}
          resetLabel={t('activityPage.resetFilters')}
          onReset={() =>
            setSearchParams(applyActivitySavedConfiguration(searchParams, {}), { replace: true })
          }
          resultLabel={t('activityPage.visibleCount', { count: visibleEvents.length })}
        />
      </Box>

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns:
            desktopDetail && selectedId
              ? 'minmax(0, 1.65fr) minmax(360px, 0.9fr)'
              : 'minmax(0, 1fr)',
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box component="section" aria-labelledby="activity-timeline-heading" sx={{ minWidth: 0 }}>
          <Box sx={{ py: 2, pr: { lg: 3 } }}>
            <SectionHeading
              id="activity-timeline-heading"
              icon={Activity}
              title={t('activityPage.timeline')}
            />
          </Box>
          <Divider />
          {!validActivityTimeRange(filters) ? (
            <EmptyState title={t('activityFoundation.invalidTimeRange')} size="compact" />
          ) : activityQuery.isLoading ? (
            <LoadingState label={t('activityPage.loading')} size="compact" />
          ) : activityQuery.isError ? (
            <LocalErrorState
              title={t('activityPage.loadErrorTitle')}
              retryLabel={t('activityPage.retry')}
              onRetry={() => void activityQuery.refetch()}
              size="compact"
            />
          ) : visibleEvents.length > 0 ? (
            <Box
              component="ol"
              aria-label={t('activityPage.timelineLabel')}
              sx={{ p: 0, m: 0, listStyle: 'none' }}
            >
              {visibleEvents.map((event) => {
                const active = event.id === selectedId;
                return (
                  <Box
                    component="li"
                    key={event.id}
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                  >
                    <ButtonBase
                      onClick={() =>
                        setSearchParams(
                          mergeFilterSearchParams(searchParams, { event: event.id }),
                          { replace: false }
                        )
                      }
                      aria-pressed={active}
                      sx={{
                        width: 1,
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '44px minmax(0, 1fr)',
                          sm: '58px 40px minmax(0, 1fr) auto',
                        },
                        gap: { xs: 1, sm: 1.5 },
                        alignItems: 'start',
                        p: 2,
                        pr: { lg: 3 },
                        textAlign: 'left',
                        bgcolor: active ? 'action.selected' : 'transparent',
                        borderLeft: 3,
                        borderLeftColor: active ? 'primary.main' : 'transparent',
                        transition: (theme) =>
                          theme.transitions.create(['background-color', 'border-color']),
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ pt: 0.75 }}>
                        {event.time}
                      </Typography>
                      <Box
                        aria-label={t('activityPage.actorLabel', {
                          actor: t(`labels.actor.${event.actor}`),
                        })}
                        sx={{
                          width: 36,
                          height: 36,
                          display: { xs: 'none', sm: 'grid' },
                          placeItems: 'center',
                          borderRadius: 'shape.borderRadius',
                          color: event.actor === 'agent' ? 'primary.main' : 'text.secondary',
                          bgcolor: event.actor === 'agent' ? 'action.selected' : 'action.hover',
                        }}
                      >
                        <ActorIcon actor={event.actor} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Box
                          sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
                        >
                          <Typography component="h3" variant="subtitle2">
                            {event.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {event.actorName}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                          {event.summary}
                        </Typography>
                        {event.progress != null && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 1.25 }}>
                            <LinearProgress
                              variant="determinate"
                              value={event.progress}
                              aria-label={t('activityPage.progressLabel', { title: event.title })}
                              sx={{
                                width: { xs: 150, sm: 220 },
                                height: 5,
                                borderRadius: 'shape.borderRadius',
                              }}
                            />
                            <Typography variant="caption" fontWeight={700}>
                              {event.progress}%
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      <Chip
                        icon={<StateIcon state={event.state} />}
                        label={t(`activityPage.states.${event.state}`)}
                        color={stateColor[event.state]}
                        size="small"
                        variant="outlined"
                        sx={(theme) => ({
                          gridColumn: { xs: '2', sm: 'auto' },
                          justifySelf: 'start',
                          ...(event.state === 'completed' && {
                            color:
                              theme.palette.mode === 'light'
                                ? theme.palette.success.dark
                                : theme.palette.success.light,
                          }),
                        })}
                      />
                    </ButtonBase>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <EmptyState
              title={t('activityPage.filteredEmptyTitle')}
              description={t('activityPage.filteredEmptyDescription')}
            />
          )}
        </Box>

        <ActivityEventDetail
          eventId={selectedId}
          query={detail}
          variant={desktopDetail ? 'inline' : 'drawer'}
          onClose={closeDetail}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        {filters.cursor && (
          <ActionButton intent="secondary" onClick={() => changeFilter('cursor', null)}>
            {t('activityFoundation.firstPage')}
          </ActionButton>
        )}
        <ActionButton
          intent="secondary"
          disabled={
            !activityQuery.data?.hasMore ||
            !activityQuery.data.nextCursor ||
            activityQuery.isFetching ||
            activityQuery.isError
          }
          onClick={() =>
            setSearchParams(
              mergeFilterSearchParams(searchParams, {
                cursor: activityQuery.data?.nextCursor ?? null,
              })
            )
          }
        >
          {t('activityFoundation.nextPage')}
        </ActionButton>
      </Box>
    </PageCanvas>
  );
}
