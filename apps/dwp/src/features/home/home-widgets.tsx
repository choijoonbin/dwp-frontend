import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  EyeOff,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  EmptyState,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { SectionHeading } from '../work-hub/workspace-ui';

import type {
  HomeOverview,
  HomeOverviewSection,
  WorkspacePriority as Priority,
  HomeRecommendation,
} from '@dwp-frontend/shared-utils';

export type HomeOverviewWidgetProps = {
  overview?: HomeOverview;
  loading: boolean;
  fetching: boolean;
  requestFailed: boolean;
  onRetry: () => void;
  feedbackBusy?: boolean;
  onRecommendationFeedback?: (recommendation: HomeRecommendation) => void;
};

function sectionUnavailable(section: HomeOverviewSection<unknown> | undefined): boolean {
  return section?.status === 'UNAVAILABLE';
}

function sectionForbidden(section: HomeOverviewSection<unknown> | undefined): boolean {
  return section?.status === 'FORBIDDEN';
}

const priorityColor: Record<Priority, 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default',
};

export function DailyBriefWidget({
  overview,
  loading,
  fetching,
  requestFailed,
  onRetry,
  feedbackBusy = false,
  onRecommendationFeedback,
}: HomeOverviewWidgetProps) {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const recommendations = overview?.recommendations ?? [];
  const sourceCount = [overview?.work, overview?.calendar, overview?.communications].filter(
    (section) => section?.status === 'AVAILABLE'
  ).length;
  const updatedTime = overview?.generatedAt
    ? formatDate(new Date(overview.generatedAt), { hour: '2-digit', minute: '2-digit' })
    : '-';

  return (
    <Box
      component="section"
      aria-labelledby="brief-heading"
      sx={{ gridColumn: '1 / -1', minWidth: 0, py: 2.5 }}
    >
      <SectionHeading
        id="brief-heading"
        icon={Sparkles}
        title={t('widgets.brief.title')}
        meta={
          <Chip
            icon={<ShieldCheck size={14} aria-hidden="true" />}
            label={t('widgets.brief.sourceSummary', { count: sourceCount })}
            size="small"
            variant="outlined"
          />
        }
      />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t('widgets.brief.description', { time: updatedTime })}
      </Typography>

      {loading && (
        <LoadingState label={t('widgets.brief.loading')} variant="skeleton" size="compact" />
      )}
      {requestFailed && (
        <ErrorState
          title={t('widgets.brief.loadError')}
          retryLabel={t('widgets.brief.retry')}
          onRetry={onRetry}
          retrying={fetching}
          size="compact"
        />
      )}
      {!loading && !requestFailed && recommendations.length === 0 && (
        <EmptyState
          title={t('widgets.brief.empty')}
          description={t('widgets.brief.emptyDescription')}
          size="compact"
        />
      )}
      {!loading && !requestFailed && recommendations.length > 0 && (
        <Box
          component="ol"
          sx={{
            p: 0,
            mt: 2,
            mb: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            borderTop: 1,
            borderLeft: 1,
            borderColor: 'divider',
            listStyle: 'none',
          }}
        >
          {recommendations.slice(0, 3).map((recommendation) => (
            <Box
              component="li"
              key={recommendation.key}
              sx={{ minWidth: 0, borderRight: 1, borderBottom: 1, borderColor: 'divider' }}
            >
              <Box
                sx={{
                  width: 1,
                  minHeight: 180,
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  borderTop: 3,
                  borderTopColor:
                    recommendation.priority === 'HIGH'
                      ? 'error.main'
                      : recommendation.priority === 'MEDIUM'
                        ? 'warning.main'
                        : 'success.main',
                }}
              >
                <Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Chip
                      size="small"
                      label={t(`widgets.brief.kind.${recommendation.kind.toLowerCase()}`)}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t('widgets.brief.confidence', {
                        confidence: t(
                          `widgets.brief.confidenceLevel.${recommendation.confidence.toLowerCase()}`
                        ),
                      })}
                    </Typography>
                  </Stack>
                  <Typography component="h3" variant="subtitle1" sx={{ mt: 1.25 }}>
                    {recommendation.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {recommendation.description}
                  </Typography>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('widgets.brief.evidence', {
                      count: recommendation.evidenceCount,
                      source: recommendation.source,
                    })}
                  </Typography>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1}
                    sx={{ mt: 0.75 }}
                  >
                    <ActionButton
                      intent="quiet"
                      size="small"
                      endIcon={<ArrowRight size={15} aria-hidden="true" />}
                      onClick={() => navigate(recommendation.actionPath)}
                      sx={{ px: 0 }}
                    >
                      {t('widgets.brief.open')}
                    </ActionButton>
                    {onRecommendationFeedback && (
                      <ActionIconButton
                        label={t('widgets.brief.notRelevant')}
                        size="small"
                        disabled={feedbackBusy}
                        onClick={() => onRecommendationFeedback(recommendation)}
                      >
                        <EyeOff size={16} />
                      </ActionIconButton>
                    )}
                  </Stack>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function FocusWidget({
  overview,
  loading,
  fetching,
  requestFailed,
  onRetry,
}: HomeOverviewWidgetProps) {
  const { t } = useTranslation(['home', 'work', 'common']);
  const navigate = useNavigate();
  const items = (overview?.work.data?.items ?? [])
    .filter((item) => item.status !== 'completed')
    .slice(0, 4);
  return (
    <Box
      component="section"
      aria-labelledby="priority-heading"
      sx={{ gridColumn: { xs: '1 / -1', lg: 'span 6' }, minWidth: 0, py: 2.5 }}
    >
      <SectionHeading
        id="priority-heading"
        icon={CheckCircle2}
        title={t('widgets.focus.title')}
        meta={
          <Typography variant="body2" color="text.secondary">
            {t('units.item', { ns: 'common', count: items.length })}
          </Typography>
        }
      />
      {loading && (
        <LoadingState label={t('widgets.focus.loading')} variant="skeleton" size="compact" />
      )}
      {(requestFailed || sectionUnavailable(overview?.work)) && (
        <ErrorState
          title={t('widgets.focus.loadError')}
          retryLabel={t('widgets.focus.retry')}
          onRetry={onRetry}
          retrying={fetching}
          size="compact"
        />
      )}
      {!loading && !requestFailed && sectionForbidden(overview?.work) && (
        <GuidedEmptyState
          kind="permission"
          title={t('widgets.common.restrictedTitle')}
          description={t('widgets.common.restrictedDescription')}
          size="compact"
        />
      )}
      {!loading &&
        !requestFailed &&
        !sectionUnavailable(overview?.work) &&
        !sectionForbidden(overview?.work) &&
        items.length === 0 && (
          <EmptyState
            title={t('widgets.focus.empty')}
            description={t('widgets.focus.emptyDescription')}
            size="compact"
          />
        )}
      {!loading &&
        !requestFailed &&
        !sectionUnavailable(overview?.work) &&
        !sectionForbidden(overview?.work) &&
        items.length > 0 && (
          <Box component="ol" sx={{ p: 0, mt: 2, mb: 0, listStyle: 'none' }}>
            {items.map((item, index) => (
              <Box component="li" key={item.id} sx={{ borderTop: 1, borderColor: 'divider' }}>
                <ButtonBase
                  onClick={() => navigate(`/work?item=${encodeURIComponent(item.id)}`)}
                  sx={{
                    width: 1,
                    minHeight: 78,
                    p: 1.5,
                    display: 'grid',
                    gridTemplateColumns: '32px minmax(0, 1fr) auto',
                    gap: 1.5,
                    alignItems: 'center',
                    textAlign: 'left',
                    bgcolor: index === 0 ? 'action.selected' : 'transparent',
                    borderLeft: 3,
                    borderLeftColor: index === 0 ? 'primary.main' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={800}>
                    {String(index + 1).padStart(2, '0')}
                  </Typography>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography component="h3" variant="subtitle2">
                        {item.title}
                      </Typography>
                      <Chip
                        label={t(`labels.priority.${item.priority}`, { ns: 'work' })}
                        color={priorityColor[item.priority]}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                      {item.reason}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.dueAt
                        ? formatDate(new Date(item.dueAt), {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : t('widgets.focus.noDueDate')}{' '}
                      / {item.sourceSystem}
                    </Typography>
                  </Box>
                  <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
                </ButtonBase>
              </Box>
            ))}
          </Box>
        )}
    </Box>
  );
}

export function ScheduleWidget({
  overview,
  loading,
  fetching,
  requestFailed,
  onRetry,
}: HomeOverviewWidgetProps) {
  const { t } = useTranslation('home');
  const navigate = useNavigate();

  return (
    <Box
      component="section"
      aria-labelledby="schedule-heading"
      sx={{ gridColumn: { xs: '1 / -1', lg: 'span 3' }, minWidth: 0, py: 2.5 }}
    >
      <SectionHeading
        id="schedule-heading"
        icon={CalendarDays}
        title={t('widgets.schedule.title')}
      />
      {loading && (
        <LoadingState label={t('widgets.schedule.loading')} variant="skeleton" size="compact" />
      )}
      {(requestFailed || sectionUnavailable(overview?.calendar)) && (
        <ErrorState
          title={t('widgets.schedule.loadError')}
          retryLabel={t('widgets.schedule.retry')}
          onRetry={onRetry}
          retrying={fetching}
          size="compact"
        />
      )}
      {!loading && !requestFailed && sectionForbidden(overview?.calendar) && (
        <GuidedEmptyState
          kind="permission"
          title={t('widgets.common.restrictedTitle')}
          description={t('widgets.common.restrictedDescription')}
          size="compact"
        />
      )}
      {!loading &&
        !requestFailed &&
        !sectionUnavailable(overview?.calendar) &&
        !sectionForbidden(overview?.calendar) &&
        (overview?.calendar.data?.today.length ?? 0) === 0 && (
          <EmptyState
            title={t('widgets.schedule.clear')}
            description={t('widgets.schedule.clearDescription')}
            actionLabel={t('widgets.schedule.openCalendar')}
            onAction={() => navigate('/calendar/schedule')}
            size="compact"
          />
        )}
      {!loading &&
        !requestFailed &&
        !sectionUnavailable(overview?.calendar) &&
        !sectionForbidden(overview?.calendar) &&
        (overview?.calendar.data?.today.length ?? 0) > 0 && (
          <>
            <Box component="ol" sx={{ p: 0, mt: 2, mb: 0, listStyle: 'none' }}>
              {overview?.calendar.data?.today.slice(0, 4).map((event) => (
                <li key={`${event.eventId}-${event.startsAt}`}>
                  <Box sx={{ py: 1.25, borderTop: 1, borderColor: 'divider' }}>
                    <ButtonBase
                      onClick={() => navigate('/calendar/schedule')}
                      sx={{ width: 1, display: 'block', textAlign: 'left' }}
                    >
                      <Typography variant="caption" color="primary.main" fontWeight={700}>
                        {formatDate(event.startsAt, { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                      <Typography component="h3" variant="subtitle2" sx={{ mt: 0.25 }}>
                        {event.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {event.location || t('widgets.schedule.noLocation')}
                      </Typography>
                    </ButtonBase>
                  </Box>
                </li>
              ))}
            </Box>
            <ActionButton
              intent="quiet"
              endIcon={<ArrowRight size={16} aria-hidden="true" />}
              onClick={() => navigate('/calendar/schedule')}
              sx={{ mt: 1, px: 0 }}
            >
              {t('widgets.schedule.openCalendar')}
            </ActionButton>
          </>
        )}
    </Box>
  );
}

export function ActivityWidget({
  overview,
  loading,
  fetching,
  requestFailed,
  onRetry,
}: HomeOverviewWidgetProps) {
  const { t } = useTranslation(['home', 'work']);
  const navigate = useNavigate();
  const events = (overview?.activity.data?.events ?? []).slice(0, 3);
  return (
    <Box
      component="section"
      aria-labelledby="activity-heading"
      sx={{ gridColumn: { xs: '1 / -1', lg: 'span 3' }, minWidth: 0, py: 2.5 }}
    >
      <SectionHeading
        id="activity-heading"
        icon={Activity}
        title={t('widgets.activity.title')}
        meta={<Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'success.main' }} />}
      />
      {loading && (
        <LoadingState label={t('widgets.activity.loading')} variant="skeleton" size="compact" />
      )}
      {(requestFailed || sectionUnavailable(overview?.activity)) && (
        <ErrorState
          title={t('widgets.activity.loadError')}
          retryLabel={t('widgets.activity.retry')}
          onRetry={onRetry}
          retrying={fetching}
          size="compact"
        />
      )}
      {!loading && !requestFailed && sectionForbidden(overview?.activity) && (
        <GuidedEmptyState
          kind="permission"
          title={t('widgets.common.restrictedTitle')}
          description={t('widgets.common.restrictedDescription')}
          size="compact"
        />
      )}
      {!loading &&
        !requestFailed &&
        !sectionUnavailable(overview?.activity) &&
        !sectionForbidden(overview?.activity) &&
        events.length === 0 && <EmptyState title={t('widgets.activity.empty')} size="compact" />}
      {!loading &&
        !requestFailed &&
        !sectionUnavailable(overview?.activity) &&
        !sectionForbidden(overview?.activity) &&
        events.length > 0 && (
          <Box component="ul" sx={{ p: 0, mt: 2, mb: 0, listStyle: 'none' }}>
            {events.map((event) => (
              <Box
                component="li"
                key={event.id}
                sx={{ py: 1.5, borderTop: 1, borderColor: 'divider' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(new Date(event.occurredAt), {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                  <Chip
                    label={t(`labels.actor.${event.actor}`, { ns: 'work' })}
                    size="small"
                    color={event.actor === 'agent' ? 'info' : 'default'}
                    variant="outlined"
                  />
                </Box>
                <Typography component="h3" variant="subtitle2" sx={{ mt: 0.75 }}>
                  {event.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {event.actorName} / {event.source}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      <ActionButton
        intent="quiet"
        endIcon={<ArrowRight size={16} aria-hidden="true" />}
        onClick={() => navigate('/activity')}
        sx={{ mt: 1, px: 0 }}
      >
        {t('widgets.activity.view')}
      </ActionButton>
    </Box>
  );
}
