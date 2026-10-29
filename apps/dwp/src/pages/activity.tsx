import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Activity, SlidersHorizontal } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  DateTimePickerField,
  EmptyState,
  FilterBar,
  FormField,
  InlineFeedback,
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
import Divider from '@mui/material/Divider';
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
import { usableActivityQueryData } from '../components/activity/activity-query-contract';
import { ActivitySourceStatus } from '../components/activity/activity-source-status';
import {
  ActivityTimelineRow,
  type ActivityTimelineRowData,
} from '../components/activity/activity-timeline-row';
import {
  ACTIVITY_ACTORS as ACTOR_FILTERS,
  ACTIVITY_OBJECT_TYPES,
  ACTIVITY_SOURCES,
  ACTIVITY_STATES as STATE_FILTERS,
  activityCompositeRefreshState,
  activityEmptyStateKind,
  activityRefreshState,
  activitySavedConfiguration,
  applyActivitySavedConfiguration,
  readActivityFilters,
  validActivityTimeRange,
} from '../features/activity/activity-model';
import { useActivitySearchDraft } from '../features/activity/use-activity-search-draft';
import type { ActorFilter, StateFilter } from '../features/activity/activity-model';
import type { Theme } from '@mui/material/styles';

const EMPTY_SELECT_VALUE = '';

const activitySourceLabelKey = {
  WORKSPACE: 'workspace',
  DWP_WORKSPACE: 'dwpWorkspace',
  PERSONAL_TASK: 'personalTask',
  'DWP Apps': 'apps',
  DWAI_ON: 'dwaion',
} as const;

const activityObjectTypeLabelKey = {
  WORK_ITEM: 'workItem',
  WORKSPACE_APP: 'workspaceApp',
  AGENT_RUN: 'agentRun',
} as const;

export default function ActivityPage() {
  const { t } = useTranslation('work');
  const [searchParams, setSearchParams] = useSearchParams();
  const desktopDetail = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));
  const compactMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const filters = readActivityFilters(searchParams);
  const committedQuery = searchParams.get('q') ?? '';
  const actorFilter = filters.actor ?? 'all';
  const stateFilter = filters.state ?? 'all';
  const [query, setQuery, searchTooShort] = useActivitySearchDraft(committedQuery, (value) =>
    setSearchParams(
      mergeFilterSearchParams(searchParams, {
        q: value || null,
        event: null,
        cursor: null,
      }),
      { replace: true }
    )
  );
  // Only the debounced URL value may change the server query key. The draft remains local so
  // typing another valid character cannot briefly switch the result set to an unfiltered feed.
  const requestFilters = filters;
  const sourceOptions = [
    { value: '', label: t('activityFoundation.filters.allSources') },
    ...ACTIVITY_SOURCES.map((value) => ({
      value,
      label: t(`activityFoundation.filters.sourceOptions.${activitySourceLabelKey[value]}`),
    })),
    ...(filters.source &&
    !ACTIVITY_SOURCES.includes(filters.source as (typeof ACTIVITY_SOURCES)[number])
      ? [
          {
            value: filters.source,
            label: t('activityFoundation.filters.preservedValue', { value: filters.source }),
          },
        ]
      : []),
  ];
  const objectTypeOptions = [
    { value: '', label: t('activityFoundation.filters.allObjectTypes') },
    ...ACTIVITY_OBJECT_TYPES.map((value) => ({
      value,
      label: t(`activityFoundation.filters.objectTypeOptions.${activityObjectTypeLabelKey[value]}`),
    })),
    ...(filters.objectType &&
    !ACTIVITY_OBJECT_TYPES.includes(filters.objectType as (typeof ACTIVITY_OBJECT_TYPES)[number])
      ? [
          {
            value: filters.objectType,
            label: t('activityFoundation.filters.preservedValue', { value: filters.objectType }),
          },
        ]
      : []),
  ];
  const activeFilterCount = [
    filters.actor,
    filters.state,
    query,
    filters.source,
    filters.objectType,
    filters.objectId,
    filters.executionId,
    filters.from,
    filters.to,
    filters.includeUsage,
  ].filter(Boolean).length;
  const emptyStateKind = activityEmptyStateKind(activeFilterCount);
  const selectedId = searchParams.get('event') ?? '';
  const {
    feed: activityQuery,
    summary,
    detail,
    executionRun,
    evidence,
    sources,
    rootDenied,
    now,
    refresh,
  } = useActivityData(requestFilters, selectedId);
  const feedData = rootDenied ? undefined : usableActivityQueryData(activityQuery);
  const summaryData = rootDenied ? undefined : usableActivityQueryData(summary);
  const detailData = rootDenied ? undefined : usableActivityQueryData(detail);
  const executionRunData = rootDenied ? undefined : usableActivityQueryData(executionRun);
  const events = useMemo<ActivityTimelineRowData[]>(
    () =>
      (feedData?.events ?? []).map((event) => ({
        ...event,
        time: formatDate(new Date(event.occurredAt), { hour: '2-digit', minute: '2-digit' }),
        date: formatDate(event.occurredAt, { year: 'numeric', month: 'short', day: 'numeric' }),
      })),
    [feedData?.events]
  );
  const visibleEvents = events;
  const sourceRefreshState = activityRefreshState(
    {
      isFetching: sources.isFetching,
      isError: sources.isError,
      dataUpdatedAt: sources.dataUpdatedAt,
      data: sources.data ? { generatedAt: sources.data.observedAt } : undefined,
    },
    now,
    6 * 60_000
  );
  const refreshState = activityCompositeRefreshState([
    activityRefreshState(activityQuery, now),
    activityRefreshState(summary, now),
    sourceRefreshState,
  ]);
  const lastSuccessfulRefresh = [
    activityQuery.dataUpdatedAt,
    summary.dataUpdatedAt,
    sources.dataUpdatedAt,
  ].filter((value) => value > 0);
  const lastSuccessfulRefreshAt = lastSuccessfulRefresh.length
    ? Math.min(...lastSuccessfulRefresh)
    : 0;
  const changeFilter = (key: string, value: string | null) =>
    setSearchParams(
      mergeFilterSearchParams(searchParams, { [key]: value, cursor: null, event: null }),
      { replace: true }
    );
  const closeDetail = () =>
    setSearchParams(mergeFilterSearchParams(searchParams, { event: null }), { replace: true });
  const resetFilters = () => {
    setQuery('');
    setSearchParams(applyActivitySavedConfiguration(searchParams, {}), { replace: true });
  };

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
        description={t(
          compactMobile ? 'activityPage.mobileDescription' : 'activityPage.header.description'
        )}
        status={
          <LiveStatus
            state={refreshState}
            label={t(`activityFoundation.freshness.${refreshState}`)}
            detail={
              lastSuccessfulRefreshAt
                ? t('activityFoundation.lastRefresh', {
                    at: formatDate(lastSuccessfulRefreshAt, {
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
  const current = summaryData;
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
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        }}
        items={[
          {
            key: 'signals',
            value: summaryValues.signals,
            label: t('activityPage.summary.signals.label'),
            detail: t('activityFoundation.summaryScope'),
            onSelect: () => selectState('all'),
          },
          {
            key: 'agent',
            value: summaryValues.agent,
            label: t('activityPage.summary.agent.label'),
            detail: t('activityFoundation.summaryScope'),
            tone: 'info' as const,
            onSelect: () => selectState('running'),
          },
          {
            key: 'input',
            value: summaryValues.input,
            label: t('activityPage.summary.input.label'),
            detail: t('activityFoundation.summaryScope'),
            tone: 'warning' as const,
            onSelect: () => selectState('needs-input'),
          },
          {
            key: 'blocked',
            value: summaryValues.blocked,
            label: t('activityPage.summary.blocked.label'),
            detail: t('activityFoundation.summaryScope'),
            tone: 'critical' as const,
            onSelect: () => selectState('policy-blocked'),
          },
          {
            key: 'completed',
            value: current?.completed ?? '—',
            label: t('dwaionActivity.metrics.completed'),
            detail: t('activityFoundation.summaryScope'),
            tone: 'success' as const,
            onSelect: () => selectState('completed'),
          },
        ]}
      />
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {t('activityFoundation.coverageNotice')}{' '}
        {t(`activityFoundation.freshness.${activityRefreshState(summary, now)}`)}
      </Typography>
      {summary.isError && current && (
        <InlineFeedback
          severity="warning"
          title={t('activityFoundation.cachedSummary.title')}
          sx={{ mt: 1.5 }}
        >
          {t('activityFoundation.cachedSummary.description')}
          <Box sx={{ mt: 1 }}>
            <ActionButton
              intent="secondary"
              size="small"
              onClick={() => void summary.refetch()}
              disabled={summary.isFetching}
            >
              {t('activityPage.retry')}
            </ActionButton>
          </Box>
        </InlineFeedback>
      )}
      {summary.isError && !current && !rootDenied && (
        <InlineFeedback
          severity="warning"
          title={t('activityFoundation.summaryUnavailable.title')}
          sx={{ mt: 1.5 }}
        >
          {t('activityFoundation.summaryUnavailable.description')}
          <Box sx={{ mt: 1 }}>
            <ActionButton
              intent="secondary"
              size="small"
              onClick={() => void summary.refetch()}
              disabled={summary.isFetching}
            >
              {t('activityPage.retry')}
            </ActionButton>
          </Box>
        </InlineFeedback>
      )}
      <ActivitySourceStatus
        sources={feedData?.sourceStates}
        partial={feedData?.partial}
        onRetry={() => void activityQuery.refetch()}
        retrying={activityQuery.isFetching}
      />
    </>
  );

  return (
    <PageCanvas>
      {header}

      <Box sx={{ mt: { xs: 1.5, sm: 3 } }}>
        {compactMobile ? (
          <Box
            component="details"
            sx={{
              borderBlock: 1,
              borderColor: 'divider',
              py: 1,
              '&[open] > summary': { mb: 1.5 },
              '& > summary': {
                minHeight: 44,
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

      {compactMobile && (
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
          {!filtersExpanded && (
            <FormField
              label={t('activityPage.searchLabel')}
              placeholder={t('activityPage.searchPlaceholder')}
              size="small"
              fullWidth
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              errorMessage={
                searchTooShort ? t('activityFoundation.filters.queryMinimum') : undefined
              }
            />
          )}
          <ActionButton
            intent="secondary"
            size="small"
            startIcon={<SlidersHorizontal size={16} aria-hidden="true" />}
            aria-label={t('activityPage.mobileFilters')}
            aria-expanded={filtersExpanded}
            aria-controls="activity-filter-controls"
            onClick={() => setFiltersExpanded((value) => !value)}
            sx={{ minHeight: 44, flexShrink: 0, ml: 'auto' }}
          >
            {t(filtersExpanded ? 'activityPage.hideFilters' : 'activityPage.showFilters')}
            {activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
          </ActionButton>
        </Box>
      )}
      <Box
        id="activity-filter-controls"
        sx={{ mt: { xs: 1, sm: 3 }, display: compactMobile && !filtersExpanded ? 'none' : 'block' }}
      >
        <FilterBar
          ariaLabel={t('activityPage.actorFilter')}
          searchLabel={t('activityPage.searchLabel')}
          searchPlaceholder={t('activityPage.searchPlaceholder')}
          searchValue={query}
          onSearchChange={setQuery}
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
                    minHeight: 44,
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: (theme) => `${theme.shape.borderRadius}px`,
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
                  <SelectField<string>
                    label={t('activityFoundation.filters.source')}
                    size="small"
                    value={filters.source ?? ''}
                    options={sourceOptions}
                    onValueChange={(value) => changeFilter('source', value || null)}
                  />
                  <SelectField<string>
                    label={t('activityFoundation.filters.objectType')}
                    size="small"
                    value={filters.objectType ?? EMPTY_SELECT_VALUE}
                    options={objectTypeOptions}
                    onValueChange={(value) => changeFilter('objectType', value || null)}
                  />
                  {(['objectId', 'executionId'] as const).map((key) => (
                    <FormField
                      key={key}
                      label={t(`activityFoundation.filters.${key}`)}
                      size="small"
                      value={filters[key] ?? ''}
                      onChange={(event) => changeFilter(key, event.target.value || null)}
                      fullWidth
                    />
                  ))}
                  {(['from', 'to'] as const).map((key) => (
                    <DateTimePickerField
                      key={key}
                      label={t(`activityFoundation.filters.${key}`)}
                      size="small"
                      value={filters[key] ?? null}
                      onValueChange={(value) => changeFilter(key, value)}
                      minutesStep={1}
                      fullWidth
                    />
                  ))}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ gridColumn: { sm: '1 / -1' } }}
                  >
                    {t('activityFoundation.filters.localTimeNotice')}
                  </Typography>
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
                        label: `${t(`activityFoundation.filters.${key}`)}: ${
                          key === 'source'
                            ? sourceOptions.find(({ value }) => value === filters[key])?.label
                            : key === 'objectType'
                              ? objectTypeOptions.find(({ value }) => value === filters[key])?.label
                              : key === 'from' || key === 'to'
                                ? validActivityTimeRange({ [key]: filters[key] })
                                  ? formatDate(filters[key]!, {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : filters[key]
                                : filters[key]
                        }`,
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
          onReset={resetFilters}
          resultLabel={t('activityPage.visibleCount', { count: visibleEvents.length })}
        />
        {searchTooShort && (
          <Typography
            role="status"
            color="error.main"
            variant="caption"
            component="p"
            sx={{ mt: 0.75 }}
          >
            {t('activityFoundation.filters.queryMinimum')}
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns:
            desktopDetail && selectedId
              ? 'minmax(0, 1.65fr) minmax(360px, 0.9fr)'
              : 'minmax(0, 1fr)',
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Box component="section" aria-labelledby="activity-timeline-heading" sx={{ minWidth: 0 }}>
          <Box sx={{ py: { xs: 1, sm: 2 }, pr: { lg: 3 } }}>
            <SectionHeading
              id="activity-timeline-heading"
              icon={Activity}
              title={t('activityPage.timeline')}
            />
          </Box>
          <Divider />
          {activityQuery.isError && feedData && (
            <InlineFeedback
              severity="warning"
              title={t('activityFoundation.cachedFeed.title')}
              sx={{ mt: 1.25 }}
            >
              {t('activityFoundation.cachedFeed.description')}
              <Box sx={{ mt: 1 }}>
                <ActionButton
                  intent="secondary"
                  size="small"
                  onClick={() => void activityQuery.refetch()}
                  disabled={activityQuery.isFetching}
                >
                  {t('activityPage.retry')}
                </ActionButton>
              </Box>
            </InlineFeedback>
          )}
          {!validActivityTimeRange(filters) ? (
            <EmptyState title={t('activityFoundation.invalidTimeRange')} size="compact" />
          ) : activityQuery.isLoading && !feedData ? (
            <LoadingState label={t('activityPage.loading')} size="compact" />
          ) : (activityQuery.isError || rootDenied) && !feedData ? (
            <LocalErrorState
              title={t('activityPage.loadErrorTitle')}
              retryLabel={t('activityPage.retry')}
              onRetry={() => void (rootDenied ? refresh() : activityQuery.refetch())}
              size="compact"
            />
          ) : visibleEvents.length > 0 ? (
            <Box
              component="ol"
              aria-label={t('activityPage.timelineLabel')}
              sx={{ p: 0, m: 0, listStyle: 'none' }}
            >
              {visibleEvents.map((event) => (
                <ActivityTimelineRow
                  key={event.id}
                  event={event}
                  active={event.id === selectedId}
                  onSelect={(eventId) =>
                    setSearchParams(mergeFilterSearchParams(searchParams, { event: eventId }), {
                      replace: false,
                    })
                  }
                />
              ))}
            </Box>
          ) : (
            <EmptyState
              title={t(
                emptyStateKind === 'filtered'
                  ? 'activityPage.filteredEmptyTitle'
                  : 'activityPage.emptyTitle'
              )}
              description={t(
                emptyStateKind === 'filtered'
                  ? 'activityPage.filteredEmptyDescription'
                  : 'activityPage.emptyDescription'
              )}
              actionLabel={
                emptyStateKind === 'filtered' ? t('activityPage.resetFilters') : undefined
              }
              onAction={emptyStateKind === 'filtered' ? resetFilters : undefined}
            />
          )}
        </Box>

        <ActivityEventDetail
          eventId={selectedId}
          query={detail}
          accessDenied={rootDenied}
          onAccessRetry={() => void refresh()}
          executionRun={executionRunData}
          executionRunRefreshFailed={
            !rootDenied && executionRun.isError && Boolean(executionRunData)
          }
          evidenceQuery={
            !rootDenied &&
            detailData &&
            (detailData.source !== 'DWAI_ON' || Boolean(detailData.auditRecordId))
              ? evidence
              : undefined
          }
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
            !feedData?.hasMore ||
            !feedData.nextCursor ||
            activityQuery.isFetching ||
            activityQuery.isError
          }
          onClick={() =>
            setSearchParams(
              mergeFilterSearchParams(searchParams, {
                cursor: feedData?.nextCursor ?? null,
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
