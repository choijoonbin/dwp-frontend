import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  ListFilter,
  ShieldX,
} from 'lucide-react';
import {
  ActionButton,
  foundationTokens,
  GuidedEmptyState,
  LoadingState,
  LocalErrorState,
  SectionHeader,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import type { DwaionUserRun } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  DWAION_ACTIVITY_FILTERS,
  DWAION_ACTIVITY_PERIODS,
  hasExpiredDwaionRunLease,
  type DwaionActivityFilter,
  type DwaionActivityPeriod,
} from './dwaion-activity-model';
import {
  DWAION_ACTIVITY_FILTER_FOCUS_EVENT,
  DWAION_ACTIVITY_FILTERS_ID,
} from './dwaion-mobile-shell-profile';

export function ActivityListHeader({
  filter,
  period,
  total,
  visible,
  onFilter,
  onPeriod,
  showCounts,
  disabled,
}: {
  filter: DwaionActivityFilter;
  period: DwaionActivityPeriod;
  total: number;
  visible: number;
  onFilter: (value: DwaionActivityFilter) => void;
  onPeriod: (value: DwaionActivityPeriod) => void;
  showCounts: boolean;
  disabled: boolean;
}) {
  const { t } = useTranslation('work');
  const filterGroupRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const focusFilters = () => {
      const target = filterGroupRef.current;
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      globalThis.setTimeout(
        () => target?.querySelector<HTMLElement>('button:not([disabled])')?.focus(),
        0
      );
    };
    globalThis.addEventListener(DWAION_ACTIVITY_FILTER_FOCUS_EVENT, focusFilters);
    return () => globalThis.removeEventListener(DWAION_ACTIVITY_FILTER_FOCUS_EVENT, focusFilters);
  }, []);
  return (
    <Box
      sx={{
        mt: { xs: 1, md: 1.25 },
        p: { xs: 1, sm: 1.25 },
        borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
        bgcolor: 'background.paper',
        boxShadow: (theme) => `0 1px 5px ${alpha(theme.palette.text.primary, 0.05)}`,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
        }}
      >
        <SectionHeader
          id="dwaion-activity-list"
          icon={ListFilter}
          title={t('dwaionActivity.listTitle')}
          density="compact"
        />
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        gap={{ xs: 0.65, md: 1 }}
        sx={{
          minWidth: 0,
          width: { xs: 'calc(100vw - 48px)', sm: 'auto' },
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: { xs: 'calc(100vw - 48px)', sm: 'auto' },
            minWidth: 0,
            maxWidth: '100%',
            overflowX: 'auto',
            alignSelf: 'stretch',
            flex: { md: '0 0 280px' },
          }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={period}
            disabled={disabled}
            onChange={(_, value: DwaionActivityPeriod | null) => value && onPeriod(value)}
            aria-label={t('dwaionActivity.periodLabel')}
            sx={(theme) => ({
              minWidth: { xs: '100%', md: 280 },
              display: 'flex',
              gap: 0.5,
              '& .MuiToggleButtonGroup-grouped': {
                minHeight: 40,
                flex: 1,
                px: 1.25,
                border: 0,
                borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 1}px !important`,
                bgcolor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.13 : 0.06
                ),
                color: 'text.secondary',
                fontSize: 'caption.fontSize',
                fontWeight: 'fontWeightBold',
              },
              '& .MuiToggleButton-root.Mui-selected': {
                bgcolor: 'background.paper',
                color: 'primary.main',
                boxShadow: (theme) => `inset 0 -2px 0 ${theme.palette.primary.main}`,
              },
            })}
          >
            {DWAION_ACTIVITY_PERIODS.map((value) => (
              <ToggleButton key={value} value={value}>
                {t(`dwaionActivity.periods.${value}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box
          sx={{
            width: { xs: 'calc(100vw - 48px)', sm: 'auto' },
            minWidth: 0,
            maxWidth: '100%',
            overflowX: 'auto',
            alignSelf: 'stretch',
            flex: 1,
          }}
        >
          <ToggleButtonGroup
            ref={filterGroupRef}
            id={DWAION_ACTIVITY_FILTERS_ID}
            exclusive
            size="small"
            value={filter}
            disabled={disabled}
            onChange={(_, value: DwaionActivityFilter | null) => value && onFilter(value)}
            aria-label={t('dwaionActivity.filterLabel')}
            sx={(theme) => ({
              minWidth: 'max-content',
              display: 'flex',
              gap: 0.5,
              '& .MuiToggleButtonGroup-grouped': {
                minHeight: 40,
                px: { xs: 1.25, sm: 1.5 },
                border: 0,
                borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 166.5}px !important`,
                bgcolor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.13 : 0.06
                ),
                color: 'text.secondary',
                fontSize: 'caption.fontSize',
                fontWeight: 'fontWeightBold',
              },
              '& .MuiToggleButton-root.Mui-selected': {
                bgcolor: theme.palette.primary.main,
                color: theme.palette.getContrastText(theme.palette.primary.main),
                '&:hover': { bgcolor: theme.palette.primary.main },
              },
            })}
          >
            {DWAION_ACTIVITY_FILTERS.map((state) => (
              <ToggleButton key={state} value={state}>
                {t(`dwaionActivity.filters.${state}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        {showCounts && (
          <Typography
            variant="caption"
            color="text.secondary"
            role="status"
            sx={{
              display: 'block',
              flex: '0 1 auto',
              mt: { xs: 0.25, md: 0 },
              textAlign: { xs: 'start', md: 'end' },
              whiteSpace: { md: 'nowrap' },
            }}
          >
            {t('dwaionActivity.filteredWindow', { visible, total })}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export function ActivityListBody({
  runs,
  visibleRuns,
  selectedRunId,
  filter,
  locale,
  onSelect,
  onResetFilter,
  onStart,
  accessDenied,
  onRefresh,
  hasMore = false,
  loadingMore = false,
  loadMoreError = false,
  onLoadMore,
}: {
  runs: {
    data: DwaionUserRun[] | undefined;
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
  };
  visibleRuns: DwaionUserRun[];
  selectedRunId: string;
  filter: DwaionActivityFilter;
  locale: 'ko' | 'en';
  onSelect: (runId: string) => void;
  onResetFilter: () => void;
  onStart: () => void;
  accessDenied: boolean;
  onRefresh?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMoreError?: boolean;
  onLoadMore?: () => void;
}) {
  const { t } = useTranslation('work');
  const selectedSample = visibleRuns.some(
    (run) => run.dataProvenance === 'SAMPLE' && run.runId === selectedRunId
  );
  const [sampleExpanded, setSampleExpanded] = useState(selectedSample);
  useEffect(() => {
    if (selectedSample) setSampleExpanded(true);
  }, [selectedSample]);
  if (accessDenied) {
    return (
      <Box sx={{ mt: 1.25 }}>
        <GuidedEmptyState
          kind="permission"
          title={t('dwaionActivity.accessTitle')}
          description={t('dwaionActivity.accessDescription')}
          actionLabel={onRefresh ? t('dwaionActivity.refresh') : undefined}
          onAction={onRefresh}
        />
      </Box>
    );
  }
  if (runs.isPending) {
    return (
      <Box sx={{ mt: 1.25 }}>
        <LoadingState label={t('dwaionActivity.loading')} variant="skeleton" size="page" />
      </Box>
    );
  }
  if (runs.isError && !runs.data) {
    return (
      <Box sx={{ mt: 1.25 }}>
        <LocalErrorState
          title={t('dwaionActivity.errorTitle')}
          description={t('dwaionActivity.errorDescription')}
          retryLabel={t('dwaionActivity.refresh')}
          onRetry={onRefresh}
          retrying={runs.isFetching}
          size="page"
        />
      </Box>
    );
  }
  if (!visibleRuns.length) {
    const filtered = filter !== 'ALL';
    const canSearchOlder = filtered && hasMore && Boolean(onLoadMore);
    return (
      <Box sx={{ mt: 1.25 }}>
        <GuidedEmptyState
          kind={filtered ? 'no-results' : 'empty'}
          title={t(filtered ? 'dwaionActivity.noResultsTitle' : 'dwaionActivity.emptyTitle')}
          description={t(
            canSearchOlder && loadMoreError
              ? 'dwaionActivity.pagination.error'
              : canSearchOlder
                ? 'dwaionActivity.noLoadedResultsDescription'
                : filtered
                  ? 'dwaionActivity.noResultsDescription'
                  : 'dwaionActivity.emptyDescription'
          )}
          actionLabel={t(
            canSearchOlder
              ? loadMoreError
                ? 'dwaionActivity.pagination.retry'
                : loadingMore
                  ? 'dwaionActivity.pagination.loading'
                  : 'dwaionActivity.pagination.loadOlder'
              : filtered
                ? 'dwaionActivity.resetFilter'
                : 'dwaionActivity.start'
          )}
          onAction={canSearchOlder ? onLoadMore : filtered ? onResetFilter : onStart}
        />
      </Box>
    );
  }
  const operationalRuns = visibleRuns.filter((run) => run.dataProvenance !== 'SAMPLE');
  const sampleRuns = visibleRuns.filter((run) => run.dataProvenance === 'SAMPLE');
  return (
    <Box
      sx={{
        mt: 0,
        overflow: { md: 'hidden' },
        borderRadius: (theme) => ({ md: Number(theme.shape.borderRadius) * 1.5 + 'px' }),
        bgcolor: { md: 'background.paper' },
        boxShadow: (theme) => ({
          md: `0 1px 5px ${alpha(theme.palette.text.primary, 0.05)}`,
        }),
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          display: { xs: 'none', md: 'grid' },
          gridTemplateColumns:
            'minmax(0, 5fr) minmax(7rem, 2fr) minmax(10rem, 3fr) minmax(6rem, 2fr)',
          gap: 1,
          px: 1.5,
          py: 1,
          bgcolor: 'var(--dwp-product-soft)',
        }}
      >
        {(['task', 'agent', 'state', 'time'] as const).map((column) => (
          <Typography
            key={column}
            variant="caption"
            color="text.secondary"
            fontWeight="fontWeightBold"
            textAlign={column === 'time' ? 'end' : 'start'}
          >
            {t(`dwaionActivity.columns.${column}`)}
          </Typography>
        ))}
      </Box>
      <Box
        component="ul"
        aria-label={t('dwaionActivity.listLabel')}
        sx={{ display: 'grid', gap: { xs: 0.75, md: 0 }, listStyle: 'none', p: 0, m: 0 }}
      >
        {operationalRuns.map((run) => (
          <Box
            component="li"
            key={run.runId}
            sx={{
              minWidth: 0,
              '&:not(:last-of-type)': { borderBottom: { md: 1 }, borderColor: 'divider' },
            }}
          >
            <RunRow
              run={run}
              locale={locale}
              selected={run.runId === selectedRunId}
              onSelect={() => onSelect(run.runId)}
            />
          </Box>
        ))}
      </Box>
      {sampleRuns.length > 0 && (
        <Accordion
          disableGutters
          elevation={0}
          expanded={sampleExpanded}
          onChange={(_, expanded) => setSampleExpanded(expanded)}
          sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
        >
          <AccordionSummary
            expandIcon={<ChevronDown size={16} aria-hidden="true" />}
            sx={{ px: 1.5, minHeight: 44 }}
          >
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
              <Typography variant="caption" fontWeight="fontWeightBold">
                {t('dwaionActivity.observability.sample.title')}
              </Typography>
              <Chip size="small" label={sampleRuns.length} sx={{ height: 22 }} />
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <Box
              component="ul"
              aria-label={t('dwaionActivity.observability.sample.listLabel')}
              sx={{ display: 'grid', gap: { xs: 0.75, md: 0 }, listStyle: 'none', p: 0, m: 0 }}
            >
              {sampleRuns.map((run) => (
                <Box component="li" key={run.runId} sx={{ minWidth: 0 }}>
                  <RunRow
                    run={run}
                    locale={locale}
                    selected={run.runId === selectedRunId}
                    onSelect={() => onSelect(run.runId)}
                  />
                </Box>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
      {onLoadMore && (hasMore || loadingMore || loadMoreError) && (
        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            borderTop: 1,
            borderColor: 'divider',
            display: 'grid',
            justifyItems: 'center',
            gap: 0.75,
          }}
        >
          {loadMoreError && (
            <Typography role="alert" variant="caption" color="warning.main" textAlign="center">
              {t('dwaionActivity.pagination.error')}
            </Typography>
          )}
          <ActionButton
            intent="secondary"
            size="small"
            disabled={loadingMore}
            aria-busy={loadingMore}
            startIcon={<ChevronDown size={16} aria-hidden="true" />}
            onClick={onLoadMore}
            sx={{ minHeight: 40 }}
          >
            {t(
              loadingMore
                ? 'dwaionActivity.pagination.loading'
                : loadMoreError
                  ? 'dwaionActivity.pagination.retry'
                  : 'dwaionActivity.pagination.loadOlder'
            )}
          </ActionButton>
        </Box>
      )}
    </Box>
  );
}

function RunRow({
  run,
  locale,
  selected,
  onSelect,
}: {
  run: DwaionUserRun;
  locale: 'ko' | 'en';
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('work');
  const leaseExpired = hasExpiredDwaionRunLease(run);
  const Icon = leaseExpired
    ? CircleAlert
    : run.runState === 'RUNNING'
      ? Clock3
      : run.runState === 'COMPLETED'
        ? CheckCircle2
        : CircleAlert;
  const agentName = t(`dwaionActivity.agents.${run.agentKey}`, { defaultValue: run.agentKey });
  const stateColor =
    run.policyOutcome === 'DENY' ? 'error' : leaseExpired ? 'warning' : runStateColor(run.runState);
  const statusLabel =
    run.policyOutcome === 'DENY'
      ? t('dwaionActivity.outcomes.DENY')
      : leaseExpired
        ? t('dwaionActivity.attentionSignals.leaseExpired')
        : t(`dwaionActivity.states.${run.runState}`);
  const displayTimestamp = formatDate(
    run.completedAt ?? run.createdAt,
    { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    locale
  );
  const compactId = `${run.runId.slice(0, 8)}…${run.runId.slice(-4)}`;
  const source = run.sourceHealth?.[0]?.sourceType;

  return (
    <Box
      component="button"
      type="button"
      aria-current={selected ? 'true' : undefined}
      aria-label={[
        t('dwaionActivity.selectRun', {
          agent: agentName,
          state: t(`dwaionActivity.states.${run.runState}`),
        }),
        ...(run.dataProvenance === 'SAMPLE'
          ? [t('dwaionActivity.observability.sample.title')]
          : []),
        ...(leaseExpired ? [t('dwaionActivity.attentionSignals.leaseExpiredDescription')] : []),
        t(`dwaionActivity.outcomes.${run.policyOutcome}`),
        run.runId,
      ].join(' · ')}
      data-testid={`dwaion-run-${run.runId}`}
      data-run-provenance={run.dataProvenance ?? 'LIVE'}
      onClick={onSelect}
      sx={{
        position: 'relative',
        width: 1,
        minHeight: { xs: 112, md: 86 },
        display: 'block',
        px: { xs: 1.5, md: 1.75 },
        py: { xs: 1.25, md: 1.35 },
        border: { xs: 1, md: 0 },
        borderColor: selected ? 'primary.main' : 'divider',
        borderInlineStart: selected ? 4 : { xs: 1, md: 3 },
        borderInlineStartColor: selected
          ? 'primary.main'
          : run.policyOutcome === 'DENY'
            ? 'error.main'
            : leaseExpired
              ? 'warning.main'
              : run.runState === 'RUNNING'
                ? 'info.main'
                : 'divider',
        borderRadius: (theme) => ({ xs: Number(theme.shape.borderRadius) * 1.5 + 'px', md: 0 }),
        bgcolor: selected ? 'var(--dwp-product-soft)' : 'background.paper',
        color: 'text.primary',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'grid' },
          gridTemplateColumns:
            'minmax(0, 5fr) minmax(7rem, 2fr) minmax(10rem, 3fr) minmax(6rem, 2fr)',
          gap: 1,
          alignItems: 'center',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Icon size={17} color="var(--dwp-product-accent)" aria-hidden="true" />
            <Typography variant="subtitle1" fontWeight="fontWeightBold" noWrap>
              {run.activityTitle ?? agentName}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.6} sx={{ mt: 0.35, minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              title={run.runId}
              sx={{ fontFamily: foundationTokens.font.mono, whiteSpace: 'nowrap' }}
            >
              {compactId}
            </Typography>
            <Typography variant="caption" color="text.secondary" aria-hidden="true">
              ·
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {source ?? t('dwaionActivity.details.sourceCountValue', { count: run.sourceCount })}
            </Typography>
          </Stack>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight="fontWeightBold" noWrap>
            {agentName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('dwaionActivity.revisionLabel', { revision: run.agentRevision })}
          </Typography>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Chip
            size="small"
            variant="outlined"
            color={stateColor}
            icon={<Icon size={13} aria-hidden="true" />}
            label={statusLabel}
            sx={{ maxWidth: 1, color: 'text.primary' }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            noWrap
            sx={{ mt: 0.35 }}
          >
            {run.answerState ? `${t(`dwaionActivity.answerStates.${run.answerState}`)} · ` : ''}
            {t(`dwaionActivity.outcomes.${run.policyOutcome}`)} ·{' '}
            {t('dwaionActivity.runMeta', {
              risk: run.riskTier,
              sources: run.sourceCount,
              latency: run.latencyMs,
            })}
          </Typography>
        </Box>
        <Box sx={{ minWidth: 0, textAlign: 'end' }}>
          <Typography variant="body2" color="primary.main" fontWeight="fontWeightBold">
            {t('dwaionActivity.details.latencyValue', { count: run.latencyMs })}
          </Typography>
          <Typography
            component="time"
            dateTime={run.completedAt ?? run.createdAt}
            variant="caption"
            color="text.secondary"
          >
            {displayTimestamp}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: { xs: 'block', md: 'none' }, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={0.75}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
            <Chip
              size="small"
              variant="outlined"
              color={stateColor}
              icon={<Icon size={12} aria-hidden="true" />}
              label={statusLabel}
              sx={{ height: 23, color: 'text.primary' }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              title={run.runId}
              noWrap
              sx={{ fontFamily: foundationTokens.font.mono }}
            >
              {compactId}
            </Typography>
          </Stack>
          <Typography
            component="time"
            dateTime={run.completedAt ?? run.createdAt}
            variant="caption"
            color="text.secondary"
            sx={{ flex: '0 0 auto' }}
          >
            {t('dwaionActivity.rowTimeMeta', {
              at: displayTimestamp,
              latency: run.latencyMs,
            })}
          </Typography>
        </Stack>

        <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.55 }}>
          <Typography
            component="h3"
            variant="subtitle1"
            fontWeight="fontWeightBold"
            noWrap
            sx={{ flex: 1 }}
          >
            {run.activityTitle ?? agentName}
          </Typography>
          {selected ? (
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                boxShadow: (theme) => `0 0 0 3px ${alpha(theme.palette.primary.main, 0.12)}`,
              }}
            />
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          )}
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.55 }}>
          <Chip
            size="small"
            icon={<Bot size={12} aria-hidden="true" />}
            label={agentName}
            sx={{ height: 22 }}
          />
          {source && (
            <Chip
              size="small"
              icon={<Database size={12} aria-hidden="true" />}
              label={source}
              sx={{ height: 22 }}
            />
          )}
          <Chip
            size="small"
            label={t('dwaionActivity.revisionLabel', { revision: run.agentRevision })}
            sx={{ height: 22 }}
          />
          {run.dataProvenance === 'SAMPLE' && (
            <Chip
              size="small"
              variant="outlined"
              color="warning"
              label={t('dwaionActivity.observability.sample.title')}
              sx={{ height: 22 }}
            />
          )}
        </Stack>

        {run.runState === 'RUNNING' &&
        run.progressPercent !== null &&
        run.progressPercent !== undefined ? (
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.75 }}>
            <Typography variant="caption" color="text.secondary" noWrap>
              {t(`dwaionActivity.outcomes.${run.policyOutcome}`)}
            </Typography>
            <Box
              sx={{
                flex: 1,
                height: 5,
                borderRadius: (theme) => Number(theme.shape.borderRadius) * 999 + 'px',
                bgcolor: 'action.hover',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ width: `${run.progressPercent}%`, height: 1, bgcolor: 'primary.main' }} />
            </Box>
          </Stack>
        ) : (
          <Stack
            direction="row"
            alignItems="center"
            gap={0.65}
            sx={{
              mt: 0.75,
              px: 0.75,
              py: 0.5,
              borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
              bgcolor: 'action.hover',
            }}
          >
            {run.policyOutcome === 'DENY' ? (
              <ShieldX size={13} aria-hidden="true" />
            ) : (
              <Bot size={13} aria-hidden="true" />
            )}
            <Typography variant="caption" color="text.secondary" noWrap>
              {run.answerState
                ? `${t(`dwaionActivity.answerStates.${run.answerState}`)} · `
                : `${t(`dwaionActivity.outcomes.${run.policyOutcome}`)} · `}
              {t('dwaionActivity.runMeta', {
                risk: run.riskTier,
                sources: run.sourceCount,
                latency: run.latencyMs,
              })}
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

export function EmptyInspector() {
  const { t } = useTranslation('work');
  return (
    <Box
      component="aside"
      aria-label={t('dwaionActivity.details.title')}
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
        bgcolor: 'background.paper',
        p: 2.5,
      }}
    >
      <GuidedEmptyState
        kind="empty"
        title={t('dwaionActivity.details.emptyTitle')}
        description={t('dwaionActivity.details.emptyDescription')}
        size="compact"
        announce={false}
      />
    </Box>
  );
}

function runStateColor(state: DwaionUserRun['runState']): 'info' | 'success' | 'error' {
  if (state === 'RUNNING') return 'info';
  if (state === 'COMPLETED') return 'success';
  return 'error';
}
