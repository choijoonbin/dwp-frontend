import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  FileClock,
  ShieldX,
  UserRound,
  Wrench,
} from 'lucide-react';
import { getWorkspaceActivity } from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  EmptyState,
  FilterBar,
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

import { LiveSignal, SectionHeading } from '../components/workspace-ui';
import { GovernedSavedViewControl } from '../components/governed-saved-view-control';

import type {
  WorkspaceActivityActor as ActivityActor,
  WorkspaceActivityEvent,
  WorkspaceActivityState as ActivityState,
} from '@dwp-frontend/shared-utils';

type ActorFilter = 'all' | ActivityActor;
type StateFilter = 'all' | ActivityState;
type ActivityRow = WorkspaceActivityEvent & { time: string };

const ACTOR_FILTERS: ActorFilter[] = ['all', 'agent', 'person', 'system'];
const STATE_FILTERS: StateFilter[] = [
  'all',
  'running',
  'needs-input',
  'completed',
  'policy-blocked',
];

function isActorFilter(value: string | null): value is ActorFilter {
  return Boolean(value && ACTOR_FILTERS.includes(value as ActorFilter));
}

function isStateFilter(value: string | null): value is StateFilter {
  return Boolean(value && STATE_FILTERS.includes(value as StateFilter));
}

const stateColor: Record<ActivityState, 'info' | 'warning' | 'success' | 'error'> = {
  running: 'info',
  'needs-input': 'warning',
  completed: 'success',
  'policy-blocked': 'error',
};

function ActorIcon({ actor }: { actor: ActivityActor }) {
  if (actor === 'agent') return <Bot size={18} strokeWidth={1.8} />;
  if (actor === 'person') return <UserRound size={18} strokeWidth={1.8} />;
  return <Wrench size={18} strokeWidth={1.8} />;
}

function StateIcon({ state }: { state: ActivityState }) {
  if (state === 'running') return <CircleDashed size={17} strokeWidth={1.8} />;
  if (state === 'needs-input') return <CircleAlert size={17} strokeWidth={1.8} />;
  if (state === 'policy-blocked') return <ShieldX size={17} strokeWidth={1.8} />;
  return <CheckCircle2 size={17} strokeWidth={1.8} />;
}

export default function ActivityPage() {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actorParam = searchParams.get('actor');
  const actorFilter: ActorFilter = isActorFilter(actorParam) ? actorParam : 'all';
  const stateParam = searchParams.get('state');
  const stateFilter: StateFilter = isStateFilter(stateParam) ? stateParam : 'all';
  const query = searchParams.get('q') ?? '';
  const activityQuery = useQuery({
    queryKey: ['workspace', 'activity'],
    queryFn: getWorkspaceActivity,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const events = useMemo<ActivityRow[]>(
    () =>
      (activityQuery.data?.events ?? []).map((event) => ({
        ...event,
        time: formatDate(new Date(event.occurredAt), { hour: '2-digit', minute: '2-digit' }),
      })),
    [activityQuery.data?.events]
  );
  const selectedId = searchParams.get('event') ?? '';
  const visibleEvents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return events.filter((event) => {
      const actorMatches = actorFilter === 'all' || event.actor === actorFilter;
      const stateMatches = stateFilter === 'all' || event.state === stateFilter;
      const queryMatches =
        !normalized ||
        [event.title, event.summary, event.actorName, event.objectLabel, event.source].some(
          (value) =>
            String(value ?? '')
              .toLocaleLowerCase()
              .includes(normalized)
        );
      return actorMatches && stateMatches && queryMatches;
    });
  }, [actorFilter, events, query, stateFilter]);
  const selected = visibleEvents.find((event) => event.id === selectedId) || visibleEvents[0];

  const selectActor = (value: ActorFilter) => {
    setSearchParams(
      mergeFilterSearchParams(searchParams, {
        actor: value === 'all' ? null : value,
        event: null,
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
      }),
      { replace: true }
    );
  };
  const selectScope = (actor: ActorFilter, state: StateFilter) => {
    setSearchParams(
      mergeFilterSearchParams(searchParams, {
        actor: actor === 'all' ? null : actor,
        state: state === 'all' ? null : state,
        event: null,
      }),
      { replace: true }
    );
  };
  const header = (
    <ResourcePageHeader
      eyebrow={t('activityPage.header.eyebrow')}
      title={t('activityPage.header.title')}
      description={t('activityPage.header.description')}
      status={
        <LiveStatus
          state={activityQuery.isFetching ? 'syncing' : 'live'}
          label={t('activityPage.header.live')}
          refreshLabel={t('activityPage.retry')}
          refreshing={activityQuery.isFetching}
          onRefresh={() => void activityQuery.refetch()}
        />
      }
    />
  );
  if (activityQuery.isLoading) {
    return (
      <PageCanvas>
        {header}
        <LoadingState label={t('activityPage.loading')} variant="skeleton" size="page" />
      </PageCanvas>
    );
  }
  if (activityQuery.isError) {
    return (
      <PageCanvas>
        {header}
        <LocalErrorState
          title={t('activityPage.loadErrorTitle')}
          description={t('activityPage.loadErrorDescription')}
          retryLabel={t('activityPage.retry')}
          onRetry={() => void activityQuery.refetch()}
          retrying={activityQuery.isFetching}
          size="page"
        />
      </PageCanvas>
    );
  }
  if (events.length === 0) {
    return (
      <PageCanvas>
        {header}
        <EmptyState
          title={t('activityPage.emptyTitle')}
          description={t('activityPage.emptyDescription')}
          size="page"
        />
      </PageCanvas>
    );
  }

  const sourceCount = new Set(events.map((event) => event.source)).size;
  const summaryValues = {
    signals: events.length,
    agent: events.filter((event) => event.actor === 'agent' && event.state === 'running').length,
    input: events.filter((event) => event.state === 'needs-input').length,
    blocked: events.filter((event) => event.state === 'policy-blocked').length,
  };

  return (
    <PageCanvas>
      {header}

      <Box sx={{ mt: 3 }}>
        <OperationalKpiStrip
          ariaLabel={t('activityPage.summaryLabel')}
          items={[
            {
              key: 'signals',
              value: String(summaryValues.signals).padStart(2, '0'),
              label: t('activityPage.summary.signals.label'),
              detail: t('activityPage.summary.signals.detail', { count: sourceCount }),
              onSelect: () => selectScope('all', 'all'),
            },
            {
              key: 'agent',
              value: String(summaryValues.agent).padStart(2, '0'),
              label: t('activityPage.summary.agent.label'),
              detail: t('activityPage.summary.agent.detail', { count: summaryValues.agent }),
              tone: 'info' as const,
              onSelect: () => selectScope('agent', 'running'),
            },
            {
              key: 'input',
              value: String(summaryValues.input).padStart(2, '0'),
              label: t('activityPage.summary.input.label'),
              detail: t('activityPage.summary.input.detail', { count: summaryValues.input }),
              tone: 'warning' as const,
              onSelect: () => selectScope('all', 'needs-input'),
            },
            {
              key: 'blocked',
              value: String(summaryValues.blocked).padStart(2, '0'),
              label: t('activityPage.summary.blocked.label'),
              detail: t('activityPage.summary.blocked.detail', { count: summaryValues.blocked }),
              tone: 'critical' as const,
              onSelect: () => selectScope('all', 'policy-blocked'),
            },
          ]}
        />
      </Box>

      <Box sx={{ mt: 3 }}>
        <FilterBar
          ariaLabel={t('activityPage.actorFilter')}
          searchLabel={t('activityPage.searchLabel')}
          searchPlaceholder={t('activityPage.searchPlaceholder')}
          searchValue={query}
          onSearchChange={(value) =>
            setSearchParams(
              mergeFilterSearchParams(searchParams, { q: value || null, event: null }),
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
            </Box>
          }
          savedViews={
            <GovernedSavedViewControl
              surfaceKey="workspace.activity"
              currentConfiguration={{ q: query, actor: actorFilter, state: stateFilter }}
              selectedBuiltInViewId={
                !query && stateFilter === 'all' ? `builtin-${actorFilter}` : null
              }
              builtInViews={ACTOR_FILTERS.map((value) => ({
                id: `builtin-${value}`,
                name: t(`activityPage.filters.${value}`),
                configuration: { q: '', actor: value, state: 'all' },
                isDefault: value === 'all',
              }))}
              onApply={(configuration) => {
                const nextActor =
                  typeof configuration.actor === 'string' && isActorFilter(configuration.actor)
                    ? configuration.actor
                    : 'all';
                const nextQuery = typeof configuration.q === 'string' ? configuration.q : '';
                const nextState =
                  typeof configuration.state === 'string' && isStateFilter(configuration.state)
                    ? configuration.state
                    : 'all';
                setSearchParams(
                  mergeFilterSearchParams(searchParams, {
                    q: nextQuery || null,
                    actor: nextActor === 'all' ? null : nextActor,
                    state: nextState === 'all' ? null : nextState,
                    event: null,
                  }),
                  { replace: true }
                );
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
          ]}
          resetLabel={t('activityPage.resetFilters')}
          onReset={() =>
            setSearchParams(
              mergeFilterSearchParams(searchParams, {
                q: null,
                actor: null,
                state: null,
                event: null,
              }),
              { replace: true }
            )
          }
          resultLabel={t('activityPage.visibleCount', { count: visibleEvents.length })}
        />
      </Box>

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.7fr) minmax(320px, 1fr)' },
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
              meta={<LiveSignal />}
            />
          </Box>
          <Divider />
          {visibleEvents.length > 0 ? (
            <Box
              component="ol"
              aria-label={t('activityPage.timelineLabel')}
              sx={{ p: 0, m: 0, listStyle: 'none' }}
            >
              {visibleEvents.map((event) => {
                const active = event.id === selected?.id;
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
                          {
                            replace: true,
                          }
                        )
                      }
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
                          borderRadius: 1,
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
                              sx={{ width: { xs: 150, sm: 220 }, height: 5, borderRadius: 1 }}
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

        {selected && (
          <Box
            component="aside"
            aria-labelledby="activity-detail-heading"
            sx={{
              minWidth: 0,
              p: { xs: 2, md: 3 },
              borderLeft: { xs: 0, lg: 1 },
              borderTop: { xs: 1, lg: 0 },
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Typography id="activity-detail-heading" component="h2" variant="h6">
                {t('activityPage.detailTitle')}
              </Typography>
              <Chip
                label={t(`activityPage.states.${selected.state}`)}
                color={stateColor[selected.state]}
                size="small"
                sx={(theme) =>
                  selected.state === 'completed'
                    ? {
                        color: theme.palette.success.contrastText,
                      }
                    : {}
                }
              />
            </Box>
            <Typography component="p" variant="subtitle1" sx={{ mt: 3 }}>
              {selected.title}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {selected.summary}
            </Typography>

            <Box sx={{ display: 'grid', gap: 2, mt: 3 }}>
              {[
                ['actor', selected.actorName],
                ['object', selected.objectLabel],
                ['source', selected.source],
                ['tool', selected.tool || t('activityPage.noTool')],
                ['auditId', selected.auditId],
              ].map(([key, value]) => (
                <Box key={key}>
                  <Typography variant="caption" color="text.secondary">
                    {t(`activityPage.fields.${key}`)}
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ mt: 0.25, overflowWrap: 'anywhere' }}
                  >
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {selected.state === 'needs-input' && (
                <ActionButton
                  intent="primary"
                  startIcon={<FileClock size={17} aria-hidden="true" />}
                  disabled={!selected.sourceRoute}
                  onClick={() => selected.sourceRoute && navigate(selected.sourceRoute)}
                >
                  {t('activityPage.reviewNow')}
                </ActionButton>
              )}
              <ActionButton
                intent="secondary"
                endIcon={<ArrowUpRight size={16} aria-hidden="true" />}
                disabled={!selected.sourceRoute}
                onClick={() => selected.sourceRoute && navigate(selected.sourceRoute)}
              >
                {t('activityPage.openSource')}
              </ActionButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              {t('activityPage.liveNotice')}
            </Typography>
          </Box>
        )}
      </Box>
    </PageCanvas>
  );
}
