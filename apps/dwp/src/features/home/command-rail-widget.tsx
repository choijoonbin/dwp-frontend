import { workspaceWorkItemRoute } from '@dwp-frontend/shared-utils/api/workspace-work-policy';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  EyeOff,
  ListChecks,
  Sparkles,
} from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  LoadingState,
  SectionHeaderMetaText,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { SectionHeading } from '../../components/workspace-ui';

import type { WorkspaceWorkItem } from '@dwp-frontend/shared-utils';
import type { HomeOverviewWidgetProps } from './home-widgets';

function nextWorkItem(items: readonly WorkspaceWorkItem[] = []): WorkspaceWorkItem | undefined {
  const statusOrder = {
    open: 1,
    'due-soon': 0,
    'in-progress': 1,
    waiting: 2,
    completed: 3,
    cancelled: 4,
    archived: 5,
  };
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return [...items]
    .filter((item) => item.status !== 'completed')
    .sort(
      (left, right) =>
        statusOrder[left.status] - statusOrder[right.status] ||
        priorityOrder[left.priority] - priorityOrder[right.priority] ||
        new Date(left.dueAt ?? '9999-12-31').getTime() -
          new Date(right.dueAt ?? '9999-12-31').getTime()
    )[0];
}

const commandCard = (accent: string) => ({
  p: { xs: 2, md: 2.5 },
  minWidth: 0,
  minHeight: { xs: 176, md: 216 },
  display: 'flex',
  flexDirection: 'column',
  bgcolor: 'background.paper',
  border: 1,
  borderLeft: { xs: 1, md: 4 },
  borderColor: 'divider',
  borderLeftColor: { xs: 'divider', md: accent },
  borderRadius: 0.5,
  boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
});

export function CommandRailWidget({
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
  const work = overview?.work.data;
  const calendar = overview?.calendar.data;
  const topWork = useMemo(() => nextWorkItem(work?.items), [work?.items]);
  const recommendationSection = overview?.recommendations;
  const recommendation = recommendationSection?.data?.[0];
  const workUnavailable = requestFailed || overview?.work.status === 'UNAVAILABLE';
  const workForbidden = overview?.work.status === 'FORBIDDEN';
  const calendarUnavailable = requestFailed || overview?.calendar.status === 'UNAVAILABLE';
  const calendarForbidden = overview?.calendar.status === 'FORBIDDEN';
  const recommendationUnavailable =
    requestFailed || recommendationSection?.status === 'UNAVAILABLE';
  const recommendationForbidden = recommendationSection?.status === 'FORBIDDEN';

  return (
    <Box
      component="section"
      aria-labelledby="command-rail-heading"
      data-testid="home-command-area"
      sx={{ minWidth: 0, height: 1, display: 'flex', flexDirection: 'column' }}
    >
      <Box sx={{ mb: 2 }}>
        <SectionHeading
          id="command-rail-heading"
          icon={ListChecks}
          title={t('dayRail.title')}
          divider
          meta={
            <SectionHeaderMetaText sx={{ display: { xs: 'none', md: 'block' } }}>
              {t('dayRail.description')}
            </SectionHeaderMetaText>
          }
        />
      </Box>

      <Box
        data-testid="home-priority-rail"
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
          },
          gap: { xs: 1.5, md: 2 },
        }}
      >
        <Box sx={commandCard('#0047AB')}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <BriefcaseBusiness size={17} color="#00327D" aria-hidden="true" />
              <Typography variant="overline" sx={{ color: '#434653' }}>
                {t('dayRail.now')}
              </Typography>
            </Stack>
            {topWork && (
              <Chip
                size="small"
                variant="outlined"
                label={t(`page.priority.${topWork.priority}`)}
                sx={{ borderRadius: 0.25 }}
              />
            )}
          </Stack>
          {loading ? (
            <LoadingState label={t('page.loadingPriorities')} variant="skeleton" size="compact" />
          ) : workUnavailable ? (
            <ErrorState
              title={t('page.priorityLoadError')}
              retryLabel={t('page.retry')}
              onRetry={onRetry}
              retrying={fetching}
              size="compact"
            />
          ) : workForbidden ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t('dayRail.restricted')}
            </Typography>
          ) : topWork ? (
            <Box sx={{ mt: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography component="h3" sx={{ fontSize: 18, fontWeight: 600, lineHeight: '24px' }}>
                {topWork.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {topWork.reason ?? topWork.summary}
              </Typography>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{ mt: 'auto', pt: 1 }}
              >
                {topWork.dueAt && (
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(topWork.dueAt, { dateStyle: 'medium', timeStyle: 'short' })}
                  </Typography>
                )}
                <ActionButton
                  intent="quiet"
                  endIcon={<ArrowRight size={16} aria-hidden="true" />}
                  onClick={() => navigate(workspaceWorkItemRoute(topWork))}
                  sx={{ px: 0, ml: 'auto' }}
                >
                  {t('page.openPriority')}
                </ActionButton>
              </Stack>
            </Box>
          ) : (
            <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1.5 }}>
              <CheckCircle2 size={20} color="#0F8A78" aria-hidden="true" />
              <Box>
                <Typography variant="subtitle2">{t('page.clearTitle')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('page.clearDescription')}
                </Typography>
              </Box>
            </Stack>
          )}
        </Box>

        <Box sx={commandCard('#006A6A')}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <CalendarDays size={17} color="#006A6A" aria-hidden="true" />
              <Typography variant="overline" sx={{ color: '#434653' }}>
                {t('dayRail.next')}
              </Typography>
            </Stack>
            {calendar?.nextEvent && (
              <Typography variant="caption" sx={{ color: '#006A6A', fontWeight: 700 }}>
                {formatDate(calendar.nextEvent.startsAt, { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            )}
          </Stack>
          {loading ? (
            <LoadingState label={t('widgets.schedule.loading')} variant="skeleton" size="compact" />
          ) : calendarUnavailable ? (
            <ErrorState
              title={t('widgets.schedule.loadError')}
              retryLabel={t('page.retry')}
              onRetry={onRetry}
              retrying={fetching}
              size="compact"
            />
          ) : calendarForbidden ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t('dayRail.restricted')}
            </Typography>
          ) : calendar?.nextEvent ? (
            <Box sx={{ mt: 1 }}>
              <Typography component="h3" sx={{ fontSize: 18, fontWeight: 600, lineHeight: '24px' }}>
                {calendar.nextEvent.title}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: 'block' }}
              >
                {calendar.nextEvent.location || t('widgets.schedule.noLocation')}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t('dayRail.noNextEvent')}
            </Typography>
          )}
        </Box>

        <Box sx={commandCard('#7A3C00')}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Sparkles size={17} color="#7A3C00" aria-hidden="true" />
            <Typography variant="overline" sx={{ color: '#434653' }}>
              {t('dayRail.later')}
            </Typography>
          </Stack>
          {loading ? (
            <LoadingState label={t('widgets.brief.loading')} variant="skeleton" size="compact" />
          ) : recommendationUnavailable ? (
            <ErrorState
              title={t('dayRail.recommendationLoadError')}
              retryLabel={t('page.retry')}
              onRetry={onRetry}
              retrying={fetching}
              size="compact"
            />
          ) : recommendationForbidden ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t('dayRail.restricted')}
            </Typography>
          ) : recommendation ? (
            <Box sx={{ mt: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography component="h3" sx={{ fontSize: 18, fontWeight: 600, lineHeight: '24px' }}>
                {recommendation.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {recommendation.description}
              </Typography>
              <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 'auto', pt: 1 }}>
                <ActionButton
                  intent="quiet"
                  endIcon={<ArrowRight size={16} aria-hidden="true" />}
                  onClick={() => navigate(recommendation.actionPath)}
                  sx={{ px: 0 }}
                >
                  {t('dayRail.review')}
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
          ) : (
            <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1.5 }}>
              <Clock3 size={18} color="#64748B" aria-hidden="true" />
              <Typography variant="body2" color="text.secondary">
                {t('dayRail.noRecommendation')}
              </Typography>
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
