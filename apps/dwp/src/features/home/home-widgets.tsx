import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Focus,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UsersRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getWorkspaceActivity, getWorkspaceWorkQueue } from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { ActionButton, EmptyState, ErrorState, LoadingState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { SectionHeading } from '../work-hub/workspace-ui';

import type { WorkspacePriority as Priority } from '@dwp-frontend/shared-utils';

const priorityColor: Record<Priority, 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default',
};

export function DailyBriefWidget() {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const workQuery = useQuery({
    queryKey: ['workspace', 'work-queue'],
    queryFn: getWorkspaceWorkQueue,
    staleTime: 30_000,
    retry: 1,
  });
  const topWork = workQuery.data?.items.find((item) => item.status !== 'completed');
  const sourceCount = new Set(workQuery.data?.items.map((item) => item.sourceSystem) ?? []).size;
  const updatedTime = workQuery.data?.generatedAt
    ? formatDate(new Date(workQuery.data.generatedAt), { hour: '2-digit', minute: '2-digit' })
    : '-';
  const signals = [
    { key: 'deadline', icon: TimerReset, value: workQuery.data?.summary.dueSoon ?? 0 },
    { key: 'focus', icon: Focus, value: workQuery.data?.summary.inProgress ?? 0 },
    { key: 'meeting', icon: UsersRound, value: workQuery.data?.summary.waiting ?? 0 },
  ] as const;

  return (
    <Box
      component="section"
      aria-labelledby="brief-heading"
      sx={{
        gridColumn: '1 / -1',
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          lg: 'minmax(0, 1.65fr) minmax(320px, 1fr)',
        },
        color: '#F8FAFC',
        bgcolor: '#111923',
        border: 1,
        borderColor: '#293545',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: { xs: 2.5, sm: 3, lg: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            icon={<ShieldCheck size={14} aria-hidden="true" />}
            label={t('widgets.brief.sourceSummary', { count: sourceCount })}
            size="small"
            sx={{
              color: '#DCE8FF',
              borderColor: '#5876A3',
              bgcolor: '#18263A',
              '& .MuiChip-icon': { color: '#7EB7FF' },
            }}
            variant="outlined"
          />
          <Typography variant="caption" sx={{ color: '#AEBACC' }}>
            {t('page.updatedAt', { time: updatedTime })}
          </Typography>
        </Box>
        <Typography id="brief-heading" component="h2" variant="h5" sx={{ mt: 2.25 }}>
          {t('widgets.brief.title')}
        </Typography>
        <Typography
          component="p"
          sx={{ mt: 1, maxWidth: 720, fontSize: '1.125rem', lineHeight: 1.55, color: '#F8FAFC' }}
        >
          {workQuery.isError
            ? t('widgets.brief.loadError')
            : topWork
              ? t('widgets.brief.liveSummary', {
                  title: topWork.title,
                  count: workQuery.data?.summary.total ?? 0,
                })
              : t('widgets.brief.emptySummary')}
        </Typography>

        <Box
          sx={{
            mt: 2.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          {signals.map(({ key, icon: SignalIcon, value }) => {
            const label = t(`widgets.brief.signals.${key}.label`);
            return (
              <Box
                key={label as string}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '32px minmax(0, 1fr)',
                  gap: 1,
                  alignItems: 'center',
                  p: 1.25,
                  border: '1px solid #334155',
                  borderRadius: 1,
                  bgcolor: '#16212E',
                }}
              >
                <Box sx={{ color: '#8DB8FF', display: 'grid', placeItems: 'center' }}>
                  <SignalIcon size={18} strokeWidth={1.8} aria-hidden="true" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: '#AEBACC' }}>
                    {label}
                  </Typography>
                  <Typography component="p" variant="subtitle2" sx={{ color: '#FFFFFF' }}>
                    {String(value).padStart(2, '0')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#AEBACC' }}>
                    {t(`widgets.brief.signals.${key}.detail`)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2.5 }}>
          <Button
            variant="contained"
            startIcon={<BriefcaseBusiness size={17} aria-hidden="true" />}
            disabled={!topWork}
            onClick={() => topWork && navigate(`/work?item=${encodeURIComponent(topWork.id)}`)}
          >
            {t('widgets.brief.reviewPriority')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Sparkles size={17} aria-hidden="true" />}
            onClick={() => navigate(`/ask?q=${encodeURIComponent(t('widgets.brief.askPrompt'))}`)}
            sx={{
              color: '#F8FAFC',
              borderColor: '#66778F',
              '&:hover': { borderColor: '#AFC8F2' },
            }}
          >
            {t('widgets.brief.askToday')}
          </Button>
        </Box>
      </Box>

      <Box
        sx={{
          p: { xs: 2.5, sm: 3, lg: 4 },
          borderLeft: { xs: 0, lg: '1px solid #293545' },
          borderTop: { xs: '1px solid #293545', lg: 0 },
          bgcolor: '#0D141D',
        }}
      >
        <Typography component="h3" variant="subtitle1" sx={{ color: '#FFFFFF' }}>
          {t('widgets.brief.rhythmTitle')}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25, color: '#AEBACC' }}>
          {t('widgets.brief.calendarConnectionDescription')}
        </Typography>
        <Box
          sx={{
            mt: 3,
            minHeight: 138,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            border: '1px dashed #405067',
            borderRadius: 1,
            p: 2,
          }}
        >
          <Box>
            <CalendarDays size={28} strokeWidth={1.6} color="#8DB8FF" aria-hidden="true" />
            <Typography variant="body2" sx={{ mt: 1, color: '#CBD5E1' }}>
              {t('widgets.brief.calendarConnectionEmpty')}
            </Typography>
            <ActionButton
              intent="quiet"
              onClick={() => navigate('/apps?app=ref-app-mail')}
              sx={{ mt: 1, color: '#AFC8F2' }}
            >
              {t('widgets.brief.reviewConnection')}
            </ActionButton>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export function FocusWidget() {
  const { t } = useTranslation(['home', 'work', 'common']);
  const navigate = useNavigate();
  const workQuery = useQuery({
    queryKey: ['workspace', 'work-queue'],
    queryFn: getWorkspaceWorkQueue,
    staleTime: 30_000,
    retry: 1,
  });
  const items = (workQuery.data?.items ?? [])
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
      {workQuery.isLoading && (
        <LoadingState label={t('widgets.focus.loading')} variant="skeleton" size="compact" />
      )}
      {workQuery.isError && (
        <ErrorState
          title={t('widgets.focus.loadError')}
          retryLabel={t('widgets.focus.retry')}
          onRetry={() => void workQuery.refetch()}
          retrying={workQuery.isFetching}
          size="compact"
        />
      )}
      {!workQuery.isLoading && !workQuery.isError && items.length === 0 && (
        <EmptyState
          title={t('widgets.focus.empty')}
          description={t('widgets.focus.emptyDescription')}
          size="compact"
        />
      )}
      {!workQuery.isLoading && !workQuery.isError && items.length > 0 && (
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

export function ScheduleWidget() {
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
      <EmptyState
        title={t('widgets.schedule.connectionRequired')}
        description={t('widgets.schedule.connectionDescription')}
        actionLabel={t('widgets.schedule.reviewConnection')}
        onAction={() => navigate('/apps?app=ref-app-mail')}
        size="compact"
      />
    </Box>
  );
}

export function ActivityWidget() {
  const { t } = useTranslation(['home', 'work']);
  const navigate = useNavigate();
  const activityQuery = useQuery({
    queryKey: ['workspace', 'activity'],
    queryFn: getWorkspaceActivity,
    staleTime: 15_000,
    retry: 1,
  });
  const events = (activityQuery.data?.events ?? []).slice(0, 3);
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
      {activityQuery.isLoading && (
        <LoadingState label={t('widgets.activity.loading')} variant="skeleton" size="compact" />
      )}
      {activityQuery.isError && (
        <ErrorState
          title={t('widgets.activity.loadError')}
          retryLabel={t('widgets.activity.retry')}
          onRetry={() => void activityQuery.refetch()}
          retrying={activityQuery.isFetching}
          size="compact"
        />
      )}
      {!activityQuery.isLoading && !activityQuery.isError && events.length === 0 && (
        <EmptyState title={t('widgets.activity.empty')} size="compact" />
      )}
      {!activityQuery.isLoading && !activityQuery.isError && events.length > 0 && (
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
      <Button
        variant="text"
        endIcon={<ArrowRight size={16} aria-hidden="true" />}
        onClick={() => navigate('/activity')}
        sx={{ mt: 1, px: 0 }}
      >
        {t('widgets.activity.view')}
      </Button>
    </Box>
  );
}
