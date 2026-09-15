import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarDays, ListChecks } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { rankWorkspaceWorkItems } from '@dwp-frontend/shared-utils';
import { workspaceWorkItemRoute } from '@dwp-frontend/shared-utils/api/workspace-work-policy';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HomeContentState } from '../runtime/home-content-state';

import type { HomeOverview } from '@dwp-frontend/shared-utils';

const SUMMARY_FRESHNESS_MS = 5 * 60 * 1000;

type ClassicSummaryRuntimeState =
  | 'initial-loading'
  | 'background-refresh'
  | 'empty'
  | 'partial'
  | 'forbidden'
  | 'stale'
  | 'widget-error'
  | null;

export function resolveClassicSummaryRuntimeState({
  overview,
  loading,
  fetching,
  requestFailed,
  now = Date.now(),
}: Readonly<{
  overview?: HomeOverview;
  loading: boolean;
  fetching: boolean;
  requestFailed: boolean;
  now?: number;
}>): ClassicSummaryRuntimeState {
  if (loading && !overview) return 'initial-loading';
  if (requestFailed && !overview) return 'widget-error';
  if (!overview) return 'initial-loading';
  if (fetching) return 'background-refresh';

  const sections = [overview.calendar, overview.work] as const;
  if (sections.every(({ status }) => status === 'FORBIDDEN')) return 'forbidden';
  if (sections.some(({ status }) => status !== 'AVAILABLE')) return 'partial';

  const timestamps = sections
    .map(({ generatedAt }) => Date.parse(generatedAt))
    .filter(Number.isFinite);
  if (timestamps.some((generatedAt) => now - generatedAt > SUMMARY_FRESHNESS_MS)) return 'stale';

  const hasEvent = Boolean(overview.calendar.data?.nextEvent);
  const hasWork = rankWorkspaceWorkItems(overview.work.data?.items ?? []).length > 0;
  return hasEvent || hasWork ? null : 'empty';
}

type ClassicPersonalSummaryProps = Readonly<{
  overview?: HomeOverview;
  loading: boolean;
  fetching: boolean;
  requestFailed: boolean;
  onRetry: () => void;
}>;

export function ClassicPersonalSummary({
  overview,
  loading,
  fetching,
  requestFailed,
  onRetry,
}: ClassicPersonalSummaryProps) {
  const { t } = useTranslation('home');
  const event =
    overview?.calendar.status === 'AVAILABLE' ? overview.calendar.data?.nextEvent : null;
  const workItems =
    overview?.work.status === 'AVAILABLE'
      ? rankWorkspaceWorkItems(overview.work.data?.items ?? []).slice(0, 2)
      : [];

  const runtimeState = resolveClassicSummaryRuntimeState({
    overview,
    loading,
    fetching,
    requestFailed,
  });
  if (runtimeState === 'initial-loading') {
    return (
      <Box
        data-classic-summary-loading-layout
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 3fr)' },
          gap: 1.5,
          '& > *': { minHeight: 148 },
        }}
      >
        <HomeContentState kind="initial-loading" size="compact" />
        <HomeContentState kind="initial-loading" size="compact" />
      </Box>
    );
  }
  if (runtimeState === 'empty') {
    return (
      <HomeContentState
        kind="empty"
        size="compact"
        actionLabel={t('states.empty.action')}
        onAction={onRetry}
      />
    );
  }
  if (runtimeState === 'forbidden') {
    return <HomeContentState kind="forbidden" size="compact" />;
  }
  if (runtimeState === 'widget-error') {
    return <HomeContentState kind={runtimeState} size="compact" onAction={onRetry} />;
  }

  const verifiedContent = (
    <Box
      data-classic-personal-summary
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 3fr)' },
        gap: 1.5,
      }}
    >
      <Box
        component="article"
        data-classic-summary-card="next-schedule"
        sx={{
          p: 2,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.home.radius.control,
        }}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <CalendarDays size={19} aria-hidden="true" />
          <Typography
            component="h3"
            variant="subtitle2"
            fontWeight={foundationTokens.home.typography.weightEmphasis}
          >
            {t('classic.resources.summary.nextSchedule')}
          </Typography>
        </Stack>
        {event ? (
          <>
            <Typography
              variant="body2"
              fontWeight={foundationTokens.home.typography.weightBold}
              sx={{ mt: 1.25 }}
            >
              {event.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(new Date(event.startsAt), {
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {event.location ? ` · ${event.location}` : ''}
            </Typography>
            <ActionButton
              component="a"
              href="/calendar"
              intent="quiet"
              size="small"
              sx={{ minHeight: 44, mt: 0.75, ml: -1 }}
            >
              {t('classic.resources.summary.openCalendar')}
            </ActionButton>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
            {t('classic.resources.summary.noSchedule')}
          </Typography>
        )}
      </Box>

      <Box
        component="article"
        data-classic-summary-card="priority-work"
        sx={{
          p: 2,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.home.radius.control,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" gap={1}>
            <ListChecks size={19} aria-hidden="true" />
            <Typography
              component="h3"
              variant="subtitle2"
              fontWeight={foundationTokens.home.typography.weightEmphasis}
            >
              {t('classic.resources.summary.priorityWork')}
            </Typography>
          </Stack>
          <Chip
            size="small"
            label={t('classic.resources.summary.itemCount', { count: workItems.length })}
          />
        </Stack>
        {workItems.length > 0 ? (
          <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />} sx={{ mt: 0.75 }}>
            {workItems.map((item) => (
              <ActionButton
                key={item.workItemId}
                component="a"
                href={workspaceWorkItemRoute(item)}
                intent="quiet"
                endIcon={<ArrowRight size={16} aria-hidden="true" />}
                sx={{ minHeight: 48, px: 0.5, justifyContent: 'space-between', textAlign: 'start' }}
              >
                <Box component="span" minWidth={0}>
                  <Typography
                    component="span"
                    variant="body2"
                    fontWeight={foundationTokens.home.typography.weightSemibold}
                    display="block"
                  >
                    {item.title}
                  </Typography>
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    display="block"
                  >
                    {item.owner} · {t(`page.priority.${item.priority}`)}
                  </Typography>
                </Box>
              </ActionButton>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
            {t('classic.resources.summary.noPriorityWork')}
          </Typography>
        )}
      </Box>
    </Box>
  );

  if (
    runtimeState === 'background-refresh' ||
    runtimeState === 'partial' ||
    runtimeState === 'stale'
  ) {
    const affectedSources = [overview?.calendar, overview?.work]
      .filter((section) => {
        if (!section) return false;
        if (runtimeState === 'stale') {
          const generatedAt = Date.parse(section.generatedAt);
          return Number.isFinite(generatedAt) && Date.now() - generatedAt > SUMMARY_FRESHNESS_MS;
        }
        return section.status !== 'AVAILABLE';
      })
      .map((section) => section!.source);
    const lastSuccessfulAt = [overview?.calendar, overview?.work]
      .filter((section) => section?.status === 'AVAILABLE')
      .map((section) => section!.generatedAt)
      .sort()
      .at(-1);
    return (
      <HomeContentState
        kind={runtimeState}
        size="compact"
        affectedSources={affectedSources}
        lastSuccessfulAt={
          runtimeState === 'stale' && lastSuccessfulAt
            ? formatDate(new Date(lastSuccessfulAt), { hour: '2-digit', minute: '2-digit' })
            : undefined
        }
        onAction={runtimeState === 'background-refresh' ? undefined : onRetry}
        preservedContent={verifiedContent}
      />
    );
  }
  return verifiedContent;
}
